import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parseQuery, type RawParsedQuery } from '@/lib/search/query-parser';

// Spec: docs/slices/S4-nl-search.md, S4-back > LLM parser (test list 19–23).
// Every call injects `complete`, so no network is used. parseQuery caches by lowercased trimmed
// query, so each test uses its own query text.

beforeAll(() => {
  process.env.OPENAI_API_KEY = '';
});

function rawJson(overrides: Partial<RawParsedQuery> = {}): string {
  const value: RawParsedQuery = {
    skills: [],
    countries: [],
    minYears: null,
    maxYears: null,
    minSalary: null,
    maxSalary: null,
    seniority: null,
    keywords: [],
    searchText: '',
    ...overrides,
  };
  return JSON.stringify(value);
}

const CASE_4_FILTERS = {
  countries: ['Canada'],
  skills: ['React'],
  minYears: 5,
  maxYears: null,
  minSalary: null,
  maxSalary: 130000,
};

describe('parseQuery', () => {
  it("19. '' (or whitespace) → null", async () => {
    const complete = vi.fn(async () => rawJson());
    await expect(parseQuery('', { complete })).resolves.toBeNull();
    await expect(parseQuery('   ', { complete })).resolves.toBeNull();
  });

  it("20. a valid model response → source 'llm', filters as given plus seniority years", async () => {
    const complete = vi.fn(async () =>
      rawJson({
        skills: ['React'],
        countries: ['Canada'],
        maxSalary: 130000,
        seniority: 'senior',
        keywords: [],
        searchText: 'Senior React engineer',
      })
    );
    const r = await parseQuery('Senior React engineer in Canada under 130k', { complete });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(r).not.toBeNull();
    expect(r!.source).toBe('llm');
    expect(r!.filters).toEqual(CASE_4_FILTERS);
    expect(r!.seniority).toBe('senior');
  });

  it("21. a complete that throws → source 'rules', same filters as case 4", async () => {
    // Differs from case 20's query only by a plural stopword, so it is a separate cache entry,
    // while the rules parser reads it exactly like case 4.
    const complete = vi.fn(async (): Promise<string> => {
      throw new Error('network down');
    });
    const r = await parseQuery('Senior React engineers in Canada under 130k', { complete });
    expect(r).not.toBeNull();
    expect(r!.source).toBe('rules');
    expect(r!.filters).toEqual(CASE_4_FILTERS);
  });

  it("22. a complete returning 'not json' → source 'rules'", async () => {
    const complete = vi.fn(async () => 'not json');
    const r = await parseQuery('python backend brazil bad json case', { complete });
    expect(r).not.toBeNull();
    expect(r!.source).toBe('rules');
  });

  it('23. the same query in different case or whitespace calls complete once', async () => {
    const complete = vi.fn(async () =>
      rawJson({ skills: ['Elixir'], keywords: ['cachetest'], searchText: 'Elixir cachetest' })
    );
    const first = await parseQuery('Elixir Cachetest Unique S4 Query', { complete });
    const second = await parseQuery('   elixir cachetest unique s4 query  ', { complete });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});

// Spec: docs/slices/S4-nl-search.md, S4-back > Addendum: stack acronyms and LLM field guard
// (test list 48–50). Each test builds its own `complete`, so the per-complete cache never
// carries results between tests.
const MERN = ['MongoDB', 'Express', 'React', 'Node.js'];

describe('parseQuery: stack acronyms and LLM field guard', () => {
  it('48. a model that drops MERN members and invents years/seniority is corrected', async () => {
    const complete = vi.fn(async () =>
      rawJson({
        skills: ['JavaScript', 'React', 'Node.js'],
        countries: ['India'],
        maxSalary: 24000,
        maxYears: 3,
        seniority: 'junior',
      })
    );
    const r = await parseQuery(
      'engineers specialised in MERN stack from india with under 2k per month',
      { complete }
    );
    expect(r).not.toBeNull();
    expect(r!.source).toBe('llm');
    for (const skill of MERN) expect(r!.filters.skills).toContain(skill);
    expect(r!.filters.minYears).toBeNull();
    expect(r!.filters.maxYears).toBeNull();
    expect(r!.seniority).toBeNull();
    expect(r!.filters.maxSalary).toBe(24000);
  });

  it("49. 'senior MERN dev with 5+ years' keeps model years and seniority, adds MERN", async () => {
    const complete = vi.fn(async () =>
      rawJson({ skills: ['MongoDB'], minYears: 5, seniority: 'senior' })
    );
    const r = await parseQuery('senior MERN dev with 5+ years', { complete });
    expect(r).not.toBeNull();
    expect(r!.source).toBe('llm');
    expect(r!.filters.minYears).toBe(5);
    expect(r!.seniority).toBe('senior');
    for (const skill of MERN) expect(r!.filters.skills).toContain(skill);
  });

  it('50. model minYears is kept only when the query has a year word', async () => {
    const complete = vi.fn(async () => rawJson({ skills: ['Python'], minYears: 2 }));
    const withYears = await parseQuery('python dev with 2 yrs experience', { complete });
    expect(withYears).not.toBeNull();
    expect(withYears!.source).toBe('llm');
    expect(withYears!.filters.minYears).toBe(2);

    const without = await parseQuery('python dev', { complete });
    expect(without).not.toBeNull();
    expect(without!.source).toBe('llm');
    expect(without!.filters.minYears).toBeNull();
  });
});
