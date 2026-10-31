'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ShoppingBag, Star } from 'lucide-react'
import { StorefrontProductImage, getProductImageSources } from '@/components/storefront/product-image'
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import type { Product } from '@/lib/hooks/use-storefront-data'
import { formatPrice, isAvailable, lowestPrice } from '@/lib/store-config'

type Filter = 'catalog' | 'featured' | 'new' | 'reduced'

export function TrendingProducts({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState<Filter>('catalog')
  const filtered = useMemo(() => {
    if (filter === 'featured') return products.filter((product) => product.isFeatured)
    if (filter === 'reduced') return products.filter((product) => product.isOnSale)
    if (filter === 'new') return products.filter((product) => product.isNewArrival)
    return products
  }, [filter, products])

  return (
    <div>
      <div className="mb-7 flex flex-wrap gap-2 border-b border-[#cfe2eb]" role="tablist" aria-label="Filter products">
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

      {products.length > 0 ? (
        filtered.length > 0 ? (
          <ul role="tabpanel" className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {filtered.slice(0, 4).map((product) => <CatalogProduct key={product.id} product={product} />)}
          </ul>
        ) : (
          <div role="tabpanel" className="border-t border-[#cfe2eb] py-12 text-center">
            <p className="text-lg font-semibold text-[#15384d]">No matching listings in this view.</p>
            <button type="button" onClick={() => setFilter('catalog')} className="mt-3 text-sm font-semibold text-[#006f9b] hover:underline">Browse the full catalog</button>
          </div>
        )
      ) : (
        <div role="tabpanel" className="border-t border-[#cfe2eb] py-12 text-center">
          <p className="text-lg font-semibold text-[#15384d]">No active products are available right now.</p>
          <Link href="/shop" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#006f9b] hover:underline">
            Browse the catalog <ArrowRight size={15} aria-hidden="true" />
          </Link>
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
    <li className="group min-w-0">
      <Link href={href} aria-label={`View ${product.name}`} className="isk-trending-image relative block overflow-hidden rounded-2xl bg-[#e8f6fb]">
        <StorefrontProductImage
          sources={getProductImageSources(product)}
          alt={product.name}
          fdaApproved={product.fdaApproved}
          className="isk-trending-image-inner aspect-square"
          imageClassName="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          fallback={<div role="img" aria-label={`No product image is available for ${product.name}`} className="product-placeholder size-full" />}
        />
        {!available && <span className="absolute left-3 top-3 rounded-full bg-[#15384d] px-3 py-1.5 text-xs font-semibold text-white">Unavailable</span>}
      </Link>
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
          {hasOptions || requiresPowerSelection || !available ? (
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
    </li>
  )
}
