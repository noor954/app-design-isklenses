'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { LoaderCircle } from 'lucide-react'
import { reportError } from '@/lib/ui/notifications'

type Mode = 'login' | 'register'

const inputClass = 'mt-1.5 w-full rounded-lg border border-[#033473]/30 bg-white px-3 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#033473]'

type OrderRow = { id: string; orderNumber: number; status: string; total: string; currency: string; createdAt: string }

function MyOrders() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    fetch('/api/storefront/orders', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((b) => setOrders(b.data ?? []))
      .catch((error: unknown) => {
        reportError(error, 'Your orders could not be loaded.')
        setFailed(true)
      })
  }, [])
  return (
    <section className="mt-6" aria-label="My orders">
      <h2 className="text-lg font-semibold">My orders</h2>
      {failed ? <p className="mt-2 text-sm text-red-700">Orders could not be loaded.</p>
        : orders === null ? <p className="mt-2 text-sm text-[#4a5568]">Loading orders…</p>
        : orders.length === 0 ? <p className="mt-2 text-sm text-[#4a5568]">No orders yet.</p>
        : <ul className="mt-3 divide-y divide-[#033473]/10 rounded-2xl border border-[#033473]/15">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <Link href={`/orders/${o.id}`} className="font-semibold text-[#006f9b] underline underline-offset-2">Order #{o.orderNumber}</Link>
                <span className="capitalize text-[#4a5568]">{o.status}</span>
                <span>{o.currency} {o.total}</span>
                <span className="text-[#4a5568]">{new Date(o.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>}
    </section>
  )
}

export function AccountPage() {
  const [customer, setCustomer] = useState<{ email: string } | null>(null)
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/storefront/session', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Account status could not be checked.')
      setCustomer(body.customer && typeof body.customer.email === 'string' ? body.customer : null)
    } catch (loadError) {
      setError(reportError(loadError, 'Account status could not be checked.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function post(payload: Record<string, string>) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/storefront/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'The request could not be completed.')
      setCustomer(payload.action === 'logout' ? null : body.customer)
    } catch (postError) {
      setError(reportError(postError))
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void post({ action: mode, email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') })
  }

  return (
    <main className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-[#033473]">My account</h1>
      <p className="mt-3 text-sm text-[#314a63]">Placed an order as a guest? <Link href="/checkout/confirmation" className="font-semibold text-[#006f9b] underline">View your latest receipt on this browser</Link>.</p>
      {error && <div role="alert" className="mt-5 rounded-lg border border-[#b20000]/30 bg-[#fff4f2] px-4 py-3 text-sm text-[#7a1c1c]">{error}</div>}
      {loading ? (
        <p className="mt-8 inline-flex items-center gap-2 text-sm text-[#4a5568]"><LoaderCircle size={16} className="animate-spin" /> Checking account…</p>
      ) : customer ? (
        <section className="mt-8 rounded-2xl bg-[#eef3fa] p-6">
          <p className="text-sm text-[#4a5568]">Signed in as</p>
          <p className="mt-1 break-all font-semibold">{customer.email}</p>
          <p className="mt-4 text-sm leading-6 text-[#4a5568]">Your details are used to pre-fill checkout. Delivery fees are confirmed with you before dispatch.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/checkout" className="rounded-full bg-[#033473] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0a4fa3]">Go to checkout</Link>
            <button type="button" disabled={busy} onClick={() => void post({ action: 'logout' })} className="rounded-full border border-[#033473] px-6 py-3 text-sm font-semibold text-[#033473] hover:bg-white disabled:opacity-50">Sign out</button>
          </div>
          <MyOrders />
        </section>
      ) : (
        <section className="mt-8">
          <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-full bg-[#eef3fa] p-1 text-sm font-semibold">
            {(['login', 'register'] as const).map((item) => (
              <button key={item} role="tab" type="button" aria-selected={mode === item} onClick={() => { setMode(item); setError('') }} className={`rounded-full py-2.5 ${mode === item ? 'bg-[#033473] text-white' : 'text-[#033473]'}`}>
                {item === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">Email address
              <input name="email" type="email" required maxLength={254} autoComplete="username" className={inputClass} />
            </label>
            <label className="block text-sm font-semibold">Password
              <input name="password" type="password" required minLength={mode === 'register' ? 12 : undefined} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className={inputClass} />
            </label>
            {mode === 'register' && <p className="text-xs leading-5 text-[#4a5568]">Use 12–128 characters. Email addresses are not verified and password reset is not available yet.</p>}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#033473] py-3.5 text-sm font-semibold text-white hover:bg-[#0a4fa3] disabled:opacity-60">
              {busy && <LoaderCircle size={15} className="animate-spin" />} {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[#4a5568]">You can also <Link href="/checkout" className="font-semibold text-[#033473] underline">check out as a guest</Link>.</p>
        </section>
      )}
    </main>
  )
}
