'use client'

import useSWR from 'swr'
import type { PowerLensOption } from '@/lib/power-lens-options'

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Unable to load products.')
  return body
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  shortDescription?: string | null
  category: string | null
  categoryId?: string | null
  categoryIds?: string[]
  categories?: Array<{ id: string; name: string }>
  categoryPath?: string
  brand?: string | null
  brandId?: string | null
  lensShadeId?: string | null
  lensShade?: { id: string; name: string; hex: string | null; imageUrl?: string | null; fallbackImageUrl?: string | null } | null
  lensTypeId?: string | null
  lensType?: { id: string; name: string } | null
  sku?: string | null
  price: string
  compareAtPrice?: string | null
  currency: string
  status: string
  stockQuantity: number
  heroImageUrl: string | null
  colors?: { name: string; hex: string }[]
  diameterMm?: string | null
  baseCurve?: string | null
  waterContent?: string | null
  material?: string | null
  wearDuration?: string | null
  packContents?: string | null
  powerType?: string | null
  powerRange?: string | null
  availablePowerRanges?: string[]
  availablePowerOptions?: PowerLensOption[]
  uvProtection?: boolean
  fdaApproved?: boolean
  features?: string[]
  specs?: { label: string; value: string }[]
  usageInstructions?: string | null
  isFeatured?: boolean
  isNewArrival?: boolean
  isOnSale?: boolean
  ratingAvg?: number | null
  ratingCount?: number
  createdAt: string
  updatedAt: string
  assets?: ProductAsset[]
  variants?: ProductVariant[]
}

export interface ProductVariant {
  id: string
  productId: string
  sku: string | null
  name: string
  color: string | null
  powerDiopters: string | null
  baseCurve: string | null
  diameterMm: string | null
  packSize: number | null
  price: string
  currency: string
  stockQuantity: number
  isActive?: boolean
}

export interface ProductAsset {
  id: string
  productId: string
  blobPathname: string
  blobUrl: string | null
  altText: string | null
  mediaType: 'image' | 'video'
  sortOrder: number
  createdAt: string
}

interface ProductsResponse {
  data: Product[]
  timestamp: string
}

/**
 * Hook for fetching active products with real-time updates via SWR
 * Revalidates every 60 seconds for fresh inventory
 */
export function useProducts(category?: string, search?: string, brand?: string) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (search?.trim()) params.set('q', search.trim())
  if (brand?.trim()) params.set('brand', brand.trim())
  const suffix = params.size ? `?${params.toString()}` : ''
  const url = `/api/products${suffix}`

  const { data, error, isLoading, mutate } = useSWR<ProductsResponse>(url, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 60000,
    focusThrottleInterval: 300000,
    refreshInterval: 60000, // Revalidate every 60 seconds
  })

  return {
    products: data?.data || [],
    isLoading,
    isError: !!error,
    error,
    mutate, // Call this to trigger manual refresh
  }
}

/**
 * Hook for fetching a single product by slug
 */
export function useProduct(slug: string, initialProduct?: Product) {
  const { data, error, isLoading, mutate } = useSWR<{ data: Product }>(slug ? `/api/products/${encodeURIComponent(slug)}` : null, fetcher, {
    fallbackData: initialProduct ? { data: initialProduct } : undefined,
    revalidateOnFocus: true,
    dedupingInterval: 60000,
    refreshInterval: 120000, // Revalidate every 2 minutes for single product
  })

  return {
    product: data?.data || null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
