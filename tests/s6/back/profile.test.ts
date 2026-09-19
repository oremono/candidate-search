import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCandidateProfile } from '@/lib/profile';
import type { CandidateProfile } from '@/lib/contracts';

// S6-back test list, cases 1-7. Runs against the real local.db (after `npm run db:seed`).
// Ids are found with raw SQL so the tests don't depend on seed order.
const dbPath = path.resolve(process.cwd(), 'local.db');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Drizzle `timestamp` columns are stored as unix seconds. null stays null. */
function isoFromSeconds(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return new Date(Number(value) * 1000).toISOString().slice(0, 10);
}

function expectIsoOrNull(value: string | null) {
  if (value !== null) expect(value).toMatch(ISO_DATE);
}

describe.skipIf(!fs.existsSync(dbPath))('S6-back getCandidateProfile (local.db)', () => {
  let client: Client;

  /** The candidate with the most experiences (ties → lowest id). */
  let mostExpId: number;
  let mostExpCount: number;
  let mostExpProfile: CandidateProfile | null;

  /** A candidate with both null and non-null experience start dates. */
  let mixedStartId: number;
  let mixedStartProfile: CandidateProfile | null;

  async function sqlExperiences(candidateId: number) {
    const res = await client.execute({
      sql: `SELECT id, company, position, start_date, end_date
            FROM experiences WHERE candidate_id = ?
            ORDER BY start_date IS NULL, start_date DESC, id ASC`,
      args: [candidateId],
    });
    return res.rows.map((r) => ({
      company: String(r.company),
      position: String(r.position),
      startDate: isoFromSeconds(r.start_date),
      endDate: isoFromSeconds(r.end_date),
    }));
  }

  beforeAll(async () => {
    client = createClient({ url: `file:${dbPath}` });

    const most = await client.execute(
      `SELECT candidate_id, COUNT(*) AS n FROM experiences
       GROUP BY candidate_id ORDER BY n DESC, candidate_id ASC LIMIT 1`
    );
    mostExpId = Number(most.rows[0].candidate_id);
    mostExpCount = Number(most.rows[0].n);
    mostExpProfile = await getCandidateProfile(mostExpId);

    const mixed = await client.execute(
      `SELECT candidate_id, SUM(start_date IS NULL) AS nulls, COUNT(*) AS n FROM experiences
       GROUP BY candidate_id HAVING nulls > 0 AND nulls < n
       ORDER BY nulls DESC, n DESC, candidate_id ASC LIMIT 1`
    );
    mixedStartId = Number(mixed.rows[0].candidate_id);
    mixedStartProfile = await getCandidateProfile(mixedStartId);
  });

  afterAll(() => {
    client?.close();
  });

  it('1. candidate with the most experiences: count and yearsExperience match SQL', async () => {
    expect(mostExpProfile).not.toBeNull();
    const profile = mostExpProfile!;
    expect(profile.candidate.id).toBe(mostExpId);
    expect(profile.experiences).toHaveLength(mostExpCount);

    const row = await client.execute({
      sql: 'SELECT years_experience FROM candidates WHERE id = ?',
      args: [mostExpId],
    });
    expect(profile.candidate.yearsExperience).toBe(Number(row.rows[0].years_experience));

    // description null → '' (always a string)
    for (const exp of profile.experiences) expect(typeof exp.description).toBe('string');
  });

  it('2. experiences are ordered by start date newest first, null starts last', async () => {
    for (const [id, profile] of [
      [mostExpId, mostExpProfile],
      [mixedStartId, mixedStartProfile],
    ] as const) {
      expect(profile).not.toBeNull();
      const exps = profile!.experiences;

      // Pairwise: non-increasing start dates; once a null appears, only nulls follow.
      let seenNull = false;
      for (let i = 0; i < exps.length; i++) {
        const start = exps[i].startDate;
        if (start === null) {
          seenNull = true;
          continue;
        }
        expect(seenNull, `non-null start after a null start (candidate ${id})`).toBe(false);
        if (i > 0 && exps[i - 1].startDate !== null) {
          expect(exps[i - 1].startDate! >= start).toBe(true);
        }
      }

      // Exact sequence: newest first, nulls last, ties in database id order.
      const expected = await sqlExperiences(id);
      expect(
        exps.map((e) => ({
          company: e.company,
          position: e.position,
          startDate: e.startDate,
          endDate: e.endDate,
        }))
      ).toEqual(expected);
    }

    // The mixed candidate really has null starts at the end.
    const mixed = mixedStartProfile!.experiences;
    expect(mixed[mixed.length - 1].startDate).toBeNull();
    expect(mixed[0].startDate).not.toBeNull();
  });

  it('3. counted ⇒ effectiveEndDate set; not counted ⇒ effectiveEndDate null and a reason', () => {
    for (const profile of [mostExpProfile, mixedStartProfile]) {
      expect(profile).not.toBeNull();
      for (const exp of profile!.experiences) {
        if (exp.counted) {
          expect(exp.effectiveEndDate).not.toBeNull();
          expect(exp.excludedReason).toBeNull();
        } else {
          expect(exp.effectiveEndDate).toBeNull();
          expect(exp.excludedReason).not.toBeNull();
          expect(['intern', 'non-work', 'no-start-date']).toContain(exp.excludedReason);
        }
      }
    }

    // Jobs with no start date are never counted.
    for (const exp of mixedStartProfile!.experiences.filter((e) => e.startDate === null)) {
      expect(exp.counted).toBe(false);
    }
  });

  it("4. an intern job has counted: false, excludedReason: 'intern'", async () => {
    const res = await client.execute(
      `SELECT id, candidate_id, company, position, start_date FROM experiences
       WHERE position LIKE '%Intern%' ORDER BY candidate_id ASC, id ASC`
    );
    // LIKE also matches "International"/"Internal"; keep whole-word intern/interns/internship.
    const job = res.rows.find((r) => /\b(intern|interns|internship)\b/i.test(String(r.position)));
    expect(job, 'no intern job in local.db').toBeDefined();

    const profile: CandidateProfile | null = await getCandidateProfile(Number(job!.candidate_id));
    expect(profile).not.toBeNull();
    const matches = profile!.experiences.filter(
      (e) =>
        e.company === String(job!.company) &&
        e.position === String(job!.position) &&
        e.startDate === isoFromSeconds(job!.start_date)
    );
    expect(matches.length).toBeGreaterThan(0);
    for (const exp of matches) {
      expect(exp.counted).toBe(false);
      expect(exp.excludedReason).toBe('intern');
      expect(exp.effectiveEndDate).toBeNull();
    }
  });

  it('5. every date is ISO YYYY-MM-DD or null', async () => {
    const edu = await client.execute(
      `SELECT candidate_id, COUNT(*) AS n FROM education
       GROUP BY candidate_id ORDER BY n DESC, candidate_id ASC LIMIT 1`
    );
    const eduProfile: CandidateProfile | null = await getCandidateProfile(
      Number(edu.rows[0].candidate_id)
    );
    expect(eduProfile).not.toBeNull();
    expect(eduProfile!.education.length).toBe(Number(edu.rows[0].n));

    for (const profile of [mostExpProfile, mixedStartProfile, eduProfile]) {
      for (const exp of profile!.experiences) {
        expectIsoOrNull(exp.startDate);
        expectIsoOrNull(exp.endDate);
        expectIsoOrNull(exp.effectiveEndDate);
      }
      for (const ed of profile!.education) {
        expectIsoOrNull(ed.startDate);
        expectIsoOrNull(ed.endDate);
      }
    }
  });

  it('6. skills equal candidate_skills rows in spec order; topSkills is the first 8 names', async () => {
    const pick = await client.execute(
      `SELECT candidate_id, COUNT(*) AS n FROM candidate_skills
       GROUP BY candidate_id ORDER BY n DESC, candidate_id ASC LIMIT 1`
    );
    const id = Number(pick.rows[0].candidate_id);
    const rows = await client.execute({
      sql: 'SELECT skill, in_bio, role_count FROM candidate_skills WHERE candidate_id = ?',
      args: [id],
    });

    const expected = rows.rows
      .map((r) => ({
        name: String(r.skill),
        inBio: Number(r.in_bio) === 1,
        roleCount: Number(r.role_count),
      }))
      .sort((a, b) => {
        const diff = b.roleCount + Number(b.inBio) - (a.roleCount + Number(a.inBio));
        if (diff !== 0) return diff;
        // default JS sort order (UTF-16 code units)
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });
    expect(expected.length).toBeGreaterThan(8);

    const profile: CandidateProfile | null = await getCandidateProfile(id);
    expect(profile).not.toBeNull();
    expect(profile!.skills).toEqual(expected);
    expect(profile!.candidate.topSkills).toEqual(expected.slice(0, 8).map((s) => s.name));
  });

  it('7. getCandidateProfile(99999999) → null', async () => {
    expect(await getCandidateProfile(99999999)).toBeNull();
  });
});
