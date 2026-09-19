import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/candidates/[id]/route';

// S6-back test list, case 8. Runs against the real local.db (after `npm run db:seed`).
const dbPath = path.resolve(process.cwd(), 'local.db');

function call(id: string) {
  return GET(new Request(`http://localhost/api/candidates/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe.skipIf(!fs.existsSync(dbPath))('S6-back GET /api/candidates/[id] (local.db)', () => {
  it("8a. id 'abc' → 400 Invalid candidate id", async () => {
    const res = await call('abc');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid candidate id' });
  });

  it("8b. id '0' → 400 Invalid candidate id", async () => {
    const res = await call('0');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid candidate id' });
  });

  it("8c. id '99999999' → 404 Candidate not found", async () => {
    const res = await call('99999999');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Candidate not found' });
  });

  it('8d. a real id → 200 and body.candidate.id matches', async () => {
    const client = createClient({ url: `file:${dbPath}` });
    try {
      const row = await client.execute('SELECT id FROM candidates ORDER BY id ASC LIMIT 1');
      const id = Number(row.rows[0].id);
      const res = await call(String(id));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.candidate.id).toBe(id);
    } finally {
      client.close();
    }
  });
});
