export type FreeGiftConfig = {
  enabled: boolean
  categoryId: string | null
  title: string
  message: string
  badge: string
  maxItems: number
  minLensQuantity: number
}

export const DEFAULT_FREE_GIFT_CONFIG: FreeGiftConfig = {
  enabled: true,
  categoryId: null,
  title: 'Your free new-launch gift',
  message: 'Order any lens and choose one cosmetic item on us. Pick your gift and confirm it before placing your order.',
  badge: 'New launch gift',
  maxItems: 1,
  minLensQuantity: 1,
}

function text(value: unknown, fallback: string, maximum: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maximum) : fallback
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number) {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : fallback
}

export function normalizeFreeGiftConfig(value: unknown): FreeGiftConfig {
  const source = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const defaults = DEFAULT_FREE_GIFT_CONFIG
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : defaults.enabled,
    categoryId: typeof source.categoryId === 'string' && source.categoryId ? source.categoryId : null,
    title: text(source.title, defaults.title, 120),
    message: text(source.message, defaults.message, 400),
    badge: text(source.badge, defaults.badge, 40),
    maxItems: integer(source.maxItems, defaults.maxItems, 1, 5),
    minLensQuantity: integer(source.minLensQuantity, defaults.minLensQuantity, 1, 20),
  }
}

export function validateFreeGiftConfig(value: unknown): asserts value is Partial<FreeGiftConfig> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Free gift settings must be an object.')
  const source = value as Record<string, unknown>
  if (source.enabled !== undefined && typeof source.enabled !== 'boolean') throw new Error('Free gift enabled must be true or false.')
  if (source.categoryId !== undefined && source.categoryId !== null && typeof source.categoryId !== 'string') throw new Error('Choose a valid gift category.')
  for (const field of ['title', 'message', 'badge']) {
    if (source[field] !== undefined && typeof source[field] !== 'string') throw new Error(`Free gift ${field} must be text.`)
  }
  if (source.maxItems !== undefined && integer(source.maxItems, -1, 1, 5) < 0) throw new Error('Gift items per order must be from 1 to 5.')
  if (source.minLensQuantity !== undefined && integer(source.minLensQuantity, -1, 1, 20) < 0) throw new Error('Minimum lens quantity must be from 1 to 20.')
}

type CategoryLike = { id: string; name: string; slug: string }

export function resolveGiftCategoryId(config: FreeGiftConfig, categories: CategoryLike[]) {
  if (config.categoryId && categories.some((category) => category.id === config.categoryId)) return config.categoryId
  return categories.find((category) => /^cosmetic/i.test(category.slug) || /^cosmetic/i.test(category.name))?.id ?? null
}

export type FreeGiftProduct = {
  id: string
  name: string
  slug: string
  price: string
  currency: string
  imageUrl: string | null
}

export type FreeGiftOffer = {
  config: FreeGiftConfig
  categoryId: string | null
  products: FreeGiftProduct[]
}
