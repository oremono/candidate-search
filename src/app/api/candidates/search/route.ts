import { count } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { candidateTable } from '@/db/schema';

/**
 * GET /api/candidates/search?q=...
 *
 * TODO: implement candidate search.
 *  - Accept structured filters (salary, years of experience, skills, country).
 *  - Accept a natural-language query, extract filters from it, and match
 *    against resumes (biography, experiences, education).
 *  - Return the top 10 candidates with a short explanation for each match.
 *
 * This stub only proves the database is wired up.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? '';
  const [{ total }] = await db.select({ total: count() }).from(candidateTable);

  return NextResponse.json({
    query,
    totalCandidates: total,
    results: [],
  });
}
