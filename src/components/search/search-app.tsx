'use client';

import type { ApiError, FilterOptions, SearchFilters, SearchResponse } from '@/lib/contracts';
import { buildSearchQuery } from '@/lib/search-query';
import { SearchPage } from './search-page';

/** Calls the search API; turns an error response into a thrown Error for SearchPage. */
async function fetchResults(filters: SearchFilters): Promise<SearchResponse> {
  const response = await fetch(`/api/candidates/search?${buildSearchQuery(filters)}`);
  const body: SearchResponse | ApiError = await response.json();
  if (!response.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : `Search failed (${response.status})`);
  }
  return body;
}

/** SearchPage wired to the real API. Lives client-side because fetchers aren't serializable. */
export function SearchApp(props: { options: FilterOptions; initialFilters: SearchFilters }) {
  return <SearchPage {...props} fetchResults={fetchResults} />;
}
