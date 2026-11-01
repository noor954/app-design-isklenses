'use client'

import { useCallback, useRef, useState } from 'react'
import { SharedCarousel } from '@/components/ui/shared-carousel'
import type { CarouselVariant } from '@/lib/carousel-variants'
import { GalleryCard } from '@/components/storefront/home/gallery-card'
import type { HomeSectionItem, HomeSectionKey } from '@/lib/data/home-sections'

type Props = {
  section: HomeSectionKey
  label: string
  variant: CarouselVariant
  initialItems: HomeSectionItem[]
  initialHasMore: boolean
  emptyMessage: string
}

/** Homepage section carousel: first page is server-rendered (max 10), later pages load on demand. */
export function PagedSectionCarousel({ section, label, variant, initialItems, initialHasMore, emptyMessage }: Props) {
  const [items, setItems] = useState(initialItems)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const loading = useRef(false)
  const page = useRef(1)

  const loadMore = useCallback(async () => {
    if (loading.current || !hasMore) return
    loading.current = true
    try {
      const response = await fetch(`/api/storefront/home/sections/${section}?page=${page.current + 1}`)
      if (!response.ok) throw new Error('Request failed')
      const { data } = (await response.json()) as { data: { items: HomeSectionItem[]; hasMore: boolean } }
      page.current += 1
      setItems((current) => {
        const known = new Set(current.map((item) => item.id))
        return [...current, ...data.items.filter((item) => !known.has(item.id))]
      })
      setHasMore(data.hasMore)
    } catch {
      setHasMore(false)
    } finally {
      loading.current = false
    }
  }, [hasMore, section])

  if (items.length === 0) {
    return <p className="rounded-2xl border border-[#cfe2eb] bg-white p-6 text-sm text-[#526b7b]">{emptyMessage}</p>
  }

  return (
    <SharedCarousel
      items={items}
      variant={variant}
      label={label}
      getKey={(item) => item.id}
      hasMore={hasMore}
      onNeedMore={loadMore}
      renderItem={(item) => (
        <GalleryCard
          href={item.href}
          title={item.title}
          detail={item.detail}
          image={item.imageUrl ?? item.fallbackImageUrl}
          imageFallback={item.imageUrl ? item.fallbackImageUrl : null}
          imageAlt={item.title}
          imageFit={item.imageFit}
          fallback={
            item.swatch ? (
              <span aria-hidden="true" className="size-16 rounded-full border border-[#cfe2eb]" style={{ backgroundColor: item.swatch }} />
            ) : (
              <span aria-hidden="true" className="grid size-20 place-items-center rounded-full border border-[#15384d]/20 bg-white/45 text-3xl text-[#15384d]">{item.title.slice(0, 1)}</span>
            )
          }
        />
      )}
    />
  )
}
