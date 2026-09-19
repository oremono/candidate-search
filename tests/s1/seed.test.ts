import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SKILLS } from '@/lib/derive/skills';

// Run after `npm run db:reset`. Skipped only when local.db is absent; if the db exists but
// the derived columns/table are missing, these tests fail (seed is incomplete).
const dbPath = path.resolve(process.cwd(), 'local.db');

describe.skipIf(!fs.existsSync(dbPath))('seed smoke test (local.db)', () => {
  let client: Client;

  beforeAll(() => {
    client = createClient({ url: `file:${dbPath}` });
  });

  afterAll(() => {
    client?.close();
  });

  it('30. 1,000 candidates; none has negative years_experience', async () => {
    const total = await client.execute('SELECT COUNT(*) AS n FROM candidates');
    expect(Number(total.rows[0].n)).toBe(1000);
    const negative = await client.execute(
      'SELECT COUNT(*) AS n FROM candidates WHERE years_experience < 0 OR years_experience IS NULL'
    );
    expect(Number(negative.rows[0].n)).toBe(0);
  });

  it('31. exactly 204 candidates have rate_unverified = true', async () => {
    const res = await client.execute(
      'SELECT COUNT(*) AS n FROM candidates WHERE rate_unverified = 1'
    );
    expect(Number(res.rows[0].n)).toBe(204);
  });

  it('32. candidate_skills has Python and Rust rows, and no skill outside SKILLS', async () => {
    const python = await client.execute(
      "SELECT COUNT(*) AS n FROM candidate_skills WHERE skill = 'Python'"
    );
    expect(Number(python.rows[0].n)).toBeGreaterThan(0);
    const rust = await client.execute(
      "SELECT COUNT(*) AS n FROM candidate_skills WHERE skill = 'Rust'"
    );
    expect(Number(rust.rows[0].n)).toBeGreaterThan(0);

    const distinct = await client.execute('SELECT DISTINCT skill FROM candidate_skills');
    const unknown = distinct.rows.map((r) => String(r.skill)).filter((s) => !SKILLS.includes(s));
    expect(unknown).toEqual([]);
  });
});
