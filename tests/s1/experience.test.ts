import { describe, expect, it } from 'vitest';
import {
  resolveJobs,
  yearsOfExperience,
  type JobInput,
  type ResolvedJob,
} from '@/lib/derive/experience';

/** 'YYYY-MM-DD' → Date at 00:00 UTC. */
function d(iso: string): Date {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

const today = new Date(Date.UTC(2026, 8, 19)); // 2026-09-19

function job(
  start: string | null,
  end: string | null,
  position = 'Software Engineer',
  company = 'Acme'
): JobInput {
  return {
    company,
    position,
    startDate: start ? d(start) : null,
    endDate: end ? d(end) : null,
  };
}

describe('yearsOfExperience / resolveJobs', () => {
  it('1. no jobs → 0', () => {
    expect(yearsOfExperience([], today)).toBe(0);
    expect(resolveJobs([], today)).toEqual([]);
  });

  it('2. one job 2020-01-01 → 2022-01-01 → 2.0', () => {
    // 731 days / 365.25 = 2.0014 → 2.0
    const jobs = [job('2020-01-01', '2022-01-01')];
    expect(yearsOfExperience(jobs, today)).toBe(2.0);
    const [r] = resolveJobs(jobs, today);
    expect(r.counted).toBe(true);
    expect(r.excludedReason).toBeNull();
    expect(r.effectiveEndDate?.getTime()).toBe(d('2022-01-01').getTime());
  });

  it('3. one open job starting 2024-09-19 → 2.0', () => {
    // 2024-09-19 → 2026-09-19 = 730 days / 365.25 = 1.9986 → 2.0
    const jobs = [job('2024-09-19', null)];
    expect(yearsOfExperience(jobs, today)).toBe(2.0);
    const [r] = resolveJobs(jobs, today);
    expect(r.counted).toBe(true);
    expect(r.excludedReason).toBeNull();
    expect(r.effectiveEndDate?.getTime()).toBe(today.getTime());
  });

  it('4. overlap: 2018–2022 and 2020–2024 → 6.0 (not 8)', () => {
    // merged 2018-01-01 → 2024-01-01 = 2191 days / 365.25 = 5.9986 → 6.0
    const jobs = [job('2018-01-01', '2022-01-01'), job('2020-01-01', '2024-01-01')];
    expect(yearsOfExperience(jobs, today)).toBe(6.0);
  });

  it('5. touching: 2018–2020 and 2020–2022 → 4.0', () => {
    // merged 2018-01-01 → 2022-01-01 = 1461 days / 365.25 = 4.0
    const jobs = [job('2018-01-01', '2020-01-01'), job('2020-01-01', '2022-01-01')];
    expect(yearsOfExperience(jobs, today)).toBe(4.0);
  });

  it('6. two open jobs 2019-01-01 and 2022-01-01 → first ends at second start, second at today', () => {
    const jobs = [job('2019-01-01', null), job('2022-01-01', null)];
    const [a, b] = resolveJobs(jobs, today);
    expect(a.counted).toBe(true);
    expect(a.excludedReason).toBeNull();
    expect(a.effectiveEndDate?.getTime()).toBe(d('2022-01-01').getTime());
    expect(b.counted).toBe(true);
    expect(b.excludedReason).toBeNull();
    expect(b.effectiveEndDate?.getTime()).toBe(today.getTime());
    // merged 2019-01-01 → 2026-09-19 = 2818 days / 365.25 = 7.7153 → 7.7
    expect(yearsOfExperience(jobs, today)).toBe(7.7);
  });

  it('7. two open jobs with the same start 2023-01-01 → both end today', () => {
    const jobs = [job('2023-01-01', null, 'Engineer', 'A'), job('2023-01-01', null, 'CTO', 'B')];
    const resolved: ResolvedJob[] = resolveJobs(jobs, today);
    for (const r of resolved) {
      expect(r.counted).toBe(true);
      expect(r.excludedReason).toBeNull();
      expect(r.effectiveEndDate?.getTime()).toBe(today.getTime());
    }
    // 2023-01-01 → 2026-09-19 = 1357 days / 365.25 = 3.7153 → 3.7
    expect(yearsOfExperience(jobs, today)).toBe(3.7);
  });

  it('8. open 2020-01-01 plus closed 2021–2023: closed job does not end the open one', () => {
    const jobs = [job('2020-01-01', null), job('2021-01-01', '2023-01-01')];
    const [open, closed] = resolveJobs(jobs, today);
    expect(open.counted).toBe(true);
    expect(open.effectiveEndDate?.getTime()).toBe(today.getTime());
    expect(closed.counted).toBe(true);
    expect(closed.effectiveEndDate?.getTime()).toBe(d('2023-01-01').getTime());
    // merged 2020-01-01 → 2026-09-19 = 2453 days / 365.25 = 6.7159 → 6.7
    expect(yearsOfExperience(jobs, today)).toBe(6.7);
  });

  it('9. intern job 2015–2019 plus Engineer 2019–2021 → 2.0; intern not counted', () => {
    const jobs = [
      job('2015-01-01', '2019-01-01', 'Software Engineer Intern'),
      job('2019-01-01', '2021-01-01', 'Engineer'),
    ];
    // only 2019-01-01 → 2021-01-01 = 731 days / 365.25 = 2.0014 → 2.0
    expect(yearsOfExperience(jobs, today)).toBe(2.0);
    const [intern, eng] = resolveJobs(jobs, today);
    expect(intern.counted).toBe(false);
    expect(intern.excludedReason).toBe('intern');
    expect(intern.effectiveEndDate).toBeNull();
    expect(eng.counted).toBe(true);
    expect(eng.excludedReason).toBeNull();
    expect(eng.effectiveEndDate?.getTime()).toBe(d('2021-01-01').getTime());
  });

  it("10. company 'Career Break', position 'Travel' → non-work", () => {
    const jobs = [job('2020-01-01', '2021-01-01', 'Travel', 'Career Break')];
    const [r] = resolveJobs(jobs, today);
    expect(r.counted).toBe(false);
    expect(r.excludedReason).toBe('non-work');
    expect(r.effectiveEndDate).toBeNull();
    expect(yearsOfExperience(jobs, today)).toBe(0);
  });

  it("11. position 'International Sales Engineer' → counted", () => {
    const jobs = [job('2020-01-01', '2022-01-01', 'International Sales Engineer')];
    const [r] = resolveJobs(jobs, today);
    expect(r.counted).toBe(true);
    expect(r.excludedReason).toBeNull();
    expect(r.effectiveEndDate?.getTime()).toBe(d('2022-01-01').getTime());
    // 731 days / 365.25 = 2.0014 → 2.0
    expect(yearsOfExperience(jobs, today)).toBe(2.0);
  });

  it('12. startDate null → no-start-date, not counted', () => {
    const jobs = [job(null, '2022-01-01')];
    const [r] = resolveJobs(jobs, today);
    expect(r.counted).toBe(false);
    expect(r.excludedReason).toBe('no-start-date');
    expect(r.effectiveEndDate).toBeNull();
    expect(yearsOfExperience(jobs, today)).toBe(0);
  });

  it('13. end date after today → capped at today', () => {
    const jobs = [job('2025-01-01', '2027-01-01')];
    const [r] = resolveJobs(jobs, today);
    expect(r.counted).toBe(true);
    expect(r.effectiveEndDate?.getTime()).toBe(today.getTime());
    // 2025-01-01 → 2026-09-19 = 626 days / 365.25 = 1.7139 → 1.7
    expect(yearsOfExperience(jobs, today)).toBe(1.7);
  });

  it('14. output order matches input order', () => {
    const jobs = [
      job('2022-01-01', null, 'Lead', 'C'),
      job(null, null, 'Ghost', 'X'),
      job('2015-01-01', '2016-01-01', 'Intern', 'B'),
      job('2019-01-01', null, 'Engineer', 'A'),
    ];
    const resolved: ResolvedJob[] = resolveJobs(jobs, today);
    expect(resolved).toHaveLength(jobs.length);
    resolved.forEach((r, i) => {
      expect(r.company).toBe(jobs[i].company);
      expect(r.position).toBe(jobs[i].position);
      expect(r.startDate?.getTime()).toBe(jobs[i].startDate?.getTime());
      expect(r.endDate?.getTime()).toBe(jobs[i].endDate?.getTime());
    });
    expect(resolved.map((r) => r.excludedReason)).toEqual([null, 'no-start-date', 'intern', null]);
    expect(resolved[3].effectiveEndDate?.getTime()).toBe(d('2022-01-01').getTime());
    expect(resolved[0].effectiveEndDate?.getTime()).toBe(today.getTime());
  });
});
