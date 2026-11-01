'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Pagination } from '@/components/ui/pagination'
import type { StorefrontBrand } from '@/lib/data/catalog'
import { StorefrontFallbackImage } from '@/components/storefront/fallback-image'

const PAGE_SIZE = 24

function wordmarkClass(name: string) {
  const brand = name.toLowerCase()
  if (['bella', 'dahab', 'solotica', 'lenseme', 'victoria'].includes(brand)) return 'font-serif italic'
  if (['hydrocor', 'desio', 'anesthesia'].includes(brand)) return 'font-medium uppercase tracking-[0.1em]'
  return 'font-extrabold tracking-[-0.035em]'
}

function BrandVisual({ brand }: { brand: StorefrontBrand }) {
  return (
    <StorefrontFallbackImage
      sources={[brand.logoUrl, brand.fallbackImageUrl]}
      alt={brand.logoUrl ? `${brand.name} logo` : `${brand.name} lens`}
      className="h-12 w-full"
      imageClassName={brand.logoUrl ? 'object-contain' : 'object-contain'}
      fallback={<span className={`text-lg text-[#15384d] sm:text-xl ${wordmarkClass(brand.name)}`}>{brand.name}</span>}
    />
  )
}

export function BrandIndex({ brands }: { brands: StorefrontBrand[] }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const requestedPage = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageCount = Math.max(1, Math.ceil(brands.length / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const visibleBrands = useMemo(() => brands.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [brands, page])

  useEffect(() => {
    if (page === requestedPage) return
    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) params.delete('page')
    else params.set('page', String(page))
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }, [page, pathname, requestedPage, router, searchParams])

  function changePage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage === 1) params.delete('page')
    else params.set('page', String(nextPage))
    router.push(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  return brands.length > 0 ? (
    <>
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {visibleBrands.map((brand) => (
          <li key={brand.id}>
            {brand.productCount > 0 ? <Link
              href={`/shop?brand=${encodeURIComponent(brand.slug)}`}
              className="group flex min-h-32 flex-col items-center justify-center rounded-2xl border border-[#cfe2eb] bg-white px-4 py-5 text-center transition-colors hover:border-[#087ba5] hover:bg-[#e8f6fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] sm:min-h-36"
            >
              <BrandVisual brand={brand} />
              <span className="mt-3 text-xs text-[#526b7b]">
                {brand.productCount > 0
                  ? `${brand.productCount} active ${brand.productCount === 1 ? 'listing' : 'listings'}`
                  : 'No active listings'}
              </span>
            </Link> : <div className="flex min-h-32 cursor-default flex-col items-center justify-center rounded-2xl border border-[#cfe2eb] bg-white px-4 py-5 text-center sm:min-h-36">
              <BrandVisual brand={brand} />
              <span className="mt-3 text-xs text-[#526b7b]">No active listings</span>
            </div>}
          </li>
        ))}
      </ul>
      <Pagination total={brands.length} page={page} pageSize={PAGE_SIZE} onPageChange={changePage} itemLabel="brands" className="mt-8" />
    </>
  ) : (
    <p className="mt-8 rounded-2xl border border-[#cfe2eb] bg-white p-6 text-sm text-[#526b7b]">No brands are available in the catalog yet.</p>
  )
}
