/**
 * Natural-language query → ParsedQuery (spec: docs/slices/S4-nl-search.md).
 * Uses the LLM when available and falls back to the rule-based parser on any failure.
 */
import { z } from 'zod';
import type { ParsedQuery, Seniority } from '@/lib/contracts';
import { SKILLS, extractSkills } from '@/lib/derive/skills';
import { CHAT_MODEL, getOpenAI } from '@/lib/openai';
import { canonicalCountry } from './countries';
import { parseQueryWithRules } from './rules-parser';

export interface RawParsedQuery {
  skills: string[];
  countries: string[];
  minYears: number | null;
  maxYears: number | null;
  minSalary: number | null; // annual USD
  maxSalary: number | null;
  seniority: Seniority | null;
  keywords: string[];
  searchText: string;
}

/** Returns the model's JSON text for the query. Injectable for tests. */
export type CompleteFn = (q: string) => Promise<string>;

// --- normalization (shared by both parsers) ---------------------------------

const SENIORITIES = ['junior', 'mid', 'senior', 'lead'] as const satisfies readonly Seniority[];

/** Years implied by a seniority word, used only when the query gives no years. */
const SENIORITY_YEARS: Record<Seniority, { minYears: number | null; maxYears: number | null }> = {
  junior: { minYears: null, maxYears: 3 },
  mid: { minYears: 3, maxYears: 7 },
  senior: { minYears: 5, maxYears: null },
  lead: { minYears: 8, maxYears: null },
};

/**
 * Domain areas rather than tools. When the query also names a concrete skill, these rank
 * (as keywords) instead of filtering; on their own ("ML engineer") they stay required skills.
 */
const DOMAIN_SKILLS: ReadonlySet<string> = new Set([
  'AI',
  'Machine Learning',
  'NLP',
  'LLM',
  'Blockchain',
]);

const SKILL_BY_LOWER = new Map(SKILLS.map((skill) => [skill.toLowerCase(), skill]));

const unique = <T>(values: T[]) => [...new Set(values)];

const titleCase = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());

const validNumber = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;

/** Orders a min/max pair, swapping when min > max. */
function ordered(min: number | null, max: number | null): [number | null, number | null] {
  return min !== null && max !== null && min > max ? [max, min] : [min, max];
}

export function normalizeParsed(raw: RawParsedQuery, source: 'llm' | 'rules'): ParsedQuery {
  const skills: string[] = [];
  const unmatchedTerms: string[] = [];
  for (const term of raw.skills) {
    const exact = SKILL_BY_LOWER.get(term.trim().toLowerCase());
    const matches = exact ? [exact] : extractSkills(term);
    if (matches.length > 0) skills.push(...matches);
    else unmatchedTerms.push(term);
  }

  const countries = unique(
    raw.countries
      .filter((name) => name.trim() !== '')
      .map((name) => canonicalCountry(name) ?? titleCase(name))
  );

  let [minYears, maxYears] = ordered(validNumber(raw.minYears), validNumber(raw.maxYears));
  const [minSalary, maxSalary] = ordered(validNumber(raw.minSalary), validNumber(raw.maxSalary));

  const seniority = SENIORITIES.find((s) => s === raw.seniority) ?? null;
  if (seniority && minYears === null && maxYears === null) {
    ({ minYears, maxYears } = SENIORITY_YEARS[seniority]);
  }

  let uniqueSkills = unique(skills);
  let domainTerms: string[] = [];
  if (uniqueSkills.some((skill) => !DOMAIN_SKILLS.has(skill))) {
    domainTerms = uniqueSkills.filter((skill) => DOMAIN_SKILLS.has(skill));
    uniqueSkills = uniqueSkills.filter((skill) => !DOMAIN_SKILLS.has(skill));
  }

  const taken = new Set([...uniqueSkills, ...countries].map((s) => s.toLowerCase()));
  const keywords = unique(
    [...raw.keywords, ...unmatchedTerms, ...domainTerms].map((k) => k.trim().toLowerCase())
  ).filter((k) => k !== '' && !taken.has(k));

  const searchText = raw.searchText.trim() || [...uniqueSkills, ...keywords].join(' ');

  return {
    filters: { countries, skills: uniqueSkills, minYears, maxYears, minSalary, maxSalary },
    keywords,
    searchText,
    seniority,
    source,
  };
}

// --- LLM ----------------------------------------------------------------------

const RawParsedQuerySchema = z.object({
  skills: z.array(z.string()),
  countries: z.array(z.string()),
  minYears: z.number().nullable(),
  maxYears: z.number().nullable(),
  minSalary: z.number().nullable(),
  maxSalary: z.number().nullable(),
  seniority: z.enum(SENIORITIES).nullable(),
  keywords: z.array(z.string()),
  searchText: z.string(),
});

