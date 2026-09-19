import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keywordSearch, type KeywordHit } from '@/lib/search/keyword';

// Runs against the seeded local.db. Skipped only when local.db is absent; if the db exists
// but candidate_search is missing, these tests fail (seed is incomplete).
const dbPath = path.resolve(process.cwd(), 'local.db');

function expectSortedDesc(values: number[]) {
  for (let i = 1; i < values.length; i++) {
    expect(values[i - 1]).toBeGreaterThanOrEqual(values[i]);
  }
}

describe.skipIf(!fs.existsSync(dbPath))('keywordSearch (local.db)', () => {
  let client: Client;

  beforeAll(() => {
    client = createClient({ url: `file:${dbPath}` });
  });

  afterAll(() => {
    client?.close();
  });

  it(`14. 'rust' → ≥5 hits, every snippet contains ⟪, scores positive and sorted desc`, async () => {
    const hits = await keywordSearch('rust');
    expect(hits.length).toBeGreaterThanOrEqual(5);
    for (const hit of hits) {
      expect(Number.isInteger(hit.candidateId)).toBe(true);
      expect(hit.snippet).toContain('⟪');
      expect(hit.score).toBeGreaterThan(0);
    }
    expectSortedDesc(hits.map((h: KeywordHit) => h.score));
  });

  it(`15. 'zzzqqqxx' → []`, async () => {
    expect(await keywordSearch('zzzqqqxx')).toEqual([]);
  });

  it(`16. '' → []`, async () => {
    expect(await keywordSearch('')).toEqual([]);
  });

  it(`17. 'python' with limit 3 → exactly 3 hits`, async () => {
    expect(await keywordSearch('python', { limit: 3 })).toHaveLength(3);
  });

  it(`18. 'python' with candidateIds = first 2 ids from case 17 → only those ids`, async () => {
    const top = await keywordSearch('python', { limit: 3 });
    expect(top.length).toBeGreaterThanOrEqual(2);
    const ids = top.slice(0, 2).map((h: KeywordHit) => h.candidateId);
    const hits = await keywordSearch('python', { candidateIds: ids });
    for (const hit of hits) expect(ids).toContain(hit.candidateId);
    // Both ids matched 'python' unrestricted, so both must come back when restricted.
    expect(hits.map((h: KeywordHit) => h.candidateId).sort()).toEqual([...ids].sort());
  });

  it(`18b. 'python' with candidateIds: [] → []`, async () => {
    expect(await keywordSearch('python', { candidateIds: [] })).toEqual([]);
  });

  it('19. candidate_search has 1,000 rows', async () => {
    const res = await client.execute('SELECT COUNT(*) AS n FROM candidate_search');
    expect(Number(res.rows[0].n)).toBe(1000);
  });
});
