'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ShoppingBag, Trash2 } from 'lucide-react'
import { cartTotals } from '@/components/storefront/shell/mini-cart'
import { getProductImageSources, StorefrontProductImage } from '@/components/storefront/product-image'
import { getCartLinePrice, useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import { useProducts } from '@/lib/hooks/use-storefront-data'
import { formatPrice } from '@/lib/store-config'
import { usePromotions } from '@/lib/hooks/use-promotions'
import { calculateBestPromotion } from '@/lib/promotions'
import { moneyToCents } from '@/lib/delivery'

export function CartPage() {
  const { lines, setQuantity, syncProducts, count } = useStorefrontCart()
  const { products, isLoading, isError } = useProducts()
  const totals = cartTotals(lines)
  const promotions = usePromotions()
  const currencies = new Set(lines.map((line) => getCartLinePrice(line).currency))
  const originalSubtotalCents = lines.reduce((sum, line) => {
    const cents = moneyToCents(getCartLinePrice(line).price) ?? 0
    return sum + cents * line.quantity
  }, 0)
  const promotionResult = currencies.size === 1
    ? calculateBestPromotion(lines.map((line) => ({
        quantity: line.quantity,
        unitPriceCents: moneyToCents(getCartLinePrice(line).price) ?? 0,
        categoryIds: line.product.categoryIds?.length ? line.product.categoryIds : line.product.categoryId ? [line.product.categoryId] : [],
      })), promotions.promotions)
    : null
  const discountCents = promotionResult?.discountCents ?? 0
  const subtotalCents = Math.max(0, originalSubtotalCents - discountCents)
  const promotionUnavailable = promotions.isLoading || promotions.isError
  useEffect(() => {
    if (!isLoading && !isError) syncProducts(products)
  }, [isError, isLoading, products, syncProducts])

  if (!lines.length) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <ShoppingBag className="mx-auto size-12 text-[#033473]" aria-hidden="true" />
        <h1 className="mt-5 text-3xl font-bold text-[#033473]">Your cart is empty</h1>
        <p className="mt-3 text-sm text-[#4a5568]">No products in the cart.</p>
        <Link href="/shop" className="mt-7 inline-block rounded-full bg-[#033473] px-8 py-3 text-sm font-semibold text-white hover:bg-[#0a4fa3]">Return to shop</Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-[#033473] sm:text-4xl">Cart</h1>
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_380px]">
        <ul className="divide-y divide-[#033473]/10 border-y border-[#033473]/10">
          {lines.map((line, lineIndex) => {
            const { price, currency } = getCartLinePrice(line)
            const max = line.variant?.stockQuantity ?? line.product.stockQuantity
            const freeUnits = promotionResult?.freeUnitsByLine[lineIndex] ?? 0
            const lineDiscount = promotionResult?.discountCentsByLine[lineIndex] ?? 0
            return (
              <li key={line.key} className="grid grid-cols-[88px_1fr] gap-4 py-5 sm:grid-cols-[112px_1fr_auto]">
                <StorefrontProductImage
                  sources={getProductImageSources(line.product)}
                  alt={line.product.name}
                  fdaApproved={line.product.fdaApproved}
                  className="size-[88px] overflow-hidden rounded-lg bg-[#eef3fa] sm:size-28"
                  imageClassName="size-full object-contain"
                  fallback={<div className="product-placeholder size-full" />}
                />
                <div className="min-w-0">
                  <Link href={`/product/${line.product.slug}`} className="font-semibold hover:underline">{line.product.name}</Link>
                  {line.variant && <p className="mt-1 text-sm text-[#4a5568]">{line.variant.name}</p>}
                  {line.lensChoice === 'plain' && <p className="mt-1 text-xs text-[#526b7b]">Plain lenses</p>}
                  {(line.leftPowerRange || line.rightPowerRange) && (
                    <p className="mt-1 text-xs text-[#526b7b]">Left eye: {line.leftPowerRange ?? '—'} D · Right eye: {line.rightPowerRange ?? '—'} D</p>
                  )}
                  <p className="mt-1 text-sm">{formatPrice(price, currency)} each</p>
                  {freeUnits > 0 && (
                    <p className="mt-1 text-xs font-semibold text-[#075f7f]">{freeUnits} item{freeUnits === 1 ? '' : 's'} free in this deal</p>
                  )}
                  {promotionResult?.promotion.type === 'bundle_discount' && lineDiscount > 0 && (
                    <p className="mt-1 text-xs font-semibold text-[#075f7f]">Bundle savings: {formatPrice(lineDiscount / 100, currency)}</p>
                  )}
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center overflow-hidden rounded-full border border-[#033473]/25">
                      <button type="button" aria-label={`Decrease quantity of ${line.product.name}`} onClick={() => setQuantity(line.key, line.quantity - 1)} className="size-9 hover:bg-[#eef3fa]">−</button>
                      <span className="w-8 text-center text-sm" aria-live="polite">{line.quantity}</span>
                      <button type="button" aria-label={`Increase quantity of ${line.product.name}`} disabled={line.quantity >= max} onClick={() => setQuantity(line.key, line.quantity + 1)} className="size-9 hover:bg-[#eef3fa] disabled:opacity-40">+</button>
                    </div>
                    <button type="button" onClick={() => setQuantity(line.key, 0)} className="inline-flex items-center gap-1.5 text-sm text-[#b20000] hover:underline"><Trash2 size={14} aria-hidden="true" /> Remove</button>
                  </div>
                </div>
                <p className="col-span-2 text-right font-bold text-[#033473] sm:col-span-1">{formatPrice(Number(price) * line.quantity, currency)}</p>
              </li>
            )
          })}
        </ul>
        <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 rounded-2xl border border-[#080b10]/10 bg-[#edf8fc] p-6 shadow-[var(--storefront-shadow)] lg:sticky lg:top-32">
          <h2 className="text-lg font-bold text-[#033473]">Cart totals</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><dt>Items</dt><dd>{count}</dd></div>
            <div className="flex justify-between"><dt>Products</dt><dd>{totals.map((total) => formatPrice(total.amount, total.currency)).join(' + ')}</dd></div>
            {promotionResult && <div className="flex justify-between font-semibold text-[#075f7f]"><dt>{promotionResult.promotion.name}</dt><dd>−{formatPrice(discountCents / 100, [...currencies][0])}</dd></div>}
            <div className="flex justify-between font-semibold"><dt>Subtotal after deals</dt><dd>{currencies.size === 1 ? formatPrice(subtotalCents / 100, [...currencies][0]) : totals.map((total) => formatPrice(total.amount, total.currency)).join(' + ')}</dd></div>
            <div className="flex justify-between text-[#4a5568]"><dt>Delivery</dt><dd>Confirmed before dispatch</dd></div>
          </dl>
          {promotions.isLoading && <p role="status" className="mt-4 text-xs leading-5 text-[#4a5568]">Checking current deal pricing…</p>}
          {promotions.isError && <p role="alert" className="mt-4 text-xs leading-5 text-[#8d3341]">{promotions.error} Reload the page to verify current deal pricing.</p>}
          <p className="mt-4 text-xs leading-5 text-[#4a5568]">Payment is cash on delivery. No online payment is collected.</p>
          {promotionUnavailable
            ? <button type="button" disabled className="mt-5 block w-full rounded-full bg-[#033473] py-3.5 text-center text-sm font-semibold text-white opacity-55">Deal pricing unavailable</button>
            : <Link href="/checkout" className="mt-5 block rounded-full bg-[#033473] py-3.5 text-center text-sm font-semibold text-white hover:bg-[#0a4fa3]">Proceed to checkout</Link>}
          <Link href="/shop" className="mt-3 block text-center text-sm font-medium text-[#033473] hover:underline">Continue shopping</Link>
        </aside>
      </div>
    </main>
  )
}
