'use client'

import { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { getContentAdmin, saveSetting } from '@/app/actions/content'
import { Alert, Field, inputClass, primaryButton, secondaryButton } from '@/components/admin/admin-ui'
import { DEFAULT_POWER_LENS_OPTIONS, normalizePowerLensOptions, type PowerLensOption } from '@/lib/power-lens-options'
import { reportError } from '@/lib/ui/notifications'

export function PowerLensOptionsManager({ canEdit }: { canEdit: boolean }) {
  const [options, setOptions] = useState<PowerLensOption[]>(DEFAULT_POWER_LENS_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    let active = true
    void getContentAdmin()
      .then((content) => {
        if (active) setOptions(normalizePowerLensOptions(content.settings.power_options))
      })
      .catch((loadError: unknown) => {
        if (active) setError(reportError(loadError, 'Power lens options could not be loaded.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  function updateOption(index: number, patch: Partial<PowerLensOption>) {
    setOptions((current) => current.map((option, position) => position === index ? { ...option, ...patch } : option))
    setSaved('')
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved('')
    try {
      await saveSetting('power_options', options)
      setSaved('Power values and per-eye prices are shared with the website and mobile apps.')
    } catch (saveError) {
      setError(reportError(saveError, 'Power lens options could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-.035em]">Power lens options</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526b7b]">
          Set the available diopters and extra price charged separately for each selected eye. Products only show options enabled in their product editor.
        </p>
      </header>
      {error && <Alert>{error}</Alert>}
      {saved && <p role="status" className="rounded-xl border border-[#087ba5]/20 bg-[#e8f6fb] px-4 py-3 text-sm text-[#15384d]">{saved}</p>}
      {loading ? (
        <p role="status" className="text-sm text-[#526b7b]">Loading power options…</p>
      ) : (
        <div className="space-y-3">
          {options.length === 0 && (
            <p className="rounded-xl border border-dashed border-[#b8d4e0] p-5 text-sm text-[#526b7b]">
              No power choices are configured. Add a choice before enabling power selection on a product.
            </p>
          )}
          {options.map((option, index) => (
            <div key={`${option.value}-${index}`} className="grid gap-3 rounded-xl border border-[#cfe2eb] bg-[#f7fcff] p-4 sm:grid-cols-[minmax(120px,.8fr)_minmax(160px,1.3fr)_minmax(130px,.8fr)_auto] sm:items-end">
              <Field label="Diopter value">
                <input
                  type="text"
                  inputMode="decimal"
                  value={option.value}
                  onChange={(event) => updateOption(index, { value: event.target.value })}
                  placeholder="e.g. -0.50"
                  className={inputClass}
                />
              </Field>
              <Field label="Customer-facing label">
                <input
                  type="text"
                  value={option.label}
                  onChange={(event) => updateOption(index, { label: event.target.value })}
                  placeholder="e.g. -0.50"
                  className={inputClass}
                />
              </Field>
              <Field label="Extra per eye (Rs)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={option.surcharge}
                  onChange={(event) => updateOption(index, { surcharge: event.target.value })}
                  placeholder="150.00"
                  className={`${inputClass} tabular-nums`}
                />
              </Field>
              <button
                type="button"
                disabled={!canEdit || saving}
                onClick={() => {
                  setOptions((current) => current.filter((_, position) => position !== index))
                  setSaved('')
                }}
                aria-label={`Remove ${option.value} power option`}
                className="mb-0.5 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#b8d4e0] px-3 text-sm font-medium text-[#526b7b] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] disabled:opacity-50"
              >
                <Trash2 size={15} aria-hidden="true" /> Remove
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={!canEdit || saving || options.length >= 200}
              onClick={() => {
                const nextValue = options.length ? (Math.min(...options.map((option) => Number(option.value))) - 0.25).toFixed(2) : '-0.50'
                setOptions((current) => [...current, { value: nextValue, label: nextValue, surcharge: '150.00' }])
                setSaved('')
              }}
              className={secondaryButton}
            >
              <Plus size={16} aria-hidden="true" /> Add power option
            </button>
            <button type="button" disabled={!canEdit || saving} onClick={() => void save()} className={primaryButton}>
              <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save options'}
            </button>
          </div>
        </div>
      )}
      {!canEdit && <p className="text-sm text-[#526b7b]">An admin or owner account is required to change these settings.</p>}
    </section>
  )
}
