'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { ProductCard, ProductGridSkeleton } from '@/components/storefront/product-card'
import { CatalogRealtimeSync } from '@/components/storefront/catalog-realtime-sync'
import { Pagination } from '@/components/ui/pagination'
import { descendantIds } from '@/lib/catalog-types'
import type { StorefrontBrand } from '@/lib/data/catalog'
import { useProducts } from '@/lib/hooks/use-storefront-data'
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import { useStorefrontCategories, type ProductCategory } from '@/lib/hooks/use-storefront-categories'
import { categoryHref, categoryTree, isAvailable, lowestPrice, titleCase } from '@/lib/store-config'

const PAGE_SIZE = 24
type Sort = 'default' | 'price-asc' | 'price-desc' | 'name'

export function CatalogView({ categoryPath, brands }: { categoryPath?: string; brands: StorefrontBrand[] }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const query = searchParams.get('q')?.trim().slice(0, 100) ?? ''
  const brandSlug = searchParams.get('brand')?.trim().slice(0, 100) ?? ''
  const { products, isLoading, isError, error, mutate } = useProducts(undefined, query, brandSlug)
  const { categories, isLoading: categoriesLoading } = useStorefrontCategories()
  const { syncProducts } = useStorefrontCart()
  const [sort, setSort] = useState<Sort>('default')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const requestedPage = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)

  const tree = useMemo(() => categoryTree(categories), [categories])
  const category = categoryPath ? categories.find((item) => item.path === categoryPath) ?? null : null
  const categoryId = category?.id ?? null
  const branch = useMemo(() => (categoryId ? descendantIds(categories, categoryId) : null), [categories, categoryId])
  const ancestors = useMemo(() => {
    const chain: ProductCategory[] = []
    let current = category
    while (current?.parentId) {
      const parent = categories.find((item) => item.id === current!.parentId)
      if (!parent) break
      chain.unshift(parent)
      current = parent
    }
    return chain
  }, [categories, category])
  const parent = ancestors[ancestors.length - 1] ?? null
  const siblings = category ? tree.get(category.id) ?? [] : tree.get('root') ?? []
  useEffect(() => {
    if (!isLoading && !isError && !query && !brandSlug) syncProducts(products)
  }, [brandSlug, isError, isLoading, products, query, syncProducts])

  const filtered = useMemo(() => {
    const result = products.filter((product) => (!branch || (product.categoryIds ?? (product.categoryId ? [product.categoryId] : [])).some((id) => branch.has(id))) && (!inStockOnly || isAvailable(product)))
    const price = (product: (typeof result)[number]) => Number(lowestPrice(product).price)
    if (sort === 'price-asc') result.sort((a, b) => price(a) - price(b))
    else if (sort === 'price-desc') result.sort((a, b) => price(b) - price(a))
    else if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name))
    return result
  }, [branch, inStockOnly, products, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, pageCount)
  const pageProducts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    if (requestedPage === currentPage) return
    const params = new URLSearchParams(searchParams.toString())
    if (currentPage === 1) params.delete('page')
    else params.set('page', String(currentPage))
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }, [currentPage, pathname, requestedPage, router, searchParams])

  function changePage(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) params.delete('page')
    else params.set('page', String(page))
    router.push(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  const missingCategory = Boolean(categoryPath) && !categoriesLoading && !category
  const selectedBrand = brands.find((item) => item.slug === brandSlug) ?? null
  const heading = selectedBrand
    ? `${selectedBrand.name} lenses`
    : query ? `Search results for “${query}”` : category ? titleCase(category.name) : 'Shop'

  function changeBrand(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (value) params.set('brand', value)
    else params.delete('brand')
    router.push(`${pathname}${params.size ? `?${params}` : ''}`)
  }

  const sidebar = (
    <nav aria-label="Categories">
      <h2 className="text-sm font-bold uppercase tracking-widest text-[#033473]">Categories</h2>
      <ul className="mt-3 space-y-0.5 text-sm">
        <li><Link href="/shop" className={`block rounded-lg px-3 py-2 font-medium hover:bg-[#eef3fa] ${!category ? 'text-[#033473]' : 'text-[#4a5568]'}`}>All products</Link></li>
        {(tree.get('root') ?? []).map((root) => <SidebarNode key={root.id} node={root} tree={tree} activeId={categoryId} activeBranch={new Set([...ancestors.map((item) => item.id), ...(categoryId ? [categoryId] : [])])} />)}
      </ul>
    </nav>
  )

  return (
    <main className="mx-auto max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
      <CatalogRealtimeSync />
      <nav aria-label="Breadcrumb" className="text-xs text-[#4a5568]">
        <Link href="/" className="hover:underline">Home</Link> / <Link href="/shop" className="hover:underline">Shop</Link>
        {ancestors.map((item) => <span key={item.id}> / <Link href={categoryHref(item)} className="hover:underline">{titleCase(item.name)}</Link></span>)}
        {category && <> / <span className="font-semibold text-[#0a0a0a]">{titleCase(category.name)}</span></>}
        {selectedBrand && <> / <span className="font-semibold text-[#0a0a0a]">{selectedBrand.name}</span></>}
      </nav>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-[#033473]/15 pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-[#033473] sm:text-4xl">{heading}</h1>
        {category?.description && <p className="w-full max-w-3xl text-sm leading-6 text-[#4a5568]">{category.description}</p>}
        <p className="text-sm text-[#4a5568]" aria-live="polite">{isLoading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}`}</p>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block">{sidebar}</aside>
        <section>
          {category && siblings.length > 0 && (
            <ul className="mb-6 flex flex-wrap gap-2" aria-label="Subcategories">
              {siblings.map((item) => <li key={item.id}><Link href={categoryHref(item)} className="inline-block rounded-full border border-[#033473]/30 px-4 py-2 text-sm font-semibold text-[#033473] hover:bg-[#033473] hover:text-white">{titleCase(item.name)} <span className="opacity-60">({item.productCount})</span></Link></li>)}
            </ul>
          )}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="inline-flex items-center gap-2 rounded-full border border-[#033473]/30 px-4 py-2 text-sm font-semibold lg:hidden">
              <SlidersHorizontal size={16} aria-hidden="true" /> Categories
            </button>
            <label className="inline-flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 text-[#4a5568]">Brand</span>
              <select value={brandSlug} onChange={(event) => changeBrand(event.target.value)} className="min-w-0 max-w-[min(60vw,16rem)] rounded-full border border-[#033473]/30 bg-white px-3 py-2 text-sm">
                <option value="">All brands</option>
                {brands.map((brand) => <option key={brand.id} value={brand.slug}>{brand.name} ({brand.productCount})</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={inStockOnly} onChange={(event) => { setInStockOnly(event.target.checked); changePage(1) }} className="size-4 accent-[#033473]" /> In stock only
            </label>
            <label className="ml-auto inline-flex items-center gap-2 text-sm">
              <span className="text-[#4a5568]">Sort by</span>
              <select value={sort} onChange={(event) => { setSort(event.target.value as Sort); changePage(1) }} className="rounded-full border border-[#033473]/30 bg-white px-3 py-2 text-sm">
                <option value="default">Default</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          {filtersOpen && <div className="mb-6 rounded-xl bg-[#eef3fa] p-4 lg:hidden">{sidebar}</div>}

          {isError ? (
            <div role="alert" className="rounded-xl border border-[#b20000]/30 bg-[#fff4f2] px-5 py-4 text-sm text-[#7a1c1c]">
              {error instanceof Error ? error.message : 'Products could not be loaded.'}{' '}
              <button type="button" onClick={() => void mutate()} className="font-bold underline">Try again</button>
            </div>
          ) : isLoading ? (
            <ProductGridSkeleton />
          ) : missingCategory ? (
            <EmptyState title="Collection not found" body="This collection does not exist or has been removed." />
          ) : brandSlug && !selectedBrand ? (
            <EmptyState title="Brand not found" body="This brand is inactive or is no longer available." />
          ) : filtered.length === 0 ? (
            <EmptyState title="No products found" body={query ? 'Try a different search term.' : selectedBrand ? `No active products are currently linked to ${selectedBrand.name}.` : 'No products are available here right now.'} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
                {pageProducts.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              <Pagination total={filtered.length} page={currentPage} pageSize={PAGE_SIZE} onPageChange={changePage} itemLabel="products" className="mt-8" />
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-[#eef3fa] px-6 py-14 text-center">
      <h2 className="text-xl font-bold text-[#033473]">{title}</h2>
      <p className="mt-2 text-sm text-[#4a5568]">{body}</p>
      <Link href="/shop" className="mt-5 inline-block rounded-full bg-[#033473] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0a4fa3]">Browse all products</Link>
    </div>
  )
}

function SidebarNode({ node, tree, activeId, activeBranch }: { node: ProductCategory; tree: ReturnType<typeof categoryTree>; activeId: string | null; activeBranch: Set<string> }) {
  const kids = tree.get(node.id) ?? []
  const open = activeBranch.has(node.id)
  return (
    <li>
      <Link href={categoryHref(node)} aria-current={node.id === activeId ? 'page' : undefined} className={`flex items-center justify-between rounded-lg px-3 py-2 font-medium hover:bg-[#eef3fa] hover:text-[#033473] ${node.id === activeId ? 'bg-[#eef3fa] text-[#033473]' : ''}`}>
        <span>{titleCase(node.name)}</span><span className="text-xs text-[#4a5568]">{node.productCount}</span>
      </Link>
      {open && kids.length > 0 && <ul className="ml-3 border-l border-[#033473]/15 pl-2">{kids.map((kid) => <SidebarNode key={kid.id} node={kid} tree={tree} activeId={activeId} activeBranch={activeBranch} />)}</ul>}
    </li>
  )
}
