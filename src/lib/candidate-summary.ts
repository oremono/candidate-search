import type { Candidate, CandidateSkill } from '@/db/schema';
import type { CandidateSummary } from '@/lib/contracts';

const TOP_SKILLS = 8;

/** Evidence strength of one skill row: roles mentioning it, plus one for the bio. */
const strength = (row: CandidateSkill) => row.roleCount + (row.inBio ? 1 : 0);

/** Strongest evidence first, then by name (default JS sort order). */
export function sortSkillRows(rows: CandidateSkill[]): CandidateSkill[] {
  return [...rows].sort(
    (a, b) => strength(b) - strength(a) || (a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0)
  );
}

/** API-facing summary of a candidate; `skills` are that candidate's skill rows. */
export function toCandidateSummary(
  candidate: Candidate,
  skills: CandidateSkill[]
): CandidateSummary {
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
    topSkills: sortSkillRows(skills)
      .slice(0, TOP_SKILLS)
      .map((row) => row.skill),
  };
}
