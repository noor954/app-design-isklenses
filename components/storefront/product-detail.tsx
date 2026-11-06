'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Star } from 'lucide-react'
import { ProductCard } from '@/components/storefront/product-card'
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import { useProduct, type Product, type ProductAsset } from '@/lib/hooks/use-storefront-data'
import { getProductImageSources, StorefrontProductImage } from '@/components/storefront/product-image'
import { StorefrontFallbackImage } from '@/components/storefront/fallback-image'
import { reportError } from '@/lib/ui/notifications'
import { powerSurchargeCents, priceWithPowerSurcharge } from '@/lib/power-lens-options'
import { isToricLensType, TORIC_ORDER_NOTICE, toricWhatsAppUrl } from '@/lib/toric'

function formatPrice(value: string, currency: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${currency} ${value}`
  try {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function mediaFor(product: Product): ProductAsset[] {
  return product.assets?.filter((asset) => asset.blobUrl) ?? []
}

type Review = { id: string; author: string; rating: number; title: string | null; body: string; createdAt: string }

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={15} className={n <= Math.round(value) ? 'fill-[#f5a623] text-[#f5a623]' : 'text-[#c5cfe0]'} />)}
    </span>
  )
}

function ReviewForm({ slug, autoApprove }: { slug: string; autoApprove: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(5)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setState('sending')
    setMessage('')
    const response = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: form.get('author'), title: form.get('title'), body: form.get('body'), rating }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setState('idle')
      setMessage(reportError(new Error(body.error || 'Review could not be saved.')))
      return
    }
    setState('done')
    setMessage(autoApprove ? 'Thank you! Your review is live.' : 'Thank you! Your review will appear once approved.')
  }
  if (state === 'done') return <p role="status" className="rounded-lg bg-[#eef3fa] p-4 text-sm">{message}</p>
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-[#033473]/15 p-5">
      <h3 className="text-lg font-bold">Write a review</h3>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}>
            <Star size={24} className={n <= rating ? 'fill-[#f5a623] text-[#f5a623]' : 'text-[#c5cfe0]'} />
          </button>
        ))}
      </div>
      <input name="author" required maxLength={80} placeholder="Your name" className="rounded border border-[#033473]/30 px-3 py-2 text-sm" />
      <input name="title" maxLength={120} placeholder="Review title (optional)" className="rounded border border-[#033473]/30 px-3 py-2 text-sm" />
      <textarea name="body" required maxLength={2000} rows={4} placeholder="Share your experience" className="rounded border border-[#033473]/30 px-3 py-2 text-sm" />
      {message && <p role="alert" className="text-sm text-[#b20000]">{message}</p>}
      <button disabled={state === 'sending'} className="justify-self-start rounded-full bg-[#033473] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{state === 'sending' ? 'Sending…' : 'Submit review'}</button>
    </form>
  )
}

export function StorefrontProductDetail({
  initialProduct,
  initialOptionId,
  reviews = [],
  reviewSettings = { enabled: false, allowSubmission: false, autoApprove: false },
  sections = [],
  breadcrumbs = [],
}: {
  initialProduct: Product
  initialOptionId?: string
  reviews?: Review[]
  reviewSettings?: { enabled: boolean; allowSubmission: boolean; autoApprove: boolean }
  sections?: { id: string; title: string; products: Product[] }[]
  breadcrumbs?: { name: string; path: string }[]
}) {
  const [tab, setTab] = useState<'description' | 'specs' | 'reviews'>('description')
  const { product: refreshedProduct, isError, error } = useProduct(initialProduct.slug, initialProduct)
  const product = refreshedProduct ?? initialProduct
  const isToric = isToricLensType(product.lensType?.name)
  const variants = product.variants ?? []
  const [selectedVariantId, setSelectedVariantId] = useState(
    initialOptionId && variants.some((variant) => variant.id === initialOptionId)
      ? initialOptionId
      : variants[0]?.id ?? '',
  )
  const [leftPowerRange, setLeftPowerRange] = useState('')
  const [rightPowerRange, setRightPowerRange] = useState('')
  const [lensChoice, setLensChoice] = useState<'plain' | 'power' | null>(null)
  const [mediaIndex, setMediaIndex] = useState(0)
  const router = useRouter()
  const { add } = useStorefrontCart()
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0] ?? null
  const media = mediaFor(product)
  const selectedMedia = media[mediaIndex] ?? media[0] ?? null
  const imageSources = selectedMedia?.mediaType === 'image'
    ? [...new Set([selectedMedia.blobUrl, ...getProductImageSources(product)].filter((source): source is string => Boolean(source)))]
    : []
  const basePrice = selectedVariant?.price ?? product.price
  const currency = selectedVariant?.currency ?? product.currency
  const stockQuantity = selectedVariant?.stockQuantity ?? product.stockQuantity
  const availablePowerRanges = product.availablePowerRanges ?? []
  const availablePowerOptions = product.availablePowerOptions ?? []
  const requiresPowerSelection = availablePowerRanges.length > 0
  const powerSelectionReady = !requiresPowerSelection || lensChoice === 'plain' || (lensChoice === 'power' &&
    availablePowerRanges.includes(leftPowerRange) && availablePowerRanges.includes(rightPowerRange)
  )
  const price = priceWithPowerSurcharge(basePrice, availablePowerOptions, lensChoice === 'power' ? leftPowerRange : null, lensChoice === 'power' ? rightPowerRange : null) ?? basePrice
  const selectedPowerSurcharge = powerSurchargeCents(availablePowerOptions, lensChoice === 'power' ? leftPowerRange : null, lensChoice === 'power' ? rightPowerRange : null)

  function changeMedia(index: number) {
    setMediaIndex((index + media.length) % media.length)
  }

  return (
    <main className="storefront-sky mx-auto min-h-[calc(100vh-72px)] max-w-[1320px] bg-white px-5 pb-24 text-[#152a52] sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#152a52]/20 py-4">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs">
          <Link href="/" className="hover:underline">Home</Link> /
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path}><Link href={`/product-category/${crumb.path}`} className="hover:underline">{crumb.name}</Link> /{index < breadcrumbs.length - 1 ? '' : ''}</span>
          ))}
          <span className="font-semibold">{product.name}</span>
        </nav>
      </div>
      {isError && <p role="status" className="mt-3 text-xs text-[#782b36]">Product details could not be refreshed. Showing the listing as it was loaded.</p>}
      <div className="grid gap-9 pt-7 lg:grid-cols-[1.1fr_.9fr] lg:gap-14 lg:pt-10">
        <section aria-label={`${product.name} product media`}>
          <div className="relative grid min-h-[340px] aspect-square max-h-[750px] place-items-center overflow-hidden bg-[#dbe7e1] sm:min-h-[480px]">
            {selectedMedia?.mediaType === 'video' && selectedMedia.blobUrl ? (
              <video
                key={selectedMedia.id}
                src={selectedMedia.blobUrl}
                controls
                preload="metadata"
                aria-label={selectedMedia.altText || `${product.name} product video`}
                className="size-full bg-[#152a52] object-contain"
              />
            ) : (
              <StorefrontProductImage
                sources={imageSources}
                alt={selectedMedia?.altText || product.name}
                fdaApproved={product.fdaApproved}
                className="size-full"
                imageClassName="size-full object-contain"
                loading="eager"
                fallback={(
                  <div role="img" aria-label="Abstract illustration; no product photograph is available" className="lens-study relative grid size-full place-items-center">
                    <span className="lens-crosshair" />
                    <span className="absolute bottom-5 left-5 max-w-40 bg-[#152a52] px-3 py-2 font-mono text-xs uppercase leading-4 tracking-[.12em] text-[#d3ff48]">
                      Abstract study / no product photo
                    </span>
                  </div>
                )}
              />
            )}
            {media.length > 1 && (
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button type="button" onClick={() => changeMedia(mediaIndex - 1)} aria-label="Previous product media" className="grid size-11 place-items-center bg-[#edf4ef] text-[#152a52] hover:bg-[#d3ff48] focus-visible:outline-2 focus-visible:outline-[#152a52]"><ArrowLeft size={17} /></button>
                <button type="button" onClick={() => changeMedia(mediaIndex + 1)} aria-label="Next product media" className="grid size-11 place-items-center bg-[#edf4ef] text-[#152a52] hover:bg-[#d3ff48] focus-visible:outline-2 focus-visible:outline-[#152a52]"><ArrowRight size={17} /></button>
              </div>
            )}
          </div>
          {media.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="Product media">
              {media.map((asset, index) => (
                <button
                  key={asset.id}
                  type="button"
                  aria-label={`Show ${asset.mediaType === 'video' ? 'video' : 'image'} ${index + 1}`}
                  aria-pressed={index === mediaIndex}
                  onClick={() => setMediaIndex(index)}
                  className={`relative size-16 shrink-0 overflow-hidden border-2 focus-visible:outline-2 focus-visible:outline-[#16468a] ${index === mediaIndex ? 'border-[#16468a]' : 'border-transparent'}`}
                >
                  {asset.mediaType === 'image'
                    ? <img src={asset.blobUrl ?? ''} alt="" className="size-full object-contain" />
                    : <span className="grid size-full place-items-center bg-[#152a52] font-mono text-xs uppercase text-[#d3ff48]">Video</span>}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col items-start">
          <p className="font-mono text-xs uppercase tracking-[.2em] text-[#16468a]">{product.brand ? `${product.brand} · ` : ''}{product.category}</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{product.name}</h1>
          {product.ratingCount ? (
            <button type="button" onClick={() => setTab('reviews')} className="mt-3 inline-flex items-center gap-2 text-sm hover:underline">
              <Stars value={product.ratingAvg ?? 0} /> {product.ratingAvg?.toFixed(1)} ({product.ratingCount} review{product.ratingCount === 1 ? '' : 's'})
            </button>
          ) : null}
          {product.shortDescription && <p className="mt-4 max-w-xl text-sm leading-6 text-[#314a63]">{product.shortDescription}</p>}
          <div className="mt-6 flex w-full flex-wrap items-baseline justify-between gap-3 border-y border-[#152a52]/25 py-4">
            <p className="flex items-baseline gap-3 text-2xl font-semibold tracking-[-.04em]">
              {formatPrice(price, currency)}
              {product.compareAtPrice && Number(product.compareAtPrice) > Number(price) && (
                <>
                  <s className="text-base font-normal text-[#6b7a90]">{formatPrice(product.compareAtPrice, currency)}</s>
                  <span className="rounded-full bg-[#b20000] px-2 py-0.5 text-xs font-bold text-white">-{Math.round((1 - Number(price) / Number(product.compareAtPrice)) * 100)}%</span>
                </>
              )}
            </p>
            <p className="font-mono text-xs uppercase tracking-[.12em] text-[#314a63]">
              {stockQuantity > 0 ? `${stockQuantity} available` : 'Unavailable'}
            </p>
          </div>
          {product.lensType && (
            <p className="mt-4 text-sm text-[#526b7b]">
              <span className="font-semibold text-[#15384d]">Lens type:</span> {product.lensType.name}
            </p>
          )}
          {isToric && (
            <div className="mt-5 w-full rounded-xl border border-[#006f9b] bg-[#e8f6fb] p-4 text-sm leading-6 text-[#15384d]">
              <p className="font-bold">Toric orders require confirmation</p>
              <p>{TORIC_ORDER_NOTICE}</p>
              <p>Discuss your prescription, including spherical power, cylinder and axis, with the store.</p>
            </div>
          )}
          {product.lensShade && (
            <div className="mt-6">
              <p className="font-mono text-xs font-bold uppercase tracking-[.15em]">Lens shade</p>
              <ul className="mt-2 flex flex-wrap gap-3">
                <li className="flex items-center gap-2 text-xs">
                  {product.lensShade.imageUrl || product.lensShade.fallbackImageUrl ? (
                    <StorefrontFallbackImage
                      sources={[product.lensShade.imageUrl, product.lensShade.fallbackImageUrl]}
                      alt=""
                      className="size-9 rounded-full border border-[#cfe2eb]"
                      imageClassName="object-contain"
                    />
                  ) : product.lensShade.hex ? <span className="size-6 rounded-full border border-black/15" style={{ backgroundColor: product.lensShade.hex }} aria-hidden="true" /> : null}
                  {product.lensShade.name}
                </li>
              </ul>
            </div>
          )}

          {!isToric && requiresPowerSelection && (
            <fieldset className="mt-7 w-full rounded-2xl border border-[#b8d4e0] bg-[#e8f6fb] p-5">
              <legend className="px-1 text-base font-semibold text-[#15384d]">Choose your lenses</legend>
              <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#15384d]">
                <label className="flex min-h-11 items-center gap-2"><input type="radio" name="lens-choice" checked={lensChoice === 'plain'} onChange={() => { setLensChoice('plain'); setLeftPowerRange(''); setRightPowerRange('') }} /> Plain lenses</label>
                <label className="flex min-h-11 items-center gap-2"><input type="radio" name="lens-choice" checked={lensChoice === 'power'} onChange={() => setLensChoice('power')} /> Power lenses</label>
              </div>
              {lensChoice === 'power' && <>
              <p className="text-sm leading-5 text-[#526b7b]">Choose a power for each eye. Each selected eye adds its listed surcharge to the lens price.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-[#15384d]">
                  Left eye
                  <select
                    required
                    value={leftPowerRange}
                    onChange={(event) => setLeftPowerRange(event.target.value)}
                    aria-label="Left eye power range"
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-[#b8d4e0] bg-white px-3 py-3 text-base font-normal text-[#15384d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#087ba5]"
                  >
                    <option value="" disabled>Choose a power range</option>
                    {availablePowerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} D {Number(option.surcharge) === 0 ? '(+Rs 0)' : `(+Rs ${Number(option.surcharge).toFixed(2)})`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-[#15384d]">
                  Right eye
                  <select
                    required
                    value={rightPowerRange}
                    onChange={(event) => setRightPowerRange(event.target.value)}
                    aria-label="Right eye power range"
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-[#b8d4e0] bg-white px-3 py-3 text-base font-normal text-[#15384d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#087ba5]"
                  >
                    <option value="" disabled>Choose a power range</option>
                    {availablePowerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} D {Number(option.surcharge) === 0 ? '(+Rs 0)' : `(+Rs ${Number(option.surcharge).toFixed(2)})`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-3 text-sm font-medium tabular-nums text-[#15384d]">
                Power surcharge: {formatPrice(String((selectedPowerSurcharge ?? 0) / 100), currency)} total for both eyes
              </p>
              </>}
            </fieldset>
          )}

          {!isToric && variants.length > 0 && (
            <div id="listed-options" className="mt-8 w-full scroll-mt-8">
              <label htmlFor="product-variant" className="mb-2 block font-mono text-xs font-bold uppercase tracking-[.15em]">Choose a listed option</label>
              <select
                id="product-variant"
                value={selectedVariant?.id ?? ''}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                className="w-full border border-[#152a52]/35 bg-white px-4 py-3 text-sm text-[#152a52] focus-visible:outline-2 focus-visible:outline-[#16468a]"
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}{variant.color ? ` · ${variant.color}` : ''}{variant.powerDiopters ? ` · ${variant.powerDiopters} D` : ''}{variant.stockQuantity === 0 ? ' · unavailable' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-7 grid w-full grid-cols-2 gap-px bg-[#152a52]/20 sm:grid-cols-4">
            {[
              ['Color', selectedVariant?.color],
              ['Power', selectedVariant?.powerDiopters ? `${selectedVariant.powerDiopters} D` : null],
              ['Base curve', selectedVariant?.baseCurve ? `${selectedVariant.baseCurve} mm` : null],
              ['Diameter', selectedVariant?.diameterMm ? `${selectedVariant.diameterMm} mm` : null],
              ['Pack', selectedVariant?.packSize ? String(selectedVariant.packSize) : null],
            ].filter(([, value]) => value).map(([label, value]) => (
              <div key={label} className="min-w-0 bg-[#edf4ef] px-3 py-3">
                <p className="font-mono text-xs uppercase tracking-[.12em] text-[#314a63]">{label}</p>
                <p className="mt-1 truncate text-sm font-semibold">{value}</p>
              </div>
            ))}
            {variants.length === 0 && (
              <p className="col-span-2 bg-[#edf4ef] px-3 py-3 text-xs leading-5 text-[#314a63] sm:col-span-4">
                No lens parameters have been added to this listing.
              </p>
            )}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#314a63]">
            Only specifications entered for this product are displayed. Confirm product details with the store before purchase.
          </p>
          {isToric ? (
            <a href={toricWhatsAppUrl(product.name)} target="_blank" rel="noopener noreferrer" className="mt-8 w-full bg-[#152a52] px-5 py-4 text-center text-sm font-bold text-white hover:bg-[#16468a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16468a]">
              Confirm this order on WhatsApp
            </a>
          ) : <button
            type="button"
            onClick={() => {
              add(
                product,
                selectedVariant,
                requiresPowerSelection ? lensChoice === 'plain' ? { choice: 'plain' } : { choice: 'power', left: leftPowerRange, right: rightPowerRange } : null,
              )
              router.push('/cart')
            }}
            disabled={stockQuantity < 1 || !powerSelectionReady}
            className="mt-8 w-full bg-[#152a52] px-5 py-4 text-xs font-black uppercase tracking-[.15em] text-[#d3ff48] hover:bg-[#16468a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16468a] disabled:cursor-not-allowed disabled:bg-[#dbe7e1] disabled:text-[#314a63]"
          >
            {stockQuantity < 1
              ? 'Currently unavailable'
              : requiresPowerSelection && !powerSelectionReady
                ? lensChoice === 'power' ? 'Select power for both eyes' : 'Choose plain or power lenses'
                : 'Add selected option to bag'}
          </button>}
          {!isToric && <p className="mt-3 w-full text-center text-xs font-mono uppercase tracking-[.1em] text-[#314a63]">Cash on delivery · guest or account checkout</p>}
        </section>
      </div>

      <section className="mt-14" aria-label="Product information">
        <div role="tablist" className="flex gap-6 border-b border-[#033473]/20">
          {([['description', 'Description'], ['specs', 'Specifications'], ...(reviewSettings.enabled ? [['reviews', `Reviews (${reviews.length})`]] : [])] as [typeof tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`-mb-px border-b-2 py-3 text-sm font-bold uppercase tracking-wide ${tab === id ? 'border-[#033473] text-[#033473]' : 'border-transparent text-[#4a5568]'}`}>{label}</button>
          ))}
        </div>
        <div role="tabpanel" className="py-6 text-sm leading-7">
          {tab === 'description' && (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div>
                <p className="whitespace-pre-line">{product.description || 'No product description has been published.'}</p>
                {product.usageInstructions && <><h3 className="mt-6 font-bold">How to use</h3><p className="whitespace-pre-line">{product.usageInstructions}</p></>}
              </div>
              {product.features && product.features.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">{product.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              )}
            </div>
          )}
          {tab === 'specs' && (
            <table className="w-full max-w-2xl border-collapse text-left">
              <tbody>
                {([
                  ['Brand', product.brand], ['SKU', product.sku], ['Diameter', product.diameterMm ? `${product.diameterMm} mm` : null], ['Base curve', product.baseCurve ? `${product.baseCurve} mm` : null],
                  ['Water content', product.waterContent], ['Material', product.material], ['Wear duration', product.wearDuration], ['Pack contents', product.packContents],
                  ['Power type', product.powerType], ['Power range', product.powerRange], ['UV protection', product.uvProtection ? 'Yes' : null],
                  ...(product.specs ?? []).map((spec) => [spec.label, spec.value] as [string, string]),
                ] as [string, string | null | undefined][]).filter(([, value]) => value).map(([label, value]) => (
                  <tr key={label} className="border-b border-[#033473]/10"><th scope="row" className="w-1/3 py-2 pr-4 font-semibold">{label}</th><td className="py-2">{value}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'reviews' && (
            <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-5">
                {reviews.length === 0 && <p>No reviews yet.</p>}
                {reviews.map((review) => (
                  <article key={review.id} className="border-b border-[#033473]/10 pb-4">
                    <Stars value={review.rating} />
                    {review.title && <h3 className="mt-1 font-bold">{review.title}</h3>}
                    <p className="mt-1">{review.body}</p>
                    <p className="mt-1 text-xs text-[#4a5568]">{review.author} · {new Date(review.createdAt).toLocaleDateString('en-GB')}</p>
                  </article>
                ))}
              </div>
              {reviewSettings.allowSubmission && <ReviewForm slug={product.slug} autoApprove={reviewSettings.autoApprove} />}
            </div>
          )}
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.id} className="mt-12" aria-label={section.title}>
          <h2 className="text-2xl font-bold tracking-tight text-[#033473]">{section.title}</h2>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {section.products.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      ))}
    </main>
  )
}
