import type { SearchFilters } from '@/lib/contracts';

/** In SearchFilters field order, which is also the order of `fromQuery`. */
const FIELDS = [
  'countries',
  'skills',
  'minYears',
  'maxYears',
  'minSalary',
  'maxSalary',
] as const satisfies readonly (keyof SearchFilters)[];

const isSet = (value: string[] | number | null) =>
  Array.isArray(value) ? value.length > 0 : value !== null;

/** Explicit filters win field by field; returns merged filters and the fields that came from the query. */
export function mergeFilters(
  explicit: SearchFilters,
  parsed: SearchFilters
): { filters: SearchFilters; fromQuery: (keyof SearchFilters)[] } {
  const filters = { ...explicit };
  const fromQuery: (keyof SearchFilters)[] = [];
  for (const field of FIELDS) {
    if (isSet(explicit[field]) || !isSet(parsed[field])) continue;
    Object.assign(filters, { [field]: parsed[field] });
    fromQuery.push(field);
  }
  return { filters, fromQuery };
}
