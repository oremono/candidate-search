import { NextResponse } from 'next/server';
import type { ApiError, CandidateProfile } from '@/lib/contracts';
import { getCandidateProfile } from '@/lib/profile';

/**
 * GET /api/candidates/:id → 200 CandidateProfile | 400 ApiError | 404 ApiError.
 * Spec: docs/slices/S6-profile-page.md.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) {
    return NextResponse.json<ApiError>({ error: 'Invalid candidate id' }, { status: 400 });
  }
  const profile = await getCandidateProfile(Number(id));
  if (!profile) {
    return NextResponse.json<ApiError>({ error: 'Candidate not found' }, { status: 404 });
  }
  return NextResponse.json<CandidateProfile>(profile);
}
