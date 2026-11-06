import 'server-only'

import { asc } from 'drizzle-orm'
import { cached } from '@/lib/cache'
import type {
  BannerContent,
  ContactSettings,
  FooterSettings,
  HeadingSettings,
  HomeContent,
  ReviewContent,
  SeoSection,
  SettingKey,
  SiteChrome,
} from '@/lib/content-types'
import {
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  normalizeHomeConfiguration,
} from '@/lib/home-configuration'
import { normalizePowerLensOptions } from '@/lib/power-lens-options'
import type { AppearanceConfiguration } from '@/lib/home-configuration'
import { db } from '@/lib/db'
import { getDeliveryAnnouncement, parseDeliveryRules } from '@/lib/delivery'
import { storeBanners, storeReviews, storeSettings } from '@/lib/db/schema'
import { WHATSAPP_SUPPORT_URL } from '@/lib/whatsapp'

export const CONTENT_NAMESPACE = 'content'
const TTL_SECONDS = 300
type StoredSettingKey = SettingKey | 'delivery_rules'
const LEGACY_ANNOUNCEMENTS = [
  'Get exclusive discounts on top lens brands',
  'Delivery available all over Pakistan',
  'Hurry up and save now!',
  'Free delivery on orders over Rs 2500',
]
const LEGACY_FOOTER_ABOUT = 'Eye Lenses is a main online dispensary of contact lenses that serves all categories of users, ranging from occasional wearers to daily lens users.'
const LEGACY_FOOTER_BRANDS = ['Comfort', 'Bella', 'Optiano', 'Us Vision', 'Freshlook', 'Magic Eye', 'Dress Your Eye', 'Joli', 'Freshkon']
const LEGACY_FOOTER_COLLECTIONS = ['Luminous', 'Naturel', '3D Colors', 'Tinker Bell']
const LEGACY_FOOTER_EXPLORE = [
  ['Shop By Color', 'colored-lenses'],
  ['Shop By Diameter', 'shop-by-diameter-dia'],
  ['Shop By Disposibility', 'shop-by-disposability'],
  ['Deals', 'deals'],
  ['Accessories', 'accessories'],
  ['Transparent', 'transparent-lenses'],
]
const LEGACY_HERO_TITLES = new Set(['10.10 sale', 'Sunglasses collection', 'Shop now', 'Deals on contact lenses'])
const MIN_HERO_SLIDES = 5
const DEFAULT_HERO_BANNERS: BannerContent[] = [
  {
    id: 'default-hero-1',
    placement: 'hero',
    title: 'See color differently.',
    body: 'Explore the color lens catalog and compare product photos, prices, and details.',
    imageUrl: '/isk-home/hero-editorial-1.jpg',
    href: '/shop',
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 'default-hero-2',
    placement: 'hero',
    title: 'A shade for your point of view.',
    body: 'Browse the collection and find the colors that speak to your style.',
    imageUrl: '/isk-home/hero-editorial-2.jpg',
    href: '/shop',
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'default-hero-3',
    placement: 'hero',
    title: 'Let your look take the lead.',
    body: 'Discover the range of lens colors and compare each listing before you choose.',
    imageUrl: '/isk-home/hero-editorial-3.jpg',
    href: '/shop',
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'default-hero-4',
    placement: 'hero',
    title: 'Find your color.',
    body: 'Explore the shades available across the lens catalog.',
    imageUrl: '/isk-home/hero-editorial-4.jpg',
    href: '/shop',
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'default-hero-5',
    placement: 'hero',
    title: 'A look that feels like you.',
    body: 'Browse lens colors and compare available listings.',
    imageUrl: '/isk-home/hero-editorial-5.jpg',
    href: '/shop',
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 'default-hero-6',
    placement: 'hero',
    title: 'A new shade, a new perspective.',
    body: 'See the colors and product details in our catalog.',
    imageUrl: '/isk-home/hero-editorial-6.jpg',
    href: '/shop',
    sortOrder: 5,
    isActive: true,
  },
  {
    id: 'default-hero-7',
    placement: 'hero',
    title: 'Make the color yours.',
    body: 'Explore the lens range by shade and brand.',
    imageUrl: '/isk-home/hero-editorial-7.jpg',
    href: '/shop',
    sortOrder: 6,
    isActive: true,
  },
]

function matchesStrings(value: string[] | undefined, expected: string[]) {
  return value?.length === expected.length && value.every((item, index) => item === expected[index])
}

function storefrontFooter(value: unknown): FooterSettings {
  const footer = { ...((value ?? {}) as FooterSettings) }
  if (footer.logo?.startsWith('https://eyelenses.pk/')) delete footer.logo
  if (footer.about === LEGACY_FOOTER_ABOUT) delete footer.about
  if (matchesStrings(footer.brands, LEGACY_FOOTER_BRANDS)) delete footer.brands
  if (matchesStrings(footer.collections, LEGACY_FOOTER_COLLECTIONS)) delete footer.collections
  if (JSON.stringify(footer.explore) === JSON.stringify(LEGACY_FOOTER_EXPLORE)) delete footer.explore
  return footer
}

