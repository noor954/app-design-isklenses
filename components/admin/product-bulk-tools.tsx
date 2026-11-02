'use client'

import { useEffect, useState } from 'react'
import { getContentAdmin } from '@/app/actions/content'
import { bulkUpdateProductPowerOptions, bulkUpdateProductPrices, type BulkPowerMode, type BulkPriceMode } from '@/app/actions/catalog-admin'
import { inputClass, primaryButton, secondaryButton } from '@/components/admin/admin-ui'
import { MultiSelectField } from '@/components/admin/multi-select-field'
import { normalizePowerLensOptions, type PowerLensOption } from '@/lib/power-lens-options'

export function ProductBulkTools({
  ids,
  busy,
  run,
}: {
  ids: string[]
  busy: boolean
  run: (action: () => Promise<void>, successMessage: string) => Promise<void>
}) {
  const [priceMode, setPriceMode] = useState<BulkPriceMode>('percent')
  const [priceValue, setPriceValue] = useState('')
  const [includeCompareAt, setIncludeCompareAt] = useState(true)
  const [powerMode, setPowerMode] = useState<BulkPowerMode>('add')
  const [powerValues, setPowerValues] = useState<string[]>([])
  const [options, setOptions] = useState<PowerLensOption[]>([])

  useEffect(() => {
    let active = true
    void getContentAdmin().then((content) => {
      if (active) setOptions(normalizePowerLensOptions(content.settings.power_options))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const priceHint = priceMode === 'set' ? 'New price, e.g. 1500' : priceMode === 'percent' ? 'Percent, e.g. -10 or 5' : 'Amount, e.g. -50 or 100'
  const choices = options.filter((option) => option.value !== '0.00').map((option) => ({ value: option.value, label: option.label }))

  return (
    <div className="mt-3 grid gap-3 border-t border-[#1c1c1a]/10 pt-3 lg:grid-cols-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[#1c1c1a]">Bulk price</span>
        <select aria-label="Bulk price update type" value={priceMode} onChange={(event) => setPriceMode(event.target.value as BulkPriceMode)} className={`${inputClass} w-auto`}>
          <option value="percent">Change by %</option>
          <option value="amount">Change by amount</option>
          <option value="set">Set exact price</option>
        </select>
        <input aria-label="Bulk price value" inputMode="decimal" value={priceValue} onChange={(event) => setPriceValue(event.target.value)} placeholder={priceHint} className={`${inputClass} w-44`} />
        {priceMode !== 'set' && (
          <label className="flex items-center gap-1.5 text-xs text-[#4c4b45]">
            <input type="checkbox" checked={includeCompareAt} onChange={(event) => setIncludeCompareAt(event.target.checked)} className="size-4 accent-[#087ba5]" /> Compare-at too
          </label>
        )}
        <button
          type="button"
          disabled={busy || !priceValue.trim()}
          onClick={() => void run(() => bulkUpdateProductPrices(ids, priceMode, priceValue.trim(), includeCompareAt), `Prices updated for ${ids.length} products.`)}
          className={primaryButton}
        >
          Apply price
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[#1c1c1a]">Bulk power options</span>
        <select aria-label="Bulk power update type" value={powerMode} onChange={(event) => setPowerMode(event.target.value as BulkPowerMode)} className={`${inputClass} w-auto`}>
          <option value="add">Add values</option>
          <option value="remove">Remove values</option>
          <option value="replace">Replace with</option>
        </select>
        <div className="min-w-56 flex-1">
          <MultiSelectField
            name="bulk-power-values"
            label="Power values"
            placeholder="Choose power values"
            options={choices}
            selected={powerValues}
            onChange={(value, checked) => setPowerValues((current) => checked ? [...current, value] : current.filter((entry) => entry !== value))}
          />
        </div>
        <button type="button" disabled={busy || options.length === 0} onClick={() => setPowerValues(choices.map((choice) => choice.value))} className={secondaryButton}>All</button>
        <button
          type="button"
          disabled={busy || (powerMode !== 'replace' && powerValues.length === 0)}
          onClick={() => void run(() => bulkUpdateProductPowerOptions(ids, powerValues, powerMode), `Power options updated for ${ids.length} products.`)}
          className={primaryButton}
        >
          Apply power
        </button>
      </div>
    </div>
  )
}
