'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  deleteBrand, deleteLensShade, deleteLensType, getAdminBrands, getAdminLensShades, getAdminLensTypes, getRecentErrorLogs, saveBrand, saveLensShade, saveLensType,
} from '@/app/actions/catalog-taxonomy'
import { DataTable, type DataTableBulkAction, type DataTableColumn } from '@/components/admin/data-table'
import { Alert, Field, inputClass, primaryButton, secondaryButton } from '@/components/admin/admin-ui'
import { reportError } from '@/lib/ui/notifications'

type Brand = Awaited<ReturnType<typeof getAdminBrands>>[number]
type LensShade = Awaited<ReturnType<typeof getAdminLensShades>>[number]
type LensType = Awaited<ReturnType<typeof getAdminLensTypes>>[number]

function BrandForm({ brand, onDone, onCancel }: { brand?: Brand; onDone: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? '')

  async function uploadLogo(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      const response = await fetch('/api/admin/content/upload', { method: 'POST', body: form })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Brand logo upload failed.')
      setLogoUrl(result.data.url)
    } catch (uploadError) {
      setError(reportError(uploadError, 'Brand logo could not be uploaded.'))
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await saveBrand({ id: brand?.id, name: form.get('name'), logoUrl, isActive: form.get('isActive') === 'on' })
      onDone()
    } catch (saveError) {
      setError(reportError(saveError, 'Brand could not be saved.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mb-5 grid gap-4 rounded-2xl border border-[#cfe2eb] bg-white p-5 sm:grid-cols-[1fr_minmax(220px,1.2fr)_auto_auto] sm:items-end">
      <Field label="Brand name" required><input name="name" required maxLength={100} defaultValue={brand?.name ?? ''} className={inputClass} /></Field>
      <Field label="Brand logo">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`${brand?.name ?? 'Brand'} logo preview`} className="size-11 shrink-0 rounded-lg border border-[#cfe2eb] bg-[#f7fcff] object-contain p-1" />
          ) : <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-dashed border-[#b8d4e0] bg-[#f7fcff] text-xs text-[#526b7b]">No logo</span>}
          <div className="min-w-0 flex-1">
            <input type="file" accept="image/avif,image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void uploadLogo(event.target.files?.[0])} className="block w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[#e8f6fb] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#15384d] hover:file:bg-[#b8e8f5]" />
            <p className="mt-1 text-xs leading-4 text-[#526b7b]">JPEG, PNG, WebP, or AVIF; max 4 MB. Stored in the site media library.</p>
          </div>
          {logoUrl && <button type="button" onClick={() => setLogoUrl('')} className="rounded-full px-2 py-1 text-xs text-[#753b2d] hover:bg-[#f8eeeb]">Remove</button>}
        </div>
      </Field>
      <label className="flex items-center gap-2 pb-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={brand?.isActive ?? true} /> Active</label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? 'Uploading…' : brand ? 'Save brand' : 'Create brand'}</button>
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
      </div>
      {error && <div className="sm:col-span-4"><Alert>{error}</Alert></div>}
    </form>
  )
}

function LensShadeForm({ shade, onDone, onCancel }: { shade?: LensShade; onDone: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await saveLensShade({ id: shade?.id, name: form.get('name'), hex: form.get('hex'), isActive: form.get('isActive') === 'on' })
      onDone()
    } catch (saveError) {
      setError(reportError(saveError, 'Lens shade could not be saved.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mb-5 grid gap-4 rounded-2xl border border-[#1c1c1a]/10 bg-white p-5 sm:grid-cols-[1fr_140px_auto_auto] sm:items-end">
      <Field label="Shade name" required><input name="name" required maxLength={80} defaultValue={shade?.name ?? ''} className={inputClass} /></Field>
      <Field label="Display color (optional)"><input name="hex" maxLength={7} pattern="#[0-9a-fA-F]{6}" placeholder="e.g. #748b9f" defaultValue={shade?.hex ?? ''} className={inputClass} /></Field>
      <label className="flex items-center gap-2 pb-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={shade?.isActive ?? true} /> Active</label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>{busy && <LoaderCircle size={15} className="animate-spin" />}{shade ? 'Save shade' : 'Create shade'}</button>
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
      </div>
      {error && <div className="sm:col-span-4"><Alert>{error}</Alert></div>}
    </form>
  )
}

export function BrandManager({ canEdit }: { canEdit: boolean }) {
  const { data, error, isLoading, mutate } = useSWR('admin-brands', () => getAdminBrands())
  const [editing, setEditing] = useState<Brand | 'new' | null>(null)
  const [message, setMessage] = useState('')
  async function remove(brand: Brand) {
    if (!window.confirm(`Delete brand ${brand.name}? Products using it will have their brand cleared.`)) return
    try { await deleteBrand(brand.id); await mutate() }
    catch (removeError) { setMessage(reportError(removeError, 'Brand could not be deleted.')) }
  }
  return (
    <section className="min-w-0 flex-1">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-[-.04em]">Brands</h1><p className="mt-2 text-sm leading-6 text-[#68675f]">Maintain a reusable catalog of product brands.</p></div>
        {canEdit && <button type="button" onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> Add brand</button>}
      </div>
      {(message || error) && <div className="mb-4"><Alert>{message || (error instanceof Error ? error.message : 'Brands could not be loaded.')}</Alert></div>}
      {editing && <BrandForm brand={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); void mutate() }} />}
      {isLoading ? <p className="text-sm text-[#68675f]">Loading brands…</p> : !data?.length ? <p className="rounded-2xl border border-dashed border-[#1c1c1a]/20 bg-white/60 px-5 py-10 text-center text-sm text-[#68675f]">No brands yet. Add one to make it available in product forms.</p> : (
        <DataTable
          rows={data}
          getRowId={(brand) => brand.id}
          getSearchValue={(brand) => `${brand.name} ${brand.slug}`}
          itemLabel="brands"
          emptyMessage="No brands are available."
          filters={[{ id: 'active', label: 'Status', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], value: (brand) => brand.isActive ? 'active' : 'inactive' }]}
          columns={[
            { id: 'brand', header: 'Brand', sortValue: (brand) => brand.name, searchValue: (brand) => brand.name, className: 'min-w-[220px]', cell: (brand) => <div className="flex items-center gap-3">
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt="" className="size-10 rounded-lg border border-[#cfe2eb] bg-[#f7fcff] object-contain p-1" />
              ) : <span className="grid size-10 place-items-center rounded-lg border border-dashed border-[#b8d4e0] text-xs text-[#526b7b]">No logo</span>}
              <span className="font-medium">{brand.name}</span>
            </div> },
            { id: 'slug', header: 'Slug', sortValue: (brand) => brand.slug, searchValue: (brand) => brand.slug, className: 'text-[#526b7b]', cell: (brand) => brand.slug },
            { id: 'status', header: 'Status', sortValue: (brand) => Number(brand.isActive), cell: (brand) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${brand.isActive ? 'bg-[#e8f6fb] text-[#006f9b]' : 'bg-[#f3f5f6] text-[#526b7b]'}`}>{brand.isActive ? 'Active' : 'Inactive'}</span> },
            { id: 'actions', header: 'Actions', className: 'w-24 text-right', cell: (brand) => canEdit ? <div className="flex justify-end">
              <button type="button" aria-label={`Edit ${brand.name}`} onClick={() => setEditing(brand)} className="grid size-9 place-items-center rounded-full hover:bg-[#e8f6fb]"><Pencil size={15} /></button>
              <button type="button" aria-label={`Delete ${brand.name}`} onClick={() => void remove(brand)} className="grid size-9 place-items-center rounded-full text-[#753b2d] hover:bg-[#f8eeeb]"><Trash2 size={15} /></button>
            </div> : null },
          ] as DataTableColumn<Brand>[]}
          exportRow={(brand) => ({ Name: brand.name, Slug: brand.slug, Active: brand.isActive })}
          bulkActions={canEdit ? [{
            label: 'Delete selected',
            confirm: (selected) => `Delete ${selected.length} selected brand${selected.length === 1 ? '' : 's'}? Products using them will have their brand cleared.`,
            run: async (selected) => {
              try { for (const brand of selected) await deleteBrand(brand.id) }
              finally { await mutate() }
            },
          } satisfies DataTableBulkAction<Brand>] : []}
        />
      )}
    </section>
  )
}

export function LensShadeManager({ canEdit }: { canEdit: boolean }) {
  const { data, error, isLoading, mutate } = useSWR('admin-lens-shades', () => getAdminLensShades())
  const [editing, setEditing] = useState<LensShade | 'new' | null>(null)
  const [message, setMessage] = useState('')
  async function remove(shade: LensShade) {
    if (!window.confirm(`Delete lens shade ${shade.name}? Products using it will have their shade cleared.`)) return
    try { await deleteLensShade(shade.id); await mutate() }
    catch (removeError) { setMessage(reportError(removeError, 'Lens shade could not be deleted.')) }
  }
  return (
    <section className="min-w-0 flex-1">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-[-.04em]">Lens shades</h1><p className="mt-2 text-sm leading-6 text-[#68675f]">Manage color shades that can be attached to lens products.</p></div>
        {canEdit && <button type="button" onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> Add lens shade</button>}
      </div>
      {(message || error) && <div className="mb-4"><Alert>{message || (error instanceof Error ? error.message : 'Lens shades could not be loaded.')}</Alert></div>}
      {editing && <LensShadeForm shade={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); void mutate() }} />}
      {isLoading ? <p className="text-sm text-[#68675f]">Loading lens shades…</p> : !data?.length ? <p className="rounded-2xl border border-dashed border-[#1c1c1a]/20 bg-white/60 px-5 py-10 text-center text-sm text-[#68675f]">No shades yet. Add a shade to make it available in product forms.</p> : (
        <DataTable
          rows={data}
          getRowId={(shade) => shade.id}
          getSearchValue={(shade) => `${shade.name} ${shade.hex ?? ''}`}
          itemLabel="lens shades"
          emptyMessage="No lens shades are available."
          filters={[{ id: 'active', label: 'Status', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], value: (shade) => shade.isActive ? 'active' : 'inactive' }]}
          columns={[
            { id: 'shade', header: 'Shade', sortValue: (shade) => shade.name, searchValue: (shade) => shade.name, className: 'min-w-[220px]', cell: (shade) => <div className="flex items-center gap-3">
              {shade.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shade.imageUrl} alt="" className="size-10 rounded-full border border-[#cfe2eb] object-cover" />
              ) : shade.hex ? <span className="size-8 rounded-full border border-black/15" style={{ backgroundColor: shade.hex }} /> : <span className="grid size-8 place-items-center rounded-full border border-dashed border-[#b8d4e0] text-xs text-[#526b7b]">N/A</span>}
              <span className="font-medium">{shade.name}</span>
            </div> },
            { id: 'color', header: 'Display color', sortValue: (shade) => shade.hex ?? '', searchValue: (shade) => shade.hex ?? '', cell: (shade) => shade.hex ?? '—' },
            { id: 'status', header: 'Status', sortValue: (shade) => Number(shade.isActive), cell: (shade) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${shade.isActive ? 'bg-[#e8f6fb] text-[#006f9b]' : 'bg-[#f3f5f6] text-[#526b7b]'}`}>{shade.isActive ? 'Active' : 'Inactive'}</span> },
            { id: 'actions', header: 'Actions', className: 'w-24 text-right', cell: (shade) => canEdit ? <div className="flex justify-end">
              <button type="button" aria-label={`Edit ${shade.name}`} onClick={() => setEditing(shade)} className="grid size-9 place-items-center rounded-full hover:bg-[#e8f6fb]"><Pencil size={15} /></button>
              <button type="button" aria-label={`Delete ${shade.name}`} onClick={() => void remove(shade)} className="grid size-9 place-items-center rounded-full text-[#753b2d] hover:bg-[#f8eeeb]"><Trash2 size={15} /></button>
            </div> : null },
          ] as DataTableColumn<LensShade>[]}
          exportRow={(shade) => ({ Name: shade.name, Hex: shade.hex, Active: shade.isActive })}
          bulkActions={canEdit ? [{
            label: 'Delete selected',
            confirm: (selected) => `Delete ${selected.length} selected lens shade${selected.length === 1 ? '' : 's'}? Products using them will have their shade cleared.`,
            run: async (selected) => {
              try { for (const shade of selected) await deleteLensShade(shade.id) }
              finally { await mutate() }
            },
          } satisfies DataTableBulkAction<LensShade>] : []}
        />
      )}
    </section>
  )
}

