'use client'

import { Check, Gift, Sparkles } from 'lucide-react'
import type { FreeGiftOffer, FreeGiftProduct } from '@/lib/free-gift'

export type GiftChoice = { productId: string | null; confirmed: boolean } | null

function formatPrice(value: string, currency: string) {
  try {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value))
  } catch {
    return `${currency} ${value}`
  }
}

export function FreeGiftPicker({
  offer,
  choice,
  invalid,
  onChange,
}: {
  offer: FreeGiftOffer
  choice: GiftChoice
  invalid: boolean
  onChange: (choice: GiftChoice) => void
}) {
  const selected = offer.products.find((product) => product.id === choice?.productId) ?? null

  function pick(product: FreeGiftProduct | null) {
    onChange({ productId: product?.id ?? null, confirmed: product ? false : true })
  }

  return (
    <section
      id="free-gift"
      aria-labelledby="free-gift-heading"
      className={`relative my-7 overflow-hidden rounded-3xl border-2 p-5 shadow-[0_18px_50px_-24px_rgba(8,123,165,.55)] sm:p-7 ${invalid ? 'border-[#a52d3c] bg-[#fff4f2]' : 'border-[#087ba5] bg-gradient-to-br from-[#e8f6fb] via-white to-[#d7f0fa]'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#087ba5] px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-white">
            <Sparkles size={13} aria-hidden="true" /> {offer.config.badge}
          </p>
          <h2 id="free-gift-heading" className="mt-3 flex items-center gap-2 text-2xl font-bold tracking-[-.03em] text-[#0d3a52]">
            <Gift size={24} aria-hidden="true" /> {offer.config.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#2c566b]">{offer.config.message}</p>
        </div>
        <span className="rounded-2xl bg-[#d3ff48] px-4 py-2 text-sm font-black uppercase tracking-[.1em] text-[#0d3a52]">Free · pick {offer.config.maxItems}</span>
      </div>

      <div role="radiogroup" aria-label="Choose your free gift" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {offer.products.map((product) => {
          const active = product.id === choice?.productId
          return (
            <button
              key={product.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(product)}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] ${active ? 'border-[#087ba5] ring-4 ring-[#087ba5]/20' : 'border-[#cfe2eb] hover:border-[#087ba5]/60'}`}
            >
              <span className="grid aspect-square place-items-center bg-[#f3fafd] p-2">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" loading="lazy" className="size-full object-contain" />
                ) : <Gift size={32} className="text-[#087ba5]" aria-hidden="true" />}
              </span>
              <span className="flex flex-1 flex-col gap-1 p-3">
                <span className="line-clamp-2 text-sm font-semibold leading-5 text-[#15384d]">{product.name}</span>
                <span className="text-xs"><s className="text-[#526b7b]">{formatPrice(product.price, product.currency)}</s> <strong className="text-[#087ba5]">FREE</strong></span>
              </span>
              {active && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-[#087ba5] text-white"><Check size={15} aria-hidden="true" /></span>}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => pick(null)}
        className={`mt-3 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#087ba5] ${choice && choice.productId === null ? 'text-[#087ba5]' : 'text-[#526b7b]'}`}
      >
        {choice && choice.productId === null ? '✓ No gift for this order' : 'No gift, thanks'}
      </button>

      {selected && (
        <label className="mt-5 flex items-start gap-3 rounded-2xl border-2 border-[#087ba5] bg-white p-4 text-sm font-semibold text-[#0d3a52]">
          <input
            type="checkbox"
            checked={choice?.confirmed === true}
            onChange={(event) => onChange({ productId: selected.id, confirmed: event.target.checked })}
            className="mt-0.5 size-5 shrink-0 accent-[#087ba5]"
          />
          <span>I confirm I want <strong>{selected.name}</strong> as my free gift with this order.</span>
        </label>
      )}
      {invalid && (
        <p role="alert" className="mt-4 rounded-xl border border-[#a52d3c]/35 bg-white px-4 py-3 text-sm font-semibold text-[#782b36]">
          Choose a free gift and confirm it — or select “No gift, thanks” — before placing your order.
        </p>
      )}
    </section>
  )
}
