import Link from 'next/link'
import { ArrowRight, CircleCheck } from 'lucide-react'
import { getOrderConfirmation } from '@/app/actions/checkout'

export const dynamic = 'force-dynamic'

function formatPrice(value: string, currency: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${currency} ${value}`
  try {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export default async function CheckoutConfirmationPage() {
  const order = await getOrderConfirmation()
  return (
    <main className="storefront-sky mx-auto min-h-[calc(100vh-72px)] max-w-[1000px] bg-[#edf4ef] px-5 pb-24 text-[#152a52] sm:px-8 lg:px-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#152a52]/20 py-4">
        <Link href="/shop" className="text-xs font-bold uppercase tracking-[.1em] hover:text-[#16468a] focus-visible:outline-2 focus-visible:outline-[#16468a]">ISK Lenses / Products</Link>
        <span className="font-mono text-xs uppercase tracking-[.15em] text-[#314a63]">Cash on delivery</span>
      </header>
      {order ? (
        <article className="mx-auto max-w-2xl py-10 sm:py-14">
          <div className="flex items-start gap-4 border-b-2 border-[#152a52] pb-6">
            <CircleCheck className="mt-1 size-8 shrink-0 text-[#16468a]" aria-hidden="true" />
            <div>
              <p className="font-mono text-xs uppercase tracking-[.16em] text-[#16468a]">Order received · pending confirmation</p>
              <h1 className="display-type mt-2 text-5xl uppercase leading-[.9] tracking-[-.025em]">Thank you.</h1>
              <p className="mt-3 text-sm leading-6 text-[#314a63]">Your cash-on-delivery order has been recorded. Keep this order reference for your records.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#152a52]/20 py-4">
            <span className="font-mono text-xs uppercase tracking-[.12em]">Order reference</span>
            <strong className="text-xl">#{order.orderNumber}</strong>
          </div>
          <ul className="divide-y divide-[#152a52]/15">
            {order.items.map((item, index) => (
              <li key={`${item.productName}-${index}`} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <span className="max-w-[70%] text-sm leading-5">
                  {item.productName} × {item.quantity}
                  {(item.powerLeft || item.powerRight) && <span className="mt-1 block text-xs text-[#526b7b]">Left eye: {item.powerLeft ?? '—'} D · Right eye: {item.powerRight ?? '—'} D</span>}
                </span>
                <span className="font-mono text-sm">{formatPrice(item.lineTotal, order.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-3 border-t border-[#152a52]/25 py-4 text-sm">
            <div className="flex justify-between gap-4"><span>Products subtotal</span><strong>{formatPrice(order.subtotal, order.currency)}</strong></div>
            <div className="flex justify-between gap-4 text-[#314a63]"><span>Delivery charge</span><span>{order.shippingFeeConfirmed ? formatPrice(order.shippingTotal, order.currency) : 'To be confirmed by store'}</span></div>
            <div className="flex justify-between gap-4 border-t border-[#152a52]/20 pt-3 text-base font-bold"><span>Cash on delivery total</span><strong>{formatPrice(order.total, order.currency)}</strong></div>
          </div>
          <div className="border border-[#152a52]/20 bg-[#e5f0ec] px-4 py-4 text-sm leading-6 text-[#314a63]">
            <p className="font-semibold text-[#152a52]">Delivery and payment</p>
            <p className="mt-2">{order.shippingFeeConfirmed
              ? 'Payment method: Cash on delivery. The displayed total includes the delivery charge configured by the store. No online payment was collected.'
              : 'Payment method: Cash on delivery. The store will confirm any delivery charge and the final payable amount before dispatch. No online payment was collected.'}</p>
            <p className="mt-3 font-semibold text-[#152a52]">Deliver to</p>
            <p>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
            <p>{order.shippingAddress.phone}</p>
            <p>{order.shippingAddress.addressLine1}{order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}</p>
            <p>{order.shippingAddress.city}, {order.shippingAddress.province}, {order.shippingAddress.country}</p>
            {order.shippingAddress.postalCode && <p>{order.shippingAddress.postalCode}</p>}
          </div>
          <Link href="/shop" className="mt-7 inline-flex items-center gap-3 bg-[#152a52] px-5 py-4 text-xs font-black uppercase tracking-[.12em] text-[#d3ff48] hover:bg-[#16468a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16468a]">
            Continue browsing <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </article>
      ) : (
        <section className="mx-auto max-w-xl py-20 text-center">
          <h1 className="display-type text-4xl uppercase leading-none">Receipt unavailable.</h1>
          <p className="mt-4 text-sm leading-6 text-[#314a63]">This browser has no active order receipt. Check your recent order confirmation or return to the catalogue.</p>
          <Link href="/shop" className="mt-6 inline-flex items-center gap-2 bg-[#152a52] px-5 py-4 text-xs font-black uppercase tracking-[.12em] text-[#d3ff48] hover:bg-[#16468a]">Browse products <ArrowRight size={15} /></Link>
        </section>
      )}
    </main>
  )
}
