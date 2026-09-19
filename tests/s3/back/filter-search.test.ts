import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FilterOptions, SearchFilters, SearchResponse } from '@/lib/contracts';
import { SKILLS } from '@/lib/derive/skills';
import { getFilterOptions, searchCandidates } from '@/lib/search/filter-search';

// Spec: docs/slices/S3-filter-search.md, S3-back > searchCandidates / getFilterOptions
// (test list 8–16). Runs against the seeded local.db; skipped only when it is absent.
const dbPath = path.resolve(process.cwd(), 'local.db');

function filters(overrides: Partial<SearchFilters> = {}): SearchFilters {
  return {
    countries: [],
    skills: [],
    minYears: null,
    maxYears: null,
    minSalary: null,
    maxSalary: null,
    ...overrides,
  };
}

function expectNonIncreasing(values: number[]) {
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
  }
}

describe.skipIf(!fs.existsSync(dbPath))('searchCandidates / getFilterOptions (local.db)', () => {
  let client: Client;

  beforeAll(() => {
    client = createClient({ url: `file:${dbPath}` });
  });

  afterAll(() => {
    client?.close();
  });

  it('8. no filters → total 1000, 10 results, years non-increasing (every score is 0)', async () => {
    const res: SearchResponse = await searchCandidates(filters());
    expect(res.total).toBe(1000);
    expect(res.results).toHaveLength(10);
    for (const r of res.results) expect(r.score).toBe(0);
    expectNonIncreasing(res.results.map((r) => r.candidate.yearsExperience));
  });

  it("9. countries ['canada'] → total 0, results []", async () => {
    const res: SearchResponse = await searchCandidates(filters({ countries: ['canada'] }));
    expect(res.total).toBe(0);
    expect(res.results).toEqual([]);
  });

  it("10. countries ['india'] → total 675, every result's country is India", async () => {
    const res: SearchResponse = await searchCandidates(filters({ countries: ['india'] }));
    expect(res.total).toBe(675);
    expect(res.results.length).toBeGreaterThan(0);
    for (const r of res.results) expect(r.candidate.country).toBe('India');
  });

  it("11. skills ['Rust'] → total equals Rust rows in candidate_skills; reasons start 'Rust in'", async () => {
    const sql = await client.execute(
      "SELECT COUNT(*) AS n FROM candidate_skills WHERE skill = 'Rust'"
    );
    const rustRows = Number(sql.rows[0].n);

    const res: SearchResponse = await searchCandidates(filters({ skills: ['Rust'] }));
    expect(res.total).toBe(rustRows);
    expect(res.results.length).toBeGreaterThan(0);
    for (const r of res.results) {
      expect(r.matchedSkills).toEqual(['Rust']);
      const skillReasons = r.reasons.filter((reason) => reason.kind === 'skill');
      expect(skillReasons).toHaveLength(1);
      expect(skillReasons[0].label.startsWith('Rust in')).toBe(true);
    }
  });

  it("12. skills ['Rust', 'Python'] → both matched, one skill reason each, total ≤ Rust-only", async () => {
    const rustOnly: SearchResponse = await searchCandidates(filters({ skills: ['Rust'] }));
    const res: SearchResponse = await searchCandidates(filters({ skills: ['Rust', 'Python'] }));
    expect(res.total).toBeLessThanOrEqual(rustOnly.total);
    expect(res.results.length).toBeGreaterThan(0);
    for (const r of res.results) {
      expect(r.matchedSkills).toEqual(['Rust', 'Python']);
      const skillReasons = r.reasons.filter((reason) => reason.kind === 'skill');
      expect(skillReasons).toHaveLength(2);
      expect(skillReasons.filter((s) => s.label.startsWith('Rust in'))).toHaveLength(1);
      expect(skillReasons.filter((s) => s.label.startsWith('Python in'))).toHaveLength(1);
    }
  });

  it('13. minYears 10 → every result has ≥ 10 yrs and an exact "(min 10)" experience reason', async () => {
    const res: SearchResponse = await searchCandidates(filters({ minYears: 10 }));
    expect(res.results.length).toBeGreaterThan(0);
    for (const r of res.results) {
      const y = r.candidate.yearsExperience;
      expect(y).toBeGreaterThanOrEqual(10);
      const labels = r.reasons.map((reason) => reason.label);
      expect(labels).toContain(`${y} yrs experience (min 10)`);
    }
  });

  it('14. maxSalary 60000 → verified rates ≤ 5000/mo, salary reason ends "under $60,000"', async () => {
    const res: SearchResponse = await searchCandidates(filters({ maxSalary: 60000 }));
    expect(res.results.length).toBeGreaterThan(0);
    for (const r of res.results) {
      expect(r.candidate.rateUnverified).toBe(false);
      expect(r.candidate.monthlyRate).not.toBeNull();
      expect(r.candidate.monthlyRate as number).toBeLessThanOrEqual(5000);
      const salaryReasons = r.reasons.filter((reason) => reason.kind === 'salary');
      expect(salaryReasons).toHaveLength(1);
      expect(salaryReasons[0].label.endsWith('under $60,000')).toBe(true);
    }
  });

  it('15. scores are non-increasing; results.length ≤ 10 and ≤ total', async () => {
    const cases: SearchFilters[] = [
      filters(),
      filters({ skills: ['Python'] }),
      filters({ skills: ['React', 'JavaScript'] }),
      filters({ countries: ['India'], skills: ['Java'] }),
      filters({ countries: ['canada'] }),
    ];
    for (const f of cases) {
      const res: SearchResponse = await searchCandidates(f);
      expectNonIncreasing(res.results.map((r) => r.score));
      expect(res.results.length).toBeLessThanOrEqual(10);
      expect(res.results.length).toBeLessThanOrEqual(res.total);
    }
  });

  it("16. getFilterOptions: India 675 first, no '-', every skill name in SKILLS", async () => {
    const options: FilterOptions = await getFilterOptions();
    expect(options.countries[0]).toEqual({ name: 'India', count: 675 });
    expect(options.countries.map((c) => c.name)).not.toContain('-');
    expect(options.skills.length).toBeGreaterThan(0);
    for (const s of options.skills) expect(SKILLS).toContain(s.name);
  });
});
