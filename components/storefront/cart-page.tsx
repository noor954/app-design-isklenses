'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ShoppingBag, Trash2 } from 'lucide-react'
import { cartTotals } from '@/components/storefront/shell/mini-cart'
import { getProductImageSources, StorefrontProductImage } from '@/components/storefront/product-image'
import { getCartLinePrice, useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import { useProducts } from '@/lib/hooks/use-storefront-data'
import { FreeGiftPicker } from '@/components/storefront/free-gift-picker'
import { useFreeGiftOffer, useGiftChoice, useGiftEligibility } from '@/lib/hooks/use-free-gift'
import { formatPrice } from '@/lib/store-config'

export function CartPage() {
  const { lines, setQuantity, syncProducts, count } = useStorefrontCart()
  const { products, isLoading, isError } = useProducts()
  const totals = cartTotals(lines)
  const giftOffer = useFreeGiftOffer()
  const [giftChoice, setGiftChoice] = useGiftChoice()
  const { eligible: giftEligible } = useGiftEligibility(giftOffer, lines)

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
          {lines.map((line) => {
            const { price, currency } = getCartLinePrice(line)
            const max = line.variant?.stockQuantity ?? line.product.stockQuantity
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
                  {(line.leftPowerRange || line.rightPowerRange) && (
                    <p className="mt-1 text-xs text-[#526b7b]">Left eye: {line.leftPowerRange ?? '—'} D · Right eye: {line.rightPowerRange ?? '—'} D</p>
                  )}
                  <p className="mt-1 text-sm">{formatPrice(price, currency)} each</p>
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
        {giftEligible && giftOffer && (
          <div className="lg:col-start-1">
            <FreeGiftPicker offer={giftOffer} choice={giftChoice} invalid={false} onChange={setGiftChoice} />
          </div>
        )}
        <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 rounded-2xl border border-[#080b10]/10 bg-[#edf8fc] p-6 shadow-[var(--storefront-shadow)] lg:sticky lg:top-32">
          <h2 className="text-lg font-bold text-[#033473]">Cart totals</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><dt>Items</dt><dd>{count}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Subtotal</dt><dd>{totals.map((total) => formatPrice(total.amount, total.currency)).join(' + ')}</dd></div>
            <div className="flex justify-between text-[#4a5568]"><dt>Delivery</dt><dd>Confirmed before dispatch</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-[#4a5568]">Payment is cash on delivery. No online payment is collected.</p>
          <Link href="/checkout" className="mt-5 block rounded-full bg-[#033473] py-3.5 text-center text-sm font-semibold text-white hover:bg-[#0a4fa3]">Proceed to checkout</Link>
          <Link href="/shop" className="mt-3 block text-center text-sm font-medium text-[#033473] hover:underline">Continue shopping</Link>
        </aside>
      </div>
    </main>
  )
}
