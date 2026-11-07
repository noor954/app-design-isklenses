'use server'

import { asc, eq } from 'drizzle-orm'
import { requireAdminSession } from '@/lib/auth/admin'
import { BANNER_PLACEMENTS, SETTING_KEYS, type BannerPlacement, type SettingKey } from '@/lib/content-types'
import { invalidateCache } from '@/lib/cache'
import { db } from '@/lib/db'
import { storeActivityEvents, storeBanners, storeReviews, storeSettings } from '@/lib/db/schema'
import { deleteMedia, isOwnedMediaUrl, mediaPathFromOwnedUrl } from '@/lib/server/media-storage.mjs'
import { validateAppearance, validateHomeConfiguration } from '@/lib/home-configuration'
import { normalizePowerLensOptions, validatePowerLensOptions } from '@/lib/power-lens-options'
import { normalizeFreeGiftConfig, validateFreeGiftConfig } from '@/lib/free-gift'
import { normalizePromotions, validatePromotions } from '@/lib/promotions'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type BannerInput = {
  id?: string
  placement: string
  title: string
  body?: string | null
  imageUrl: string
  blobPathname?: string | null
  href?: string | null
  sortOrder?: number
  isActive?: boolean
}

export type ReviewInput = { id?: string; author: string; body: string; sortOrder?: number; isActive?: boolean }

function text(value: unknown, label: string, max: number, required = true) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (required && !trimmed) throw new Error(`${label} is required.`)
  if (trimmed.length > max) throw new Error(`${label} must be at most ${max} characters.`)
  return trimmed
}

function httpsUrl(value: unknown, label: string) {
  const raw = text(value, label, 2000)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`${label} must be a valid URL.`)
  }
  if (url.protocol !== 'https:') throw new Error(`${label} must use https.`)
  return url.toString()
}

function imageUrl(value: unknown) {
  const raw = text(value, 'Image URL', 2000)
  return isOwnedMediaUrl(raw) ? raw : httpsUrl(raw, 'Image URL')
}

function link(value: unknown) {
  const raw = text(value, 'Link', 500, false)
  if (!raw) return null
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  return httpsUrl(raw, 'Link')
}

function order(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isInteger(number) || number < 0 || number > 10_000) throw new Error('Sort order must be a whole number from 0 to 10000.')
  return number
}

function requireId(id: unknown) {
  if (typeof id !== 'string' || !uuidPattern.test(id)) throw new Error('Invalid identifier.')
  return id
}

async function logChange(entityType: string, entityId: string, eventType: string) {
  await db.insert(storeActivityEvents).values({ entityType, entityId, eventType, payload: {} })
}

async function removeStoredMedia(pathname: string | null | undefined, url: string) {
  if (!pathname || mediaPathFromOwnedUrl(url) !== pathname) return
  try {
    await deleteMedia(pathname)
  } catch (error) {
    console.error('[content] Media cleanup failed', error instanceof Error ? error.name : 'UnknownError')
  }
}

export async function getContentAdmin() {
  await requireAdminSession('staff')
  const [banners, reviews, settings] = await Promise.all([
    db.select().from(storeBanners).orderBy(asc(storeBanners.placement), asc(storeBanners.sortOrder)),
    db.select().from(storeReviews).orderBy(asc(storeReviews.sortOrder)),
    db.select().from(storeSettings),
  ])
  const settingValues = Object.fromEntries(settings.map((row) => [row.key, row.value])) as Partial<Record<SettingKey, unknown>>
  return {
    banners: banners.map((banner) => ({ ...banner, createdAt: banner.createdAt.toISOString(), updatedAt: banner.updatedAt.toISOString() })),
    reviews: reviews.map((review) => ({ ...review, createdAt: review.createdAt.toISOString(), updatedAt: review.updatedAt.toISOString() })),
    settings: {
      ...settingValues,
      power_options: normalizePowerLensOptions(settingValues.power_options),
      free_gift: normalizeFreeGiftConfig(settingValues.free_gift),
      deals: normalizePromotions(settingValues.deals),
    },
  }
}

export async function saveBanner(input: BannerInput) {
  await requireAdminSession('admin')
  if (!(BANNER_PLACEMENTS as readonly string[]).includes(input.placement)) throw new Error('Choose a valid placement.')
  const values = {
    placement: input.placement as BannerPlacement,
    title: text(input.title, 'Title', 200, false),
    body: text(input.body, 'Body', 500, false) || null,
    imageUrl: imageUrl(input.imageUrl),
    blobPathname: text(input.blobPathname, 'Blob path', 500, false) || null,
    href: link(input.href),
    sortOrder: order(input.sortOrder),
    isActive: input.isActive !== false,
    updatedAt: new Date(),
  }
  let id: string
  if (input.id) {
    id = requireId(input.id)
    const [existing] = await db.select().from(storeBanners).where(eq(storeBanners.id, id)).limit(1)
    if (!existing) throw new Error('Banner not found.')
    await db.update(storeBanners).set(values).where(eq(storeBanners.id, id))
    if (existing.blobPathname && existing.imageUrl !== values.imageUrl) await removeStoredMedia(existing.blobPathname, existing.imageUrl)
  } else {
    const [created] = await db.insert(storeBanners).values(values).returning({ id: storeBanners.id })
    id = created.id
  }
  await logChange('banner', id, input.id ? 'banner.updated' : 'banner.created')
  await invalidateCache('content')
  return { id }
}

