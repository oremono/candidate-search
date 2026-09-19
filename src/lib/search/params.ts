import type { SearchFilters } from '@/lib/contracts';
import { SKILLS } from '@/lib/derive/skills';

export type ParseResult = { ok: true; filters: SearchFilters } | { ok: false; error: string };

type NumberKey = 'minYears' | 'maxYears' | 'minSalary' | 'maxSalary';

const SKILL_BY_LOWER = new Map(SKILLS.map((skill) => [skill.toLowerCase(), skill]));

/** Trims values, drops empties and dedupes case-insensitively, keeping the first spelling. */
function uniqueTrimmed(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of values) {
    const value = raw.trim();
    if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
  }
  return [...seen.values()];
}

/** Parses the filter query string (spec: docs/slices/S3-filter-search.md). */
export function parseSearchParams(params: URLSearchParams): ParseResult {
  const countries = uniqueTrimmed(params.getAll('country'));

  const skills: string[] = [];
  for (const value of uniqueTrimmed(params.getAll('skill'))) {
    const skill = SKILL_BY_LOWER.get(value.toLowerCase());
    if (!skill) return { ok: false, error: `Unknown skill: ${value}` };
    skills.push(skill);
  }

  const numbers = {} as Record<NumberKey, number | null>;
  for (const key of ['minYears', 'maxYears', 'minSalary', 'maxSalary'] as const) {
    const raw = params.get(key)?.trim() ?? '';
    const value = raw === '' ? null : Number(raw);
    if (value !== null && !(Number.isFinite(value) && value >= 0)) {
      return { ok: false, error: `Invalid ${key}` };
    }
    numbers[key] = value;
  }

  if (
    numbers.minYears !== null &&
    numbers.maxYears !== null &&
    numbers.minYears > numbers.maxYears
  ) {
    return { ok: false, error: 'minYears is greater than maxYears' };
  }
  if (
    numbers.minSalary !== null &&
    numbers.maxSalary !== null &&
    numbers.minSalary > numbers.maxSalary
  ) {
    return { ok: false, error: 'minSalary is greater than maxSalary' };
  }

  return { ok: true, filters: { countries, skills, ...numbers } };
}

/** The free-text query: trimmed `q`, or '' when absent or blank (spec: docs/slices/S4-nl-search.md). */
export function parseQueryParam(params: URLSearchParams): string {
  return params.get('q')?.trim() ?? '';
}
