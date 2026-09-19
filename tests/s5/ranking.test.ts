import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  MatchReason,
  MatchReasonKind,
  ParsedQuery,
  SearchFilters,
  SearchResponse,
} from '@/lib/contracts';
import { EMPTY_FILTERS } from '@/lib/search-query';
import { searchCandidates } from '@/lib/search/filter-search';
import { keywordSearch } from '@/lib/search/keyword';

// Spec: docs/slices/S5-ranking-explanations.md, "Test list" cases 1–10.
// Runs against the seeded local.db; skipped when it is absent. The semantic cases (3, 8, 10)
// also skip when candidate_embeddings is missing or empty. No test calls the network: every
// search with a query passes `embedQuery`.
const dbPath = path.resolve(process.cwd(), 'local.db');
const hasDb = fs.existsSync(dbPath);

async function countEmbeddings(): Promise<number> {
  if (!hasDb) return 0;
  const probe = createClient({ url: `file:${dbPath}` });
  try {
    const res = await probe.execute('SELECT COUNT(*) AS n FROM candidate_embeddings');
    return Number(res.rows[0].n);
  } catch {
    return 0;
  } finally {
    probe.close();
  }
}

const hasEmbeddings = (await countEmbeddings()) > 0;

// --- helpers named in the spec ------------------------------------------------

function filters(overrides: Partial<SearchFilters> = {}): SearchFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

function q(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return {
    filters: filters(),
    keywords: [],
    searchText: 'test',
    seniority: null,
    source: 'rules',
    ...overrides,
  };
}

const reject = (): Promise<number[]> => Promise.reject(new Error('offline'));

function expectNonIncreasing(values: number[]) {
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
  }
}

const SEMANTIC_LABEL = /^Top \d+% resume match for “.+”$/;

