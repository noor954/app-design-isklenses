import type { AppearanceConfiguration, HomeConfiguration } from '@/lib/home-configuration'
import type { PowerLensOption } from '@/lib/power-lens-options'

export const BANNER_PLACEMENTS = ['hero', 'promo', 'brand', 'category', 'service', 'new_arrival', 'feature', 'why_choose'] as const
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number]

export const SETTING_KEYS = [
  'announcements',
  'contact',
  'headings',
  'seo_sections',
  'footer',
  'chatbot',
  'appearance',
  'home_configuration',
  'power_options',
  'free_gift',
] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

export interface BannerContent {
  id: string
  placement: BannerPlacement
  title: string
  body: string | null
  imageUrl: string
  href: string | null
  sortOrder: number
  isActive: boolean
}

export interface ReviewContent {
  id: string
  author: string
  body: string
  sortOrder: number
  isActive: boolean
}

export interface ContactSettings {
  phone?: string
  email?: string
  address?: string
  whatsapp?: string
  facebook?: string
  instagram?: string
}

export interface FooterSettings {
  logo?: string
  about?: string
  brands?: string[]
  collections?: string[]
  explore?: [string, string][]
  information?: [string, string][]
}

export interface HeadingSettings {
  whyChoose?: string
  whyChooseHeading?: string
  whyChooseLines?: string[]
  categories?: string
  categoriesIntro?: string
  serviceTitle?: string
  serviceBody?: string
  reviews?: string
  reviewsIntro?: string
  seoTitle?: string
}

export interface SeoSection {
  heading: string
  paragraphs: string[]
}

export interface SiteChrome {
  announcements: string[]
  deliveryNotice: string | null
  whatsappSupportUrl: string
  contact: ContactSettings
  footer: FooterSettings
  loadError?: string
}

export interface HomeContent {
  banners: BannerContent[]
  headings: HeadingSettings
  seoSections: SeoSection[]
  appearance: AppearanceConfiguration
  configuration: HomeConfiguration
  powerOptions: PowerLensOption[]
}
