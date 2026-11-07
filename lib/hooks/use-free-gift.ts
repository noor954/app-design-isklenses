'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GiftChoice } from '@/components/storefront/free-gift-picker'
import type { FreeGiftOffer } from '@/lib/free-gift'

const STORAGE_KEY = 'isk-free-gift-choice'
const CHANGE_EVENT = 'isk-free-gift-change'

function readChoice(): GiftChoice {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { productId?: string | null; confirmed?: boolean }
    if (typeof parsed.confirmed !== 'boolean') return null
    return { productId: parsed.productId ?? null, confirmed: parsed.confirmed }
  } catch {
    return null
  }
}

export function useFreeGiftOffer() {
  const [offer, setOffer] = useState<FreeGiftOffer | null>(null)
  useEffect(() => {
    let active = true
    fetch('/api/storefront/gift')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (active && body?.data) setOffer(body.data as FreeGiftOffer) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])
  return offer
}

/** Gift choice shared by the cart and checkout via localStorage. */
export function useGiftChoice() {
  const [choice, setChoiceState] = useState<GiftChoice>(null)

  useEffect(() => {
    const sync = () => setChoiceState(readChoice())
    sync()
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setChoice = useCallback((next: GiftChoice) => {
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage can be unavailable; the in-memory state still applies.
    }
    setChoiceState(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return [choice, setChoice] as const
}

export function useGiftEligibility(
  offer: FreeGiftOffer | null,
  lines: { quantity: number; product: { categoryId?: string | null; categoryIds?: string[] | null } }[],
  subtotalCents: number,
  hasAppliedDeal: boolean,
) {
  return useMemo(() => {
    const lensUnits = offer?.categoryId
      ? lines.reduce((sum, line) => {
          const ids = line.product.categoryIds?.length ? line.product.categoryIds : line.product.categoryId ? [line.product.categoryId] : []
          return sum + (ids.includes(offer.categoryId as string) ? 0 : line.quantity)
        }, 0)
      : 0
    const eligible = Boolean(
      offer?.config.enabled &&
      offer.products.length &&
      !hasAppliedDeal &&
      subtotalCents >= offer.minimumSubtotalCents &&
      lensUnits >= offer.config.minLensQuantity,
    )
    return { lensUnits, eligible }
  }, [hasAppliedDeal, offer, lines, subtotalCents])
}