async function loadSettings() {
  const rows = await db.select().from(storeSettings)
  return new Map(rows.map((row) => [row.key as StoredSettingKey, row.value]))
}

export function getSettings() {
  return cached(CONTENT_NAMESPACE, 'settings', TTL_SECONDS, async () => Object.fromEntries(await loadSettings()) as Partial<Record<StoredSettingKey, unknown>>)
}

export async function getStoreAppearance(): Promise<AppearanceConfiguration> {
  try {
    const settings = await getSettings()
    return normalizeAppearance(settings.appearance)
  } catch (error) {
    console.error(
      '[site-content] Appearance settings unavailable',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return DEFAULT_APPEARANCE
  }
}

const asStrings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])

export async function getSiteChrome(): Promise<SiteChrome> {
  try {
    const settings = await getSettings()
    const deliveryRules = parseDeliveryRules(settings.delivery_rules ?? [])
    return {
      announcements: asStrings(settings.announcements).filter((item) => !LEGACY_ANNOUNCEMENTS.includes(item)),
      deliveryNotice: getDeliveryAnnouncement(deliveryRules),
      whatsappSupportUrl: WHATSAPP_SUPPORT_URL,
      contact: (settings.contact ?? {}) as ContactSettings,
      footer: storefrontFooter(settings.footer),
    }
  } catch (error) {
    console.error('[site-content] Site chrome unavailable', error instanceof Error ? error.name : 'UnknownError')
    return {
      announcements: [],
      deliveryNotice: null,
      whatsappSupportUrl: WHATSAPP_SUPPORT_URL,
      contact: {},
      footer: {},
      loadError: 'Store announcements and contact details could not be loaded.',
    }
  }
}

export function getAllBanners() {
  return cached(CONTENT_NAMESPACE, 'banners:all', TTL_SECONDS, async (): Promise<BannerContent[]> => {
    const rows = await db.select().from(storeBanners).orderBy(asc(storeBanners.placement), asc(storeBanners.sortOrder), asc(storeBanners.createdAt))
    return rows.map(({ id, placement, title, body, imageUrl, href, sortOrder, isActive }) => ({ id, placement: placement as BannerContent['placement'], title, body, imageUrl, href, sortOrder, isActive }))
  })
}

export function getAllReviews() {
  return cached(CONTENT_NAMESPACE, 'reviews:all', TTL_SECONDS, async (): Promise<ReviewContent[]> => {
    const rows = await db.select().from(storeReviews).orderBy(asc(storeReviews.sortOrder), asc(storeReviews.createdAt))
    return rows.map(({ id, author, body, sortOrder, isActive }) => ({ id, author, body, sortOrder, isActive }))
  })
}

export async function getHomeContent(): Promise<HomeContent> {
  const [banners, settings] = await Promise.all([getAllBanners(), getSettings()])
  const headings = { ...((settings.headings ?? {}) as HeadingSettings) }
  if (headings.categoriesIntro === 'Browse through our extensive selection to find the perfect lens for you.') delete headings.categoriesIntro
  if (headings.serviceTitle === 'Professional Service') delete headings.serviceTitle
  if (headings.serviceBody === 'Enjoy fast and secure delivery across Pakistan your lenses, delivered safely to your doorstep!') delete headings.serviceBody
  if (headings.reviews === 'Customer Love Us') delete headings.reviews
  if (headings.reviewsIntro === 'Loved by customers for exceptional service and quality.') delete headings.reviewsIntro
  const defaultConfiguration = normalizeHomeConfiguration(undefined)
  const configuration = settings.home_configuration === undefined
    ? {
        ...defaultConfiguration,
        sections: defaultConfiguration.sections.map((section) => ({
          ...section,
          ...(section.id === 'bloom' && {
            title: headings.categories ?? section.title,
            description: headings.categoriesIntro ?? section.description,
          }),
          ...(section.id === 'reviews' && {
            title: headings.reviews ?? section.title,
            description: headings.reviewsIntro ?? section.description,
          }),
          ...(section.id === 'contact' && {
            title: headings.serviceTitle ?? section.title,
            description: headings.serviceBody ?? section.description,
          }),
        })),
      }
    : normalizeHomeConfiguration(settings.home_configuration)
  const activeBanners = banners.filter((banner) => banner.isActive && !banner.imageUrl.startsWith('https://eyelenses.pk/') && !(banner.placement === 'hero' && LEGACY_HERO_TITLES.has(banner.title)))
  const heroBanners = activeBanners.filter((banner) => banner.placement === 'hero')
  return {
    banners: [
      ...activeBanners,
      ...DEFAULT_HERO_BANNERS.filter(
        (fallback) => !heroBanners.some((banner) => banner.imageUrl === fallback.imageUrl),
      ).slice(0, Math.max(MIN_HERO_SLIDES - heroBanners.length, 0)),
    ],
    headings,
    seoSections: Array.isArray(settings.seo_sections) ? (settings.seo_sections as SeoSection[]) : [],
    appearance: normalizeAppearance(settings.appearance),
    configuration,
    powerOptions: normalizePowerLensOptions(settings.power_options),
  }
}
