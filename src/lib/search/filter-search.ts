import { and, asc, count, desc, eq, gte, inArray, lte, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  candidateSkillTable,
  candidateTable,
  type Candidate,
  type CandidateSkill,
} from '@/db/schema';
import { toCandidateSummary } from '@/lib/candidate-summary';
import type { FilterOptions, MatchReason, SearchFilters, SearchResponse } from '@/lib/contracts';

const TOP_N = 10;

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Filter search (spec: docs/slices/S3-filter-search.md). Top 10 by skill score. */
export async function searchCandidates(filters: SearchFilters): Promise<SearchResponse> {
  const c = candidateTable;
  const cs = candidateSkillTable;
  const { countries, skills, minYears, maxYears, minSalary, maxSalary } = filters;

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

  // Candidates with every requested skill, scored by summed evidence strength.
  const matched = db
    .select({
      candidateId: cs.candidateId,
      score: sql<number>`sum(${cs.roleCount} + ${cs.inBio})`.as('score'),
    })
    .from(cs)
    .where(inArray(cs.skill, skills))
    .groupBy(cs.candidateId)
    .having(sql`count(*) = ${skills.length}`)
    .as('matched');

  // With no skills every score is 0, so the order starts at years of experience.
  const hasSkills = skills.length > 0;
  const score = hasSkills ? matched.score : sql<number>`0`;
  const base = db
    .select({ candidate: c, score, total: sql<number>`count(*) over ()` })
    .from(c)
    .$dynamic();
  if (hasSkills) base.innerJoin(matched, eq(matched.candidateId, c.id));

  const rows = await base
    .where(and(...conditions))
    .orderBy(...(hasSkills ? [desc(score)] : []), desc(c.yearsExperience), asc(c.id))
    .limit(TOP_N);

  const skillRows = rows.length
    ? await db
        .select()
        .from(cs)
        .where(
          inArray(
            cs.candidateId,
            rows.map((row) => row.candidate.id)
          )
        )
    : [];

  const results = rows.map(({ candidate, score }) => {
    const own = skillRows.filter((row) => row.candidateId === candidate.id);
    const reasons: MatchReason[] = skills.map((skill) => ({
      kind: 'skill',
      label: skillLabel(own.find((row) => row.skill === skill)),
    }));
    reasons.push({ kind: 'experience', label: experienceLabel(candidate, filters) });
    if (minSalary !== null || maxSalary !== null) {
      reasons.push({ kind: 'salary', label: salaryLabel(candidate, filters) });
    }
    if (countries.length > 0) {
      reasons.push({ kind: 'country', label: `Based in ${candidate.country}` });
    }
    return {
      candidate: toCandidateSummary(candidate, own),
      score: Number(score),
      matchedSkills: [...skills],
      reasons,
    };
  });

  return { filters, total: rows[0]?.total ?? 0, results };
}

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

function skillLabel(row: CandidateSkill | undefined): string {
  if (!row) return '';
  const roles = `${row.roleCount} ${row.roleCount === 1 ? 'role' : 'roles'}`;
  if (row.roleCount > 0) return `${row.skill} in ${roles}${row.inBio ? ' and bio' : ''}`;
  return `${row.skill} in bio`;
}

function experienceLabel(candidate: Candidate, { minYears, maxYears }: SearchFilters): string {
  const label = `${candidate.yearsExperience} yrs experience`;
  if (minYears !== null && maxYears !== null) return `${label} (${minYears}–${maxYears})`;
  if (minYears !== null) return `${label} (min ${minYears})`;
  if (maxYears !== null) return `${label} (max ${maxYears})`;
  return label;
}

function salaryLabel(candidate: Candidate, { minSalary, maxSalary }: SearchFilters): string {
  const label = `${usd.format((candidate.fullTimeRateNormalized ?? 0) * 12)}/yr`;
  if (minSalary !== null && maxSalary !== null) {
    return `${label}, within ${usd.format(minSalary)}–${usd.format(maxSalary)}`;
  }
  if (maxSalary !== null) return `${label}, under ${usd.format(maxSalary)}`;
  return `${label}, over ${usd.format(minSalary ?? 0)}`;
}
