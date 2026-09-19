/** Keyword search over resumes with SQLite FTS5 (table `candidate_search`). */
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export interface KeywordHit {
  candidateId: number;
  score: number; // > 0, higher = better
  snippet: string; // matched words wrapped in ⟪ ⟫
}

const DEFAULT_LIMIT = 50;
const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}+#.]*/gu;

/** Turn free text into a safe FTS5 query: quoted tokens joined with OR, or null if none. */
export function toFtsQuery(input: string): string | null {
  const tokens = (input.toLowerCase().match(TOKEN_PATTERN) ?? [])
    .map((token) => token.replace(/\.+$/, ''))
    .filter((token) => token.length >= 2 || /[+#]/.test(token));
  const unique = [...new Set(tokens)];
  return unique.length > 0 ? unique.map((token) => `"${token}"`).join(' OR ') : null;
}

/** Candidates whose resume matches any query word, best bm25 score first. */
export async function keywordSearch(
  query: string,
  options: { limit?: number; candidateIds?: number[] } = {}
): Promise<KeywordHit[]> {
  const match = toFtsQuery(query);
  const { limit = DEFAULT_LIMIT, candidateIds } = options;
  if (match === null || candidateIds?.length === 0) return [];

  const idFilter = candidateIds
    ? sql`AND candidate_id IN (${sql.join(
        candidateIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    : sql``;

  const rows = await db.all<{ candidateId: number; score: number; snippet: string }>(sql`
    SELECT candidate_id AS candidateId,
           -bm25(candidate_search) AS score,
           snippet(candidate_search, -1, '⟪', '⟫', '…', 12) AS snippet
    FROM candidate_search
    WHERE candidate_search MATCH ${match} ${idFilter}
    ORDER BY score DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    candidateId: Number(r.candidateId),
    score: r.score,
    snippet: r.snippet,
  }));
}

/** Refill `candidate_search` from candidates, experiences and education. */
export async function rebuildKeywordIndex(): Promise<number> {
  await db.run(sql`DELETE FROM candidate_search`);
  await db.run(sql`
    INSERT INTO candidate_search (candidate_id, biography, experience, education)
    WITH exp AS (
      SELECT candidate_id, group_concat(position || char(10) || coalesce(description, ''), char(10)) AS text
      FROM experiences GROUP BY candidate_id
    ), edu AS (
      SELECT candidate_id, group_concat(degree || char(10) || school, char(10)) AS text
      FROM education GROUP BY candidate_id
    )
    SELECT c.id, coalesce(c.biography, ''), coalesce(exp.text, ''), coalesce(edu.text, '')
    FROM candidates c
    LEFT JOIN exp ON exp.candidate_id = c.id
    LEFT JOIN edu ON edu.candidate_id = c.id
  `);
  const [{ n }] = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM candidate_search`);
  return n;
}
