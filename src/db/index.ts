import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

/** Path to the SQLite file. Created and populated by `npm run db:seed`. */
export const DATABASE_URL = 'file:local.db';

/** Shared database client. */
export const db = drizzle({
  connection: { url: DATABASE_URL },
  casing: 'snake_case',
  schema,
});

export type Db = typeof db;
