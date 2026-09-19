import { NextResponse } from 'next/server';
import type { FilterOptions } from '@/lib/contracts';
import { getFilterOptions } from '@/lib/search/filter-search';

/** GET /api/candidates/filters → 200 FilterOptions (countries and skills with counts). */
export async function GET() {
  return NextResponse.json<FilterOptions>(await getFilterOptions());
}
