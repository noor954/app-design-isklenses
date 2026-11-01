import {
  getCategories,
  getHomeCatalog,
  getStorefrontBrands,
  getStorefrontLensTypes,
  getStorefrontShades,
} from '@/lib/data/catalog'
import { categoryHref } from '@/lib/store-config'

export const HOME_SECTION_PAGE_SIZE = 10
export const HOME_SECTION_KEYS = ['categories', 'brands', 'shades', 'lens-types'] as const
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number]

export type HomeSectionItem = {
  id: string
  title: string
  detail: string
  href: string
  imageUrl: string | null
  fallbackImageUrl: string | null
  imageFit: 'contain' | 'cover'
  swatch: string | null
}

export type HomeSectionPage = {
  section: HomeSectionKey
  items: HomeSectionItem[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export function isHomeSectionKey(value: string): value is HomeSectionKey {
  return (HOME_SECTION_KEYS as readonly string[]).includes(value)
}

const listings = (count: number) => `${count} active ${count === 1 ? 'listing' : 'listings'}`

async function loadItems(section: HomeSectionKey): Promise<HomeSectionItem[]> {
  switch (section) {
    case 'categories': {
      const categories = await getCategories()
      return categories
        .filter((category) => category.isActive)
        .map((category) => ({
          id: category.id,
          title: category.name,
          detail: listings(category.productCount),
          href: categoryHref(category),
          imageUrl: category.imageUrl ?? null,
          fallbackImageUrl: category.fallbackImageUrl ?? null,
          imageFit: 'contain' as const,
          swatch: null,
        }))
    }
    case 'brands': {
      const brands = await getStorefrontBrands()
      return [...brands]
        .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name))
        .map((brand) => ({
          id: brand.id,
          title: brand.name,
          detail: listings(brand.productCount),
          href: `/shop?brand=${encodeURIComponent(brand.slug)}`,
          imageUrl: brand.logoUrl ?? null,
          fallbackImageUrl: brand.fallbackImageUrl ?? null,
          imageFit: 'contain' as const,
          swatch: null,
        }))
    }
    case 'shades': {
      const shades = await getStorefrontShades()
      return shades.map((shade) => ({
        id: shade.id,
        title: shade.name,
        detail: listings(shade.productCount),
        href: `/shop?q=${encodeURIComponent(shade.name)}`,
        imageUrl: shade.imageUrl ?? null,
        fallbackImageUrl: shade.fallbackImageUrl ?? null,
        imageFit: 'contain' as const,
        swatch: shade.hex && /^#[\da-f]{6}$/i.test(shade.hex) ? shade.hex : null,
      }))
    }
    case 'lens-types': {
      const types = await getStorefrontLensTypes()
      return types.map((type) => ({
        id: type.id,
        title: type.name,
        detail: listings(type.productCount),
        href: `/shop?q=${encodeURIComponent(type.name)}`,
        imageUrl: null,
        fallbackImageUrl: type.fallbackImageUrl ?? null,
        imageFit: 'contain' as const,
        swatch: null,
      }))
    }
  }
}

/** Pages are capped at 10 items unless a search query is supplied. */
export async function getHomeSectionPage(
  section: HomeSectionKey,
  { page = 1, query = '' }: { page?: number; query?: string } = {},
): Promise<HomeSectionPage> {
  const normalizedQuery = query.trim().toLowerCase()
  const all = await loadItems(section)
  const filtered = normalizedQuery
    ? all.filter((item) => item.title.toLowerCase().includes(normalizedQuery))
    : all
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
  const pageSize = normalizedQuery ? Math.max(filtered.length, 1) : HOME_SECTION_PAGE_SIZE
  const start = normalizedQuery ? 0 : (safePage - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)
  return {
    section,
    items,
    page: normalizedQuery ? 1 : safePage,
    pageSize,
    total: filtered.length,
    hasMore: !normalizedQuery && start + items.length < filtered.length,
  }
}

export async function getHomeProductsPage(page = 1) {
  const products = await getHomeCatalog()
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
  const start = (safePage - 1) * HOME_SECTION_PAGE_SIZE
  const items = products.slice(start, start + HOME_SECTION_PAGE_SIZE)
  return {
    items,
    page: safePage,
    pageSize: HOME_SECTION_PAGE_SIZE,
    total: products.length,
    hasMore: start + items.length < products.length,
  }
}
