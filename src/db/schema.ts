import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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
