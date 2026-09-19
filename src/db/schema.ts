import {
  customType,
  index,
  int,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

// --- CSV parsing helpers -------------------------------------------------
// The seed CSVs store everything as strings, so these coerce the raw values.

/** "" -> null, otherwise a Date. */
const csvDate = z.preprocess((val) => (val === '' ? null : val), z.coerce.date().nullish());

/** "true"/"false" (case-insensitive) or "1"/"0" -> boolean. */
const csvBoolean = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    return v === 'true' || v === '1';
  }
  return Boolean(val);
}, z.boolean());

/** "" -> null, otherwise a whole number (rates are rounded to whole dollars). */
const csvNumber = z.preprocess(
  (val) => (val === '' ? null : val),
  z.coerce.number().transform(Math.round).nullish()
);

// --- candidates ----------------------------------------------------------

export const candidateTable = sqliteTable('candidates', {
  id: int().primaryKey({ autoIncrement: true }),
  firstName: text().notNull(),
  lastName: text().notNull(),

  fullTime: int({ mode: 'boolean' }).notNull(),
  fullTimeStartDate: int({ mode: 'timestamp' }),
  /** Expected monthly rate in USD for full-time work. */
  fullTimeMonthlyRate: int(),

  partTime: int({ mode: 'boolean' }).notNull(),
  partTimeStartDate: int({ mode: 'timestamp' }),
  /** Expected monthly rate in USD for part-time work. */
  partTimeMonthlyRate: int(),

  contractor: int({ mode: 'boolean' }).notNull(),
  employee: int({ mode: 'boolean' }).notNull(),
  country: text().notNull(),
  biography: text(),

  // Derived at seed time (see src/lib/derive).
  /** Years of experience, overlaps merged, internships and breaks excluded. */
  yearsExperience: real().notNull().default(0),
  /** Full-time monthly rate if plausible (500-30000 USD), else null. */
  fullTimeRateNormalized: int(),
  /** Part-time monthly rate if plausible (500-30000 USD), else null. */
  partTimeRateNormalized: int(),
  /** true when the full-time rate is missing or implausible. */
  rateUnverified: int({ mode: 'boolean' }).notNull().default(false),
});

export const candidateInsertSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  fullTime: csvBoolean,
  fullTimeStartDate: csvDate,
  fullTimeMonthlyRate: csvNumber,
  partTime: csvBoolean,
  partTimeStartDate: csvDate,
  partTimeMonthlyRate: csvNumber,
  contractor: csvBoolean,
  employee: csvBoolean,
  country: z.string(),
  biography: z.string().nullish(),
});

export type Candidate = typeof candidateTable.$inferSelect;
export type CandidateInsert = z.infer<typeof candidateInsertSchema>;

// --- education -----------------------------------------------------------

export const educationTable = sqliteTable('education', {
  id: int().primaryKey({ autoIncrement: true }),
  candidateId: int()
    .references(() => candidateTable.id)
    .notNull(),
  school: text().notNull(),
  degree: text().notNull(),
  startDate: int({ mode: 'timestamp' }),
  endDate: int({ mode: 'timestamp' }),
});

export const educationInsertSchema = z.object({
  candidateId: z.number(),
  school: z.string(),
  degree: z.string(),
  startDate: csvDate,
  endDate: csvDate,
});

export type Education = typeof educationTable.$inferSelect;
export type EducationInsert = z.infer<typeof educationInsertSchema>;

// --- experiences ---------------------------------------------------------

export const experienceTable = sqliteTable('experiences', {
  id: int().primaryKey({ autoIncrement: true }),
  candidateId: int()
    .references(() => candidateTable.id)
    .notNull(),
  company: text().notNull(),
  position: text().notNull(),
  description: text(),
  startDate: int({ mode: 'timestamp' }),
  endDate: int({ mode: 'timestamp' }),
});

export const experienceInsertSchema = z.object({
  candidateId: z.number(),
  company: z.string(),
  position: z.string(),
  description: z.string().default(''),
  startDate: csvDate,
  endDate: csvDate,
});

export type Experience = typeof experienceTable.$inferSelect;
export type ExperienceInsert = z.infer<typeof experienceInsertSchema>;

// --- candidate skills (derived) -------------------------------------------

export const candidateSkillTable = sqliteTable(
  'candidate_skills',
  {
    candidateId: int()
      .references(() => candidateTable.id)
      .notNull(),
    /** Canonical skill name from SKILLS. */
    skill: text().notNull(),
    /** Whether the skill was found in the biography. */
    inBio: int({ mode: 'boolean' }).notNull(),
    /** How many experiences mention it, in position or description. */
    roleCount: int().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.candidateId, table.skill] }),
    index('candidate_skills_skill_idx').on(table.skill),
  ]
);

export type CandidateSkill = typeof candidateSkillTable.$inferSelect;
export type CandidateSkillInsert = typeof candidateSkillTable.$inferInsert;

// --- candidate embeddings (derived) ----------------------------------------

/** Length of a text-embedding-3-small vector. */
export const EMBEDDING_DIMENSIONS = 1536;

/** libsql's native vector column: little-endian float32s, compared with vector_distance_cos. */
const f32Vector = customType<{ data: number[]; driverData: ArrayBuffer | Uint8Array }>({
  dataType: () => `F32_BLOB(${EMBEDDING_DIMENSIONS})`,
  toDriver: (value) => new Float32Array(value).buffer,
  // Copy first: the driver may hand back a byte view that isn't 4-byte aligned.
  fromDriver: (value) => Array.from(new Float32Array(new Uint8Array(value).slice().buffer)),
});

export const candidateEmbeddingTable = sqliteTable('candidate_embeddings', {
  candidateId: int()
    .primaryKey()
    .references(() => candidateTable.id),
  embedding: f32Vector().notNull(),
  /** sha256 hex of `model + '\n' + document`; unchanged hash means no re-embed. */
  contentHash: text().notNull(),
  model: text().notNull(),
});

export type CandidateEmbedding = typeof candidateEmbeddingTable.$inferSelect;
export type CandidateEmbeddingInsert = typeof candidateEmbeddingTable.$inferInsert;
