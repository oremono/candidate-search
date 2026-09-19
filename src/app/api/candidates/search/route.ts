import { NextResponse } from 'next/server';
import type { ApiError, SearchResponse } from '@/lib/contracts';
import { searchCandidates } from '@/lib/search/filter-search';
import { mergeFilters } from '@/lib/search/merge';
import { parseQueryParam, parseSearchParams } from '@/lib/search/params';
import { parseQuery } from '@/lib/search/query-parser';

/**
 * GET /api/candidates/search?q=…&country=…&skill=…&minYears=…&maxYears=…&minSalary=…&maxSalary=…
 * → 200 SearchResponse | 400 ApiError | 500 ApiError.
 * Specs: docs/slices/S3-filter-search.md, docs/slices/S4-nl-search.md.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const explicit = parseSearchParams(params);
  if (!explicit.ok) {
    return NextResponse.json<ApiError>({ error: explicit.error }, { status: 400 });
  }

  try {
    const q = parseQueryParam(params);
    const parsed = q ? await parseQuery(q) : null;
    if (!parsed) {
      return NextResponse.json<SearchResponse>(await searchCandidates(explicit.filters));
    }

    const { filters, fromQuery } = mergeFilters(explicit.filters, parsed.filters);
    return NextResponse.json<SearchResponse>(
      await searchCandidates(filters, { query: parsed, queryText: q, relaxable: fromQuery })
    );
  } catch (error) {
    console.error('Search failed', error);
    return NextResponse.json<ApiError>({ error: 'Search failed' }, { status: 500 });
  }
}
