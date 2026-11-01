import type { ReactNode } from 'react'

export const inputClass = 'w-full rounded-xl border border-[#b8d4e0] bg-white px-3 py-2.5 text-sm text-[#15384d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#087ba5] disabled:cursor-not-allowed disabled:opacity-60'
export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#006f9b] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#005b80] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] disabled:cursor-wait disabled:opacity-60'
export const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-full border border-[#b8d4e0] bg-white px-4 py-2.5 text-sm font-medium text-[#15384d] transition-colors hover:bg-[#e8f6fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] disabled:cursor-not-allowed disabled:opacity-60'

export function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="block text-xs font-medium text-[#55544e]">{label}{required && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}<div className="mt-1.5">{children}</div></label>
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) {
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${tone === 'error' ? 'border-[#9b4a36]/30 bg-[#f8eeeb] text-[#753b2d]' : 'border-[#1c1c1a]/15 bg-[#f2f1ed]'}`}>{children}</p>
}

export type AdminCategory = {
  id: string
  parentId: string | null
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  sortOrder: number
  isActive: boolean
  showInMenu: boolean
  seoTitle: string | null
  seoDescription: string | null
  path: string
  depth: number
  productCount: number
}

/** Depth-first flattened tree so selects can show indented options. */
export function flattenCategories(rows: AdminCategory[]) {
  const children = new Map<string, AdminCategory[]>()
  for (const row of rows) children.set(row.parentId ?? 'root', [...(children.get(row.parentId ?? 'root') ?? []), row])
  const out: AdminCategory[] = []
  const seen = new Set<string>()
  const walk = (key: string) => {
    for (const row of children.get(key) ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
      walk(row.id)
    }
  }
  walk('root')
  return out
}
