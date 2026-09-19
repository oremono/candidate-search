/** URL query-string helpers for filter search. Spec: docs/slices/S3-filter-search.md. */
import type { SearchFilters } from '@/lib/contracts';

/** No constraints. Treat as read-only: every update builds a new object. */
export const EMPTY_FILTERS: SearchFilters = {
  countries: [],
  skills: [],
  minYears: null,
  maxYears: null,
  minSalary: null,
  maxSalary: null,
};

const NUMBER_KEYS = ['minYears', 'maxYears', 'minSalary', 'maxSalary'] as const;

/** Filters → query string without a leading '?'. Nulls and empty lists are left out. */
export function buildSearchQuery(filters: SearchFilters): string {
  const params = new URLSearchParams();
  for (const country of filters.countries) params.append('country', country);
  for (const skill of filters.skills) params.append('skill', skill);
  for (const key of NUMBER_KEYS) {
    const value = filters[key];
    if (value !== null) params.append(key, String(value));
  }
  return params.toString();
}
