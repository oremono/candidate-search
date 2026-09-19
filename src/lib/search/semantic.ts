/** Semantic search: cosine similarity against stored resume embeddings (libsql vectors). */
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export interface SemanticHit {
  candidateId: number;
  similarity: number; // 1 - cosine distance, higher = better
}

const DEFAULT_LIMIT = 50;

/** Candidates whose resume embedding is closest to `queryVector`, most similar first. */
export async function semanticSearch(
  queryVector: number[],
  options: { limit?: number; candidateIds?: number[] } = {}
): Promise<SemanticHit[]> {
  const { limit = DEFAULT_LIMIT, candidateIds } = options;
  if (candidateIds?.length === 0) return [];

  const idFilter = candidateIds
    ? sql`WHERE candidate_id IN (${sql.join(
        candidateIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    : sql``;

  const rows = await db.all<{ candidateId: number; similarity: number }>(sql`
    SELECT candidate_id AS candidateId,
           1 - vector_distance_cos(embedding, vector32(${JSON.stringify(queryVector)})) AS similarity
    FROM candidate_embeddings
    ${idFilter}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ candidateId: Number(r.candidateId), similarity: r.similarity }));
}
