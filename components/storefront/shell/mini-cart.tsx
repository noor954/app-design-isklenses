'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { getCartLinePrice, useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import { StorefrontProductImage, getProductImageSources } from '@/components/storefront/product-image'
import { formatPrice } from '@/lib/store-config'

export function cartTotals(lines: ReturnType<typeof useStorefrontCart>['lines']) {
  const totals: Record<string, number> = {}
  for (const line of lines) {
    const { currency, price } = getCartLinePrice(line)
    totals[currency] = (totals[currency] ?? 0) + Math.round(Number(price) * 100) * line.quantity
  }
  return Object.entries(totals).map(([currency, cents]) => ({ currency, amount: cents / 100 }))
}

export function MiniCart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, setQuantity, count } = useStorefrontCart()
  if (!open) return null
  const totals = cartTotals(lines)

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button type="button" aria-label="Close cart" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-[#033473]/15 px-5">
          <h2 className="text-lg font-bold text-[#033473]">Cart ({count})</h2>
          <button type="button" aria-label="Close cart" onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-[#eef3fa]"><X size={20} /></button>
        </div>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-[#4a5568]">No products in the cart.</p>
            <Link href="/shop" onClick={onClose} className="rounded-full bg-[#033473] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0a4fa3]">Return to shop</Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-[#033473]/10 overflow-y-auto px-5">
              {lines.map((line) => {
                const { price, currency } = getCartLinePrice(line)
                const max = line.variant?.stockQuantity ?? line.product.stockQuantity
                return (
                  <li key={line.key} className="flex gap-3 py-4">
                    <StorefrontProductImage
                      sources={getProductImageSources(line.product)}
                      alt={line.product.name}
                      fdaApproved={line.product.fdaApproved}
                      className="size-20 shrink-0 overflow-hidden rounded-lg bg-[#eef3fa]"
                      imageClassName="size-full object-contain"
                      fallback={<div className="product-placeholder size-full" />}
                    />
                    <div className="min-w-0 flex-1">
                      <Link href={`/product/${line.product.slug}`} onClick={onClose} className="line-clamp-2 text-sm font-semibold hover:underline">{line.product.name}</Link>
                      {line.variant && <p className="mt-0.5 text-xs text-[#4a5568]">{line.variant.name}</p>}
                      {line.lensChoice === 'plain' && <p className="mt-0.5 text-xs text-[#526b7b]">Plain lenses</p>}
                      {(line.leftPowerRange || line.rightPowerRange) && (
                        <p className="mt-0.5 text-xs text-[#526b7b]">L {line.leftPowerRange ?? '—'} D · R {line.rightPowerRange ?? '—'} D</p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center overflow-hidden rounded-full border border-[#033473]/25 text-sm">
                          <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(line.key, line.quantity - 1)} className="size-8 hover:bg-[#eef3fa]">−</button>
                          <span className="w-7 text-center" aria-live="polite">{line.quantity}</span>
                          <button type="button" aria-label="Increase quantity" disabled={line.quantity >= max} onClick={() => setQuantity(line.key, line.quantity + 1)} className="size-8 hover:bg-[#eef3fa] disabled:opacity-40">+</button>
                        </div>
                        <span className="text-sm font-bold text-[#033473]">{formatPrice(Number(price) * line.quantity, currency)}</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="space-y-3 border-t border-[#033473]/15 p-5">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Subtotal</span>
                <span>{totals.map((total) => formatPrice(total.amount, total.currency)).join(' + ')}</span>
              </div>
              <p className="text-xs text-[#4a5568]">Cash on delivery. Delivery charge is confirmed before dispatch.</p>
              <Link href="/cart" onClick={onClose} className="block rounded-full border border-[#033473] py-3 text-center text-sm font-semibold text-[#033473] hover:bg-[#eef3fa]">View cart</Link>
              <Link href="/checkout" onClick={onClose} className="block rounded-full bg-[#033473] py-3 text-center text-sm font-semibold text-white hover:bg-[#0a4fa3]">Checkout</Link>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
