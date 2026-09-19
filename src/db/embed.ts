/**
 * Embed every candidate's resume with OpenAI and store it in `candidate_embeddings`.
 *
 *   npm run db:embed             # embed new or changed resumes only
 *   npm run db:embed -- --force  # re-embed everyone
 *
 * Also called by `npm run db:seed`. A resume is re-embedded only when the sha256 of
 * `model + '\n' + document` differs from the stored `content_hash`.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { asc, sql } from 'drizzle-orm';
import { buildResumeDocument, type ResumeParts } from '../lib/search/document';
import { EMBEDDING_MODEL, embed } from '../lib/openai';
import { db } from './index';
import { candidateEmbeddingTable, candidateTable, educationTable, experienceTable } from './schema';

// tsx doesn't load .env by itself. Existing env vars win over the file.
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const EMBED_BATCH_SIZE = 100;
const PARALLEL_REQUESTS = 5;

/** Embed resumes whose content hash changed (or all of them with `force`) and upsert them. */
export async function embedCandidates(
  options: { force?: boolean } = {}
): Promise<{ embedded: number; skipped: number }> {
  const documents = await loadResumeDocuments();
  const storedHashes = new Map(
    (
      await db
        .select({
          candidateId: candidateEmbeddingTable.candidateId,
          contentHash: candidateEmbeddingTable.contentHash,
        })
        .from(candidateEmbeddingTable)
    ).map((row) => [row.candidateId, row.contentHash])
  );

  const todo = [...documents]
    .map(([candidateId, document]) => ({
      candidateId,
      document,
      contentHash: sha256(`${EMBEDDING_MODEL}\n${document}`),
    }))
    .filter((d) => options.force || storedHashes.get(d.candidateId) !== d.contentHash);

  const batches: (typeof todo)[] = [];
  for (let i = 0; i < todo.length; i += EMBED_BATCH_SIZE) {
    batches.push(todo.slice(i, i + EMBED_BATCH_SIZE));
  }
  // A few requests in flight at once: ~5x faster, well under OpenAI's rate limits.
  for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
    await Promise.all(batches.slice(i, i + PARALLEL_REQUESTS).map(embedAndStore));
  }

  return { embedded: todo.length, skipped: documents.size - todo.length };
}

/** Embed one batch of documents and upsert the vectors. */
async function embedAndStore(
  batch: { candidateId: number; document: string; contentHash: string }[]
) {
  const vectors = await embed(batch.map((d) => d.document));
  await db
    .insert(candidateEmbeddingTable)
    .values(
      batch.map((d, j) => ({
        candidateId: d.candidateId,
        embedding: vectors[j],
        contentHash: d.contentHash,
        model: EMBEDDING_MODEL,
      }))
    )
    .onConflictDoUpdate({
      target: candidateEmbeddingTable.candidateId,
      set: {
        embedding: sql`excluded.embedding`,
        contentHash: sql`excluded.content_hash`,
        model: sql`excluded.model`,
      },
    });
}

/** Resume document per candidate id, built from bio, experiences and education. */
async function loadResumeDocuments(): Promise<Map<number, string>> {
  const [candidates, experiences, education] = await Promise.all([
    db
      .select({ id: candidateTable.id, biography: candidateTable.biography })
      .from(candidateTable)
      .orderBy(asc(candidateTable.id)),
    db.select().from(experienceTable).orderBy(asc(experienceTable.id)),
    db.select().from(educationTable).orderBy(asc(educationTable.id)),
  ]);

  const parts = new Map<number, ResumeParts>(
    candidates.map((c) => [c.id, { biography: c.biography ?? '', experiences: [], education: [] }])
  );
  for (const e of experiences) {
    parts.get(e.candidateId)?.experiences.push({
      position: e.position,
      company: e.company,
      description: e.description ?? '',
    });
  }
  for (const e of education) {
    parts.get(e.candidateId)?.education.push({ degree: e.degree, school: e.school });
  }

  return new Map([...parts].map(([id, p]) => [id, buildResumeDocument(p)]));
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// Entry point for `npm run db:embed`.
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const force = process.argv.includes('--force');
  const startedAt = performance.now();
  embedCandidates({ force })
    .then(({ embedded, skipped }) => {
      const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
      console.log(`Embedded ${embedded}, skipped ${skipped} unchanged (${seconds}s)`);
    })
    .catch((error) => {
      console.error('\nEmbedding failed:', error);
      process.exit(1);
    });
}
