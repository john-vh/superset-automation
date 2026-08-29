import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

export type Db = Database.Database;

export function createDb(filename: string = config.DATABASE_PATH): Db {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });

  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

let instance: Db | null = null;

export function db(): Db {
  if (!instance) instance = createDb();
  return instance;
}

export function setDb(next: Db): void {
  instance = next;
}

export function nowIso(): string {
  return new Date().toISOString();
}
