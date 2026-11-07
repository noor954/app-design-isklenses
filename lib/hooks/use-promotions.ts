'use client'

import useSWR from 'swr'
import type { Promotion } from '@/lib/promotions'

type PromotionResponse = { data?: { promotions?: Promotion[] }; error?: string }

async function fetchPromotions(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json() as PromotionResponse
  if (!response.ok) throw new Error(body.error || 'Promotional offers could not be loaded.')
  if (!Array.isArray(body.data?.promotions)) throw new Error('The promotion response is invalid.')
  return body.data.promotions
}

export function usePromotions() {
  const { data, error, isLoading } = useSWR<Promotion[]>('/api/storefront/deals', fetchPromotions, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 60_000,
    dedupingInterval: 60_000,
  })
  return {
    promotions: data ?? [],
    isLoading,
    isError: Boolean(error),
    error: error instanceof Error ? error.message : '',
  }
}
