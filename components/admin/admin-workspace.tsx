'use client'

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowDown, ArrowUp, BarChart3, Bot, ClipboardList, Eye, Gift, LayoutDashboard, LoaderCircle,
  AlertTriangle, BadgePercent, Images, LogOut, Package, Plus, RefreshCw, Search, ShoppingBag, ShieldCheck, Sparkles, Star, Tags, Truck, Users, X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR, { useSWRConfig } from 'swr'
import {
  createSystemUser,
  deleteProductAsset,
  updateOrderStatus,
  updateOrderDeliveryFee,
  updateProductStock,
  moveProductAsset,
  updateCustomer,
  getSystemUsers,
  setSystemUserActive,
  resetSystemUserPassword,
  updateOwnSystemUserCredentials,
} from '@/app/actions/admin'
import {
  useAdminActivity,
  useAdminCustomers,
  useAdminMetrics,
  useAdminOrders,
  useAdminProducts,
  type AdminCustomer,
  type AdminOrder,
  type AdminProduct,
} from '@/lib/hooks/use-admin-data'
import { addProductsToCategory, deleteProduct, getAdminCategories, setProductMerchandising } from '@/app/actions/catalog-admin'
import { CategoryManager } from '@/components/admin/category-manager'
import { CatalogSettings } from '@/components/admin/catalog-settings'
import { ChatbotManager } from '@/components/admin/chatbot-manager'
import { ProductEditor } from '@/components/admin/product-editor'
import { ContentManager } from '@/components/admin/content-manager'
import { HomeDesignManager } from '@/components/admin/home-design-manager'
import { FreeGiftManager } from '@/components/admin/free-gift-manager'
import { PowerLensOptionsManager } from '@/components/admin/power-lens-options-manager'
import { BrandManager, ErrorLogManager, LensShadeManager, LensTypeManager } from '@/components/admin/catalog-taxonomy-manager'
import { CatalogSyncManager } from '@/components/admin/catalog-sync-manager'
import { ProjectKanban } from '@/components/admin/project-kanban'
import { DeliveryManager } from '@/components/admin/delivery-manager'
import { ProductVariantManager } from '@/components/admin/product-variant-manager'
import { MerchandisingManager } from '@/components/admin/merchandising-manager'
import { CrmWorkspace } from '@/components/admin/crm-workspace'
import { DataTable, type DataTableBulkAction, type DataTableColumn } from '@/components/admin/data-table'
import { Pagination } from '@/components/ui/pagination'
import { getProductImageSources } from '@/components/storefront/product-image'
import { reportError } from '@/lib/ui/notifications'
import type { AdminSectionId } from '@/lib/admin-sections'

type Section = AdminSectionId

const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'brands', label: 'Brands', icon: Tags },
  { id: 'lens-shades', label: 'Lens shades', icon: Tags },
  { id: 'lens-types', label: 'Lens types', icon: Tags },
  { id: 'catalog-sync', label: 'Catalog sync', icon: RefreshCw },
  { id: 'error-logs', label: 'Error logs', icon: AlertTriangle },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'featured', label: 'Featured', icon: Star },
  { id: 'new-arrivals', label: 'New arrivals', icon: Sparkles },
  { id: 'on-sale', label: 'On sale', icon: BadgePercent },
  { id: 'catalog-settings', label: 'Reviews & product page', icon: ClipboardList },
  { id: 'chatbot', label: 'Chatbot', icon: Bot },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'content', label: 'Storefront content', icon: Tags },
  { id: 'home-design', label: 'Home and design', icon: Images },
  { id: 'power-options', label: 'Power lens options', icon: Eye },
  { id: 'free-gift', label: 'Free gift', icon: Gift },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'system-users', label: 'System users', icon: Users },
  { id: 'project-plan', label: 'Project Kanban', icon: ClipboardList },
]

function currencyLabel(value: string, currency: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${currency} ${value}`
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function PanelHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-.04em]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68675f]">{description}</p>
      </div>
      {action}
    </div>
  )
}

function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) {
  const color = tone === 'error' ? 'border-[#9b4a36]/25 bg-[#f8eeeb] text-[#753b2d]' : 'border-[#52624f]/20 bg-[#e2e7df] text-[#465342]'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm leading-5 ${color}`}>{children}</div>
}

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-[#e8e6e0]" />)}
    </div>
  )
}

