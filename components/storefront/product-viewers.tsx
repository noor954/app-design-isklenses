'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye } from 'lucide-react'

export function ProductViewers({ slug }: { slug: string }) {
  const [count, setCount] = useState<number | null>(null)
  const session = useRef<{ slug: string; id: string } | null>(null)

  useEffect(() => {
    if (typeof globalThis.crypto?.randomUUID !== 'function') {
      console.error('[product-viewers] Secure random UUIDs are unavailable.')
      return
    }
    if (!session.current || session.current.slug !== slug) {
      session.current = { slug, id: crypto.randomUUID() }
    }
    const viewerId = session.current.id
    let active = true
    let controller: AbortController | null = null
    async function heartbeat() {
      if (document.visibilityState !== 'visible' || controller) return
      controller = new AbortController()
      try {
        const response = await fetch(`/api/products/${encodeURIComponent(slug)}/viewers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewerId }),
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Viewer count request failed (${response.status})`)
        const body: { data?: { count?: unknown } } = await response.json()
        if (!Number.isInteger(body.data?.count) || (body.data?.count as number) < 1) throw new Error('Invalid viewer count')
        if (active && document.visibilityState === 'visible') setCount(body.data?.count as number)
      } catch (error) {
        if (active) {
          console.error('[product-viewers]', error)
          setCount(null)
        }
      } finally {
        controller = null
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void heartbeat()
      else {
        controller?.abort()
        setCount(null)
      }
    }
    void heartbeat()
    const timer = window.setInterval(heartbeat, 60_000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      controller?.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [slug])

  if (count === null) return null
  return <p className="mt-4 flex items-center gap-2 text-sm text-[#314a63]"><Eye size={16} aria-hidden="true" />{count} {count === 1 ? 'viewing session' : 'viewing sessions'} in the last 2 minutes</p>
}
