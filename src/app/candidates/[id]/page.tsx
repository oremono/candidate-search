import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProfileView } from '@/components/profile/profile-view';
import { getCandidateProfile } from '@/lib/profile';
import { highlightTermsFor } from '@/lib/skill-spellings';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ highlight?: string | string[] }>;
};

async function loadProfile(id: string) {
  return /^[1-9]\d*$/.test(id) ? getCandidateProfile(Number(id)) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await loadProfile((await params).id);
  return {
    title: profile ? `${profile.candidate.name} · Candidate Search` : 'Candidate not found',
  };
}

export default async function CandidatePage({ params, searchParams }: Props) {
  const profile = await loadProfile((await params).id);
  if (!profile) notFound();

  const { highlight } = await searchParams;
  const terms = [highlight ?? []]
    .flat()
    .flatMap((value) => value.split(','))
    .map((term) => term.trim())
    .filter(Boolean);

  return (
    <main className="flex w-full flex-1 flex-col py-8">
      <ProfileView profile={profile} highlight={highlightTermsFor(terms)} />
    </main>
  );
}