function AdminLogin({
  onSignedIn,
  configurationMessage,
  prefill,
}: {
  onSignedIn: (email: string, role: string, expiresAt: number) => void
  configurationMessage?: string
  prefill?: { email: string; password: string }
}) {
  const [email, setEmail] = useState(prefill?.email ?? '')
  const [password, setPassword] = useState(prefill?.password ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.')
      if (typeof result.expiresAt !== 'number') throw new Error('The sign-in session could not be established. Try again.')
      onSignedIn(result.email, result.role, result.expiresAt)
    } catch (submitError) {
      setError(reportError(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg rounded-2xl border border-[#1c1c1a]/10 bg-white p-6 sm:p-8">
      <div className="mb-6 grid size-11 place-items-center rounded-full bg-[#e2e7df] text-[#52624f]"><ShieldCheck size={20} /></div>
      <h1 className="text-2xl font-semibold tracking-[-.04em]">Admin sign in</h1>
      <p className="mt-2 text-sm leading-6 text-[#68675f]">Sign in to view store operations and customer information.</p>
      {configurationMessage ? (
        <div className="mt-5 space-y-3">
          <Notice>{configurationMessage}</Notice>
          <p className="text-xs leading-5 text-[#68675f]">Configure `ADMIN_SESSION_SECRET` and apply the system-user database migration before signing in.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <Notice>{error}</Notice>}
          <label className="block text-sm font-medium">
            Email
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#1c1c1a]/15 bg-white px-3 py-2.5 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1a]"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#1c1c1a]/15 bg-white px-3 py-2.5 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1a]"
            />
          </label>
          {prefill && <p className="text-xs leading-5 text-[#68675f]">Local development shortcut. Credentials are never prefilled on deployed environments.</p>}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1c1c1a] px-4 py-3 text-sm font-medium text-white hover:bg-[#353531] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1a] disabled:cursor-wait disabled:opacity-60"
          >
            {submitting && <LoaderCircle size={16} className="animate-spin" />}
            {submitting ? 'Signing in…' : prefill ? 'Quick sign in' : 'Sign in'}
          </button>
          <a href="/admin/forgot-password" className="block text-center text-sm text-[#68675f] underline">Forgot password?</a>
        </form>
      )}
    </section>
  )
}

function AdminOverview({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { metrics, isLoading, isError, error, mutate } = useAdminMetrics()
  const { orders, isLoading: ordersLoading, isError: ordersError, error: ordersLoadError, mutate: mutateOrders } = useAdminOrders()
  const { products, isLoading: productsLoading, isError: productsError, error: productsLoadError, mutate: mutateProducts } = useAdminProducts()

  async function refresh() {
    await Promise.all([mutate(), mutateOrders(), mutateProducts()])
  }

  return (
    <section className="min-w-0 flex-1">
      <PanelHeading
        title="Store overview"
        description="Current catalog, order, and customer totals from the connected database."
        action={<button type="button" onClick={() => void refresh()} className="rounded-full border border-[#1c1c1a]/15 bg-white px-4 py-2.5 text-sm hover:bg-[#f2f1ed] focus-visible:outline-2 focus-visible:outline-[#1c1c1a]">Refresh data</button>}
      />
      {(isError || productsError || ordersError) && <div className="mb-5"><Notice>{errorMessage(error ?? productsLoadError ?? ordersLoadError)}</Notice></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Catalog products" value={productsLoading || productsError ? '—' : String(products.length)} icon={<Package size={18} />} />
        <MetricCard label="All orders" value={isLoading || !metrics ? '—' : String(metrics.orders.totalOrders)} icon={<ShoppingBag size={18} />} />
        <MetricCard label="Pending orders" value={isLoading || !metrics ? '—' : String(metrics.orders.pendingOrders)} icon={<Activity size={18} />} />
        <MetricCard label="Customers" value={isLoading || !metrics ? '—' : String(metrics.customers.totalCustomers)} icon={<Users size={18} />} />
      </div>
      <section className="mt-6 rounded-2xl border border-[#1c1c1a]/10 bg-white p-5">
        <h2 className="font-medium">Recognized order value</h2>
        <p className="mt-1 text-xs leading-5 text-[#68675f]">COD value counts only after payment is marked paid. Other orders follow their recorded paid, processing, shipped, or delivered states.</p>
        {isError ? (
          <p className="mt-4 text-sm text-[#753b2d]">Order value could not be loaded.</p>
        ) : isLoading || !metrics ? (
          <div className="mt-5 h-8 w-48 animate-pulse rounded bg-[#e8e6e0]" />
        ) : metrics.orders.revenueByCurrency.length ? (
          <div className="mt-4 flex flex-wrap gap-4">
            {metrics.orders.revenueByCurrency.map((item) => (
              <div key={item.currency} className="min-w-40">
                <p className="text-xs text-[#68675f]">{item.currency}</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-.04em]">{currencyLabel(item.totalRevenue, item.currency)}</p>
                <p className="mt-1 text-xs text-[#68675f]">Average {currencyLabel(item.avgOrderValue, item.currency)}</p>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-[#68675f]">No recognized orders yet.</p>}
      </section>
      <section className="mt-6 rounded-2xl border border-[#1c1c1a]/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-medium">Recent orders</h2><p className="mt-1 text-xs text-[#68675f]">Latest records from the shared store database.</p></div>
          <button type="button" onClick={() => onNavigate('orders')} className="text-sm underline underline-offset-4">Open orders</button>
        </div>
        {ordersLoading ? <p className="mt-5 text-sm text-[#68675f]">Loading orders…</p> : ordersError ? <p className="mt-5 text-sm text-[#753b2d]">Order data is unavailable.</p> : orders.length === 0 ? (
          <p className="mt-5 text-sm text-[#68675f]">No orders have been recorded.</p>
        ) : (
          <div className="mt-4 divide-y divide-[#1c1c1a]/10">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-medium">Order #{order.orderNumber}</span>
                <span className="text-[#68675f]">{order.customer?.email ?? 'Customer unavailable'}</span>
                <span className="rounded-full bg-[#f2f1ed] px-2.5 py-1 text-xs capitalize">{order.status}</span>
                <span>{currencyLabel(order.total, order.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#1c1c1a]/10 bg-white p-5">
      <span className="text-[#65645e]">{icon}</span>
      <p className="mt-5 text-xs text-[#68675f]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-.04em]">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-medium text-[#55544e]">{label}<div className="mt-1.5">{children}</div></label>
}

const inputClass = 'w-full rounded-lg border border-[#1c1c1a]/15 bg-white px-3 py-2.5 text-sm text-[#1c1c1a] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1c1c1a]'
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#1c1c1a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#353531] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1a] disabled:cursor-wait disabled:opacity-60'
const secondaryButton = 'rounded-full border border-[#1c1c1a]/15 bg-white px-4 py-2.5 text-sm hover:bg-[#f2f1ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1a] disabled:opacity-60'

function ProductWorkspace({ canEdit }: { canEdit: boolean }) {
  const { products, isLoading, isError, error, mutate } = useAdminProducts()
  const { mutate: globalMutate } = useSWRConfig()
  const { data: categories = [] } = useSWR(canEdit ? 'admin-product-categories' : null, () => getAdminCategories())
  const [editing, setEditing] = useState<AdminProduct | undefined>()
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'error' | 'info'>('error')
  const [busyId, setBusyId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [categoryId, setCategoryId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.category} ${product.slug}`.toLowerCase().includes(query.toLowerCase())), [products, query])
  const visibleProducts = filtered.slice(offset, offset + 20)
  const selectedProducts = products.filter((product) => selectedIds.has(product.id))
  const pageSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.has(product.id))
  useEffect(() => { setOffset(0) }, [query])
  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => products.some((product) => product.id === id))))
  }, [products])

  async function refresh() {
    setCreating(false)
    setEditing(undefined)
    await Promise.all([mutate(), globalMutate('/api/products'), globalMutate('/api/admin/metrics'), globalMutate('admin-product-categories')])
  }

  async function changeStock(product: AdminProduct, quantity: number) {
    setBusyId(product.id)
    setMessage('')
    try {
      await updateProductStock(product.id, quantity)
      await refresh()
    } catch (updateError) {
      setMessage(reportError(updateError))
      setMessageTone('error')
    } finally {
      setBusyId('')
    }
  }

  async function archive(product: AdminProduct) {
    if (!window.confirm(`Permanently delete ${product.name}, its options and media? Past orders are kept.`)) return
    setBusyId(product.id)
    setMessage('')
    try {
      await deleteProduct(product.id)
      await refresh()
    } catch (deleteError) {
      setMessage(reportError(deleteError))
      setMessageTone('error')
    } finally {
      setBusyId('')
    }
  }

  function togglePageSelection() {
    const next = new Set(selectedIds)
    if (pageSelected) visibleProducts.forEach((product) => next.delete(product.id))
    else visibleProducts.forEach((product) => next.add(product.id))
    if (next.size > 100) {
      setMessage('Select no more than 100 products for a bulk update.')
      setMessageTone('error')
      return
    }
    setMessage('')
    setSelectedIds(next)
  }

  function toggleProductSelection(productId: string) {
    const next = new Set(selectedIds)
    if (next.has(productId)) next.delete(productId)
    else if (next.size < 100) next.add(productId)
    else {
      setMessage('Select no more than 100 products for a bulk update.')
      setMessageTone('error')
      return
    }
    setMessage('')
    setSelectedIds(next)
  }

  async function runBulkAction(action: () => Promise<void>, successMessage: string) {
    setBulkBusy(true)
    setMessage('')
    try {
      await action()
      setSelectedIds(new Set())
      await refresh()
      setMessage(successMessage)
      setMessageTone('info')
    } catch (bulkError) {
      setMessage(reportError(bulkError))
      setMessageTone('error')
    } finally {
      setBulkBusy(false)
    }
  }

  function setMerchandising(kind: 'featured' | 'new_arrival' | 'on_sale', selected: boolean) {
    return runBulkAction(
      () => setProductMerchandising([...selectedIds], kind, selected),
      `${selectedIds.size} products ${selected ? 'added to' : 'removed from'} ${kind === 'new_arrival' ? 'New Arrivals' : kind === 'on_sale' ? 'On Sale' : 'Featured'}.`,
    )
  }

  return (
    <section className="min-w-0 flex-1">
      <PanelHeading
        title="Products"
        description="Every product belongs to a category. Manage listings, lens options and media here."
        action={<div className="flex flex-wrap gap-2">
          {canEdit && <button type="button" onClick={() => { setEditing(undefined); setCreating(true) }} className={primaryButton}><Plus size={16} /> Add product</button>}
        </div>}
      />
      {(message || isError) && <div className="mb-4"><Notice tone={message ? messageTone : 'error'}>{message || errorMessage(error)}</Notice></div>}
      {(creating || editing) && <div className="mb-5"><ProductEditor key={editing?.id ?? 'new-product'} product={editing} onSaved={() => void refresh()} onCancel={() => { setCreating(false); setEditing(undefined) }} /></div>}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#1c1c1a]/10 bg-white px-3">
        <Search size={16} className="text-[#68675f]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter catalog" aria-label="Filter products" className="w-full bg-transparent py-3 text-sm outline-none" />
      </div>
      {canEdit && (
        <div className="mb-4 rounded-xl border border-[#1c1c1a]/10 bg-[#f7f6f2] p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 pr-2 text-sm text-[#4c4b45]">
              <input type="checkbox" checked={pageSelected} disabled={bulkBusy} onChange={togglePageSelection} aria-label="Select all products on this page" className="size-4 accent-[#1c1c1a]" />
              Select page
            </label>
            <span className="mr-auto text-sm text-[#68675f]">{selectedIds.size} selected</span>
            {selectedIds.size > 0 && <>
              <select aria-label="Category to add to selected products" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={`${inputClass} w-full min-w-48 sm:w-auto`}>
                <option value="">Add to category…</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{'—'.repeat(category.depth)}{category.name}</option>)}
              </select>
              <button type="button" disabled={bulkBusy || !categoryId} onClick={() => void runBulkAction(() => addProductsToCategory([...selectedIds], categoryId), `${selectedIds.size} products added to the selected category.`)} className={secondaryButton}>Add category</button>
              <button type="button" disabled={bulkBusy} onClick={() => void setMerchandising('featured', !selectedProducts.every((product) => product.isFeatured))} className={secondaryButton}>
                {selectedProducts.every((product) => product.isFeatured) ? 'Remove Featured' : 'Feature selected'}
              </button>
              <button type="button" disabled={bulkBusy} onClick={() => void setMerchandising('new_arrival', !selectedProducts.every((product) => product.isNewArrival))} className={secondaryButton}>
                {selectedProducts.every((product) => product.isNewArrival) ? 'Remove New Arrivals' : 'Mark New Arrivals'}
              </button>
              <button type="button" disabled={bulkBusy} onClick={() => void setMerchandising('on_sale', !selectedProducts.every((product) => product.isOnSale))} className={secondaryButton}>
                {selectedProducts.every((product) => product.isOnSale) ? 'Remove On Sale' : 'Mark On Sale'}
              </button>
              <button type="button" disabled={bulkBusy} onClick={() => { setSelectedIds(new Set()); setMessage('') }} className="rounded-full px-3 py-2 text-sm text-[#68675f] underline underline-offset-4">Clear</button>
            </>}
          </div>
        </div>
      )}
      {isLoading ? <LoadingRows label="Loading products" /> : isError ? null : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1c1c1a]/20 bg-white/60 px-5 py-10 text-center text-sm text-[#68675f]">
          {products.length ? 'No products match this filter.' : 'No products are in the catalog yet. Create a category first, then add a product.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleProducts.map((product) => (
            <ProductRow
              key={`${product.id}-${product.stockQuantity}`}
              product={product}
              canEdit={canEdit}
              selected={selectedIds.has(product.id)}
              selectionDisabled={bulkBusy}
              onSelect={() => toggleProductSelection(product.id)}
              busy={busyId === product.id}
              onEdit={() => { setCreating(false); setEditing(product) }}
              onArchive={() => void archive(product)}
              onStock={(quantity) => void changeStock(product, quantity)}
              onRefresh={() => void refresh()}
            />
          ))}
        </div>
      )}
      <Pagination total={filtered.length} page={Math.floor(offset / 20) + 1} pageSize={20} onPageChange={(page) => setOffset((page - 1) * 20)} itemLabel="products" className="mt-4" />
    </section>
  )
}

function ProductRow({
  product,
  canEdit,
  selected,
  selectionDisabled,
  onSelect,
  busy,
  onEdit,
  onArchive,
  onStock,
  onRefresh,
}: {
  product: AdminProduct
  canEdit: boolean
  selected: boolean
  selectionDisabled: boolean
  onSelect: () => void
  busy: boolean
  onEdit: () => void
  onArchive: () => void
  onStock: (quantity: number) => void
  onRefresh: () => void
}) {
  const [quantity, setQuantity] = useState(String(product.stockQuantity))
  const [mediaExpanded, setMediaExpanded] = useState(false)
  const [variantsExpanded, setVariantsExpanded] = useState(false)
  const [assetMessage, setAssetMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const { mutate: globalMutate } = useSWRConfig()

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const files = form.getAll('file').filter((value): value is File => value instanceof File && value.size > 0)
    if (files.length === 0) return
    const altText = String(form.get('altText') ?? '')
    setUploading(true)
    setAssetMessage('')
    try {
      for (const file of files) {
        const fileForm = new FormData()
        fileForm.append('file', file)
        fileForm.append('altText', altText)
        const response = await fetch(`/api/admin/products/${product.id}/assets`, { method: 'POST', body: fileForm })
        const result = await response.json()
        if (response.status === 401) window.dispatchEvent(new Event('admin-session-expired'))
        if (!response.ok) throw new Error(result.error || `Product media upload failed for ${file.name}.`)
      }
      await Promise.all([globalMutate('/api/admin/products'), globalMutate('/api/products'), globalMutate(`/api/products/${product.slug}`)])
      formElement.reset()
      onRefresh()
      setAssetMessage(`${files.length} ${files.length === 1 ? 'file' : 'files'} uploaded successfully.`)
    } catch (uploadError) {
      setAssetMessage(reportError(uploadError, 'Product media could not be uploaded.'))
    } finally {
      setUploading(false)
    }
  }

  async function removeAsset(assetId: string) {
    setAssetMessage('')
    try {
      const response = await fetch(`/api/admin/assets/${assetId}`, { method: 'DELETE' })
      const result = await response.json()
      if (response.status === 401) window.dispatchEvent(new Event('admin-session-expired'))
      if (!response.ok) throw new Error(result.error || 'Product media deletion failed.')
      await Promise.all([globalMutate('/api/admin/products'), globalMutate('/api/products')])
      onRefresh()
    } catch (removeError) {
      setAssetMessage(reportError(removeError, 'Product media could not be removed.'))
    }
  }

  async function reorderAsset(assetId: string, direction: 'up' | 'down') {
    setAssetMessage('')
    try {
      await moveProductAsset(assetId, direction)
      await Promise.all([globalMutate('/api/admin/products'), globalMutate('/api/products'), globalMutate(`/api/products/${product.slug}`)])
      onRefresh()
    } catch (reorderError) {
      setAssetMessage(reportError(reorderError, 'Product media could not be reordered.'))
    }
  }

  const activeVariants = product.variants.some((variant) => variant.isActive !== false)
  const previewImage = getProductImageSources(product)[0]

  return (
    <article className="rounded-2xl border border-[#1c1c1a]/10 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {canEdit && <input type="checkbox" checked={selected} disabled={selectionDisabled} onChange={onSelect} aria-label={`Select ${product.name}`} className="mt-5 size-4 shrink-0 accent-[#1c1c1a]" />}
          {previewImage ? <img src={previewImage} alt="" className="size-14 shrink-0 rounded-lg object-cover" /> : <div aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-lg bg-[#f2f1ed]"><Package size={18} /></div>}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">{product.name}</h2>
            <p className="mt-1 text-xs text-[#68675f]">{product.category} · {product.slug}</p>
            <p className="mt-1 text-xs text-[#68675f]">{currencyLabel(product.price, product.currency)} · <span className="capitalize">{product.status}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && !activeVariants && <>
            <label className="sr-only" htmlFor={`stock-${product.id}`}>Stock quantity for {product.name}</label>
            <input id={`stock-${product.id}`} type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-20 rounded-lg border border-[#1c1c1a]/15 px-2 py-2 text-sm" />
            <button type="button" disabled={busy || !/^\d+$/.test(quantity) || Number(quantity) === product.stockQuantity} onClick={() => onStock(Number(quantity))} className={secondaryButton}>Save stock</button>
          </>}
          {canEdit && <>
            <button type="button" disabled={busy} onClick={onEdit} className={secondaryButton}>Edit</button>
            <button type="button" disabled={busy} onClick={onArchive} className="rounded-full border border-[#9b4a36]/30 px-4 py-2.5 text-sm text-[#753b2d] hover:bg-[#f8eeeb] disabled:opacity-60">Delete</button>
          </>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        <button type="button" aria-expanded={variantsExpanded} onClick={() => setVariantsExpanded((value) => !value)} className="text-xs underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#1c1c1a]">
          {variantsExpanded ? 'Hide lens options' : `Manage lens options (${product.variants.length})`}
        </button>
        <button type="button" aria-expanded={mediaExpanded} onClick={() => setMediaExpanded((value) => !value)} className="text-xs underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#1c1c1a]">
          {mediaExpanded ? 'Hide product media' : `Manage product media (${product.assets.length})`}
        </button>
      </div>
      {variantsExpanded && <ProductVariantManager product={product} canEdit={canEdit} onChanged={onRefresh} />}
      {mediaExpanded && (
        <div className="mt-4 border-t border-[#1c1c1a]/10 pt-4">
          {assetMessage && <div className="mb-3"><Notice>{assetMessage}</Notice></div>}
          {canEdit && <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
            <Field label="Images or videos"><input name="file" type="file" required multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" className="max-w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[#f2f1ed] file:px-3 file:py-2" /></Field>
            <Field label="Alternative text or caption"><input name="altText" maxLength={500} placeholder={product.name} className={`${inputClass} min-w-48`} /></Field>
            <button type="submit" disabled={uploading} className={primaryButton}>{uploading && <LoaderCircle size={15} className="animate-spin" />}{uploading ? 'Uploading…' : 'Upload media'}</button>
          </form>}
          <p className="mt-2 text-xs text-[#68675f]">JPEG, PNG, WebP, AVIF, MP4, or WebM · maximum 4 MB per file.</p>
          {product.assets.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-3">
              {product.assets.map((asset, index) => (
                <li key={asset.id} className="w-24">
                  {asset.blobUrl && asset.mediaType === 'video'
                    ? <video src={asset.blobUrl} controls preload="metadata" aria-label={asset.altText || `${product.name} video ${index + 1}`} className="h-20 w-24 bg-[#1c1c1a] object-cover" />
                    : asset.blobUrl
                      ? <img src={asset.blobUrl} alt={asset.altText ?? ''} className="h-20 w-24 object-cover" />
                      : <div className="grid h-20 w-24 place-items-center bg-[#f2f1ed] text-xs">Missing media URL</div>}
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="truncate text-xs uppercase text-[#68675f]">{asset.mediaType} · {index + 1}</span>
                    {canEdit && <div className="flex">
                      <button type="button" disabled={index === 0} onClick={() => void reorderAsset(asset.id, 'up')} aria-label={`Move ${asset.mediaType} ${index + 1} earlier`} className="grid size-7 place-items-center hover:bg-[#f2f1ed] disabled:opacity-35"><ArrowUp size={13} /></button>
                      <button type="button" disabled={index === product.assets.length - 1} onClick={() => void reorderAsset(asset.id, 'down')} aria-label={`Move ${asset.mediaType} ${index + 1} later`} className="grid size-7 place-items-center hover:bg-[#f2f1ed] disabled:opacity-35"><ArrowDown size={13} /></button>
                      <button type="button" onClick={() => void removeAsset(asset.id)} aria-label={`Delete ${asset.altText || `product ${asset.mediaType}`}`} className="grid size-7 place-items-center text-[#753b2d] hover:bg-[#f8eeeb]"><X size={13} /></button>
                    </div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}

function OrdersWorkspace({ canEdit }: { canEdit: boolean }) {
  const [offset, setOffset] = useState(0)
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState('')
  const { orders, total, isLoading, isError, error, mutate } = useAdminOrders(offset, filter)
  const { mutate: globalMutate } = useSWRConfig()

  useEffect(() => { setOffset(0) }, [filter])
  useEffect(() => {
    if (!isLoading && offset >= total && offset > 0) setOffset(Math.max(0, Math.floor((total - 1) / 50) * 50))
  }, [isLoading, offset, total])

  async function changeStatus(orderId: string, status: string) {
    setSaving(orderId)
    setMessage('')
    try {
      await updateOrderStatus(orderId, status)
      await Promise.all([mutate(), globalMutate('/api/admin/metrics'), globalMutate('/api/admin/activity')])
    } catch (statusError) {
      setMessage(reportError(statusError, 'The order status could not be changed.'))
    } finally {
      setSaving('')
    }
  }

  async function confirmDeliveryFee(orderId: string, fee: string) {
    setSaving(orderId)
    setMessage('')
    try {
      await updateOrderDeliveryFee(orderId, fee)
      await Promise.all([mutate(), globalMutate('/api/admin/metrics'), globalMutate('/api/admin/activity')])
    } catch (feeError) {
      setMessage(reportError(feeError, 'The delivery fee could not be saved.'))
    } finally {
      setSaving('')
    }
  }

  return (
    <section className="min-w-0 flex-1">
      <PanelHeading title="Orders" description={`${total ? `Showing ${offset + 1}–${Math.min(offset + orders.length, total)} of ${total}` : 'No orders'} from the shared database. Status changes are validated and audit logged.`} />
      {message && <div className="mb-4"><Notice>{message}</Notice></div>}
      {isError && <div className="mb-4"><Notice>{errorMessage(error)}</Notice></div>}
      <label className="mb-4 block max-w-xs text-xs font-medium text-[#55544e]">Filter status
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className={`${inputClass} mt-1.5`}>
          <option value="">All statuses</option>
          {['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      {isLoading ? <LoadingRows label="Loading orders" /> : isError ? null : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1c1c1a]/20 bg-white/60 px-5 py-10 text-center text-sm text-[#68675f]">No matching orders are recorded.</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              saving={saving === order.id}
              canEdit={canEdit}
              onStatus={(status) => void changeStatus(order.id, status)}
              onDeliveryFee={(fee) => void confirmDeliveryFee(order.id, fee)}
            />
          ))}
        </div>
      )}
      <Pagination total={total} page={Math.floor(offset / 50) + 1} pageSize={50} onPageChange={(page) => setOffset((page - 1) * 50)} itemLabel="orders" className="mt-4" />
    </section>
  )
}

function OrderRow({
  order,
  saving,
  canEdit,
  onStatus,
  onDeliveryFee,
}: {
  order: AdminOrder
  saving: boolean
  canEdit: boolean
  onStatus: (status: string) => void
  onDeliveryFee: (fee: string) => void
}) {
  const customerName = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ')
  const [deliveryFee, setDeliveryFee] = useState(order.shippingTotal)
  const codOrder = order.paymentMethod === 'cash_on_delivery'
  const canConfirmDeliveryFee = codOrder && (order.status === 'pending' || order.status === 'processing')
  useEffect(() => setDeliveryFee(order.shippingTotal), [order.shippingTotal])
  return (
    <article className="rounded-2xl border border-[#1c1c1a]/10 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Order #{order.orderNumber}</h2>
          <p className="mt-1 text-xs text-[#68675f]">{customerName || order.customer?.email || 'Customer unavailable'}{customerName && order.customer?.email ? ` · ${order.customer.email}` : ''}</p>
          <p className="mt-1 text-xs text-[#68675f]">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{currencyLabel(order.total, order.currency)}</p>
          <p className="mt-1 text-xs text-[#68675f]">
            {codOrder ? `Cash on delivery · ${order.status === 'paid' ? 'paid' : order.status === 'refunded' ? 'refunded' : 'not paid'}` : order.paymentMethod ?? 'Payment method not recorded'}
          </p>
          <label className="mt-2 block text-left text-xs text-[#68675f]">Order status
            <select disabled={!canEdit || saving} value={order.status} onChange={(event) => onStatus(event.target.value)} className="mt-1 block rounded-lg border border-[#1c1c1a]/15 bg-white px-2 py-1.5 text-xs capitalize disabled:cursor-not-allowed disabled:opacity-60">
              {['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
      </div>
      <details className="mt-4 border-t border-[#1c1c1a]/10 pt-3">
        <summary className="cursor-pointer text-xs underline underline-offset-4">Items and shipping details</summary>
        <ul className="mt-3 space-y-2">
          {order.items.map((item) => <li key={item.id} className="flex justify-between gap-3 text-xs"><span>{item.productName} × {item.quantity}{(item.powerLeft || item.powerRight) && <span className="mt-1 block text-[#526b7b]">Left eye: {item.powerLeft ?? '—'} D · Right eye: {item.powerRight ?? '—'} D</span>}</span><span>{currencyLabel(item.lineTotal, order.currency)}</span></li>)}
        </ul>
        <div className="mt-3 text-xs leading-5 text-[#68675f]">
          <p className="font-medium text-[#1c1c1a]">Shipping address</p>
          {Object.entries(order.shippingAddress ?? {}).map(([key, value]) => (
            <p key={key}>{String(value)}</p>
          ))}
        </div>
        {codOrder && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onDeliveryFee(deliveryFee)
            }}
            className="mt-4 border-t border-[#1c1c1a]/10 pt-4"
          >
            <label className="block text-xs font-medium text-[#55544e]">
              Delivery fee {order.shippingFeeConfirmed ? '· confirmed' : '· not confirmed'}
              <span className="mt-1 block text-xs font-normal leading-5 text-[#68675f]">Enter the amount agreed with the customer. Enter 0 to confirm no delivery fee.</span>
              <span className="mt-2 flex flex-wrap gap-2 sm:max-w-sm">
                <input
                  value={deliveryFee}
                  onChange={(event) => setDeliveryFee(event.target.value)}
                  inputMode="decimal"
                  pattern="\d{1,10}(\.\d{1,2})?"
                  maxLength={16}
                  required
                  disabled={!canEdit || !canConfirmDeliveryFee || saving}
                  aria-label={`Delivery fee for order ${order.orderNumber}`}
                  className={inputClass}
                />
                <button type="submit" disabled={!canEdit || !canConfirmDeliveryFee || saving} className={primaryButton}>
                  {order.shippingFeeConfirmed ? 'Update fee' : 'Confirm fee'}
                </button>
              </span>
            </label>
            <p className="mt-2 text-xs leading-5 text-[#68675f]">Current COD total: {currencyLabel(order.total, order.currency)}. Confirm delivery charges with the customer before dispatch; shipping is blocked until this fee is confirmed.</p>
          </form>
        )}
      </details>
    </article>
  )
}

function CustomersWorkspace() {
  const [offset, setOffset] = useState(0)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())
  const { customers, total, isLoading, isError, error, mutate } = useAdminCustomers(offset, deferredQuery)
  const { mutate: globalMutate } = useSWRConfig()
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState('')

  useEffect(() => { setOffset(0) }, [deferredQuery])

  async function updateMarketing(customer: AdminCustomer, marketingOptIn: boolean) {
    setSaving(customer.id)
    setMessage('')
    try {
      await updateCustomer(customer.id, { marketingOptIn })
      await Promise.all([mutate(), globalMutate('/api/admin/activity')])
    } catch (updateError) {
      setMessage(reportError(updateError, 'The customer details could not be saved.'))
    } finally {
      setSaving('')
    }
  }

  return (
    <section className="min-w-0 flex-1">
      <PanelHeading title="Customers" description="Customer records from the shared database. Personal data is shown only to signed-in admins." />
      {(message || isError) && <div className="mb-4"><Notice>{message || errorMessage(error)}</Notice></div>}
      {isLoading ? <LoadingRows label="Loading customers" /> : isError ? null : customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1c1c1a]/20 bg-white/60 px-5 py-10 text-center text-sm text-[#68675f]">{deferredQuery ? 'No customers match this search.' : 'No customer records are in the database.'}</div>
      ) : (
        <DataTable
          rows={customers}
          getRowId={(customer) => customer.id}
          itemLabel="customers"
          emptyMessage="No customer records are available."
          searchable={false}
          toolbarContent={<label className="flex min-w-[min(100%,16rem)] flex-1 items-center gap-2 rounded-xl border border-[#b8d4e0] bg-white px-3">
            <Search size={16} className="shrink-0 text-[#526b7b]" aria-hidden="true" />
            <span className="sr-only">Search customers</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="w-full bg-transparent py-2.5 text-sm text-[#15384d] outline-none placeholder:text-[#526b7b]" />
          </label>}
          serverPagination={{ total, offset, pageSize: 50, onOffsetChange: setOffset }}
          columns={[
            { id: 'customer', header: 'Customer', sortValue: (customer) => [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email, searchValue: (customer) => `${customer.firstName ?? ''} ${customer.lastName ?? ''} ${customer.email}`, className: 'min-w-[220px]', cell: (customer) => <><p className="font-medium">{[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Name not provided'}</p><p className="mt-1 text-xs text-[#526b7b]">{customer.email}</p></> },
            { id: 'phone', header: 'Phone', searchValue: (customer) => customer.phone ?? '', cell: (customer) => customer.phone || '—' },
            { id: 'joined', header: 'Joined', sortValue: (customer) => new Date(customer.createdAt).getTime(), className: 'text-xs', cell: (customer) => new Date(customer.createdAt).toLocaleDateString() },
            { id: 'marketing', header: 'Marketing', sortValue: (customer) => Number(customer.marketingOptIn), cell: (customer) => <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={customer.marketingOptIn} disabled={saving === customer.id} onChange={(event) => void updateMarketing(customer, event.target.checked)} className="size-4 accent-[#006f9b]" />
              {customer.marketingOptIn ? 'Opted in' : 'Not opted in'}
            </label> },
          ] as DataTableColumn<AdminCustomer>[]}
          exportRow={(customer) => ({ Email: customer.email, Name: [customer.firstName, customer.lastName].filter(Boolean).join(' '), Phone: customer.phone, 'Marketing opt-in': customer.marketingOptIn, 'Joined at': customer.createdAt })}
        />
      )}
    </section>
  )
}

type AdminSystemUser = {
  id: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

function SystemUsersWorkspace({ signedInUserId, signedInEmail }: { signedInUserId: string; signedInEmail: string }) {
  const [users, setUsers] = useState<AdminSystemUser[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [ownerEmail, setOwnerEmail] = useState(signedInEmail)
  const [ownerPassword, setOwnerPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyUserId, setBusyUserId] = useState('')
  const [resetTargetId, setResetTargetId] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'error' | 'info'>('error')
  const [loadError, setLoadError] = useState('')

  async function refreshUsers() {
    setLoading(true)
    setLoadError('')
    try {
      setUsers(await getSystemUsers())
    } catch (loadFailure) {
      setLoadError(reportError(loadFailure, 'System users could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshUsers() }, [])

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await createSystemUser({ email, password, role })
      setEmail('')
      setPassword('')
      setMessageTone('info')
      setMessage('System user created. Share the initial password with them securely.')
      await refreshUsers()
    } catch (createError) {
      setMessageTone('error')
      setMessage(reportError(createError, 'The user could not be created.'))
    } finally {
      setSaving(false)
    }
  }

  async function changeActiveState(user: AdminSystemUser) {
    const nextActive = !user.isActive
    if (!nextActive && !window.confirm(`Deactivate ${user.email}? Their active admin sessions will stop working.`)) return
    setBusyUserId(user.id)
    setMessage('')
    try {
      const updated = await setSystemUserActive(user.id, nextActive)
      setUsers((current) => current.map((entry) => entry.id === updated.id ? updated : entry))
      setMessageTone('info')
      setMessage(nextActive ? 'System user activated.' : 'System user deactivated; their sessions were revoked.')
    } catch (updateError) {
      setMessageTone('error')
      setMessage(reportError(updateError, 'The user could not be updated.'))
    } finally {
      setBusyUserId('')
    }
  }

  async function changeSelectedUsersState(selected: AdminSystemUser[], isActive: boolean) {
    setMessage('')
    try {
      for (const user of selected) {
        if (user.isActive === isActive) continue
        const updated = await setSystemUserActive(user.id, isActive)
        setUsers((current) => current.map((entry) => entry.id === updated.id ? updated : entry))
      }
      setMessageTone('info')
      setMessage(isActive ? 'Selected system users activated.' : 'Selected system users deactivated; their sessions were revoked.')
    } catch (error) {
      setMessageTone('error')
      setMessage(reportError(error, 'Some system users could not be updated.'))
      await refreshUsers()
      throw error
    }
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>, user: AdminSystemUser) {
    event.preventDefault()
    setBusyUserId(user.id)
    setMessage('')
    try {
      await resetSystemUserPassword(user.id, resetPassword)
      setResetTargetId('')
      setResetPassword('')
      setMessageTone('info')
      setMessage(`Password reset for ${user.email}. Their sessions were signed out; share the new password securely.`)
    } catch (resetError) {
      setMessageTone('error')
      setMessage(reportError(resetError, 'The password could not be reset.'))
    } finally {
      setBusyUserId('')
    }
  }

  async function updateOwnerCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await updateOwnSystemUserCredentials({ email: ownerEmail, password: ownerPassword || undefined })
      window.dispatchEvent(new Event('admin-session-expired'))
    } catch (updateError) {
      setMessageTone('error')
      setMessage(reportError(updateError, 'Your account details could not be updated.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="min-w-0 flex-1">
      <PanelHeading title="System users" description="Manage database-backed accounts. Staff can view store data, admins can change store data, and only an owner can manage accounts." />
      {message && <div className="mb-4"><Notice tone={messageTone}>{message}</Notice></div>}
      {loadError && <div className="mb-4"><Notice>{loadError}</Notice></div>}
      <form onSubmit={updateOwnerCredentials} className="mb-8 grid gap-4 rounded-2xl border border-[#1c1c1a]/10 bg-white p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="text-base font-medium sm:col-span-2">Update your owner login</h2>
        <label className="block text-sm font-medium">
          Email
          <input required type="email" maxLength={254} autoComplete="username" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} className={`${inputClass} mt-2`} />
        </label>
        <label className="block text-sm font-medium">
          New password <span className="font-normal text-[#68675f]">(optional)</span>
          <input type="password" maxLength={256} autoComplete="new-password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} className={`${inputClass} mt-2`} />
          <span className="mt-1 block text-xs font-normal text-[#68675f]">Leave blank to keep the current password; changing login details signs you out.</span>
        </label>
        <div className="flex items-end sm:col-span-2">
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Updating…' : 'Update owner login'}</button>
        </div>
      </form>
      <form onSubmit={addUser} className="mb-8 grid gap-4 rounded-2xl border border-[#1c1c1a]/10 bg-white p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="text-base font-medium sm:col-span-2">Create system user</h2>
        <label className="block text-sm font-medium">
          Email
          <input required type="email" maxLength={254} autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} className={`${inputClass} mt-2`} />
        </label>
        <label className="block text-sm font-medium">
          Initial password
          <input required type="password" maxLength={256} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} mt-2`} />
          <span className="mt-1 block text-xs font-normal text-[#68675f]">Share it securely.</span>
        </label>
        <label className="block text-sm font-medium">
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'staff')} className={`${inputClass} mt-2`}>
            <option value="staff">Staff · read-only</option>
            <option value="admin">Admin · store operations</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving && <LoaderCircle size={15} className="animate-spin" />}
            {saving ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
      <h2 className="mb-3 text-base font-medium">Existing accounts</h2>
      {loading ? <LoadingRows label="Loading system users" /> : loadError ? null : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1c1c1a]/20 bg-white/60 px-5 py-10 text-center text-sm text-[#68675f]">No system users have been provisioned.</div>
      ) : (
        <DataTable
          rows={users}
          getRowId={(user) => user.id}
          getSearchValue={(user) => `${user.email} ${user.role} ${user.isActive ? 'active' : 'inactive'}`}
          canSelectRow={(user) => user.id !== signedInUserId}
          itemLabel="system users"
          emptyMessage="No system users are available."
          filters={[
            { id: 'status', label: 'Status', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], value: (user) => user.isActive ? 'active' : 'inactive' },
            { id: 'role', label: 'Role', options: [{ label: 'Admin', value: 'admin' }, { label: 'Staff', value: 'staff' }, { label: 'Owner', value: 'owner' }], value: (user) => user.role },
          ]}
          columns={[
            { id: 'email', header: 'Account', sortValue: (user) => user.email, searchValue: (user) => user.email, className: 'min-w-[220px] break-all', cell: (user) => <>{user.email}{user.id === signedInUserId && <span className="ml-2 text-xs text-[#526b7b]">(you)</span>}</> },
            { id: 'role', header: 'Role', sortValue: (user) => user.role, cell: (user) => <span className="capitalize">{user.role}</span> },
            { id: 'lastLogin', header: 'Last sign in', sortValue: (user) => user.lastLoginAt?.getTime() ?? 0, className: 'text-xs', cell: (user) => user.lastLoginAt ? user.lastLoginAt.toLocaleString() : 'Never' },
            { id: 'status', header: 'Status', sortValue: (user) => Number(user.isActive), cell: (user) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? 'bg-[#e8f6fb] text-[#006f9b]' : 'bg-[#f3f5f6] text-[#526b7b]'}`}>{user.isActive ? 'Active' : 'Inactive'}</span> },
            { id: 'actions', header: 'Actions', className: 'min-w-[270px]', cell: (user) => user.id === signedInUserId ? <span className="text-xs text-[#526b7b]">Your account</span> : <div className="flex flex-wrap items-center gap-2">
              {resetTargetId === user.id ? (
                <form onSubmit={(event) => void submitPasswordReset(event, user)} className="flex flex-wrap items-center gap-2">
                  <input required autoFocus type="password" maxLength={256} autoComplete="new-password" placeholder="New password" aria-label={`New password for ${user.email}`} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className={`${inputClass} !w-48`} />
                  <button type="submit" disabled={busyUserId === user.id} className={primaryButton}>Save</button>
                  <button type="button" onClick={() => { setResetTargetId(''); setResetPassword('') }} className={secondaryButton}>Cancel</button>
                </form>
              ) : <button type="button" onClick={() => { setResetTargetId(user.id); setResetPassword('') }} className={secondaryButton} aria-label={`Reset password for ${user.email}`}>Reset password</button>}
              <button
                type="button"
                disabled={busyUserId === user.id}
                onClick={() => void changeActiveState(user)}
                className={user.isActive ? 'rounded-full border border-[#9b4a36]/30 px-3 py-2 text-xs text-[#753b2d] hover:bg-[#f8eeeb] disabled:cursor-not-allowed disabled:opacity-50' : secondaryButton}
                aria-label={`${user.isActive ? 'Deactivate' : 'Activate'} ${user.email}`}
              >
                {busyUserId === user.id ? 'Saving…' : user.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div> },
          ] as DataTableColumn<AdminSystemUser>[]}
          exportRow={(user) => ({ Email: user.email, Role: user.role, Status: user.isActive ? 'Active' : 'Inactive', 'Last sign in': user.lastLoginAt?.toISOString() ?? '' })}
          bulkActions={[
            {
              label: 'Activate selected',
              disabled: (selected) => selected.every((user) => user.isActive),
              confirm: (selected) => `Activate ${selected.length} selected account${selected.length === 1 ? '' : 's'}? This restores their admin access.`,
              run: (selected) => changeSelectedUsersState(selected, true),
            },
            {
              label: 'Deactivate selected',
              disabled: (selected) => selected.every((user) => !user.isActive),
              confirm: (selected) => `Deactivate ${selected.length} selected account${selected.length === 1 ? '' : 's'}? Their active admin sessions will be revoked.`,
              run: (selected) => changeSelectedUsersState(selected, false),
            },
          ] satisfies DataTableBulkAction<AdminSystemUser>[]}
        />
      )}
    </section>
  )
}

function AnalyticsWorkspace() {
  const { metrics, isLoading, isError, error } = useAdminMetrics()
  const { activity, isLoading: activityLoading, isError: activityError, error: activityLoadError } = useAdminActivity()
  const statusRows = metrics ? Object.entries(metrics.orders.ordersByStatus) : []

  return (
    <section className="min-w-0 flex-1">
      <PanelHeading title="Analytics" description="Order value is grouped by currency and includes paid, processing, shipped, and delivered orders only." />
      {(isError || activityError) && <div className="mb-4"><Notice>{errorMessage(error ?? activityLoadError)}</Notice></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {isLoading || !metrics ? <LoadingRows label="Loading analytics" /> : (
          <>
            <MetricCard label="All recorded orders" value={String(metrics.orders.totalOrders)} icon={<ShoppingBag size={18} />} />
            <MetricCard label="Pending orders" value={String(metrics.orders.pendingOrders)} icon={<Activity size={18} />} />
          </>
        )}
      </div>
      <section className="mt-6 rounded-2xl border border-[#1c1c1a]/10 bg-white p-5">
        <h2 className="font-medium">Recognized order value</h2>
        <p className="mt-1 text-xs text-[#68675f]">Grouped by currency; excludes pending, cancelled, and refunded orders.</p>
        {isError ? <p className="mt-4 text-sm text-[#753b2d]">Order value is unavailable.</p> : !metrics || isLoading ? <p className="mt-4 text-sm text-[#68675f]">Loading totals…</p> : metrics.orders.revenueByCurrency.length ? (
          <div className="mt-4 flex flex-wrap gap-6">
            {metrics.orders.revenueByCurrency.map((entry) => (
              <div key={entry.currency}>
                <p className="text-2xl font-semibold">{currencyLabel(entry.totalRevenue, entry.currency)}</p>
                <p className="mt-1 text-xs text-[#68675f]">Average order: {currencyLabel(entry.avgOrderValue, entry.currency)}</p>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-[#68675f]">No recognized orders yet.</p>}
      </section>
      <section className="mt-6 rounded-2xl border border-[#1c1c1a]/10 bg-white p-5">
        <h2 className="font-medium">Orders by status</h2>
        {isError ? <p className="mt-4 text-sm text-[#68675f]">Order analytics are unavailable right now.</p> : !metrics || isLoading ? <p className="mt-4 text-sm text-[#68675f]">Loading status totals…</p> : statusRows.length ? (
          <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {statusRows.map(([status, count]) => <div key={status} className="flex justify-between border-b border-[#1c1c1a]/10 py-2 text-sm"><span className="capitalize">{status}</span><strong>{count}</strong></div>)}
          </div>
        ) : <p className="mt-4 text-sm text-[#68675f]">No orders have been recorded.</p>}
      </section>
      <section className="mt-6 rounded-2xl border border-[#1c1c1a]/10 bg-white p-5">
        <h2 className="font-medium">Recent activity</h2>
        {activityLoading ? <p className="mt-4 text-sm text-[#68675f]">Loading activity…</p> : activity.length ? (
          <ul className="mt-4 divide-y divide-[#1c1c1a]/10">
            {activity.map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span><span className="capitalize">{event.entityType}</span> · <span className="text-[#68675f]">{event.eventType.replaceAll('_', ' ')}</span></span><time className="text-xs text-[#68675f]">{new Date(event.createdAt).toLocaleString()}</time></li>)}
          </ul>
        ) : <p className="mt-4 text-sm text-[#68675f]">No activity has been recorded.</p>}
      </section>
    </section>
  )
}

export function AdminWorkspace({ section = 'overview' }: { section?: AdminSectionId }) {
  const router = useRouter()
  const [session, setSession] = useState<{ checked: boolean; authenticated: boolean; userId?: string; email?: string; role?: string; expiresAt?: number; loginPrefill?: { email: string; password: string }; configurationMessage?: string; error?: string }>({ checked: false, authenticated: false })
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/admin/session', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!active) return
        if (response.status === 503 && result.configured === false) {
          setSession({ checked: true, authenticated: false, configurationMessage: result.error })
        } else if (!response.ok) {
          setSession({ checked: true, authenticated: false, error: result.error || 'Admin access is unavailable.' })
        } else {
          setSession({
            checked: true,
            authenticated: Boolean(result.authenticated),
            userId: result.userId,
            email: result.email,
            role: result.role,
            expiresAt: result.expiresAt,
            loginPrefill: result.loginPrefill,
          })
        }
      })
      .catch((sessionError: unknown) => {
        reportError(sessionError, 'Could not check the admin session. Refresh the page to try again.')
        if (active) setSession({ checked: true, authenticated: false, error: 'Could not check the admin session. Refresh the page to try again.' })
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!session.authenticated || !session.expiresAt) return
    const remaining = session.expiresAt * 1000 - Date.now()
    if (remaining <= 0) {
      setSession({ checked: true, authenticated: false, error: 'Your admin session expired. Sign in again to continue.' })
      return
    }
    const timeout = window.setTimeout(
      () => setSession({ checked: true, authenticated: false, error: 'Your admin session expired. Sign in again to continue.' }),
      remaining,
    )
    return () => window.clearTimeout(timeout)
  }, [session.authenticated, session.expiresAt])

  useEffect(() => {
    const expireSession = () => setSession({ checked: true, authenticated: false, error: 'Your admin session expired. Sign in again to continue.' })
    window.addEventListener('admin-session-expired', expireSession)
    return () => window.removeEventListener('admin-session-expired', expireSession)
  }, [])

  async function signOut() {
    setSigningOut(true)
    try {
      const response = await fetch('/api/admin/session', { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not sign out. Refresh and try again.')
      router.replace('/admin')
      setSession({ checked: true, authenticated: false })
    } catch (signOutError) {
      setSession((current) => ({ ...current, error: reportError(signOutError, 'Sign out could not be completed.') }))
    } finally {
      setSigningOut(false)
    }
  }

  if (!session.checked) {
    return <div className="mx-auto grid min-h-[50vh] max-w-lg place-items-center"><LoaderCircle size={22} className="animate-spin text-[#68675f]" aria-label="Checking admin session" /></div>
  }

  if (!session.authenticated) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-[1440px] flex-col justify-center px-5 py-12 lg:px-10">
        {session.error && <div className="mx-auto mb-4 w-full max-w-lg"><Notice>{session.error}</Notice></div>}
        <AdminLogin
          configurationMessage={session.configurationMessage}
          prefill={session.loginPrefill}
          onSignedIn={(email, role, expiresAt) => setSession({ checked: true, authenticated: true, email, role, expiresAt })}
        />
      </div>
    )
  }

  const content = {
    overview: <AdminOverview onNavigate={(next) => router.push(next === 'overview' ? '/admin' : `/admin/${next}`)} />,
    categories: <CategoryManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    brands: <BrandManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'lens-shades': <LensShadeManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'lens-types': <LensTypeManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'catalog-sync': <CatalogSyncManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'error-logs': <ErrorLogManager />,
    'catalog-settings': <CatalogSettings canEdit={session.role === 'owner' || session.role === 'admin'} />,
    chatbot: <ChatbotManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    products: <ProductWorkspace canEdit={session.role === 'owner' || session.role === 'admin'} />,
    featured: <MerchandisingManager kind="featured" canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'new-arrivals': <MerchandisingManager kind="new_arrival" canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'on-sale': <MerchandisingManager kind="on_sale" canEdit={session.role === 'owner' || session.role === 'admin'} />,
    orders: <OrdersWorkspace canEdit={session.role === 'owner' || session.role === 'admin'} />,
    customers: <CustomersWorkspace />,
    crm: <CrmWorkspace canEdit={session.role === 'owner' || session.role === 'admin'} />,
    analytics: <AnalyticsWorkspace />,
    content: <ContentManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'home-design': <HomeDesignManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'hero-slider': <HomeDesignManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'power-options': <PowerLensOptionsManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'free-gift': <FreeGiftManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    delivery: <DeliveryManager canEdit={session.role === 'owner' || session.role === 'admin'} />,
    'system-users': session.role === 'owner' && session.userId
      ? <SystemUsersWorkspace signedInUserId={session.userId} signedInEmail={session.email ?? ''} />
      : <AdminOverview onNavigate={() => router.push('/admin')} />,
    'project-plan': <ProjectKanban />,
  }[section]

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-5 py-8 lg:flex-row lg:px-10">
      <aside className="w-full shrink-0 lg:w-52">
        <div className="mb-4 flex items-center justify-between gap-3 lg:mb-7">
          <h2 className="text-xs font-medium uppercase tracking-[.16em] text-[#68675f]">Workspace</h2>
          <button type="button" disabled={signingOut} onClick={() => void signOut()} className="flex items-center gap-1.5 text-xs text-[#68675f] hover:text-[#1c1c1a] focus-visible:outline-2 focus-visible:outline-[#1c1c1a] disabled:opacity-60">
            <LogOut size={14} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
        <nav aria-label="Admin workspace" className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3 lg:flex lg:flex-col">
          {sections.filter(({ id }) => id !== 'system-users' || session.role === 'owner').map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={id === 'overview' ? '/admin' : `/admin/${id}`}
              aria-current={section === id ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-[#1c1c1a] ${section === id ? 'bg-white font-medium shadow-sm' : 'text-[#68675f] hover:bg-white/60'}`}
            >
              <Icon size={17} aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <p className="mt-5 hidden break-all text-xs leading-4 text-[#68675f] lg:block">Signed in as {session.email}</p>
      </aside>
      {session.error && <div className="w-full lg:hidden"><Notice>{session.error}</Notice></div>}
      {content}
    </div>
  )
}
