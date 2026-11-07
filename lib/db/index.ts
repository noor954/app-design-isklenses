import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { normalizePostgresConnectionString } from './postgres-connection.mjs'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { pool?: Pool; readPool?: Pool }

const connectionString = process.env.DATABASE_URL
  ? normalizePostgresConnectionString(process.env.DATABASE_URL)
  : undefined

export const pool = globalForDb.pool ?? new Pool({ connectionString })

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })

const readConnectionString = process.env.DATABASE_READ_URL
  ? normalizePostgresConnectionString(process.env.DATABASE_READ_URL)
  : undefined

export const readPool = readConnectionString
  ? globalForDb.readPool ?? new Pool({
      connectionString: readConnectionString,
      max: 5,
      options: '-c default_transaction_read_only=on',
    })
  : pool

if (readConnectionString && process.env.NODE_ENV !== 'production') globalForDb.readPool = readPool

export const readDb = readPool === pool ? db : drizzle(readPool, { schema })
