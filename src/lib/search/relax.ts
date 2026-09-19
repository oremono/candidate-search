/** Dropping query-derived constraints one at a time when nothing matches (S5). */
import type { Relaxation, SearchFilters } from '@/lib/contracts';
import { formatUsd } from '@/lib/search/ranking-reasons';

type Field = keyof SearchFilters;

interface RelaxStep {
  filters: SearchFilters;
  relaxation: Relaxation;
}

const perYear = (amount: number) => `${formatUsd(amount)}/yr`;

/** The next constraint to drop from `filters`, or null when nothing relaxable is left. */
function nextStep(filters: SearchFilters, relaxable: ReadonlySet<Field>): RelaxStep | null {
  const step = (field: Field, changes: Partial<SearchFilters>, message: string): RelaxStep => ({
    filters: { ...filters, ...changes },
    relaxation: { field, message },
  });
  const { countries, maxSalary, minSalary, maxYears, minYears, skills } = filters;

  if (relaxable.has('countries') && countries.length > 0) {
    return step(
      'countries',
      { countries: [] },
      `No candidates in ${countries.join(' or ')} match, so country was ignored.`
    );
  }
  if (relaxable.has('maxSalary') && maxSalary !== null) {
    return step(
      'maxSalary',
      { maxSalary: null },
      `No candidates under ${perYear(maxSalary)} match, so the salary cap was ignored.`
    );
  }
  if (relaxable.has('minSalary') && minSalary !== null) {
    return step(
      'minSalary',
      { minSalary: null },
      `No candidates over ${perYear(minSalary)} match, so the salary minimum was ignored.`
    );
  }
  if (relaxable.has('maxYears') && maxYears !== null) {
    return step(
      'maxYears',
      { maxYears: null },
      `No candidates with at most ${maxYears} yrs match, so the experience cap was ignored.`
    );
  }
  if (relaxable.has('minYears') && minYears !== null) {
    return step(
      'minYears',
      { minYears: null },
      `No candidates with ${minYears}+ yrs match, so the experience minimum was ignored.`
    );
  }
  if (relaxable.has('skills') && skills.length > 0) {
    const skill = skills[skills.length - 1];
    return step(
      'skills',
      { skills: skills.slice(0, -1) },
      `No candidates have ${skill} alongside the other requirements, so ${skill} was ignored.`
    );
  }
  return null;
}

/**
 * Find the candidate set for `filters`; while it is empty, drop the next relaxable constraint
 * and try again. Returns the effective filters, the set and the relaxations made, in order.
 */
export async function relaxUntilFound<T>(
  filters: SearchFilters,
  relaxable: readonly Field[],
  find: (filters: SearchFilters) => Promise<T[]>
): Promise<{ filters: SearchFilters; set: T[]; relaxed: Relaxation[] }> {
  const allowed = new Set(relaxable);
  const relaxed: Relaxation[] = [];
  let current = filters;
  let set = await find(current);
  while (set.length === 0) {
    const step = nextStep(current, allowed);
    if (!step) break;
    current = step.filters;
    relaxed.push(step.relaxation);
    set = await find(current);
  }
  return { filters: current, set, relaxed };
}
