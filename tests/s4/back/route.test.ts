import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SearchResponse } from '@/lib/contracts';

// Spec: docs/slices/S4-nl-search.md, S4-back > Route (test list 26–28).
// Skipped when local.db is absent. The API key is blanked before the route is imported, so the
// rules parser runs and nothing touches the network.
const dbPath = path.resolve(process.cwd(), 'local.db');

type Handler = (req: Request) => Response | Promise<Response>;
let callSearch: Handler;

async function search(query: string): Promise<{ status: number; body: SearchResponse }> {
  const res = await callSearch(new Request(`http://localhost/api/candidates/search?${query}`));
  return { status: res.status, body: (await res.json()) as SearchResponse };
}

describe.skipIf(!fs.existsSync(dbPath))('search route with q (local.db)', () => {
  beforeAll(async () => {
    process.env.OPENAI_API_KEY = '';
    const mod = await import('@/app/api/candidates/search/route');
    callSearch = mod.GET as unknown as Handler;
  });

  it('26. ?q=Rust developer with 5+ years → rules interpretation, minYears 5', async () => {
    const { status, body } = await search('q=Rust%20developer%20with%205%2B%20years');
    expect(status).toBe(200);
    expect(body.query).toBe('Rust developer with 5+ years');
    expect(body.interpretation).not.toBeNull();
    expect(body.interpretation!.source).toBe('rules');
    expect(body.interpretation!.filters.skills).toContain('Rust');
    expect(body.filters.minYears).toBe(5);
  }, 30000);

  it('27. ?q=%20%20 → treated as no query', async () => {
    const { status, body } = await search('q=%20%20');
    expect(status).toBe(200);
    expect(body.query).toBeNull();
    expect(body.interpretation).toBeNull();
    expect(body.relaxed).toEqual([]);
  }, 30000);

  it('28. ?q=react&skill=Python → explicit skill wins; interpretation keeps React', async () => {
    const { status, body } = await search('q=react&skill=Python');
    expect(status).toBe(200);
    expect(body.filters.skills).toEqual(['Python']);
    expect(body.interpretation).not.toBeNull();
    expect(body.interpretation!.filters.skills).toEqual(['React']);
  }, 30000);
});
