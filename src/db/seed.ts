/**
 * Seed the local SQLite database from the CSV files in the repo root.
 *
 *   npm run db:seed          # create tables (if needed) and load data once
 *   npm run db:reset         # wipe and reload everything
 *
 * Safe to re-run: if candidates already exist it exits without changes unless
 * `--force` is passed.
 */
import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { count, type InferInsertModel, type Table } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { z } from 'zod';
import { DATABASE_URL, db } from './index';
import {
  candidateInsertSchema,
  candidateTable,
  educationInsertSchema,
  educationTable,
  experienceInsertSchema,
  experienceTable,
} from './schema';

const FORCE = process.argv.includes('--force');
const BATCH_SIZE = 200;

async function main() {
  const startedAt = performance.now();
  console.log(`Database: ${DATABASE_URL}`);

  await step('Applying migrations', () => migrate(db, { migrationsFolder: './migrations' }));

  const [{ existing }] = await db.select({ existing: count() }).from(candidateTable);
  if (existing > 0) {
    if (!FORCE) {
      console.log(`Database already has ${existing} candidates. Nothing to do.`);
      console.log('Run `npm run db:reset` to wipe and reload.');
      return;
    }
    await step('Clearing existing data', async () => {
      await db.delete(experienceTable);
      await db.delete(educationTable);
      await db.delete(candidateTable);
    });
  }

  // Candidates -------------------------------------------------------------
  const candidates = await step('Reading candidates.csv', () =>
    loadCsv('candidates.csv', candidateInsertSchema.extend({ userId: z.string() }))
  );

  const candidateIdByUserId = new Map<string, number>();
  await step(`Inserting ${candidates.length} candidates`, async () => {
    for (const batch of chunk(candidates, BATCH_SIZE)) {
      const inserted = await db
        .insert(candidateTable)
        .values(batch.map((c) => candidateInsertSchema.parse(c)))
        .returning({ id: candidateTable.id });
      batch.forEach((c, i) => candidateIdByUserId.set(c.userId, inserted[i].id));
    }
  });

  const resolveCandidateId = (userId: string) => {
    const id = candidateIdByUserId.get(userId);
    if (id === undefined) throw new Error(`Unknown candidate userId ${userId}`);
    return id;
  };

  // Education --------------------------------------------------------------
  const education = await step('Reading education.csv', () =>
    loadCsv(
      'education.csv',
      educationInsertSchema.omit({ candidateId: true }).extend({ userId: z.string() })
    )
  );
  await step(`Inserting ${education.length} education records`, () =>
    insertBatched(
      educationTable,
      education.map(({ userId, ...row }) => ({ ...row, candidateId: resolveCandidateId(userId) }))
    )
  );

  // Experiences ------------------------------------------------------------
  const experiences = await step('Reading experiences.csv', () =>
    loadCsv(
      'experiences.csv',
      experienceInsertSchema.omit({ candidateId: true }).extend({ userId: z.string() })
    )
  );
  await step(`Inserting ${experiences.length} experience records`, () =>
    insertBatched(
      experienceTable,
      experiences.map(({ userId, ...row }) => ({ ...row, candidateId: resolveCandidateId(userId) }))
    )
  );

  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone in ${seconds}s`);
  console.log(`  candidates:  ${candidates.length}`);
  console.log(`  education:   ${education.length}`);
  console.log(`  experiences: ${experiences.length}`);
}

// --- helpers ---------------------------------------------------------------

async function step<T>(label: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await run();
    console.log(`✓ ${label} (${((performance.now() - start) / 1000).toFixed(2)}s)`);
    return result;
  } catch (error) {
    console.error(`✗ ${label}`);
    throw error;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function insertBatched<T extends Table>(table: T, rows: InferInsertModel<T>[]) {
  for (const batch of chunk(rows, BATCH_SIZE)) {
    await db.insert(table).values(batch);
  }
}

async function loadCsv<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>[]> {
  const raw: Record<string, unknown>[] = parse(await fs.readFile(path), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  const rows: z.infer<T>[] = [];
  const errors: string[] = [];
  raw.forEach((record, index) => {
    const result = schema.safeParse(record);
    if (result.success) rows.push(result.data);
    else errors.push(`  row ${index + 2}: ${result.error.message}`); // +2: header + 1-based
  });

  if (errors.length > 0) {
    throw new Error(`${errors.length} invalid rows in ${path}:\n${errors.slice(0, 10).join('\n')}`);
  }
  return rows;
}

main().catch((error) => {
  console.error('\nSeed failed:', error);
  process.exit(1);
});
