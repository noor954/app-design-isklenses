'use client'

import { useRef, useState, type FormEvent, type InvalidEvent } from 'react'
import useSWR from 'swr'
import { LoaderCircle, Plus, X } from 'lucide-react'
import { createProduct, getAdminCategories, setProductRelations, updateProduct } from '@/app/actions/catalog-admin'
import { getAdminBrands, getAdminLensShades, getAdminLensTypes } from '@/app/actions/catalog-taxonomy'
import { Alert, Field, flattenCategories, inputClass, primaryButton, secondaryButton, type AdminCategory } from '@/components/admin/admin-ui'
import { useAdminProducts, type AdminProduct } from '@/lib/hooks/use-admin-data'
import { notify, reportError } from '@/lib/ui/notifications'
import { POWER_RANGE_OPTIONS } from '@/lib/power-ranges'

type SpecRow = { label: string; value: string }

const diameterAndCurveOptions = Array.from({ length: 121 }, (_, index) => (index / 10).toFixed(2))
const waterContentOptions = Array.from({ length: 101 }, (_, index) => `${index}%`)
const sectionClass = 'grid gap-4 rounded-xl border border-[#cfe2eb] bg-[#f7fcff] p-4 sm:grid-cols-2 sm:p-5'

function optionsWithSavedValue(options: string[], savedValue: string) {
  return savedValue && !options.includes(savedValue) ? [...options, savedValue] : options
}

