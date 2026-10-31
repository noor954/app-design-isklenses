'use client'

import useSWR from 'swr'
import type { Product, ProductAsset, ProductVariant } from '@/lib/hooks/use-storefront-data'

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json()
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('admin-session-expired'))
  }
  if (!response.ok) throw new Error(body.error || 'Unable to load admin data.')
  return body
}

export interface DashboardMetrics {
  orders: {
    totalOrders: number
    pendingOrders: number
    revenueByCurrency: Array<{ currency: string; totalRevenue: string; avgOrderValue: string }>
    ordersByStatus: Record<string, number>
  }
  customers: {
    totalCustomers: number
  }
}

export interface AdminOrder {
  id: string
  orderNumber: number
  customerId: string
  status: string
  paymentMethod: string | null
  shippingFeeConfirmed: boolean
  subtotal: string
  shippingTotal: string
  taxTotal: string
  total: string
  currency: string
  shippingAddress: Record<string, string>
  createdAt: string
  customer: { email: string; firstName: string | null; lastName: string | null } | null
  items: Array<{ id: string; productName: string; powerLeft: string | null; powerRight: string | null; unitPrice: string; quantity: number; lineTotal: string }>
}

export interface AdminCustomer {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  marketingOptIn: boolean
  createdAt: string
}

export interface AdminProduct extends Product {
  assets: ProductAsset[]
  variants: ProductVariant[]
  relatedProductIds: string[]
  seoTitle?: string | null
  seoDescription?: string | null
}

export interface AdminActivity {
  id: number
  entityType: string
  entityId: string
  eventType: string
  createdAt: string
}

export function useAdminMetrics() {
  const { data, error, isLoading, mutate } = useSWR<{ data: DashboardMetrics; timestamp: string }>(
    '/api/admin/metrics',
    fetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true, refreshInterval: 30000, dedupingInterval: 10000 },
  )

  return { metrics: data?.data, isLoading, isError: !!error, error, timestamp: data?.timestamp, mutate }
}

export function useAdminProducts() {
  const { data, error, isLoading, mutate } = useSWR<{ data: AdminProduct[] }>(
    '/api/admin/products',
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30000 },
  )
  return { products: data?.data ?? [], isLoading, isError: !!error, error, mutate }
}

export function useAdminOrders(offset = 0, status = '') {
  const params = new URLSearchParams({ offset: String(offset) })
  if (status) params.set('status', status)
  const { data, error, isLoading, mutate } = useSWR<{ data: AdminOrder[]; total: number }>(
    `/api/admin/orders?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30000 },
  )
  return { orders: data?.data ?? [], total: data?.total ?? 0, isLoading, isError: !!error, error, mutate }
}

export function useAdminCustomers(offset = 0, query = '') {
  const params = new URLSearchParams({ offset: String(offset) })
  if (query) params.set('q', query)
  const { data, error, isLoading, mutate } = useSWR<{ data: AdminCustomer[]; total: number }>(
    `/api/admin/customers?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60000 },
  )
  return { customers: data?.data ?? [], total: data?.total ?? 0, isLoading, isError: !!error, error, mutate }
}

export function useAdminActivity() {
  const { data, error, isLoading, mutate } = useSWR<{ data: AdminActivity[] }>(
    '/api/admin/activity',
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60000 },
  )
  return { activity: data?.data ?? [], isLoading, isError: !!error, error, mutate }
}
