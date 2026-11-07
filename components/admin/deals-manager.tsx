'use client'

import { useEffect, useState } from 'react'
import { BadgePercent, Plus, Save, Trash2 } from 'lucide-react'
import { getAdminCategories } from '@/app/actions/catalog-admin'
import { getContentAdmin, saveSetting } from '@/app/actions/content'
import { Alert, Field, flattenCategories, inputClass, primaryButton, type AdminCategory } from '@/components/admin/admin-ui'
import { normalizePromotions, type Promotion, type PromotionType } from '@/lib/promotions'
import { reportError } from '@/lib/ui/notifications'

function createPromotion(): Promotion {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    type: 'buy_get_free',
    categoryIds: [],
    buyQuantity: 2,
    freeQuantity: 1,
    discountPercent: 0,
    priority: 0,
  }
}

export function DealsManager({ canEdit }: { canEdit: boolean }) {
  const [promotions, setPromotions] = useState<Promotion[]>([])
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
        setPromotions(normalizePromotions(content.settings.deals))
        setCategories(flattenCategories(rows as AdminCategory[]))
      })
      .catch((loadError: unknown) => {
        if (active) setError(reportError(loadError, 'Deal settings could not be loaded.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  function update(id: string, patch: Partial<Promotion>) {
    setPromotions((current) => current.map((promotion) => promotion.id === id ? { ...promotion, ...patch } : promotion))
    setSaved('')
  }

  function updateType(id: string, type: PromotionType) {
    update(id, {
      type,
      freeQuantity: type === 'buy_get_free' ? 1 : 0,
      discountPercent: type === 'bundle_discount' ? 10 : 0,
      buyQuantity: type === 'buy_get_free' ? 2 : 2,
    })
  }

  function toggleCategory(promotion: Promotion, categoryId: string) {
    const categoryIds = promotion.categoryIds.includes(categoryId)
      ? promotion.categoryIds.filter((id) => id !== categoryId)
      : [...promotion.categoryIds, categoryId]
    update(promotion.id, { categoryIds })
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved('')
    try {
      await saveSetting('deals', promotions)
      setSaved('Deal rules are saved and shared with the website, checkout API, and mobile app.')
    } catch (saveError) {
      setError(reportError(saveError, 'Deal settings could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-.035em]"><BadgePercent size={22} aria-hidden="true" /> Lens deals</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526b7b]">
            Build offers from lens categories. Every category you select must be represented in each qualifying bundle. The best single qualifying deal applies; offers do not stack.
          </p>
        </div>
        {canEdit && (
          <button type="button" disabled={loading || saving} onClick={() => { setPromotions((current) => [...current, createPromotion()]); setSaved('') }} className="inline-flex min-h-11 items-center gap-2 border border-[#087ba5] px-4 py-2 text-sm font-semibold text-[#075f7f] hover:bg-[#e8f6fb] disabled:opacity-50">
            <Plus size={16} aria-hidden="true" /> Add deal
          </button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {saved && <p role="status" className="border border-[#087ba5]/20 bg-[#e8f6fb] px-4 py-3 text-sm text-[#15384d]">{saved}</p>}

      {loading ? <p role="status" className="text-sm text-[#526b7b]">Loading deal rules…</p> : promotions.length === 0 ? (
        <div className="border-y border-[#cfe2eb] py-8">
          <p className="font-semibold text-[#15384d]">No lens deals yet</p>
          <p className="mt-1 text-sm leading-6 text-[#526b7b]">Add a Buy X Get Y Free offer or a percentage discount for qualifying lens bundles.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#cfe2eb] border-y border-[#cfe2eb]">
          {promotions.map((promotion, index) => {
            const bundleSize = promotion.buyQuantity + (promotion.type === 'buy_get_free' ? promotion.freeQuantity : 0)
            const categoryCountInvalid = promotion.categoryIds.length > bundleSize
            return (
            <fieldset key={promotion.id} disabled={!canEdit || saving} className="space-y-4 py-6 disabled:opacity-75">
              <legend className="sr-only">Deal {index + 1}</legend>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-[#15384d]">Deal {index + 1}</h2>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={promotion.enabled} onChange={(event) => update(promotion.id, { enabled: event.target.checked })} className="size-4 accent-[#087ba5]" />
                    Active
                  </label>
                  <button type="button" aria-label={`Remove deal ${index + 1}`} onClick={() => { setPromotions((current) => current.filter((entry) => entry.id !== promotion.id)); setSaved('') }} className="inline-flex min-h-10 items-center gap-1.5 px-2 text-sm font-semibold text-[#8d3341] hover:bg-[#fff4f2]">
                    <Trash2 size={15} aria-hidden="true" /> Remove
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Deal name">
                  <input value={promotion.name} maxLength={120} onChange={(event) => update(promotion.id, { name: event.target.value })} className={inputClass} placeholder="Buy 2 Get 1 Free" />
                </Field>
                <Field label="Offer type">
                  <select value={promotion.type} onChange={(event) => updateType(promotion.id, event.target.value as PromotionType)} className={inputClass}>
                    <option value="buy_get_free">Buy X, get Y free</option>
                    <option value="bundle_discount">Bundle percentage discount</option>
                  </select>
                </Field>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-[#15384d]">Lens categories in each qualifying bundle</legend>
                <p className="text-xs leading-5 text-[#526b7b]">A bundle must include at least one product from every selected category. Each item can count toward only one bundle.</p>
                {categories.length ? (
                  <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category) => (
                      <label key={category.id} className="flex min-h-9 items-center gap-2 text-sm text-[#15384d]">
                        <input type="checkbox" checked={promotion.categoryIds.includes(category.id)} disabled={!promotion.categoryIds.includes(category.id) && promotion.categoryIds.length >= bundleSize} onChange={() => toggleCategory(promotion, category.id)} className="size-4 shrink-0 accent-[#087ba5]" />
                        <span className="min-w-0 truncate">{'\u2003'.repeat(category.depth)}{category.name}</span>
                      </label>
                    ))}
                  </div>
                ) : <p className="text-sm text-[#8d3341]">Create an active lens category before adding a deal.</p>}
                {categoryCountInvalid && <p role="alert" className="text-sm font-medium text-[#8d3341]">Choose fewer categories or increase the bundle size so every selected category can contribute a distinct item.</p>}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={promotion.type === 'bundle_discount' ? 'Items per bundle' : 'Items to buy'}>
                  <input type="number" min={1} max={promotion.type === 'buy_get_free' ? 99 : 100} value={promotion.buyQuantity} onChange={(event) => {
                    const buyQuantity = Number(event.target.value) || 1
                    update(promotion.id, {
                      buyQuantity,
                      ...(promotion.type === 'buy_get_free' ? { freeQuantity: Math.min(promotion.freeQuantity, 100 - buyQuantity) } : {}),
                    })
                  }} className={inputClass} />
                </Field>
                {promotion.type === 'buy_get_free' ? (
                  <Field label="Free items per bundle">
                    <input type="number" min={1} max={100 - promotion.buyQuantity} value={promotion.freeQuantity} onChange={(event) => update(promotion.id, { freeQuantity: Number(event.target.value) || 1 })} className={inputClass} />
                  </Field>
                ) : (
                  <Field label="Discount on each bundle item (%)">
                    <input type="number" min={1} max={100} value={promotion.discountPercent} onChange={(event) => update(promotion.id, { discountPercent: Number(event.target.value) || 1 })} className={inputClass} />
                  </Field>
                )}
                <Field label="Priority (tie-breaker)">
                  <input type="number" min={0} max={1000} value={promotion.priority} onChange={(event) => update(promotion.id, { priority: Number(event.target.value) || 0 })} className={inputClass} />
                </Field>
              </div>
              <p className="text-xs leading-5 text-[#526b7b]">
                {promotion.type === 'buy_get_free'
                  ? `The lowest-priced ${promotion.freeQuantity} item${promotion.freeQuantity === 1 ? '' : 's'} in each qualifying bundle are free.`
                  : `Each item in a complete ${promotion.buyQuantity}-item bundle receives ${promotion.discountPercent}% off.`}
                {' '}If deals save the same amount, the higher priority wins.
              </p>
            </fieldset>
            )
          })}
        </div>
      )}

      {categories.length === 0 && !loading && <Alert>Deal categories are unavailable. Check the catalog before saving.</Alert>}
      {!canEdit && <p className="text-sm text-[#526b7b]">An admin or owner account is required to change these settings.</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" disabled={!canEdit || loading || saving || categories.length === 0 || promotions.some((promotion) => promotion.categoryIds.length > promotion.buyQuantity + (promotion.type === 'buy_get_free' ? promotion.freeQuantity : 0))} onClick={() => void save()} className={primaryButton}>
          <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save deal rules'}
        </button>
        <p className="max-w-2xl text-xs leading-5 text-[#526b7b]">Checkout recalculates eligibility and discounts from current product categories and prices. Deals do not combine with the separate free gift, and gifts require at least PKR 2,500 after discounts.</p>
      </div>
    </section>
  )
}
