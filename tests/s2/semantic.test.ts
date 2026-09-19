import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMBEDDING_MODEL } from '@/lib/openai';
import { semanticSearch, type SemanticHit } from '@/lib/search/semantic';

// Runs against the seeded local.db. Skipped when local.db is absent or when
// candidate_embeddings is missing or empty (seed ran without OPENAI_API_KEY).
const dbPath = path.resolve(process.cwd(), 'local.db');

async function countEmbeddings(): Promise<number> {
  if (!fs.existsSync(dbPath)) return 0;
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

const embeddingCount = await countEmbeddings();

function expectSortedDesc(values: number[]) {
  for (let i = 1; i < values.length; i++) {
    expect(values[i - 1]).toBeGreaterThanOrEqual(values[i]);
  }
}

describe.skipIf(embeddingCount === 0)('semanticSearch (local.db)', () => {
  let client: Client;
  let candidateX: number;
  let vectorX: number[];

  beforeAll(async () => {
    client = createClient({ url: `file:${dbPath}` });
    const res = await client.execute(
      'SELECT candidate_id, vector_extract(embedding) AS v FROM candidate_embeddings LIMIT 1'
    );
    candidateX = Number(res.rows[0].candidate_id);
    vectorX = JSON.parse(String(res.rows[0].v)) as number[];
  });

  afterAll(() => {
    client?.close();
  });

  it('20. candidate_embeddings has 1,000 rows, every model is text-embedding-3-small', async () => {
    expect(EMBEDDING_MODEL).toBe('text-embedding-3-small');
    const total = await client.execute('SELECT COUNT(*) AS n FROM candidate_embeddings');
    expect(Number(total.rows[0].n)).toBe(1000);
    const models = await client.execute('SELECT DISTINCT model FROM candidate_embeddings');
    expect(models.rows.map((r) => String(r.model))).toEqual(['text-embedding-3-small']);
  });

  it("21. candidate X's stored vector → X first with similarity > 0.999, sorted desc", async () => {
    expect(vectorX).toHaveLength(1536);
    const hits = await semanticSearch(vectorX);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].candidateId).toBe(candidateX);
    expect(hits[0].similarity).toBeGreaterThan(0.999);
    expectSortedDesc(hits.map((h: SemanticHit) => h.similarity));
  });

  it('22. limit 5 → exactly 5 hits; candidateIds: [] → []', async () => {
    expect(await semanticSearch(vectorX, { limit: 5 })).toHaveLength(5);
    expect(await semanticSearch(vectorX, { candidateIds: [] })).toEqual([]);
  });
});
