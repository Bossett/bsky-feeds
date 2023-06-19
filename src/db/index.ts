import { MongoClient } from 'mongodb'

import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect } from 'kysely'
import { DatabaseSchema } from './schema'
import { migrationProvider } from './migrations'

export const createDb = (location: string): Database => {
  const client = new MongoClient(location);

  return client;
}

export type Database = MongoClient
