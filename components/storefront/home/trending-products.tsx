'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ShoppingBag, Star } from 'lucide-react'
import { SharedCarousel } from '@/components/ui/shared-carousel'
import type { CarouselVariant } from '@/lib/carousel-variants'
import { ProductHoverImage } from '@/components/storefront/product-hover-image'
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import type { Product } from '@/lib/hooks/use-storefront-data'
import { formatPrice, isAvailable, lowestPrice } from '@/lib/store-config'
import { isToricLensType } from '@/lib/toric'

type Filter = 'catalog' | 'featured' | 'new' | 'reduced'
type TabState = { items: Product[]; page: number; hasMore: boolean; loaded: boolean }

const TAB_VARIANTS: Record<Filter, CarouselVariant> = {
  catalog: 'smooth-slide',
  featured: 'coverflow',
  new: 'fade-slide',
  reduced: 'infinite-loop',
}

const EMPTY_TAB: TabState = { items: [], page: 0, hasMore: true, loaded: false }

export function TrendingProducts({ initialProducts, initialHasMore }: { initialProducts: Product[]; initialHasMore: boolean }) {
  const [filter, setFilter] = useState<Filter>('catalog')
  const [tabs, setTabs] = useState<Record<Filter, TabState>>({
    catalog: { items: initialProducts, page: 1, hasMore: initialHasMore, loaded: true },
    featured: EMPTY_TAB,
    new: EMPTY_TAB,
    reduced: EMPTY_TAB,
  })
  const loading = useRef<Set<Filter>>(new Set())

  const loadPage = useCallback(async (tab: Filter) => {
    if (loading.current.has(tab)) return
    loading.current.add(tab)
    try {
      const current = tabsRef.current[tab]
      const response = await fetch(`/api/storefront/home/products?tab=${tab}&page=${current.page + 1}`)
      if (!response.ok) throw new Error('Request failed')
      const { data } = (await response.json()) as { data: { items: Product[]; hasMore: boolean } }
      setTabs((state) => {
        const known = new Set(state[tab].items.map((item) => item.id))
        return {
          ...state,
          [tab]: {
            items: [...state[tab].items, ...data.items.filter((item) => !known.has(item.id))],
            page: state[tab].page + 1,
            hasMore: data.hasMore,
            loaded: true,
          },
        }
      })
    } catch {
      setTabs((state) => ({ ...state, [tab]: { ...state[tab], hasMore: false, loaded: true } }))
    } finally {
      loading.current.delete(tab)
    }
  }, [])

  const tabsRef = useRef(tabs)
  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])

  useEffect(() => {
    if (!tabs[filter].loaded) void loadPage(filter)
  }, [filter, tabs, loadPage])

  const active = tabs[filter]

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 border-b border-[#cfe2eb]" role="tablist" aria-label="Filter products">
        {([
          ['catalog', 'Catalog'],
          ['featured', 'Featured'],
          ['new', 'New arrivals'],
          ['reduced', 'On sale'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`relative px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] ${filter === value ? 'text-[#006f9b]' : 'text-[#526b7b] hover:text-[#15384d]'}`}
          >
            {label}
            {filter === value && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-[#087ba5]" />}
          </button>
        ))}
      </div>

      {active.items.length > 0 ? (
        <div role="tabpanel">
          <SharedCarousel
            key={filter}
            items={active.items}
            variant={TAB_VARIANTS[filter]}
            label={`${filter} products`}
            getKey={(product) => product.id}
            hasMore={active.hasMore}
            onNeedMore={() => void loadPage(filter)}
            renderItem={(product) => <CatalogProduct product={product} />}
          />
        </div>
      ) : !active.loaded || active.hasMore ? (
        <div role="tabpanel" aria-busy="true" className="border-t border-[#cfe2eb] py-12 text-center text-sm text-[#526b7b]">Loading listings…</div>
      ) : filter === 'catalog' ? (
        <div role="tabpanel" className="border-t border-[#cfe2eb] py-12 text-center">
          <p className="text-lg font-semibold text-[#15384d]">No active products are available right now.</p>
          <Link href="/shop" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#006f9b] hover:underline">
            Browse the catalog <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div role="tabpanel" className="border-t border-[#cfe2eb] py-12 text-center">
          <p className="text-lg font-semibold text-[#15384d]">No matching listings in this view.</p>
          <button type="button" onClick={() => setFilter('catalog')} className="mt-3 text-sm font-semibold text-[#006f9b] hover:underline">Browse the full catalog</button>
        </div>
      )}
    </div>
  )
}

function CatalogProduct({ product }: { product: Product }) {
  const { add } = useStorefrontCart()
  const { price, currency, hasOptions } = lowestPrice(product)
  const available = isAvailable(product)
  const requiresPowerSelection = Boolean(product.availablePowerRanges?.length)
  const href = `/product/${product.slug}`

  return (
    <div className="group min-w-0">
      <ProductHoverImage product={product} className="isk-trending-image rounded-2xl bg-[#e8f6fb]" imageClassName="isk-trending-image-inner aspect-square">
        {!available && <span className="absolute left-3 top-3 rounded-full bg-[#15384d] px-3 py-1.5 text-xs font-semibold text-white">Unavailable</span>}
      </ProductHoverImage>
      <div className="pt-4">
        {product.brand && <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006f9b]">{product.brand}</p>}
        <h3 className="mt-2 min-h-12 text-lg font-bold leading-6 tracking-[-0.03em] text-[#15384d]">
          <Link href={href} className="hover:text-[#087ba5]">{product.name}</Link>
        </h3>
        {product.ratingCount ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[#526b7b]">
            <Star size={14} className="fill-[#b66b24] text-[#b66b24]" aria-hidden="true" />
            <span>{product.ratingAvg?.toFixed(1)} ({product.ratingCount})</span>
          </p>
        ) : null}
        <p className="mt-3 text-lg font-bold text-[#15384d]">
          {hasOptions && 'From '}{formatPrice(price, currency)}
          {product.compareAtPrice && Number(product.compareAtPrice) > Number(price) && <s className="ml-2 text-sm font-normal text-[#526b7b]">{formatPrice(product.compareAtPrice, currency)}</s>}
        </p>
        <div className="mt-4">
          {hasOptions || requiresPowerSelection || !available || isToricLensType(product.lensType?.name) ? (
            <Link href={href} className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#15384d]/25 px-4 text-sm font-semibold text-[#15384d] transition-colors hover:border-[#006f9b] hover:bg-[#006f9b] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5]">
              {available ? 'Choose options' : 'View details'}
            </Link>
          ) : (
            <button type="button" onClick={() => add(product)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#006f9b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#087ba5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5]">
              <ShoppingBag size={15} aria-hidden="true" /> Add to bag
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
