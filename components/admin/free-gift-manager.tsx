'use client'

import { useEffect, useState } from 'react'
import { Gift, Save } from 'lucide-react'
import { getAdminCategories } from '@/app/actions/catalog-admin'
import { getContentAdmin, saveSetting } from '@/app/actions/content'
import { Alert, Field, flattenCategories, inputClass, primaryButton, type AdminCategory } from '@/components/admin/admin-ui'
import { DEFAULT_FREE_GIFT_CONFIG, normalizeFreeGiftConfig, type FreeGiftConfig } from '@/lib/free-gift'
import { reportError } from '@/lib/ui/notifications'

export function FreeGiftManager({ canEdit }: { canEdit: boolean }) {
  const [config, setConfig] = useState<FreeGiftConfig>(DEFAULT_FREE_GIFT_CONFIG)
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([getContentAdmin(), getAdminCategories()])
      .then(([content, rows]) => {
        if (!active) return
        setConfig(normalizeFreeGiftConfig(content.settings.free_gift))
        setCategories(flattenCategories(rows as AdminCategory[]))
      })
      .catch((loadError: unknown) => {
        if (active) setError(reportError(loadError, 'Free gift settings could not be loaded.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  function update(patch: Partial<FreeGiftConfig>) {
    setConfig((current) => ({ ...current, ...patch }))
    setSaved('')
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved('')
    try {
      await saveSetting('free_gift', config)
      setSaved('Free gift rules are live on the website and mobile apps.')
    } catch (saveError) {
      setError(reportError(saveError, 'Free gift settings could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-.035em]"><Gift size={22} aria-hidden="true" /> Free gift at checkout</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526b7b]">
          On qualifying lens orders, customers can choose and confirm a gift when the discounted merchandise subtotal is at least PKR 2,500. A separate gift cannot be combined with a lens deal.
        </p>
      </header>
      {error && <Alert>{error}</Alert>}
      {saved && <p role="status" className="rounded-xl border border-[#087ba5]/20 bg-[#e8f6fb] px-4 py-3 text-sm text-[#15384d]">{saved}</p>}
      {loading ? <p role="status" className="text-sm text-[#526b7b]">Loading free gift settings…</p> : (
        <div className="grid max-w-3xl gap-4 rounded-2xl border border-[#cfe2eb] bg-[#f7fcff] p-5 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" checked={config.enabled} disabled={!canEdit} onChange={(event) => update({ enabled: event.target.checked })} className="size-4 accent-[#087ba5]" />
            Offer a free gift on qualifying orders
          </label>
          <Field label="Gift category">
            <select value={config.categoryId ?? ''} disabled={!canEdit} onChange={(event) => update({ categoryId: event.target.value || null })} className={inputClass}>
              <option value="">Automatic — Cosmetics category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{'\u2003'.repeat(category.depth)}{category.name}</option>)}
            </select>
          </Field>
          <Field label="Badge text">
            <input value={config.badge} maxLength={40} disabled={!canEdit} onChange={(event) => update({ badge: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Gift items per order">
            <input type="number" min={1} max={5} value={config.maxItems} disabled={!canEdit} onChange={(event) => update({ maxItems: Number(event.target.value) || 1 })} className={inputClass} />
          </Field>
          <Field label="Minimum lenses in the order">
            <input type="number" min={1} max={20} value={config.minLensQuantity} disabled={!canEdit} onChange={(event) => update({ minLensQuantity: Number(event.target.value) || 1 })} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Heading shown at checkout">
              <input value={config.title} maxLength={120} disabled={!canEdit} onChange={(event) => update({ title: event.target.value })} className={inputClass} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Message shown at checkout">
              <textarea value={config.message} maxLength={400} rows={3} disabled={!canEdit} onChange={(event) => update({ message: event.target.value })} className={inputClass} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <button type="button" disabled={!canEdit || saving} onClick={() => void save()} className={primaryButton}>
              <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save free gift rules'}
            </button>
          </div>
        </div>
      )}
      {!canEdit && <p className="text-sm text-[#526b7b]">An admin or owner account is required to change these settings.</p>}
    </section>
  )
}
