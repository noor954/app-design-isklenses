'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, CircleHelp, Share2, X } from 'lucide-react'
import type { Product } from '@/lib/hooks/use-storefront-data'

const storageKey = 'isk-product-comparison'
const buttonClass = 'inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#15384d] hover:text-[#006f9b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006f9b]'
type ComparedProduct = { slug: string; product: Product | null }

export function ProductActions({ product }: { product: Product }) {
  const [compared, setCompared] = useState<ComparedProduct[] | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function compare() {
    setBusy(true)
    setMessage('')
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]')
      if (!Array.isArray(saved) || !saved.every((slug) => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) throw new Error('The saved comparison is invalid.')
      const atLimit = !saved.includes(product.slug) && saved.length >= 3
      const slugs: string[] = saved.includes(product.slug) || atLimit ? saved : [...saved, product.slug]
      if (atLimit) {
        setMessage('Compare up to three products. Remove one before adding another.')
      }
      const items = await Promise.all(slugs.map(async (slug) => {
        if (slug === product.slug) return { slug, product }
        const response = await fetch(`/api/products/${encodeURIComponent(slug)}`, { cache: 'no-store' })
        if (response.status === 404) return { slug, product: null }
        if (!response.ok) throw new Error('A saved product could not be loaded. Please try again.')
        const body: { data: Product } = await response.json()
        return { slug, product: body.data }
      }))
      sessionStorage.setItem(storageKey, JSON.stringify(slugs))
      setCompared(items)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Comparison is unavailable. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    const url = new URL(`/product/${encodeURIComponent(product.slug)}`, window.location.origin).toString()
    try {
      if (navigator.share) await navigator.share({ title: product.name, url })
      else {
        await navigator.clipboard.writeText(url)
        setMessage('Product link copied.')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setMessage('Could not share the link. Copy it from your browser address bar.')
    }
  }

  const question = `Hello, I have a question about ${product.name}:`
  return (
    <div className="mt-6 w-full border-t border-[#cfe2eb] pt-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <button type="button" className={buttonClass} onClick={compare} disabled={busy}><ArrowLeftRight size={18} aria-hidden="true" />{busy ? 'Loading…' : 'Compare'}</button>
        <a className={buttonClass} href={`https://wa.me/923015740405?text=${encodeURIComponent(question)}`} target="_blank" rel="noopener noreferrer"><CircleHelp size={18} aria-hidden="true" />Ask a question</a>
        <button type="button" className={buttonClass} onClick={share}><Share2 size={18} aria-hidden="true" />Share</button>
      </div>
      {message && <p role="status" className="mt-2 text-sm text-[#526b7b]">{message}</p>}
      {compared && (
        <section aria-label="Product comparison" className="mt-4 rounded-xl border border-[#cfe2eb] bg-[#f7fcff] p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Compare products</h2><button type="button" aria-label="Close comparison" onClick={() => setCompared(null)} className="p-2"><X size={18} /></button></div>
          <p className="mt-1 text-sm text-[#526b7b]">Add up to three products by selecting Compare on their pages.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {compared.map(({ slug, product: item }) => (
              <div key={slug} className="min-w-0 rounded-lg bg-white p-3 text-sm">
                {item ? <>
                  <Link href={`/product/${item.slug}`} className="font-bold text-[#006f9b] hover:underline">{item.name}</Link>
                  <p className="mt-2">{item.currency} {item.price}</p>
                  <p>Brand: {item.brand || 'Not listed'}</p>
                  <p>Diameter: {item.diameterMm ? `${item.diameterMm} mm` : 'Not listed'}</p>
                  <p>Wear: {item.wearDuration || 'Not listed'}</p>
                </> : <p>Product no longer available.</p>}
                <button type="button" className="mt-2 underline" onClick={() => {
                  const remaining = compared.filter((entry) => entry.slug !== slug)
                  try {
                    sessionStorage.setItem(storageKey, JSON.stringify(remaining.map((entry) => entry.slug)))
                    setCompared(remaining)
                  } catch {
                    setMessage('Could not update the comparison. Please try again.')
                  }
                }}>Remove</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
