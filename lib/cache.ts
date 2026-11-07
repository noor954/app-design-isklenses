import 'server-only'

import { revalidateTag, unstable_cache } from 'next/cache'
import { readPool } from './db'

const cacheTag = (namespace: string) => `isk:${namespace}`

/**
 * Cache only shared, public data. Never use this for authentication, customer
 * data, or checkout validation. Vercel shares its Data Cache across instances.
 */
export async function cached<T>(namespace: string, key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  let revision: string
  try {
    // MVCC snapshots change when transactions become visible, including writes
    // outside this app, without introducing write-side locks.
    const result = await readPool.query<{ revision: string }>(
      'SELECT pg_current_snapshot()::text AS revision',
    )
    if (!result.rows[0]) throw new Error('Database snapshot is missing')
    revision = result.rows[0].revision
  } catch (error) {
    console.error('[cache] Database snapshot unavailable; bypassing cache', error instanceof Error ? error.name : 'UnknownError')
    const value = await loader()
    const serialized = JSON.stringify(value)
    return serialized === undefined ? value : JSON.parse(serialized) as T
  }
  const load = unstable_cache(
    async () => {
      const value = await loader()
      // Return the same JSON-compatible shape on cache hits and misses.
      const serialized = JSON.stringify(value)
      return serialized === undefined ? value : JSON.parse(serialized) as T
    },
    [JSON.stringify(['isk-data-v2', namespace, key, revision])],
    { tags: [cacheTag(namespace)], revalidate: ttlSeconds },
  )
  return load()
}

/** Expire all entries in each namespace; they reload on the next request. */
export function invalidateCache(...namespaces: string[]) {
  for (const namespace of new Set(namespaces)) {
    try {
      revalidateTag(cacheTag(namespace), { expire: 0 })
    } catch (error) {
      // Committed writes still change the snapshot key; don't report an order
      // or other successful mutation as failed because tag expiry failed.
      console.error('[cache] Tag invalidation failed', namespace, error instanceof Error ? error.name : 'UnknownError')
    }
  }
}
