import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

/** Built by `npm run db:seed` during the build and bundled with the function. */
const bundled = path.join(process.cwd(), 'local.db');

/** Serverless filesystems are read-only; /tmp is not. Copy once per cold start. */
function resolveDbFile(): string {
  if (!process.env.VERCEL || !existsSync(bundled)) return bundled;
  const tmp = '/tmp/local.db';
  if (!existsSync(tmp)) copyFileSync(bundled, tmp);
  return tmp;
}

/** Path to the SQLite file. Created and populated by `npm run db:seed`. */
export const DATABASE_URL = `file:${resolveDbFile()}`;

/** Shared database client. */
export const db = drizzle({
  connection: { url: DATABASE_URL },
  casing: 'snake_case',
  schema,
});

export type Db = typeof db;
