import fs from "node:fs";
import path from "node:path";
import { Kysely, PostgresDialect, SqliteDialect, type Dialect } from "kysely";
import { Migrator } from "kysely/migration";
import type { Database } from "./schema.js";
import { migrationProvider } from "./migrations.js";

export type DB = Kysely<Database>;

async function createDialect(url: string): Promise<Dialect> {
  if (/^postgres(ql)?:\/\//.test(url)) {
    const { default: pg } = await import("pg");
    return new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: 10 }) });
  }
  const file = url.replace(/^sqlite:(\/\/)?/, "");
  const { default: Sqlite } = await import("better-sqlite3");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const database = new Sqlite(file);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  return new SqliteDialect({ database });
}

export async function openDatabase(url: string): Promise<DB> {
  const db = new Kysely<Database>({ dialect: await createDialect(url) });
  const migrator = new Migrator({ db, provider: migrationProvider });
  const { error, results } = await migrator.migrateToLatest();
  for (const r of results ?? []) {
    if (r.status === "Success") console.log(`[db] applied migration ${r.migrationName}`);
    if (r.status === "Error") console.error(`[db] migration ${r.migrationName} failed`);
  }
  if (error) throw error;
  return db;
}

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