function LensTypeForm({ lensType, onDone, onCancel }: { lensType?: LensType; onDone: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await saveLensType({ id: lensType?.id, name: form.get('name'), isActive: form.get('isActive') === 'on' })
      onDone()
    } catch (saveError) {
      setError(reportError(saveError, 'Lens type could not be saved.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mb-5 grid gap-4 rounded-2xl border border-[#cfe2eb] bg-white p-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <Field label="Lens type name" required><input name="name" required maxLength={100} defaultValue={lensType?.name ?? ''} className={inputClass} /></Field>
      <label className="flex items-center gap-2 pb-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={lensType?.isActive ?? true} /> Active</label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? 'Saving…' : lensType ? 'Save type' : 'Create type'}</button>
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
      </div>
      {error && <div className="sm:col-span-3"><Alert>{error}</Alert></div>}
    </form>
  )
}

export function LensTypeManager({ canEdit }: { canEdit: boolean }) {
  const { data, error, isLoading, mutate } = useSWR('admin-lens-types', () => getAdminLensTypes())
  const [editing, setEditing] = useState<LensType | 'new' | null>(null)
  const [message, setMessage] = useState('')
  async function remove(lensType: LensType) {
    if (!window.confirm(`Delete lens type ${lensType.name}? Products using it will have their type cleared.`)) return
    try { await deleteLensType(lensType.id); await mutate() }
    catch (removeError) { setMessage(reportError(removeError, 'Lens type could not be deleted.')) }
  }
  return (
    <section className="min-w-0 flex-1">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-[-.04em]">Lens types</h1><p className="mt-2 text-sm leading-6 text-[#526b7b]">Maintain lens families used in product records. Sync available source types from Catalog sync.</p></div>
        {canEdit && <button type="button" onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> Add lens type</button>}
      </div>
      {(message || error) && <div className="mb-4"><Alert>{message || (error instanceof Error ? error.message : 'Lens types could not be loaded.')}</Alert></div>}
      {editing && <LensTypeForm lensType={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); void mutate() }} />}
      {isLoading ? <p className="text-sm text-[#526b7b]">Loading lens types…</p> : !data?.length ? <p className="rounded-2xl border border-dashed border-[#b8d4e0] bg-white/60 px-5 py-10 text-center text-sm text-[#526b7b]">No lens types yet. Sync the source catalog or add a type to make it available in product forms.</p> : (
        <DataTable
          rows={data}
          getRowId={(lensType) => lensType.id}
          getSearchValue={(lensType) => lensType.name}
          itemLabel="lens types"
          emptyMessage="No lens types are available."
          filters={[{ id: 'active', label: 'Status', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], value: (lensType) => lensType.isActive ? 'active' : 'inactive' }]}
          columns={[
            { id: 'name', header: 'Lens type', sortValue: (lensType) => lensType.name, searchValue: (lensType) => lensType.name, className: 'min-w-[220px]', cell: (lensType) => <span className="font-medium">{lensType.name}</span> },
            { id: 'status', header: 'Status', sortValue: (lensType) => Number(lensType.isActive), cell: (lensType) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${lensType.isActive ? 'bg-[#e8f6fb] text-[#006f9b]' : 'bg-[#f3f5f6] text-[#526b7b]'}`}>{lensType.isActive ? 'Active' : 'Inactive'}</span> },
            { id: 'actions', header: 'Actions', className: 'w-24 text-right', cell: (lensType) => canEdit ? <div className="flex justify-end">
              <button type="button" aria-label={`Edit ${lensType.name}`} onClick={() => setEditing(lensType)} className="grid size-9 place-items-center rounded-full hover:bg-[#e8f6fb]"><Pencil size={15} /></button>
              <button type="button" aria-label={`Delete ${lensType.name}`} onClick={() => void remove(lensType)} className="grid size-9 place-items-center rounded-full text-[#753b2d] hover:bg-[#f8eeeb]"><Trash2 size={15} /></button>
            </div> : null },
          ] as DataTableColumn<LensType>[]}
          exportRow={(lensType) => ({ Name: lensType.name, Active: lensType.isActive })}
          bulkActions={canEdit ? [{
            label: 'Delete selected',
            confirm: (selected) => `Delete ${selected.length} selected lens type${selected.length === 1 ? '' : 's'}? Products using them will have their type cleared.`,
            run: async (selected) => {
              try { for (const lensType of selected) await deleteLensType(lensType.id) }
              finally { await mutate() }
            },
          } satisfies DataTableBulkAction<LensType>] : []}
        />
      )}
    </section>
  )
}

export function ErrorLogManager() {
  const { data, error, isLoading, mutate } = useSWR('admin-error-logs', () => getRecentErrorLogs(), { refreshInterval: 30000 })
  type ErrorLog = Awaited<ReturnType<typeof getRecentErrorLogs>>[number]
  return (
    <section className="min-w-0 flex-1">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-[-.04em]">Error logs</h1><p className="mt-2 text-sm leading-6 text-[#68675f]">Recent application errors. Entries are pruned after 24 hours; up to 200 are shown here.</p></div>
        <button type="button" onClick={() => void mutate()} className={secondaryButton}>Refresh</button>
      </div>
      {error && <div className="mb-4"><Alert>{error instanceof Error ? error.message : 'Error logs could not be loaded.'}</Alert></div>}
      {isLoading ? <p className="text-sm text-[#68675f]">Loading error logs…</p> : !data?.length ? <p className="rounded-2xl border border-dashed border-[#1c1c1a]/20 bg-white/60 px-5 py-10 text-center text-sm text-[#68675f]">No errors recorded in the last 24 hours.</p> : (
        <DataTable
          rows={data}
          getRowId={(entry) => String(entry.id)}
          getSearchValue={(entry) => `${entry.errorName} ${entry.message} ${entry.source}`}
          itemLabel="error logs"
          initialPageSize={25}
          emptyMessage="No error logs are available."
          columns={[
            { id: 'error', header: 'Error', sortValue: (entry) => entry.errorName, searchValue: (entry) => entry.errorName, className: 'min-w-[220px]', cell: (entry) => <span className="font-semibold text-[#9b1c34]">{entry.errorName}</span> },
            { id: 'message', header: 'Message', searchValue: (entry) => entry.message, className: 'min-w-[280px] max-w-[42rem]', cell: (entry) => <div className="max-w-[42rem]">
              <p className="line-clamp-2 whitespace-pre-wrap break-words">{entry.message}</p>
              <p className="mt-1 text-xs text-[#526b7b]">Source: {entry.source}</p>
              {entry.stack && <details className="mt-2"><summary className="cursor-pointer text-xs underline underline-offset-2">Diagnostics and stack trace</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f7fcff] p-3 text-xs">{entry.stack}</pre></details>}
            </div> },
            { id: 'createdAt', header: 'Recorded', sortValue: (entry) => entry.createdAt.getTime(), className: 'min-w-[180px] text-xs', cell: (entry) => <time dateTime={entry.createdAt.toISOString()}>{entry.createdAt.toLocaleString()}</time> },
          ] as DataTableColumn<ErrorLog>[]}
          exportRow={(entry) => ({ Error: entry.errorName, Message: entry.message, Source: entry.source, Recorded: entry.createdAt.toISOString() })}
        />
      )}
    </section>
  )
}
