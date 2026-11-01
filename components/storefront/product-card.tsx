'use client'

import Link from 'next/link'
import { ShoppingBag, Star } from 'lucide-react'
import { getProductImageSources, StorefrontProductImage } from '@/components/storefront/product-image'
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import type { Product } from '@/lib/hooks/use-storefront-data'
import { formatPrice, isAvailable, lowestPrice } from '@/lib/store-config'

export function ProductCard({ product }: { product: Product }) {
  const { add } = useStorefrontCart()
  const { price, currency, hasOptions } = lowestPrice(product)
  const available = isAvailable(product)
  const requiresPowerSelection = Boolean(product.availablePowerRanges?.length)
  const href = `/product/${product.slug}`

  return (
    <article className="group flex min-w-0 flex-col rounded-2xl border border-[#080b10]/10 bg-white p-2 shadow-[0_10px_30px_rgba(8,11,16,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(8,11,16,0.12)]">
      <Link href={href} aria-label={`View ${product.name}`} className="relative block overflow-hidden rounded-xl bg-[#eef3fa]">
        <StorefrontProductImage
          sources={getProductImageSources(product)}
          alt={product.name}
          fdaApproved={product.fdaApproved}
          className="relative aspect-square overflow-hidden"
          imageClassName="size-full object-contain transition-transform duration-500 group-hover:scale-105"
          fallback={<div role="img" aria-label={`No product image is available for ${product.name}`} className="product-placeholder size-full" />}
        />
        {!available && <span className="absolute left-2 top-2 rounded-full bg-[#b20000] px-3 py-1 text-xs font-semibold text-white">Sold out</span>}
      </Link>
      <div className="flex flex-1 flex-col pt-3">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-[#4a5568]">{product.category}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">
          <Link href={href} className="hover:text-[#0a4fa3] hover:underline">{product.name}</Link>
        </h3>
        {product.ratingCount ? <p className="mt-1 flex items-center gap-1 text-xs text-[#4a5568]"><Star size={13} className="fill-[#f5a623] text-[#f5a623]" aria-hidden="true" />{product.ratingAvg?.toFixed(1)} ({product.ratingCount})</p> : null}
        <p className="mt-1.5 text-base font-bold text-[#033473]">{hasOptions && 'From '}{formatPrice(price, currency)}{product.compareAtPrice && Number(product.compareAtPrice) > Number(price) && <s className="ml-2 text-sm font-normal text-[#6b7a90]">{formatPrice(product.compareAtPrice, currency)}</s>}</p>
        <div className="mt-auto pt-3">
          {hasOptions || requiresPowerSelection || !available ? (
            <Link href={href} className="block rounded-full border border-[#033473] py-2.5 text-center text-sm font-semibold text-[#033473] hover:bg-[#033473] hover:text-white">
              {available ? 'Select options' : 'View details'}
            </Link>
          ) : (
            <button type="button" onClick={() => add(product)} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#033473] py-2.5 text-sm font-semibold text-white hover:bg-[#0a4fa3]">
              <ShoppingBag size={15} aria-hidden="true" /> Add to cart
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4" aria-label="Loading products" role="status">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3">
          <div className="aspect-square animate-pulse rounded-xl bg-[#eef3fa]" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-[#eef3fa]" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-[#eef3fa]" />
        </div>
      ))}
    </div>
  )
}
