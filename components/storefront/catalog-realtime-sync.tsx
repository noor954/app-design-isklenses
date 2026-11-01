'use client'

import { createCollection, localOnlyCollectionOptions } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { createRealtimeClient, QueryRefreshController, type SealedLiveQuery } from '@neon/realtime/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'
import type { CatalogVersion } from '@/lib/realtime/catalog'

type Bootstrap = {
  url: string
  query: SealedLiveQuery<CatalogVersion>
}

async function fetchBootstrap(signal?: AbortSignal): Promise<Bootstrap> {
  const response = await fetch('/api/realtime/catalog', { cache: 'no-store', signal })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'Catalog live updates are unavailable.'
    throw new Error(message)
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    !('url' in body) ||
    typeof body.url !== 'string' ||
    !('query' in body) ||
    typeof body.query !== 'object' ||
    body.query === null ||
    !('capability' in body.query) ||
    typeof body.query.capability !== 'string'
  ) {
    throw new Error('Catalog live-update response is invalid.')
  }
  return body as Bootstrap
}

export function CatalogRealtimeSync() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetchBootstrap(controller.signal)
      .then(setBootstrap)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.warn('[catalog-realtime] Falling back to periodic catalog refresh', error instanceof Error ? error.message : 'UnknownError')
      })
    return () => controller.abort()
  }, [])

  if (!bootstrap) return null
  return <ConnectedCatalogRealtimeSync bootstrap={bootstrap} />
}

function ConnectedCatalogRealtimeSync({ bootstrap }: { bootstrap: Bootstrap }) {
  const { mutate } = useSWRConfig()
  const client = useMemo(() => createRealtimeClient({ url: bootstrap.url }), [bootstrap.url])
  const collection = useMemo(
    () => createCollection(localOnlyCollectionOptions<CatalogVersion>({ getKey: () => 'active-catalog' })),
    [],
  )
  const { data } = useLiveQuery(collection)
  const priorVersion = useRef<string | null>(null)

  useEffect(() => () => client.close(), [client])

  useEffect(() => {
    const subscription = client.subscribe(bootstrap.query)
    const applySnapshot = (snapshot: ReturnType<typeof subscription.getSnapshot>) => {
      if (snapshot.status === 'error') {
        console.warn('[catalog-realtime] Live subscription failed', snapshot.error.code)
        return
      }

      const row = snapshot.data?.[0]
      const key = 'active-catalog'
      const existing = collection.get(key)
      if (!row) {
        if (existing) collection.delete(key)
        return
      }
      if (!existing) {
        collection.insert(row)
      } else if (existing.updated_at !== row.updated_at || existing.product_count !== row.product_count) {
        collection.update(key, (draft) => Object.assign(draft, row))
      }
    }

    const unsubscribe = subscription.onChange(applySnapshot)
    applySnapshot(subscription.getSnapshot())
    const refresh = new QueryRefreshController({
      query: bootstrap.query,
      refreshQuery: async () => (await fetchBootstrap()).query,
      renewSubscription: (query) => subscription.renew(query),
      onRefreshExhausted: (error) => {
        console.warn(
          '[catalog-realtime] Live query capability refresh failed',
          error instanceof Error ? error.message : 'UnknownError',
        )
      },
      subscription,
    })
    refresh.start()

    return () => {
      refresh.stop()
      unsubscribe()
      subscription.unsubscribe()
    }
  }, [bootstrap.query, client, collection])

  useEffect(() => {
    const version = data?.[0]?.updated_at
    if (version === undefined) return
    if (priorVersion.current === null) {
      priorVersion.current = version
      return
    }
    if (version === priorVersion.current) return
    priorVersion.current = version
    const timeout = setTimeout(() => {
      void mutate((key) => typeof key === 'string' && key.startsWith('/api/products'), undefined, { revalidate: true })
    }, 250)
    return () => clearTimeout(timeout)
  }, [data, mutate])

  return null
}