export async function deleteBanner(id: string) {
  await requireAdminSession('admin')
  const bannerId = requireId(id)
  const [removed] = await db.delete(storeBanners).where(eq(storeBanners.id, bannerId)).returning()
  if (!removed) throw new Error('Banner not found.')
  await removeStoredMedia(removed.blobPathname, removed.imageUrl)
  await logChange('banner', bannerId, 'banner.deleted')
  await invalidateCache('content')
}

export async function saveReview(input: ReviewInput) {
  await requireAdminSession('admin')
  const values = {
    author: text(input.author, 'Author', 120),
    body: text(input.body, 'Review', 1000),
    sortOrder: order(input.sortOrder),
    isActive: input.isActive !== false,
    updatedAt: new Date(),
  }
  let id: string
  if (input.id) {
    id = requireId(input.id)
    const updated = await db.update(storeReviews).set(values).where(eq(storeReviews.id, id)).returning({ id: storeReviews.id })
    if (!updated.length) throw new Error('Review not found.')
  } else {
    const [created] = await db.insert(storeReviews).values(values).returning({ id: storeReviews.id })
    id = created.id
  }
  await logChange('review', id, input.id ? 'review.updated' : 'review.created')
  await invalidateCache('content')
  return { id }
}

export async function deleteReview(id: string) {
  await requireAdminSession('admin')
  const reviewId = requireId(id)
  const removed = await db.delete(storeReviews).where(eq(storeReviews.id, reviewId)).returning({ id: storeReviews.id })
  if (!removed.length) throw new Error('Review not found.')
  await logChange('review', reviewId, 'review.deleted')
  await invalidateCache('content')
}

const isStringArray = (value: unknown, max = 20) => Array.isArray(value) && value.length <= max && value.every((item) => typeof item === 'string' && item.length <= 500)
const isPairs = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every((item) => typeof item === 'string' && item.length <= 300))
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function validateSetting(key: SettingKey, value: unknown) {
  switch (key) {
    case 'announcements':
      if (!isStringArray(value)) throw new Error('Announcements must be a list of text lines.')
      return
    case 'contact':
      if (!isObject(value) || !Object.values(value).every((item) => typeof item === 'string' && item.length <= 500)) throw new Error('Contact must be an object of text values.')
      return
    case 'headings':
      if (!isObject(value) || !Object.values(value).every((item) => typeof item === 'string' || isStringArray(item))) throw new Error('Headings must be an object of text values.')
      return
    case 'seo_sections':
      if (!Array.isArray(value) || value.length > 12 || !value.every((section) => isObject(section) && typeof section.heading === 'string' && isStringArray(section.paragraphs, 10))) throw new Error('SEO sections need a heading and paragraphs.')
      return
    case 'footer':
      if (!isObject(value)) throw new Error('Footer must be an object.')
      for (const field of ['brands', 'collections']) if (value[field] !== undefined && !isStringArray(value[field], 40)) throw new Error(`Footer ${field} must be a list of text.`)
      for (const field of ['explore', 'information']) if (value[field] !== undefined && !isPairs(value[field])) throw new Error(`Footer ${field} must be a list of [label, link] pairs.`)
      for (const field of ['logo', 'about']) if (value[field] !== undefined && typeof value[field] !== 'string') throw new Error(`Footer ${field} must be text.`)
      return
    case 'appearance':
      validateAppearance(value)
      return
    case 'home_configuration':
      validateHomeConfiguration(value)
      return
    case 'power_options':
      validatePowerLensOptions(value)
      return
    case 'free_gift':
      validateFreeGiftConfig(value)
      return
    case 'deals':
      validatePromotions(value)
      return
    case 'chatbot':
      return
  }
}

export async function saveSetting(key: string, value: unknown) {
  await requireAdminSession('admin')
  if (!(SETTING_KEYS as readonly string[]).includes(key)) throw new Error('Unknown setting.')
  validateSetting(key as SettingKey, value)
  await db
    .insert(storeSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } })
  await logChange('setting', key, 'setting.updated')
  await invalidateCache('content')
  if (key === 'power_options' || key === 'free_gift' || key === 'deals') await invalidateCache('catalog')
}