export function ProductEditor({ product, onSaved, onCancel }: { product?: AdminProduct; onSaved: () => void; onCancel: () => void }) {
  const { data: categoryData } = useSWR('admin-categories', () => getAdminCategories())
  const { data: brandData } = useSWR('admin-brands', () => getAdminBrands())
  const { data: shadeData } = useSWR('admin-lens-shades', () => getAdminLensShades())
  const { data: lensTypeData } = useSWR('admin-lens-types', () => getAdminLensTypes())
  const { products } = useAdminProducts()
  const categories = flattenCategories((categoryData ?? []) as AdminCategory[])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [specs, setSpecs] = useState<SpecRow[]>(product?.specs ?? [])
  const [related, setRelated] = useState<string[]>(product?.relatedProductIds ?? [])
  const [relatedQuery, setRelatedQuery] = useState('')
  const [diameterMm, setDiameterMm] = useState(product?.diameterMm ?? '')
  const [baseCurve, setBaseCurve] = useState(product?.baseCurve ?? '')
  const [waterContent, setWaterContent] = useState(product?.waterContent ?? '')
  const [powerRange, setPowerRange] = useState(product?.powerRange ?? '')
  const [availablePowerRanges, setAvailablePowerRanges] = useState(product?.availablePowerRanges ?? [])
  const powerRangeInput = useRef<HTMLInputElement>(null)
  const variantManaged = Boolean(product?.variants.some((variant) => variant.isActive !== false))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '')
    const values = {
      name: text('name'),
      slug: text('slug'),
      categoryIds: form.getAll('categoryIds'),
      brandId: text('brandId') || null,
      lensShadeId: text('lensShadeId') || null,
      lensTypeId: text('lensTypeId') || null,
      sku: text('sku'),
      shortDescription: text('shortDescription'),
      description: text('description'),
      price: text('price'),
      compareAtPrice: text('compareAtPrice'),
      currency: text('currency').toUpperCase() || 'PKR',
      status: text('status'),
      diameterMm: text('diameterMm'),
      baseCurve: text('baseCurve'),
      waterContent: text('waterContent'),
      material: text('material'),
      wearDuration: text('wearDuration'),
      packContents: text('packContents'),
      powerType: text('powerType'),
      powerRange: text('powerRange'),
      availablePowerRanges: form.getAll('availablePowerRanges'),
      uvProtection: form.get('uvProtection') === 'on',
      fdaApproved: form.get('fdaApproved') === 'on',
      features: text('features').split('\n'),
      specs,
      usageInstructions: text('usageInstructions'),
      isFeatured: form.get('isFeatured') === 'on',
      seoTitle: text('seoTitle'),
      seoDescription: text('seoDescription'),
    }
    setSaving(true)
    setError('')
    try {
      let id = product?.id
      if (product) await updateProduct(product.id, values)
      else id = (await createProduct(values)).id
      if (id) await setProductRelations(id, related)
      notify('info', product ? 'Product updated.' : 'Product created.')
      onSaved()
    } catch (saveError) {
      setError(reportError(saveError, 'The product could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  function showRequiredFieldError(event: InvalidEvent<HTMLFormElement>) {
    const field = event.target
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      notify('warning', field.validationMessage || 'Complete the required product fields before saving.')
    }
  }

  const candidates = products
    .filter((item) => item.id !== product?.id && !related.includes(item.id) && item.name.toLowerCase().includes(relatedQuery.toLowerCase()))
    .slice(0, 6)
  const diameterOptions = optionsWithSavedValue(diameterAndCurveOptions, diameterMm)
  const baseCurveOptions = optionsWithSavedValue(diameterAndCurveOptions, baseCurve)
  const waterOptions = optionsWithSavedValue(waterContentOptions, waterContent)

  return (
    <form onSubmit={submit} onInvalidCapture={showRequiredFieldError} className="rounded-2xl border border-[#cfe2eb] bg-white p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#15384d]">{product ? `Edit ${product.name}` : 'Add a product'}</h2>
          <p className="mt-1 text-sm leading-5 text-[#526b7b]">Saved values are prefilled. Missing lens specifications stay blank until verified.</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close product editor" className="grid size-10 shrink-0 place-items-center rounded-full text-[#526b7b] hover:bg-[#e8f6fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5]"><X size={17} /></button>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {variantManaged && <div className="mb-4"><Alert tone="info">Price and stock are calculated from active lens options.</Alert></div>}
      {categories.length === 0 && <div className="mb-4"><Alert tone="info">Products can be saved without categories. You can attach categories later.</Alert></div>}

      <fieldset className={sectionClass}>
        <legend className="px-1 text-sm font-semibold text-[#15384d]">Product identity</legend>
        <p className="text-xs leading-5 text-[#526b7b] sm:col-span-2">Name, catalog placement, and availability.</p>
        <Field label="Name" required><input name="name" required maxLength={200} defaultValue={product?.name} className={inputClass} /></Field>
        <Field label="Slug (blank = from name)"><input name="slug" maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={product?.slug} className={inputClass} /></Field>
        <Field label="Categories">
          <select name="categoryIds" multiple aria-describedby="product-category-help" defaultValue={product?.categoryIds ?? (product?.categoryId ? [product.categoryId] : [])} className={`${inputClass} min-h-32`}>
            {categories.map((row) => <option key={row.id} value={row.id}>{'\u2003'.repeat(row.depth)}{row.name}</option>)}
          </select>
          <span id="product-category-help" className="mt-1 block text-xs text-[#526b7b]">Optional. Select multiple categories, or leave empty until you are ready to assign them.</span>
        </Field>
        <Field label="Brand">
          <select name="brandId" defaultValue={product?.brandId ?? ''} className={inputClass}>
            <option value="">No brand</option>
            {(brandData ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}{row.isActive ? '' : ' (inactive)'}</option>)}
          </select>
        </Field>
        <Field label="SKU"><input name="sku" maxLength={80} defaultValue={product?.sku ?? ''} className={inputClass} /></Field>
        <Field label="Status">
          <select name="status" defaultValue={product?.status ?? 'active'} className={inputClass}>
            <option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
          </select>
        </Field>
      </fieldset>

      <fieldset className={`${sectionClass} mt-4`}>
        <legend className="px-1 text-sm font-semibold text-[#15384d]">Pricing</legend>
        <p className="text-xs leading-5 text-[#526b7b] sm:col-span-2">Price and currency shown on the product listing.</p>
        <Field label="Price" required><input name="price" required inputMode="decimal" pattern="\d+(\.\d{1,2})?" readOnly={variantManaged} defaultValue={product?.price} className={inputClass} /></Field>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Field label="Compare-at (old) price"><input name="compareAtPrice" inputMode="decimal" pattern="\d+(\.\d{1,2})?" defaultValue={product?.compareAtPrice ?? ''} className={inputClass} /></Field>
          <Field label="Currency"><input name="currency" maxLength={3} defaultValue={product?.currency ?? 'PKR'} className={inputClass} /></Field>
        </div>
      </fieldset>

      <fieldset className={`${sectionClass} mt-4`}>
        <legend className="px-1 text-sm font-semibold text-[#15384d]">Lens specifications</legend>
        <p className="text-xs leading-5 text-[#526b7b] sm:col-span-2">Recorded values are prefilled. New or unverified measurements stay unselected.</p>
        <Field label="Power type"><input name="powerType" placeholder="Zero power / Prescription" defaultValue={product?.powerType ?? ''} className={inputClass} /></Field>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Power range notes (optional)">
            <input
              ref={powerRangeInput}
              name="powerRange"
              placeholder="Verified note shown in specifications"
              value={powerRange}
              onChange={(event) => setPowerRange(event.target.value)}
              className={inputClass}
            />
            </Field>
          </div>
          <button
            type="button"
            onClick={() => {
              setPowerRange('')
              powerRangeInput.current?.focus()
            }}
            disabled={!powerRange}
            aria-label="Clear power range notes"
            className="mb-0.5 inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-[#b8d4e0] px-3 text-xs font-medium text-[#526b7b] hover:bg-[#e8f6fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={14} aria-hidden="true" /> Clear
          </button>
        </div>
        <div className="sm:col-span-2">
          <p className="text-sm font-medium text-[#15384d]">Power ranges offered to customers</p>
          <p id="power-range-help" className="mt-1 text-xs leading-5 text-[#526b7b]">
            Select the ranges shoppers can choose separately for their left and right eyes. Leave all unchecked to hide power selection.
          </p>
          <details className="relative mt-2">
            <summary
              aria-describedby="power-range-help"
              className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-[#b8d4e0] bg-[#e8f6fb] px-4 py-3 text-sm text-[#15384d] transition-colors hover:border-[#087ba5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] [&::-webkit-details-marker]:hidden"
            >
              <span>{availablePowerRanges.length ? `${availablePowerRanges.length} ranges selected` : 'Choose one or more power ranges'}</span>
              <span className="text-xs font-medium text-[#006f9b]">{availablePowerRanges.length ? 'Edit selection' : 'Open list'}</span>
            </summary>
            <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-[#b8d4e0] bg-white p-2 shadow-[0_12px_28px_rgba(21,56,77,.18)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#cfe2eb] px-2 py-2">
                <span className="text-xs font-semibold text-[#526b7b]">Available diopter ranges</span>
                <button
                  type="button"
                  onClick={() => setAvailablePowerRanges([])}
                  disabled={availablePowerRanges.length === 0}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-[#006f9b] hover:bg-[#e8f6fb] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#087ba5] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <div className="grid gap-1 p-1 sm:grid-cols-2">
                {POWER_RANGE_OPTIONS.map((range) => {
                  const checked = availablePowerRanges.includes(range)
                  return (
                    <label
                      key={range}
                      className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm transition-colors hover:bg-[#e8f6fb] ${checked ? 'bg-[#e8f6fb] font-semibold text-[#15384d]' : 'text-[#526b7b]'}`}
                    >
                      <input
                        type="checkbox"
                        name="availablePowerRanges"
                        value={range}
                        checked={checked}
                        onChange={() => setAvailablePowerRanges((current) => checked
                          ? current.filter((value) => value !== range)
                          : POWER_RANGE_OPTIONS.filter((value) => value === range || current.includes(value)))}
                        className="size-4 accent-[#006f9b]"
                      />
                      {range} D
                    </label>
                  )
                })}
              </div>
            </div>
          </details>
          {availablePowerRanges.length > 0 && (
            <p className="mt-2 text-xs text-[#526b7b]">
              Customer choices: {availablePowerRanges.join(' D, ')} D
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
          <Field label="Diameter (DIA) · mm" required>
            <select name="diameterMm" required value={diameterMm} onChange={(event) => setDiameterMm(event.target.value)} className={inputClass}>
              <option value="" disabled>Select diameter</option>
              {diameterOptions.map((value) => <option key={value} value={value}>{value}{!diameterAndCurveOptions.includes(value) ? ' (saved value)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Base curve (BC) · mm" required>
            <select name="baseCurve" required value={baseCurve} onChange={(event) => setBaseCurve(event.target.value)} className={inputClass}>
              <option value="" disabled>Select base curve</option>
              {baseCurveOptions.map((value) => <option key={value} value={value}>{value}{!diameterAndCurveOptions.includes(value) ? ' (saved value)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Water content · %" required>
            <select name="waterContent" required value={waterContent} onChange={(event) => setWaterContent(event.target.value)} className={inputClass}>
              <option value="" disabled>Select water content</option>
              {waterOptions.map((value) => <option key={value} value={value}>{value}{!waterContentOptions.includes(value) ? ' (saved value)' : ''}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className={`${sectionClass} mt-4`}>
        <legend className="px-1 text-sm font-semibold text-[#15384d]">Wear &amp; construction</legend>
        <p className="text-xs leading-5 text-[#526b7b] sm:col-span-2">Group the remaining product construction and usage details.</p>
        <Field label="Material"><input name="material" defaultValue={product?.material ?? ''} className={inputClass} /></Field>
        <Field label="Lens type">
          <select name="lensTypeId" defaultValue={product?.lensTypeId ?? ''} className={inputClass}>
            <option value="">No lens type</option>
            {(lensTypeData ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}{row.isActive ? '' : ' (inactive)'}</option>)}
          </select>
        </Field>
        <Field label="Wear duration"><input name="wearDuration" placeholder="Monthly / One day" defaultValue={product?.wearDuration ?? ''} className={inputClass} /></Field>
        <Field label="Pack contents"><input name="packContents" placeholder="2 lenses (1 pair)" defaultValue={product?.packContents ?? ''} className={inputClass} /></Field>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm text-[#15384d]"><input name="uvProtection" type="checkbox" defaultChecked={product?.uvProtection ?? false} className="size-4 accent-[#006f9b]" /> UV protection</label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input name="fdaApproved" type="checkbox" defaultChecked={product?.fdaApproved ?? false} className="mt-0.5 size-4 accent-[#006f9b]" />
          <span>
            <span className="font-medium text-[#15384d]">FDA Approved</span>
            <span className="mt-1 block text-xs leading-5 text-[#526b7b]">Only enable after verifying current FDA approval documentation. This adds an FDA Approved stamp to product photos.</span>
          </span>
        </label>
      </fieldset>

      <fieldset className={`${sectionClass} mt-4`}>
        <legend className="px-1 text-sm font-semibold text-[#15384d]">Shade</legend>
        <Field label="Shade">
          <select name="lensShadeId" defaultValue={product?.lensShadeId ?? ''} className={inputClass}>
            <option value="">No shade</option>
            {(shadeData ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}{row.isActive ? '' : ' (inactive)'}</option>)}
          </select>
        </Field>
        <p className="self-end pb-2 text-xs leading-5 text-[#68675f]">Add or edit shades in the Lens shades section.</p>
      </fieldset>

      <fieldset className={`${sectionClass} mt-4`}>
        <legend className="px-1 text-sm font-semibold text-[#15384d]">Product description</legend>
        <Field label="Short description"><input name="shortDescription" maxLength={400} defaultValue={product?.shortDescription ?? ''} className={inputClass} /></Field>
        <Field label="Description"><textarea name="description" rows={4} maxLength={10000} defaultValue={product?.description ?? ''} className={inputClass} /></Field>
      </fieldset>

      <fieldset className={`${sectionClass} mt-4`}>
        <legend className="px-1 text-sm font-semibold text-[#15384d]">Features &amp; specifications</legend>
        <div className="sm:col-span-2"><Field label="Key features (one per line)"><textarea name="features" rows={4} defaultValue={(product?.features ?? []).join('\n')} className={inputClass} /></Field></div>
        <div>
          <p className="text-xs font-medium text-[#55544e]">Extra specification rows</p>
          <ul className="mt-1.5 space-y-2">
            {specs.map((spec, index) => (
              <li key={index} className="flex flex-col gap-2 sm:flex-row">
                <input aria-label="Label" placeholder="Label" value={spec.label} onChange={(event) => setSpecs(specs.map((row, i) => i === index ? { ...row, label: event.target.value } : row))} className={`${inputClass} min-w-0`} />
                <input aria-label="Value" placeholder="Value" value={spec.value} onChange={(event) => setSpecs(specs.map((row, i) => i === index ? { ...row, value: event.target.value } : row))} className={`${inputClass} min-w-0`} />
                <button type="button" aria-label="Remove row" onClick={() => setSpecs(specs.filter((_, i) => i !== index))} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-[#f2f1ed]"><X size={15} /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setSpecs([...specs, { label: '', value: '' }])} className={`${secondaryButton} mt-2`}><Plus size={14} className="mr-1 inline" />Add row</button>
        </div>
        <Field label="Usage / care instructions"><textarea name="usageInstructions" rows={3} defaultValue={product?.usageInstructions ?? ''} className={inputClass} /></Field>
      </fieldset>

      <fieldset className={`${sectionClass} mt-4`}>
        <legend className="px-1 text-sm font-semibold text-[#15384d]">Related products</legend>
        <p className="text-xs leading-5 text-[#526b7b] sm:col-span-2">Add optional cross-links to other catalog listings.</p>
        <div className="flex flex-wrap gap-2">
          {related.map((id) => {
            const item = products.find((row) => row.id === id)
            return <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#f2f1ed] py-1 pl-3 pr-1 text-xs">{item?.name ?? id}<button type="button" aria-label="Remove related product" onClick={() => setRelated(related.filter((value) => value !== id))} className="grid size-5 place-items-center rounded-full hover:bg-white"><X size={12} /></button></span>
          })}
        </div>
        <input value={relatedQuery} onChange={(event) => setRelatedQuery(event.target.value)} placeholder="Search products to add…" aria-label="Search related products" className={`${inputClass} mt-2`} />
        {relatedQuery && <ul className="mt-1 rounded-lg border border-[#1c1c1a]/10">{candidates.map((item) => <li key={item.id}><button type="button" onClick={() => { setRelated([...related, item.id]); setRelatedQuery('') }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f2f1ed]">{item.name} <span className="text-xs text-[#68675f]">· {item.category}</span></button></li>)}{candidates.length === 0 && <li className="px-3 py-2 text-xs text-[#68675f]">No matches.</li>}</ul>}
      </fieldset>

      <fieldset className={`${sectionClass} mt-4`}>
        <legend className="px-1 text-sm font-semibold text-[#15384d]">Search listing</legend>
        <Field label="SEO title"><input name="seoTitle" maxLength={160} defaultValue={product?.seoTitle ?? ''} className={inputClass} /></Field>
        <Field label="SEO description"><input name="seoDescription" maxLength={320} defaultValue={product?.seoDescription ?? ''} className={inputClass} /></Field>
      </fieldset>

      <div className="sticky bottom-2 z-10 mt-4 flex flex-wrap gap-2 rounded-xl border border-[#cfe2eb] bg-white/95 p-3 shadow-[0_8px_24px_rgba(21,56,77,.12)]">
        <button type="submit" disabled={saving || categories.length === 0} className={primaryButton}>{saving && <LoaderCircle size={15} className="animate-spin" />}{saving ? 'Saving…' : product ? 'Save product' : 'Create product'}</button>
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
      </div>
    </form>
  )
}