describe.skipIf(!hasDb)('S5 searchCandidates ranking + explanations (local.db)', () => {
  let client: Client;

  /** Candidate X = first row of candidate_embeddings, with its stored vector. */
  async function vectorOf(): Promise<{ id: number; vector: number[] }> {
    const res = await client.execute(
      'SELECT candidate_id, vector_extract(embedding) AS v FROM candidate_embeddings ORDER BY rowid LIMIT 1'
    );
    return {
      id: Number(res.rows[0].candidate_id),
      vector: JSON.parse(String(res.rows[0].v)) as number[],
    };
  }

  async function skillCount(skill: string): Promise<number> {
    const res = await client.execute({
      sql: 'SELECT COUNT(DISTINCT candidate_id) AS n FROM candidate_skills WHERE skill = ?',
      args: [skill],
    });
    return Number(res.rows[0].n);
  }

  beforeAll(() => {
    client = createClient({ url: `file:${dbPath}` });
  });

  afterAll(() => {
    client?.close();
  });

  it('1. no options → query null, interpretation null, relaxed [], total 1000, years non-increasing', async () => {
    const res: SearchResponse = await searchCandidates(EMPTY_FILTERS);
    expect(res.query).toBeNull();
    expect(res.interpretation).toBeNull();
    expect(res.relaxed).toEqual([]);
    expect(res.total).toBe(1000);
    expect(res.results.length).toBeGreaterThan(0);
    expectNonIncreasing(res.results.map((r) => r.candidate.yearsExperience));
  });

  it("2. keywords ['rust'], embedding rejected → keyword order, keyword reasons, no semantic", async () => {
    const hits = await keywordSearch('rust');
    expect(hits.length).toBeGreaterThan(0);
    const n = Math.min(hits.length, 10);

    const res: SearchResponse = await searchCandidates(EMPTY_FILTERS, {
      query: q({ keywords: ['rust'], searchText: 'rust' }),
      embedQuery: reject,
    });

    expect(res.total).toBe(1000);
    expect(res.results.length).toBeLessThanOrEqual(10);
    expect(res.results.length).toBeGreaterThanOrEqual(n);
    expect(res.results.slice(0, n).map((r) => r.candidate.id)).toEqual(
      hits.slice(0, n).map((h) => h.candidateId)
    );

    for (const r of res.results.slice(0, n)) {
      const kw = r.reasons.filter((x) => x.kind === 'keyword');
      expect(kw).toHaveLength(1);
      expect(kw[0].label.startsWith('Resume mentions rust')).toBe(true);
      expect(kw[0].snippet).toContain('⟪');
    }
    for (const r of res.results.slice(n)) {
      expect(r.score).toBe(0);
      expect(r.reasons.some((x) => x.kind === 'keyword')).toBe(false);
    }
    for (const r of res.results) {
      expect(r.reasons.some((x) => x.kind === 'semantic')).toBe(false);
    }
  });

  it.skipIf(!hasEmbeddings)(
    "3. embedQuery returns X's stored vector → X first with score 1 and a Top 1% semantic reason",
    async () => {
      const x = await vectorOf();
      const res: SearchResponse = await searchCandidates(EMPTY_FILTERS, {
        query: q({ searchText: 'x' }),
        embedQuery: async () => x.vector,
      });
      expect(res.results.length).toBeGreaterThan(0);
      const first = res.results[0];
      expect(first.candidate.id).toBe(x.id);
      expect(first.score).toBeCloseTo(1, 9);
      expect(first.reasons).toContainEqual({
        kind: 'semantic',
        label: 'Top 1% resume match for “x”',
      });
    }
  );

  it("4. countries ['Canada'], relaxable ['countries'] → country relaxed, total 1000", async () => {
    const res: SearchResponse = await searchCandidates(filters({ countries: ['Canada'] }), {
      query: q({}),
      relaxable: ['countries'],
      embedQuery: reject,
    });
    expect(res.relaxed).toEqual([
      { field: 'countries', message: 'No candidates in Canada match, so country was ignored.' },
    ]);
    expect(res.filters.countries).toEqual([]);
    expect(res.total).toBe(1000);
  });

  it("5. countries ['Canada'], relaxable [] → total 0, results [], relaxed []", async () => {
    const res: SearchResponse = await searchCandidates(filters({ countries: ['Canada'] }), {
      query: q({}),
      relaxable: [],
      embedQuery: reject,
    });
    expect(res.total).toBe(0);
    expect(res.results).toEqual([]);
    expect(res.relaxed).toEqual([]);
  });

  it("6. skills ['Rust', 'Elixir'], relaxable ['skills'] → Elixir dropped, Rust kept", async () => {
    const rustCount = await skillCount('Rust');
    const res: SearchResponse = await searchCandidates(filters({ skills: ['Rust', 'Elixir'] }), {
      query: q({}),
      relaxable: ['skills'],
      embedQuery: reject,
    });
    expect(res.relaxed).toEqual([
      {
        field: 'skills',
        message:
          'No candidates have Elixir alongside the other requirements, so Elixir was ignored.',
      },
    ]);
    expect(res.filters.skills).toEqual(['Rust']);
    expect(res.total).toBe(rustCount);
    expect(res.results.length).toBeGreaterThan(0);
    for (const r of res.results) expect(r.matchedSkills).toEqual(['Rust']);
  });

  it("7. countries ['Canada'] + maxSalary 1000, both relaxable → countries then maxSalary", async () => {
    const res: SearchResponse = await searchCandidates(
      filters({ countries: ['Canada'], maxSalary: 1000 }),
      {
        query: q({}),
        relaxable: ['countries', 'maxSalary'],
        embedQuery: reject,
      }
    );
    expect(res.relaxed.map((r) => r.field)).toEqual(['countries', 'maxSalary']);
    expect(res.relaxed[1].message).toBe(
      'No candidates under $1,000/yr match, so the salary cap was ignored.'
    );
  });

  it.skipIf(!hasEmbeddings)(
    "8. skills ['Python'] + keyword 'django' + stored vector → reason order, scores, total",
    async () => {
      const pythonCount = await skillCount('Python');
      const x = await vectorOf();
      const res: SearchResponse = await searchCandidates(filters({ skills: ['Python'] }), {
        query: q({ keywords: ['django'], searchText: 'python django' }),
        embedQuery: async () => x.vector,
      });

      const rank: Partial<Record<MatchReasonKind, number>> = {
        skill: 0,
        keyword: 1,
        semantic: 2,
        experience: 3,
      };
      expect(res.results.length).toBeGreaterThan(0);
      for (const r of res.results) {
        const order = r.reasons.map((reason) => rank[reason.kind]);
        for (const o of order) expect(o).toBeDefined();
        const sorted = [...(order as number[])].sort((a, b) => a - b);
        expect(order).toEqual(sorted);
      }
      expectNonIncreasing(res.results.map((r) => r.score));
      expect(res.results.length).toBeLessThanOrEqual(10);
      expect(res.total).toBe(pythonCount);
    }
  );

  it("9. queryText '  Senior React  ' → query 'Senior React', interpretation is the given query", async () => {
    const parsed = q({ searchText: 'react', seniority: 'senior' });
    const res: SearchResponse = await searchCandidates(EMPTY_FILTERS, {
      query: parsed,
      queryText: '  Senior React  ',
      embedQuery: reject,
    });
    expect(res.query).toBe('Senior React');
    expect(res.interpretation).toEqual(parsed);
  });

  it.skipIf(!hasEmbeddings)(
    '10. every semantic reason label matches /^Top \\d+% resume match for “.+”$/',
    async () => {
      // Re-runs the searches of cases 3 and 8 and checks every semantic reason they produce.
      const x = await vectorOf();
      const responses: SearchResponse[] = [
        await searchCandidates(EMPTY_FILTERS, {
          query: q({ searchText: 'x' }),
          embedQuery: async () => x.vector,
        }),
        await searchCandidates(filters({ skills: ['Python'] }), {
          query: q({ keywords: ['django'], searchText: 'python django' }),
          embedQuery: async () => x.vector,
        }),
      ];
      const semantic: MatchReason[] = responses.flatMap((res) =>
        res.results.flatMap((r) => r.reasons.filter((reason) => reason.kind === 'semantic'))
      );
      expect(semantic.length).toBeGreaterThanOrEqual(1);
      for (const reason of semantic) expect(reason.label).toMatch(SEMANTIC_LABEL);
    }
  );
});
