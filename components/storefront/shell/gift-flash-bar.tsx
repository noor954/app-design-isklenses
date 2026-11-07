'use client'

import Link from 'next/link'
import { Gift } from 'lucide-react'
import { useFreeGiftOffer } from '@/lib/hooks/use-free-gift'

export function GiftFlashBar() {
  const offer = useFreeGiftOffer()
  if (!offer?.config.enabled || !offer.products.length) return null

  return (
    <Link
      href="/cart"
      className="isk-gift-flash flex min-h-9 items-center justify-center gap-2 bg-[#d3ff48] px-4 py-1.5 text-center text-xs font-extrabold uppercase tracking-[.08em] text-[#0d3a52] sm:text-sm"
    >
      <Gift size={16} aria-hidden="true" className="shrink-0" />
      <span>Choose a free gift on qualifying orders · PKR 2,500 minimum · No lens deal</span>
      <span aria-hidden="true">·</span>
      <span className="rounded-full bg-[#0d3a52] px-2.5 py-0.5 text-[10px] text-[#d3ff48] sm:text-xs">{offer.config.badge || 'New Launch Gift'}</span>
    </Link>
  )
}
