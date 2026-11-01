import 'server-only'

import { createRealtime, rawSql } from '@neon/realtime/server'

export type CatalogVersion = {
  product_count: number
  updated_at: string
}

function getCatalogRealtime() {
  const secret = process.env.NEON_REALTIME_SECRET
  const connectionString = process.env.DATABASE_URL
  if (!secret || !connectionString) return null

  let database: string
  try {
    database = decodeURIComponent(new URL(connectionString).pathname.slice(1))
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL connection URL.')
  }
  if (!database || !/^[\w-]+$/.test(database)) {
    throw new Error('DATABASE_URL does not identify a supported PostgreSQL database name.')
  }
  return createRealtime({
    secret,
    db: database,
    debugMode: process.env.NODE_ENV === 'development',
  })
}

export function getCatalogRealtimeUrl() {
  return process.env.NEON_REALTIME_URL || null
}

export async function sealPublicCatalogVersion() {
  const realtime = getCatalogRealtime()
  if (!realtime) return null

  const query = rawSql<CatalogVersion>(
    `SELECT count(*)::int AS product_count,
            coalesce(max(updated_at)::text, '') AS updated_at
       FROM store_products
      WHERE status = $1`,
    ['active'],
  )
  return realtime.seal({ query })
}
