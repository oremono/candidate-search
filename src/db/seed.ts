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
import { count, eq, type InferInsertModel, type Table } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { z } from 'zod';
import { type JobInput, yearsOfExperience } from '../lib/derive/experience';
import { normalizeMonthlyRate } from '../lib/derive/rate';
import { extractSkills } from '../lib/derive/skills';
import { DATABASE_URL, db } from './index';
import {
  candidateInsertSchema,
  candidateSkillTable,
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
      await db.delete(candidateSkillTable);
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

  // Derived data -----------------------------------------------------------
  const skillRows = await step('Deriving experience, rates and skills', async () => {
    const today = new Date();
    const jobsByCandidate = new Map<number, (JobInput & { description: string })[]>();
    for (const e of experiences) {
      const id = resolveCandidateId(e.userId);
      const jobs = jobsByCandidate.get(id) ?? [];
      jobs.push({ ...e, startDate: e.startDate ?? null, endDate: e.endDate ?? null });
      jobsByCandidate.set(id, jobs);
    }
    const rows: InferInsertModel<typeof candidateSkillTable>[] = [];

    await db.transaction(async (tx) => {
      for (const c of candidates) {
        const candidateId = resolveCandidateId(c.userId);
        const jobs = jobsByCandidate.get(candidateId) ?? [];
        const fullTime = normalizeMonthlyRate(c.fullTimeMonthlyRate ?? null);
        const partTime = normalizeMonthlyRate(c.partTimeMonthlyRate ?? null);

        await tx
          .update(candidateTable)
          .set({
            yearsExperience: yearsOfExperience(jobs, today),
            fullTimeRateNormalized: fullTime.monthlyRate,
            partTimeRateNormalized: partTime.monthlyRate,
            rateUnverified: fullTime.rateUnverified,
          })
          .where(eq(candidateTable.id, candidateId));

        rows.push(...deriveSkills(candidateId, c.biography ?? '', jobs));
      }
    });

    await insertBatched(candidateSkillTable, rows);
    return rows;
  });

  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone in ${seconds}s`);
  console.log(`  candidates:  ${candidates.length}`);
  console.log(`  education:   ${education.length}`);
  console.log(`  experiences: ${experiences.length}`);
  console.log(`  skills:      ${skillRows.length}`);
}

// --- helpers ---------------------------------------------------------------

/** One candidate_skills row per skill found in the bio or any experience. */
function deriveSkills(
  candidateId: number,
  biography: string,
  jobs: { position: string; description: string }[]
): InferInsertModel<typeof candidateSkillTable>[] {
  const inBio = new Set(extractSkills(biography));
  const roleCount = new Map<string, number>();
  for (const job of jobs) {
    for (const skill of extractSkills(`${job.position}\n${job.description}`)) {
      roleCount.set(skill, (roleCount.get(skill) ?? 0) + 1);
    }
  }
  const skills = new Set([...inBio, ...roleCount.keys()]);
  return [...skills].map((skill) => ({
    candidateId,
    skill,
    inBio: inBio.has(skill),
    roleCount: roleCount.get(skill) ?? 0,
  }));
}

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