const nullableNumber = { type: ['number', 'null'] };
const stringArray = { type: 'array', items: { type: 'string' } };

/** Strict JSON schema for OpenAI structured output; mirrors RawParsedQuerySchema. */
const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'skills',
    'countries',
    'minYears',
    'maxYears',
    'minSalary',
    'maxSalary',
    'seniority',
    'keywords',
    'searchText',
  ],
  properties: {
    skills: stringArray,
    countries: stringArray,
    minYears: nullableNumber,
    maxYears: nullableNumber,
    minSalary: nullableNumber,
    maxSalary: nullableNumber,
    seniority: { type: ['string', 'null'], enum: [...SENIORITIES, null] },
    keywords: stringArray,
    searchText: { type: 'string' },
  },
};

const SYSTEM_PROMPT = `You turn a recruiter's search for software engineers into JSON filters.

Fields:
- skills: technologies the candidate must have (languages, frameworks, cloud, databases, ML/AI). Prefer these canonical names: ${SKILLS.join(', ')}. "AI/ML" means both AI and Machine Learning. Domain areas (AI, Machine Learning, NLP, LLM, Blockchain) are fine to list here; normalization decides whether they filter or only rank.
- countries: countries the candidate must be in, as full English names ("Canada", "United States"). Only explicit countries; regions like "LATAM" or "Europe" go to keywords.
- minYears / maxYears: years of experience. "5+ years" → minYears 5. "under 3 years" → maxYears 3. Null when not stated; do not infer from seniority.
- minSalary / maxSalary: annual salary in USD. "130k" = 130000. Monthly amounts ("$8k/month") are multiplied by 12. "under 130k" → maxSalary; "over 60k" → minSalary. Null when not stated.
- seniority: junior, mid, senior or lead (lead also covers staff and principal), or null.
- keywords: lowercase words to find in resumes that no other field covers: domains, topics and regions, e.g. "fintech", "payments", "backend", "healthcare", "latam". No filler words, no skills, no countries.
- searchText: a short phrase describing the person: role, stack and domain, keeping seniority. Leave out location, salary and filler ("someone good with"). Example: "Senior React engineer in Canada under 130k" → "Senior React engineer".

Use empty arrays and nulls for anything not in the query. Never invent constraints.`;

const LLM_TIMEOUT_MS = 6000;

function hasApiKey(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && !key.includes('REPLACE_ME'));
}

/** Default CompleteFn: OpenAI chat completion with strict structured output. */
const completeWithOpenAI: CompleteFn = async (q) => {
  const response = await getOpenAI().chat.completions.create(
    {
      model: CHAT_MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: q },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'parsed_query', strict: true, schema: RESPONSE_JSON_SCHEMA },
      },
    },
    { signal: AbortSignal.timeout(LLM_TIMEOUT_MS), maxRetries: 0 }
  );
  const content = response.choices[0]?.message.content;
  if (!content) throw new Error('Empty completion');
  return content;
};

// --- cache ------------------------------------------------------------------

const CACHE_LIMIT = 200;

/** Map with insertion-order eviction: the oldest entry goes first once full. */
class BoundedCache<V> {
  private readonly entries = new Map<string, V>();
  constructor(private readonly limit: number) {}

  get(key: string): V | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.limit) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }
}

/** One cache per CompleteFn, so an injected parser never sees results from another. */
const caches = new WeakMap<CompleteFn, BoundedCache<ParsedQuery>>();
/** Stands in for "no LLM available" in the cache map. */
const NO_LLM: CompleteFn = () => Promise.reject(new Error('OPENAI_API_KEY is not set'));

function cacheFor(complete: CompleteFn): BoundedCache<ParsedQuery> {
  let cache = caches.get(complete);
  if (!cache) {
    cache = new BoundedCache(CACHE_LIMIT);
    caches.set(complete, cache);
  }
  return cache;
}

// --- entry point --------------------------------------------------------------

async function parseWithLlm(q: string, complete: CompleteFn): Promise<ParsedQuery> {
  const raw = RawParsedQuerySchema.parse(JSON.parse(await complete(q)));
  return normalizeParsed(raw, 'llm');
}

/** Parses a free-text query; null for a blank one. Never throws. */
export async function parseQuery(
  q: string,
  options: { complete?: CompleteFn } = {}
): Promise<ParsedQuery | null> {
  const query = q.trim();
  if (query === '') return null;

  const complete = options.complete ?? (hasApiKey() ? completeWithOpenAI : NO_LLM);
  const cache = cacheFor(complete);
  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  let parsed: ParsedQuery;
  try {
    parsed = complete === NO_LLM ? parseQueryWithRules(query) : await parseWithLlm(query, complete);
  } catch {
    parsed = parseQueryWithRules(query);
  }
  cache.set(key, parsed);
  return parsed;
}
