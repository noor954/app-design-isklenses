'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, LoaderCircle, LockKeyhole, PackageCheck, Store } from 'lucide-react'
import { getProductImageSources, StorefrontProductImage } from '@/components/storefront/product-image'
import { getDeliveryFeeCents, getFreeShippingThreshold, moneyFromCents, moneyToCents, type DeliveryRule } from '@/lib/delivery'
import { useProducts, type Product } from '@/lib/hooks/use-storefront-data'
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import { reportError } from '@/lib/ui/notifications'
import { getCartLinePrice } from '@/lib/hooks/use-storefront-cart'
import { priceWithPowerSurcharge } from '@/lib/power-lens-options'
import { FreeGiftPicker, type GiftChoice } from '@/components/storefront/free-gift-picker'
import { useFreeGiftOffer, useGiftChoice, useGiftEligibility } from '@/lib/hooks/use-free-gift'

type Customer = { email: string }

function formatPrice(value: string | number, currency: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${currency} ${value}`
  try {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function linePrice(product: Product, variantId: string | undefined, leftPowerRange?: string | null, rightPowerRange?: string | null) {
  const variant = product.variants?.find((item) => item.id === variantId)
  const basePrice = variant?.price ?? product.price
  return {
    variant,
    price: priceWithPowerSurcharge(basePrice, product.availablePowerOptions, leftPowerRange, rightPowerRange) ?? basePrice,
    currency: variant?.currency ?? product.currency,
  }
}

const inputClass = 'w-full min-w-0 border border-[#b8d4e0] bg-white px-3 py-3 text-base text-[#15384d] placeholder:text-[#526b7b] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#087ba5]'

export function Checkout({ deliveryRules }: { deliveryRules: DeliveryRule[] }) {
  const router = useRouter()
  const { lines, count, clear, syncProducts } = useStorefrontCart()
  const { products, isLoading: productsLoading, isError: productsError, error: productsErrorValue, mutate: refreshProducts } = useProducts()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [authMode, setAuthMode] = useState<'guest' | 'login' | 'register'>('guest')
  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState('')
  const checkoutKey = useRef<string | null>(null)
  const giftOffer = useFreeGiftOffer()
  const [giftChoice, setGiftChoice] = useGiftChoice()
  const [giftInvalid, setGiftInvalid] = useState(false)


  useEffect(() => {
    if (!productsLoading && !productsError) syncProducts(products)
  }, [products, productsError, productsLoading, syncProducts])

  const readCustomerSession = useCallback(async () => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await fetch('/api/storefront/session', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Account status could not be checked.')
      setCustomer(body.customer && typeof body.customer.email === 'string' ? body.customer : null)
      setAuthMode('guest')
    } catch (error) {
      setAuthError(reportError(error, 'Account status could not be checked.'))
    } finally {
      setAuthLoading(false)
    }
  }, [])

  useEffect(() => { void readCustomerSession() }, [readCustomerSession])

  const currencies = new Set(lines.map((line) => getCartLinePrice(line).currency))
  const currency = lines.length ? getCartLinePrice(lines[0]).currency : 'PKR'
  const subtotalCents = lines.reduce((sum, line) => {
    const { price } = getCartLinePrice(line)
    return sum + (moneyToCents(price) ?? 0) * line.quantity
  }, 0)
  const subtotal = subtotalCents / 100
  const deliveryFeeCents = getDeliveryFeeCents(deliveryRules, subtotalCents)
  const freeShippingThreshold = getFreeShippingThreshold(deliveryRules)
  const orderTotalCents = deliveryFeeCents === null ? null : subtotalCents + deliveryFeeCents

  const { eligible: giftEligible } = useGiftEligibility(giftOffer, lines)
  const selectedGift = giftEligible ? giftOffer?.products.find((product) => product.id === giftChoice?.productId) ?? null : null

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    setAccountMessage('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      const response = await fetch('/api/storefront/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode === 'register' ? 'register' : 'login',
          email: String(form.get('accountEmail') ?? ''),
          password: String(form.get('accountPassword') ?? ''),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Account access could not be completed.')
      setCustomer(body.customer)
      setAccountMessage(authMode === 'register' ? 'Account created. Your bag is ready for checkout.' : 'Signed in. Your bag is ready for checkout.')
      setAuthMode('guest')
      formElement.reset()
    } catch (error) {
      setAuthError(reportError(error, 'Account access could not be completed.'))
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    setAuthBusy(true)
    setAuthError('')
    try {
      const response = await fetch('/api/storefront/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Sign out could not be completed.')
      setCustomer(null)
      setAccountMessage('')
      setAuthMode('guest')
    } catch (error) {
      setAuthError(reportError(error, 'Sign out could not be completed.'))
    } finally {
      setAuthBusy(false)
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setOrderError('')
    if (productsError) {
      setOrderError('The catalogue could not be refreshed. Try again before placing your order.')
      setSubmitting(false)
      return
    }
    if (lines.length > 30) {
      setOrderError('Checkout supports up to 30 different items. Remove some items from your bag.')
      setSubmitting(false)
      return
    }
    if (currencies.size > 1) {
      setOrderError('A single order cannot contain products in different currencies. Remove items in another currency.')
      setSubmitting(false)
      return
    }
    if (deliveryFeeCents === null) {
      setOrderError('Delivery pricing is not configured for this order total. Please contact the store before placing your order.')
      setSubmitting(false)
      return
    }

    const giftDecided = giftChoice !== null && (giftChoice.productId === null || giftChoice.confirmed)
    if (giftEligible && !giftDecided) {
      setGiftInvalid(true)
      setSubmitting(false)
      document.getElementById('free-gift')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const form = new FormData(event.currentTarget)
    checkoutKey.current ??= window.crypto.randomUUID()
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutKey: checkoutKey.current,
          email: customer ? undefined : String(form.get('email') ?? ''),
          shippingAddress: {
            firstName: String(form.get('firstName') ?? ''),
            lastName: String(form.get('lastName') ?? ''),
            phone: String(form.get('phone') ?? ''),
            addressLine1: String(form.get('addressLine1') ?? ''),
            addressLine2: String(form.get('addressLine2') ?? ''),
            city: String(form.get('city') ?? ''),
            province: String(form.get('province') ?? ''),
            postalCode: String(form.get('postalCode') ?? ''),
          },
          items: lines.map((line) => {
            const { price, currency: lineCurrency } = linePrice(line.product, line.variant?.id, line.leftPowerRange, line.rightPowerRange)
            return {
              productId: line.product.id,
              variantId: line.variant?.id ?? null,
              leftPowerRange: line.leftPowerRange,
              rightPowerRange: line.rightPowerRange,
              lensChoice: line.lensChoice,
              quantity: line.quantity,
              quotedUnitPrice: price,
              quotedCurrency: lineCurrency,
            }
          }),
          quotedDeliveryFee: moneyFromCents(deliveryFeeCents),
          giftProductId: selectedGift?.id ?? null,
          giftConfirmed: selectedGift ? true : undefined,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status === 401) {
          setCustomer(null)
          setAuthMode('login')
        }
        if (response.status === 409) await refreshProducts()
        throw new Error(body.error || 'The order could not be placed.')
      }
      clear()
      setGiftChoice(null)
      router.push('/checkout/confirmation')
    } catch (error) {
      setOrderError(reportError(error, 'The order could not be placed. Your bag is unchanged; try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!lines.length) {
    return (
      <main className="storefront-sky mx-auto max-w-[1200px] bg-[#edf4ef] px-5 pb-24 text-[#152a52] sm:px-8 lg:px-12">
        <div className="border-b border-[#152a52]/20 py-4">
          <Link href="/shop" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] hover:text-[#16468a] focus-visible:outline-2 focus-visible:outline-[#16468a]">
            <ArrowLeft size={15} /> Products
          </Link>
        </div>
        <section className="mx-auto max-w-xl py-20 text-center">
          <PackageCheck className="mx-auto size-10 text-[#16468a]" aria-hidden="true" />
          <h1 className="display-type mt-5 text-5xl uppercase leading-none">Your bag is empty.</h1>
          <p className="mt-4 text-sm leading-6 text-[#314a63]">Choose a product before continuing to checkout.</p>
          <Link href="/shop" className="mt-7 inline-flex bg-[#152a52] px-5 py-4 text-xs font-black uppercase tracking-[.13em] text-[#d3ff48] hover:bg-[#16468a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16468a]">
            Browse products
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="storefront-sky mx-auto max-w-[1400px] bg-[#edf4ef] px-5 pb-24 text-[#152a52] sm:px-8 lg:px-12">
      <nav aria-label="Checkout navigation" className="flex min-h-[64px] items-center justify-between gap-4 border-b border-[#152a52]/20 py-3">
        <Link href="/shop" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] hover:text-[#16468a] focus-visible:outline-2 focus-visible:outline-[#16468a]">
          <ArrowLeft size={15} aria-hidden="true" /> ISK Lenses / Products
        </Link>
        <p className="font-mono text-xs uppercase tracking-[.16em] text-[#314a63]">Cash on delivery · Pakistan</p>
      </nav>

      <header className="grid gap-4 border-b-2 border-[#152a52] py-7 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <h1 className="display-type text-5xl uppercase leading-[.9] tracking-[-.025em] sm:text-6xl">Checkout</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#314a63]">Review your bag and delivery details. The delivery charge is included in your cash-on-delivery total; no online payment is collected.</p>
        </div>
        <p className="font-mono text-xs uppercase tracking-[.14em] text-[#314a63]">{count} {count === 1 ? 'item' : 'items'} in your bag</p>
      </header>

      <div className="grid items-start gap-9 pt-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.62fr)] lg:gap-12">
        <div className="min-w-0">
          <section aria-labelledby="account-heading" className="border-b border-[#152a52]/20 pb-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="account-heading" className="text-xl font-bold tracking-[-.035em]">Shopper</h2>
                <p className="mt-1 text-sm leading-6 text-[#314a63]">Continue as a guest or use a registered account.</p>
              </div>
              {authLoading && <span className="inline-flex items-center gap-2 text-xs text-[#314a63]"><LoaderCircle size={14} className="animate-spin" />Checking account</span>}
            </div>
            {authError && (
              <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[#a52d3c]/35 bg-[#fff4f2] px-3 py-2.5 text-sm text-[#782b36]">
                <span>{authError}</span>
                <button type="button" onClick={() => void readCustomerSession()} disabled={authLoading} className="font-bold underline underline-offset-4 disabled:opacity-50">Check again</button>
              </div>
            )}
            {customer ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[#152a52]/20 bg-white px-4 py-3">
                <p className="min-w-0 break-all text-sm"><LockKeyhole size={15} className="mr-2 inline-block" aria-hidden="true" />Signed in as <strong>{customer.email}</strong></p>
                <button type="button" onClick={() => void signOut()} disabled={authBusy} className="text-xs font-bold uppercase tracking-[.1em] underline underline-offset-4 disabled:opacity-50">Sign out to use guest checkout</button>
              </div>
            ) : (
              <>
                <div role="group" aria-label="Choose checkout account option" className="mt-4 flex flex-wrap gap-2">
                  {([
                    ['guest', 'Guest checkout'],
                    ['login', 'Sign in'],
                    ['register', 'Create account'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={authMode === mode}
                      onClick={() => { setAuthMode(mode); setAuthError(''); setAccountMessage('') }}
                      className={`min-h-11 border px-4 py-2 text-xs font-bold uppercase tracking-[.08em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16468a] ${authMode === mode ? 'border-[#152a52] bg-[#152a52] text-[#d3ff48]' : 'border-[#152a52]/25 bg-white hover:bg-[#dbe7e1]'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {(authMode === 'login' || authMode === 'register') && (
                  <form onSubmit={handleAccountSubmit} className="mt-4 grid gap-3 border border-[#152a52]/20 bg-[#e5f0ec] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="block text-xs font-semibold">Account email
                      <input name="accountEmail" type="email" required maxLength={254} autoComplete="username" className={`${inputClass} mt-1.5`} />
                    </label>
                    <label className="block text-xs font-semibold">Password
                      <input name="accountPassword" type="password" required minLength={authMode === 'register' ? 12 : undefined} maxLength={128} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} className={`${inputClass} mt-1.5`} />
                    </label>
                    <button type="submit" disabled={authBusy || authLoading} className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#152a52] px-4 py-3 text-xs font-bold uppercase tracking-[.08em] text-[#d3ff48] hover:bg-[#16468a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16468a] disabled:cursor-wait disabled:opacity-55">
                      {authBusy && <LoaderCircle size={14} className="animate-spin" />}
                      {authBusy ? 'Please wait' : authMode === 'register' ? 'Create account' : 'Sign in'}
                    </button>
                    {authMode === 'register' && <p className="text-xs leading-5 text-[#314a63] sm:col-span-3">Use 12–128 characters. Account email is not verified by email; existing customer records must continue as guest unless they already have an account.</p>}
                  </form>
                )}
                {accountMessage && <p role="status" className="mt-3 text-sm text-[#16468a]">{accountMessage}</p>}
              </>
            )}
          </section>

          <form onSubmit={submitOrder}>
          <section aria-labelledby="delivery-heading" className="border-b border-[#152a52]/20 py-7">
            <h2 id="delivery-heading" className="text-xl font-bold tracking-[-.035em]">Delivery details</h2>
            <p className="mt-1 text-sm leading-6 text-[#314a63]">Enter where the order should be delivered in Pakistan.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {!customer && (
                <label className="block text-xs font-semibold sm:col-span-2">Email
                  <input name="email" type="email" required maxLength={254} autoComplete="email" className={`${inputClass} mt-1.5`} />
                </label>
              )}
              <label className="block text-xs font-semibold">First name
                <input name="firstName" required maxLength={100} autoComplete="given-name" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-semibold">Last name
                <input name="lastName" required maxLength={100} autoComplete="family-name" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-semibold sm:col-span-2">Phone number
                <input name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="+92 300 1234567" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-semibold sm:col-span-2">Street address
                <input name="addressLine1" required maxLength={250} autoComplete="address-line1" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-semibold sm:col-span-2">Apartment, suite, area <span className="font-normal text-[#314a63]">(optional)</span>
                <input name="addressLine2" maxLength={250} autoComplete="address-line2" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-semibold">City
                <input name="city" required maxLength={100} autoComplete="address-level2" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-semibold">Province or territory
                <input name="province" required maxLength={100} autoComplete="address-level1" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-semibold">Postal code <span className="font-normal text-[#314a63]">(optional)</span>
                <input name="postalCode" maxLength={20} autoComplete="postal-code" className={`${inputClass} mt-1.5`} />
              </label>
              <div className="block text-xs font-semibold">Country
                <p className="mt-1.5 border border-[#152a52]/20 bg-[#dbe7e1] px-3 py-3 text-base font-normal">Pakistan</p>
              </div>
            </div>
          </section>

          {giftEligible && giftOffer && (
            <FreeGiftPicker
              offer={giftOffer}
              choice={giftChoice}
              invalid={giftInvalid && !(giftChoice !== null && (giftChoice.productId === null || giftChoice.confirmed))}
              onChange={(choice) => { setGiftChoice(choice); setGiftInvalid(false) }}
            />
          )}

          <section aria-labelledby="payment-heading" className="py-7">
            <h2 id="payment-heading" className="text-xl font-bold tracking-[-.035em]">Payment</h2>
            <div className="mt-4 flex items-start gap-3 border border-[#152a52] bg-white px-4 py-4">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center border border-[#152a52] bg-[#d3ff48]"><Check size={13} aria-hidden="true" /></span>
              <div>
                <p className="text-sm font-bold">Cash on delivery</p>
                <p className="mt-1 text-xs leading-5 text-[#314a63]">Cash is due on delivery. No card or online payment is available.</p>
              </div>
            </div>
            {deliveryFeeCents !== null && freeShippingThreshold ? (
              <p className="mt-4 border border-[#cfe2eb] bg-[#e8f6fb] px-4 py-3 text-sm leading-6 text-[#15384d]">
                {subtotalCents >= (moneyToCents(freeShippingThreshold) ?? Number.MAX_SAFE_INTEGER)
                  ? 'Free delivery unlocked for this order.'
                  : `Add ${formatPrice(((moneyToCents(freeShippingThreshold) ?? subtotalCents) - subtotalCents) / 100, currency)} to qualify for free delivery.`}
              </p>
            ) : deliveryFeeCents !== null && deliveryFeeCents === 0 ? (
              <p className="mt-4 border border-[#cfe2eb] bg-[#e8f6fb] px-4 py-3 text-sm leading-6 text-[#15384d]">Free delivery applies to this order.</p>
            ) : null}
            {deliveryFeeCents === null && (
              <p role="alert" className="mt-4 border border-[#a52d3c]/35 bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#782b36]">
                Delivery pricing is not configured for this order total. Please contact the store before placing your order.
              </p>
            )}
          </section>

          {orderError && <p role="alert" className="mb-4 border border-[#a52d3c]/35 bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#782b36]">{orderError}</p>}
          {(productsError || productsLoading) && (
            <div role={productsError ? 'alert' : 'status'} className="mb-4 border border-[#152a52]/20 bg-white px-4 py-3 text-sm leading-6 text-[#314a63]">
              {productsError ? `Product availability could not be refreshed${productsErrorValue instanceof Error ? `: ${productsErrorValue.message}` : '.'}` : 'Checking current product prices and availability…'}
              {productsError && <button type="button" onClick={() => void refreshProducts()} className="ml-2 font-bold underline underline-offset-4">Try again</button>}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || authLoading || Boolean(authError) || productsLoading || productsError || deliveryFeeCents === null}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 bg-[#152a52] px-5 py-4 text-sm font-black uppercase tracking-[.11em] text-[#d3ff48] hover:bg-[#16468a] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#16468a] disabled:cursor-wait disabled:opacity-55 sm:w-auto sm:min-w-72"
          >
            {submitting ? <LoaderCircle size={17} className="animate-spin" /> : <PackageCheck size={17} aria-hidden="true" />}
            {submitting ? 'Placing COD order…' : 'Place COD order'}
          </button>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-[#314a63]">The order is recorded as pending. The displayed COD total includes the configured delivery charge. No online payment is collected.</p>
          </form>
        </div>

        <aside aria-labelledby="summary-heading" className="min-w-0 border-y-2 border-[#152a52] bg-[#e5f0ec] px-4 py-5 sm:px-6 lg:sticky lg:top-24">
          <div className="flex items-end justify-between gap-3 border-b border-[#152a52]/25 pb-4">
            <h2 id="summary-heading" className="display-type text-3xl uppercase leading-none">Order docket</h2>
            <span className="font-mono text-xs uppercase tracking-[.12em] text-[#314a63]">{lines.length} lines</span>
          </div>
          <ul className="divide-y divide-[#152a52]/15">
            {lines.map((line) => {
              const { variant, price, currency: lineCurrency } = linePrice(line.product, line.variant?.id)
              const imageSources = getProductImageSources(line.product)
              return (
                <li key={line.key} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 py-4">
                  <StorefrontProductImage
                    sources={imageSources}
                    alt=""
                    fdaApproved={line.product.fdaApproved}
                    className="size-16 overflow-hidden bg-[#dbe7e1]"
                    imageClassName="size-full object-contain"
                    fallback={<div className="lens-study size-full" aria-hidden="true" />}
                  />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold leading-5">{line.product.name}</p>
                    <p className="mt-1 break-words text-xs leading-5 text-[#314a63]">{variant?.name ?? 'Standard listing'} · Qty {line.quantity}</p>
                    <p className="mt-2 font-mono text-xs font-semibold">{formatPrice(Number(price) * line.quantity, lineCurrency)}</p>
                  </div>
                </li>
              )
            })}
            {selectedGift && giftChoice?.confirmed && (
              <li className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 bg-[#d3ff48]/35 py-4">
                <span className="grid size-16 place-items-center bg-white">
                  {selectedGift.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedGift.imageUrl} alt="" className="size-full object-contain" />
                  ) : null}
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-5">{selectedGift.name}</p>
                  <p className="mt-1 text-xs leading-5 text-[#314a63]">Free gift · Qty 1</p>
                  <p className="mt-2 font-mono text-xs font-bold text-[#087ba5]">FREE</p>
                </div>
              </li>
            )}
          </ul>
          <div className="space-y-3 border-t border-[#152a52]/25 pt-4 text-sm">
            <div className="flex items-start justify-between gap-4"><span>Products subtotal</span><strong className="font-mono text-right">{formatPrice(subtotal, currency)}</strong></div>
            <div className="flex items-start justify-between gap-4 text-[#314a63]"><span>Delivery charge</span><strong className="font-mono text-right">{deliveryFeeCents === null ? 'Unavailable' : formatPrice(deliveryFeeCents / 100, currency)}</strong></div>
            <div className="flex items-start justify-between gap-4 border-t border-[#152a52]/20 pt-3 font-bold"><span>Cash on delivery total</span><strong className="font-mono text-right">{orderTotalCents === null ? 'Unavailable' : formatPrice(orderTotalCents / 100, currency)}</strong></div>
          </div>
          <p className="mt-4 border border-[#152a52]/15 bg-white/65 px-3 py-3 text-xs leading-5 text-[#314a63]">The COD total includes the current delivery price for this order. Nothing is charged online.</p>
          <Link href="/shop" className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] underline underline-offset-4 hover:text-[#16468a] focus-visible:outline-2 focus-visible:outline-[#16468a]">
            <Store size={14} aria-hidden="true" /> Edit your bag in Products
          </Link>
        </aside>
      </div>
    </main>
  )
}
