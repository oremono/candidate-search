import { and, asc, count, desc, eq, gte, inArray, lte, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { candidateSkillTable, candidateTable, type CandidateSkill } from '@/db/schema';
import { toCandidateSummary } from '@/lib/candidate-summary';
import type {
  FilterOptions,
  MatchReason,
  ParsedQuery,
  SearchFilters,
  SearchResponse,
  SearchResult,
} from '@/lib/contracts';
import { embed } from '@/lib/openai';
import {
  keywordSignal,
  rank,
  semanticSignal,
  skillSignal,
  type SetMember,
  type Signals,
} from '@/lib/search/ranking';
import {
  filterReasons,
  keywordReason,
  semanticReason,
  skillReasons,
} from '@/lib/search/ranking-reasons';
import { relaxUntilFound } from '@/lib/search/relax';

const TOP_N = 10;
/** Percentile from which a candidate gets a semantic reason. */
const SEMANTIC_REASON_PERCENTILE = 0.9;

export interface SearchOptions {
  /** Parsed free-text query (S4). Absent/null → plain S3 filter search. */
  query?: ParsedQuery | null;
  /** The raw query text, echoed as `response.query` (trimmed). */
  queryText?: string;
  /** Filter fields that came from the query and may be dropped if nothing matches. */
  relaxable?: (keyof SearchFilters)[];
  /** Embeds text for semantic search. Default: `embed()` from src/lib/openai.ts. Injectable for tests. */
  embedQuery?: (text: string) => Promise<number[]>;
}

const embedOne = async (text: string) => (await embed([text]))[0];

/**
 * Candidate search. Without a query: filter search, top 10 by skill score
 * (docs/slices/S3-filter-search.md). With a query: hard filters (relaxed if nothing matches),
 * then ranking by semantic, keyword and skill signals (docs/slices/S5-ranking-explanations.md).
 */
export async function searchCandidates(
  filters: SearchFilters,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  return options.query ? rankedSearch(filters, options.query, options) : filterSearch(filters);
}

// --- shared SQL ---------------------------------------------------------------

/** WHERE conditions for everything except skills. */
function filterConditions(filters: SearchFilters): SQL | undefined {
  const c = candidateTable;
  const { countries, minYears, maxYears, minSalary, maxSalary } = filters;
  const conditions: (SQL | undefined)[] = [];
  if (countries.length > 0) {
    conditions.push(
      inArray(
        sql`lower(${c.country})`,
        countries.map((country) => country.toLowerCase())
      )
    );
  }
  if (minYears !== null) conditions.push(gte(c.yearsExperience, minYears));
  if (maxYears !== null) conditions.push(lte(c.yearsExperience, maxYears));
  if (minSalary !== null || maxSalary !== null) {
    const annual = sql`${c.fullTimeRateNormalized} * 12`;
    conditions.push(eq(c.rateUnverified, false));
    if (minSalary !== null) conditions.push(gte(annual, minSalary));
    if (maxSalary !== null) conditions.push(lte(annual, maxSalary));
  }
  return and(...conditions);
}

/** Candidates with every requested skill, scored by summed evidence strength. */
function skillMatches(skills: string[]) {
  const cs = candidateSkillTable;
  return db
    .select({
      candidateId: cs.candidateId,
      score: sql<number>`sum(${cs.roleCount} + ${cs.inBio})`.as('score'),
    })
    .from(cs)
    .where(inArray(cs.skill, skills))
    .groupBy(cs.candidateId)
    .having(sql`count(*) = ${skills.length}`)
    .as('matched');
}

/** Skill rows of the given candidates, grouped by candidate id. */
async function skillRowsFor(ids: number[]): Promise<Map<number, CandidateSkill[]>> {
  const byCandidate = new Map<number, CandidateSkill[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return byCandidate;
  const cs = candidateSkillTable;
  const rows = await db.select().from(cs).where(inArray(cs.candidateId, ids));
  for (const row of rows) byCandidate.get(row.candidateId)?.push(row);
  return byCandidate;
}

// --- without a query (S3) -------------------------------------------------------

async function filterSearch(filters: SearchFilters): Promise<SearchResponse> {
  const c = candidateTable;
  const { skills } = filters;
  const matched = skillMatches(skills);

  // With no skills every score is 0, so the order starts at years of experience.
  const hasSkills = skills.length > 0;
  const score = hasSkills ? matched.score : sql<number>`0`;
  const base = db
    .select({ candidate: c, score, total: sql<number>`count(*) over ()` })
    .from(c)
    .$dynamic();
  if (hasSkills) base.innerJoin(matched, eq(matched.candidateId, c.id));

  const rows = await base
    .where(filterConditions(filters))
    .orderBy(...(hasSkills ? [desc(score)] : []), desc(c.yearsExperience), asc(c.id))
    .limit(TOP_N);

  const skillRows = await skillRowsFor(rows.map((row) => row.candidate.id));
  const results = rows.map(({ candidate, score }) => {
    const own = skillRows.get(candidate.id) ?? [];
    return {
      candidate: toCandidateSummary(candidate, own),
      score: Number(score),
      matchedSkills: [...skills],
      reasons: [...skillReasons(skills, own), ...filterReasons(candidate, filters)],
    };
  });

  return {
    query: null,
    interpretation: null,
    relaxed: [],
    filters,
    total: rows[0]?.total ?? 0,
    results,
  };
}

// --- with a query (S5) ----------------------------------------------------------

/** Every candidate passing the hard filters, with its raw skill score. No top-N cut. */
async function candidateSet(filters: SearchFilters): Promise<SetMember[]> {
  const c = candidateTable;
  const hasSkills = filters.skills.length > 0;
  const matched = skillMatches(filters.skills);
  const base = db
    .select({
      id: c.id,
      yearsExperience: c.yearsExperience,
      skillScore: hasSkills ? matched.score : sql<number>`0`,
    })
    .from(c)
    .$dynamic();
  if (hasSkills) base.innerJoin(matched, eq(matched.candidateId, c.id));
  const rows = await base.where(filterConditions(filters));
  return rows.map((row) => ({ ...row, skillScore: Number(row.skillScore) }));
}

async function rankedSearch(
  requested: SearchFilters,
  query: ParsedQuery,
  options: SearchOptions
): Promise<SearchResponse> {
  // The semantic signal doesn't depend on the filters, so it runs alongside them.
  const semantic = semanticSignal(query.searchText, options.embedQuery ?? embedOne);
  const { filters, set, relaxed } = await relaxUntilFound(
    requested,
    options.relaxable ?? [],
    candidateSet
  );
  const ids = set.map((member) => member.id);
  const [keyword, semanticPercentiles] = await Promise.all([
    keywordSignal(query.keywords, ids),
    semantic,
  ]);
  const signals: Signals = {
    skill: skillSignal(set, filters.skills.length > 0),
    keyword,
    semantic: semanticPercentiles,
  };

  const ranked = rank(set, signals, TOP_N);
  const results = await loadResults(ranked, filters, signals, query.searchText);

  return {
    query: options.queryText !== undefined ? options.queryText.trim() : query.searchText,
    interpretation: query,
    relaxed,
    filters,
    total: set.length,
    results,
  };
}

/** Rows and skills for the ranked ids (one query each), with S5 reasons, in rank order. */
async function loadResults(
  ranked: { id: number; score: number }[],
  filters: SearchFilters,
  signals: Signals,
  searchText: string
): Promise<SearchResult[]> {
  if (ranked.length === 0) return [];
  const ids = ranked.map((entry) => entry.id);
  const [rows, skillRows] = await Promise.all([
    db.select().from(candidateTable).where(inArray(candidateTable.id, ids)),
    skillRowsFor(ids),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ranked.flatMap(({ id, score }) => {
    const candidate = byId.get(id);
    if (!candidate) return [];
    const own = skillRows.get(id) ?? [];
    const reasons: MatchReason[] = skillReasons(filters.skills, own);
    const hit = signals.keyword?.get(id);
    if (hit) reasons.push(keywordReason(hit));
    const percentile = signals.semantic?.get(id);
    if (percentile !== undefined && percentile >= SEMANTIC_REASON_PERCENTILE) {
      reasons.push(semanticReason(percentile, searchText));
    }
    reasons.push(...filterReasons(candidate, filters));
    return [
      {
        candidate: toCandidateSummary(candidate, own),
        score,
        matchedSkills: [...filters.skills],
        reasons,
      },
    ];
  });
}

// --- filter options -------------------------------------------------------------

/** Countries (except "-") and skills with candidate counts, most common first. */
export async function getFilterOptions(): Promise<FilterOptions> {
  const c = candidateTable;
  const cs = candidateSkillTable;
  const countries = await db
    .select({ name: c.country, count: count() })
    .from(c)
    .where(ne(c.country, '-'))
    .groupBy(c.country)
    .orderBy(desc(count()), asc(c.country));
  const skills = await db
    .select({ name: cs.skill, count: count() })
    .from(cs)
    .groupBy(cs.skill)
    .orderBy(desc(count()), asc(cs.skill));
  return { countries, skills };
}
