/** "Why matched" labels shared by filter search (S3) and ranked search (S5). */
import type { Candidate, CandidateSkill } from '@/db/schema';
import type { MatchReason, SearchFilters } from '@/lib/contracts';
import type { KeywordHit } from '@/lib/search/keyword';

const MAX_KEYWORD_TERMS = 4;

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** `$130,000` */
export const formatUsd = (amount: number) => usd.format(amount);

/** One `skill` reason per requested skill, from the candidate's own skill rows. */
export function skillReasons(skills: string[], own: CandidateSkill[]): MatchReason[] {
  return skills.map((skill) => ({
    kind: 'skill',
    label: skillLabel(own.find((row) => row.skill === skill)),
  }));
}

/** The `experience` reason, then `salary` and `country` when those filters are set. */
export function filterReasons(candidate: Candidate, filters: SearchFilters): MatchReason[] {
  const reasons: MatchReason[] = [
    { kind: 'experience', label: experienceLabel(candidate, filters) },
  ];
  if (filters.minSalary !== null || filters.maxSalary !== null) {
    reasons.push({ kind: 'salary', label: salaryLabel(candidate, filters) });
  }
  if (filters.countries.length > 0) {
    reasons.push({ kind: 'country', label: `Based in ${candidate.country}` });
  }
  return reasons;
}

/** `Resume mentions a, b` with the hit's snippet attached. */
export function keywordReason(hit: KeywordHit): MatchReason {
  return {
    kind: 'keyword',
    label: `Resume mentions ${snippetTerms(hit.snippet).join(', ')}`,
    snippet: hit.snippet,
  };
}

/** `Top k% resume match for “text”`; `percentile` is in [0, 1]. */
export function semanticReason(percentile: number, searchText: string): MatchReason {
  // Round away float noise first so that e.g. (1 − 0.97) × 100 gives 3, not 4.
  const topPercent = Math.round((1 - percentile) * 100 * 1e6) / 1e6;
  const k = Math.max(1, Math.ceil(topPercent));
  return { kind: 'semantic', label: `Top ${k}% resume match for “${searchText}”` };
}

/** Distinct lowercased highlighted words of a snippet, in order, at most 4. */
function snippetTerms(snippet: string): string[] {
  const terms = [...snippet.matchAll(/⟪(.*?)⟫/g)].map((match) => match[1].toLowerCase());
  return [...new Set(terms)].slice(0, MAX_KEYWORD_TERMS);
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
  const label = `${formatUsd((candidate.fullTimeRateNormalized ?? 0) * 12)}/yr`;
  if (minSalary !== null && maxSalary !== null) {
    return `${label}, within ${formatUsd(minSalary)}–${formatUsd(maxSalary)}`;
  }
  if (maxSalary !== null) return `${label}, under ${formatUsd(maxSalary)}`;
  return `${label}, over ${formatUsd(minSalary ?? 0)}`;
}
