'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { AdminWorkspace } from '@/components/admin/admin-workspace'
import type { AdminSectionId } from '@/lib/admin-sections'

export function AdminShell({ section = 'overview' }: { section?: AdminSectionId }) {
  return (
    <div className="admin-theme min-h-screen">
      <header className="bg-[#201b35] text-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><img src="/isk-logo.png" alt="" aria-hidden="true" className="size-10 rounded-md bg-white p-1 object-contain" /> <span>ISK <span className="font-serif font-normal italic text-[#f3b4c9]">Lenses</span> <span className="ml-1 font-medium text-white/70">· Admin</span></span></span>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85 transition-colors hover:text-white hover:underline">View store <ExternalLink size={14} aria-hidden="true" /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 lg:px-12"><AdminWorkspace section={section} /></main>
    </div>
  )
}
