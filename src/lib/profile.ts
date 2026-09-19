import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  candidateSkillTable,
  candidateTable,
  educationTable,
  experienceTable,
  type Candidate,
  type CandidateSkill,
} from '@/db/schema';
import type {
  CandidateProfile,
  CandidateSummary,
  ProfileEducation,
  ProfileExperience,
  ProfileSkill,
} from '@/lib/contracts';
import { resolveJobs } from '@/lib/derive/experience';

const TOP_SKILLS = 8;

/** Candidate profile (spec: docs/slices/S6-profile-page.md). null for an unknown id. */
export async function getCandidateProfile(id: number): Promise<CandidateProfile | null> {
  const [candidates, experienceRows, educationRows, skillRows] = await Promise.all([
    db.select().from(candidateTable).where(eq(candidateTable.id, id)).limit(1),
    db
      .select()
      .from(experienceTable)
      .where(eq(experienceTable.candidateId, id))
      .orderBy(asc(experienceTable.id)),
    db
      .select()
      .from(educationTable)
      .where(eq(educationTable.candidateId, id))
      .orderBy(asc(educationTable.id)),
    db.select().from(candidateSkillTable).where(eq(candidateSkillTable.candidateId, id)),
  ]);
  const candidate = candidates[0];
  if (!candidate) return null;

  const resolved = resolveJobs(experienceRows, new Date());
  const experiences = byStartDesc(
    experienceRows.map((row, i): ProfileExperience => ({
      company: row.company,
      position: row.position,
      description: row.description ?? '',
      startDate: isoDate(row.startDate),
      endDate: isoDate(row.endDate),
      effectiveEndDate: isoDate(resolved[i].effectiveEndDate),
      counted: resolved[i].counted,
      excludedReason: resolved[i].excludedReason,
    })),
    experienceRows.map((row) => row.startDate)
  );

  const education = byStartDesc(
    educationRows.map((row): ProfileEducation => ({
      school: row.school,
      degree: row.degree.trim(),
      startDate: isoDate(row.startDate),
      endDate: isoDate(row.endDate),
    })),
    educationRows.map((row) => row.startDate)
  );

  const skills: ProfileSkill[] = sortSkills(skillRows).map((row) => ({
    name: row.skill,
    inBio: row.inBio,
    roleCount: row.roleCount,
  }));

  return {
    candidate: toSummary(
      candidate,
      skills.slice(0, TOP_SKILLS).map((skill) => skill.name)
    ),
    partTimeMonthlyRate: candidate.partTimeRateNormalized,
    experiences,
    education,
    skills,
  };
}

/** UTC `YYYY-MM-DD`, or null. */
const isoDate = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

/** Newest start first, null starts last; stable, so ties keep input order. */
function byStartDesc<T>(items: T[], starts: (Date | null)[]): T[] {
  const time = (i: number) => starts[i]?.getTime() ?? -Infinity;
  return items
    .map((_, i) => i)
    .sort((a, b) => (time(a) === time(b) ? 0 : time(b) > time(a) ? 1 : -1))
    .map((i) => items[i]);
}

/** Strongest evidence first (roles + bio), then by name using the default JS sort order. */
function sortSkills(rows: CandidateSkill[]): CandidateSkill[] {
  const strength = (row: CandidateSkill) => row.roleCount + (row.inBio ? 1 : 0);
  return [...rows].sort(
    (a, b) => strength(b) - strength(a) || (a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0)
  );
}

// Private copy of the S3 CandidateSummary mapping; merged into one helper after wave 2.
function toSummary(candidate: Candidate, topSkills: string[]): CandidateSummary {
  return {
    id: candidate.id,
    name: `${candidate.firstName} ${candidate.lastName}`,
    country: candidate.country,
    yearsExperience: candidate.yearsExperience,
    monthlyRate: candidate.fullTimeRateNormalized,
    rateUnverified: candidate.rateUnverified,
    availability: {
      fullTime: candidate.fullTime,
      partTime: candidate.partTime,
      contractor: candidate.contractor,
      employee: candidate.employee,
    },
    biography: candidate.biography ?? '',
    topSkills,
  };
}
