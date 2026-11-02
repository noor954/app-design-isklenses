import Link from 'next/link'
import { ArrowRight, Gift, ShieldCheck, Truck } from 'lucide-react'
import { StorefrontProductImage } from '@/components/storefront/product-image'
import { getProductImageSources } from '@/lib/storefront/product-image-sources'
import type { Product } from '@/lib/hooks/use-storefront-data'
import { formatPrice, lowestPrice } from '@/lib/store-config'

function Visual({ product, className }: { product: Product; className: string }) {
  return (
    <StorefrontProductImage
      sources={getProductImageSources(product)}
      alt={product.name}
      fdaApproved={product.fdaApproved}
      className={className}
      imageClassName="size-full object-contain p-4 transition-transform duration-700 group-hover:scale-[1.04] sm:p-8"
      fallback={<div role="img" aria-label={`No image for ${product.name}`} className="product-placeholder size-full" />}
    />
  )
}

export function Showcase({ products, title, description }: { products: Product[]; title: string; description?: string }) {
  const withImage = products.filter((product) => product.heroImageUrl || product.assets?.some((asset) => asset.mediaType === 'image'))
  const pool = [...withImage.filter((product) => product.isFeatured), ...withImage.filter((product) => !product.isFeatured)]
  const [spotlight, ...rest] = pool
  const tiles = rest.slice(0, 2)
  if (!spotlight) return null
  const spot = lowestPrice(spotlight)

  return (
    <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-8 lg:px-10">
      <p className="mb-3 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[.22em] text-[#087ba5]">
        <span aria-hidden="true" className="h-px w-10 bg-current" /> Showcase
      </p>
      <h2 id="showcase-heading" className="max-w-4xl text-balance text-[clamp(2.4rem,5.6vw,5.5rem)] font-extrabold leading-[0.95] tracking-[-0.06em] text-[#15384d]">{title}</h2>
      {description && <p className="mt-3 max-w-3xl text-base leading-7 text-[#526b7b] sm:text-lg">{description}</p>}

      <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-[1.5fr_1fr] lg:gap-6">
        <Link href={`/product/${spotlight.slug}`} className="group relative grid min-h-[26rem] overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_30%_20%,#ffffff_0%,#d7f0fa_55%,#b8e1f0_100%)] shadow-[0_30px_80px_-40px_rgba(8,123,165,.6)] outline-none focus-visible:ring-4 focus-visible:ring-[#087ba5] lg:min-h-[34rem] lg:grid-cols-[1.2fr_1fr]">
          <Visual product={spotlight} className="min-h-[16rem] lg:min-h-full" />
          <span className="flex flex-col justify-center gap-3 p-6 sm:p-9 lg:pl-0">
            <span className="w-fit rounded-full bg-[#d3ff48] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#0d3a52]">{spotlight.isFeatured ? 'Featured' : 'Spotlight'}</span>
            {spotlight.brand && <span className="text-xs font-bold uppercase tracking-[.18em] text-[#006f9b]">{spotlight.brand}</span>}
            <span className="text-3xl font-extrabold leading-tight tracking-[-0.04em] text-[#15384d] sm:text-4xl">{spotlight.name}</span>
            {(spotlight.shortDescription || spotlight.description) && (
              <span className="line-clamp-3 text-sm leading-6 text-[#2c566b]">{spotlight.shortDescription || spotlight.description}</span>
            )}
            <span className="flex flex-wrap gap-2 text-xs font-semibold text-[#15384d]">
              {[spotlight.lensType?.name, spotlight.lensShade?.name, spotlight.wearDuration].filter(Boolean).map((chip) => (
                <span key={chip} className="rounded-full border border-[#15384d]/20 bg-white/70 px-3 py-1">{chip}</span>
              ))}
            </span>
            <span className="text-2xl font-extrabold text-[#15384d]">{spot.hasOptions && 'From '}{formatPrice(spot.price, spot.currency)}</span>
            <span className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-[#087ba5] px-6 text-sm font-semibold text-white transition group-hover:bg-[#15384d]">Shop now <ArrowRight size={17} aria-hidden="true" /></span>
          </span>
        </Link>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6">
          {tiles.map((product) => {
            const info = lowestPrice(product)
            return (
              <Link key={product.id} href={`/product/${product.slug}`} className="group relative flex min-h-[15rem] overflow-hidden rounded-[2rem] bg-[#e8f6fb] outline-none focus-visible:ring-4 focus-visible:ring-[#087ba5] lg:min-h-0 lg:flex-1">
                <Visual product={product} className="absolute inset-0" />
                <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,29,43,.85)_0%,rgba(7,29,43,.05)_55%)]" />
                <span className="relative mt-auto flex w-full items-end justify-between gap-3 p-5 text-white">
                  <span className="min-w-0">
                    {product.brand && <span className="block text-[11px] font-bold uppercase tracking-[.16em] text-[#b8e8f5]">{product.brand}</span>}
                    <span className="block truncate text-xl font-bold tracking-[-0.03em]">{product.name}</span>
                    <span className="text-sm font-semibold text-white/85">{formatPrice(info.price, info.currency)}</span>
                  </span>
                  <ArrowRight size={22} aria-hidden="true" className="shrink-0" />
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {([
          [Gift, 'Free gift on every order', 'Pick a New Launch Gift in your cart.'],
          [ShieldCheck, 'Authentic lenses', 'Genuine brands with full product details.'],
          [Truck, 'Cash on delivery', 'Pay when your order arrives.'],
        ] as const).map(([Icon, heading, body]) => (
          <li key={heading} className="flex items-center gap-4 rounded-2xl border border-[#cfe2eb] bg-white p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#e8f6fb] text-[#087ba5]"><Icon size={20} aria-hidden="true" /></span>
            <span><strong className="block text-sm text-[#15384d]">{heading}</strong><span className="text-xs text-[#526b7b]">{body}</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}
