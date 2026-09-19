import { NextResponse } from 'next/server';
import type { ApiError, SearchResponse } from '@/lib/contracts';
import { searchCandidates } from '@/lib/search/filter-search';
import { parseSearchParams } from '@/lib/search/params';

/**
 * GET /api/candidates/search?country=…&skill=…&minYears=…&maxYears=…&minSalary=…&maxSalary=…
 * → 200 SearchResponse | 400 ApiError. Spec: docs/slices/S3-filter-search.md.
 * The `q` parameter is ignored until S4.
 */
export async function GET(request: Request) {
  const parsed = parseSearchParams(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json<ApiError>({ error: parsed.error }, { status: 400 });
  }
  return NextResponse.json<SearchResponse>(await searchCandidates(parsed.filters));
}
