import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ApiError, FilterOptions, SearchResponse } from '@/lib/contracts';
import { GET as filtersGET } from '@/app/api/candidates/filters/route';
import { GET as searchGET } from '@/app/api/candidates/search/route';

// Spec: docs/slices/S3-filter-search.md, S3-back > Route handlers (test list 17–19).
// The handlers read local.db, so this is skipped only when it is absent.
const dbPath = path.resolve(process.cwd(), 'local.db');

// Route handlers may be typed with NextRequest or take no argument; call them uniformly.
type Handler = (req: Request) => Response | Promise<Response>;
const callSearch = searchGET as unknown as Handler;
const callFilters = filtersGET as unknown as Handler;

describe.skipIf(!fs.existsSync(dbPath))('candidate API route handlers (local.db)', () => {
  it("17. /api/candidates/search?skill=react → 200, filters.skills is ['React']", async () => {
    const res = await callSearch(new Request('http://localhost/api/candidates/search?skill=react'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as SearchResponse;
    expect(body.filters.skills).toEqual(['React']);
  });

  it("18. /api/candidates/search?skill=Cobol → 400 { error: 'Unknown skill: Cobol' }", async () => {
    const res = await callSearch(new Request('http://localhost/api/candidates/search?skill=Cobol'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiError;
    expect(body).toEqual({ error: 'Unknown skill: Cobol' });
  });

  it('19. /api/candidates/filters → 200 with non-empty countries and skills', async () => {
    const res = await callFilters(new Request('http://localhost/api/candidates/filters'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as FilterOptions;
    expect(body.countries.length).toBeGreaterThan(0);
    expect(body.skills.length).toBeGreaterThan(0);
  });
});
