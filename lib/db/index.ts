import { AsyncLocalStorage } from 'node:async_hooks'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { normalizePostgresConnectionString } from './postgres-connection.mjs'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { pool?: Pool; readPool?: Pool }
const requestPoolStorage = new AsyncLocalStorage<Pool>()

const connectionString = process.env.DATABASE_URL
  ? normalizePostgresConnectionString(process.env.DATABASE_URL)
  : undefined

const defaultPool = globalForDb.pool ?? new Pool({
  connectionString,
})

export const pool = new Proxy(defaultPool, {
  get(target, property) {
    const activePool = requestPoolStorage.getStore() ?? target
    const value = Reflect.get(activePool, property, activePool)
    return typeof value === 'function' ? value.bind(activePool) : value
  },
}) as Pool

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export function createRequestPool(connectionString: string) {
  return new Pool({
    connectionString: normalizePostgresConnectionString(connectionString),
    max: 1,
    connectionTimeoutMillis: 5_000,
  })
}

export function runWithRequestPool<T>(requestPool: Pool, callback: () => T): T {
  return requestPoolStorage.run(requestPool, callback)
}

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
