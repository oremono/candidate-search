/**
 * URL query-string helpers for filter and natural-language search.
 * Spec: docs/slices/S3-filter-search.md, docs/slices/S4-nl-search.md.
 */
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

/**
 * Filters (and an optional free-text query) → query string without a leading '?'.
 * The trimmed query goes first as `q`; a blank one is left out. Nulls and empty lists are too.
 */
export function buildSearchQuery(filters: SearchFilters, q?: string): string {
  const params = new URLSearchParams();
  const query = q?.trim() ?? '';
  if (query !== '') params.append('q', query);
  for (const country of filters.countries) params.append('country', country);
  for (const skill of filters.skills) params.append('skill', skill);
  for (const key of NUMBER_KEYS) {
    const value = filters[key];
    if (value !== null) params.append(key, String(value));
  }
  return params.toString();
}
