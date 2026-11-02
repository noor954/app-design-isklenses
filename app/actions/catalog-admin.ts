'use server'

import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { invalidateCache } from '@/lib/cache'
import { requireAdminSession } from '@/lib/auth/admin'
import { buildCategoryPaths, DEFAULT_PRODUCT_PAGE, descendantIds, SECTION_SOURCES, type ProductPageSettings } from '@/lib/catalog-types'
import { db } from '@/lib/db'
import { normalizePowerLensOptions } from '@/lib/power-lens-options'
import { deleteMedia, mediaPathFromOwnedUrl } from '@/lib/server/media-storage.mjs'
import { titleCase } from '@/lib/store-config'
import {
  storeActivityEvents,
  storeBrands,
  storeCategories,
  storeLensShades,
  storeLensTypes,
  storeProductAssets,
  storeProductCategories,
  storeProductRelations,
  storeProductReviews,
  storeProducts,
  storeProductVariants,
  storeSettings,
} from '@/lib/db/schema'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const moneyPattern = /^\d{1,10}(?:\.\d{1,2})?$/
const productStatuses = ['active', 'draft', 'archived'] as const

function text(value: unknown, max: number, label: string, required = false) {
  const result = typeof value === 'string' ? value.trim() : ''
  if (required && !result) throw new Error(`${label} is required.`)
  if (result.length > max) throw new Error(`${label} must be ${max} characters or fewer.`)
  return result || null
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

function uuid(value: unknown, label: string) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error(`${label} is invalid.`)
  return value
}

function bust() {
  invalidateCache('catalog')
  invalidateCache('content')
}

async function log(entityType: string, entityId: string, eventType: string, payload: Record<string, unknown> = {}) {
  await db.insert(storeActivityEvents).values({ entityType, entityId, eventType, payload })
}

// ───────────── Categories ─────────────

export type CategoryInput = {
  name: unknown
  slug?: unknown
  parentId?: unknown
  description?: unknown
  imageUrl?: unknown
  sortOrder?: unknown
  isActive?: unknown
  showInMenu?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
}

function parseCategory(input: CategoryInput) {
  const name = titleCase(text(input.name, 120, 'Name', true)!)
  const slug = typeof input.slug === 'string' && input.slug.trim() ? input.slug.trim().toLowerCase() : slugify(name)
  if (!slugPattern.test(slug) || slug.length > 80) throw new Error('Slug may use lowercase letters, numbers and hyphens only.')
  const imageUrl = text(input.imageUrl, 1000, 'Image URL')
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) throw new Error('Image URL must start with https://')
  const sortOrder = Number(input.sortOrder ?? 0)
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100000) throw new Error('Sort order must be a whole number.')
  return {
    name,
    slug,
    parentId: input.parentId ? uuid(input.parentId, 'Parent category') : null,
    description: text(input.description, 2000, 'Description'),
    imageUrl,
    sortOrder,
    isActive: input.isActive !== false,
    showInMenu: input.showInMenu !== false,
    seoTitle: text(input.seoTitle, 160, 'SEO title'),
    seoDescription: text(input.seoDescription, 320, 'SEO description'),
  }
}

export async function getAdminCategories() {
  await requireAdminSession('staff')
  const rows = await db.select().from(storeCategories).orderBy(asc(storeCategories.sortOrder), asc(storeCategories.name))
  const counts = await db
    .select({ id: storeProductCategories.categoryId, n: sql<number>`count(distinct ${storeProducts.id})::int` })
    .from(storeProductCategories)
    .innerJoin(storeProducts, eq(storeProducts.id, storeProductCategories.productId))
    .groupBy(storeProductCategories.categoryId)
  const own = new Map(counts.map((row) => [row.id, row.n]))
  return buildCategoryPaths(rows).map((row) => ({
    ...row,
    name: titleCase(row.name),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    productCount: own.get(row.id) ?? 0,
  }))
}

async function assertValidParent(id: string | null, parentId: string | null) {
  if (!parentId) return
  if (id && parentId === id) throw new Error('A category cannot be its own parent.')
  const rows = await db.select({ id: storeCategories.id, parentId: storeCategories.parentId }).from(storeCategories)
  if (!rows.some((row) => row.id === parentId)) throw new Error('Parent category not found.')
  if (id && descendantIds(rows, id).has(parentId)) throw new Error('A category cannot be moved under its own descendant.')
}

export async function createCategory(input: CategoryInput) {
  await requireAdminSession('admin')
  const values = parseCategory(input)
  await assertValidParent(null, values.parentId)
  try {
    const [row] = await db.insert(storeCategories).values(values).returning()
    await log('category', row.id, 'created', { name: row.name })
    bust()
    return { id: row.id }
  } catch (error) {
    if (String((error as { code?: string }).code) === '23505') throw new Error('That category name or slug is already in use.')
    throw error
  }
}

export async function updateCategory(id: string, input: CategoryInput) {
  await requireAdminSession('admin')
  uuid(id, 'Category')
  const values = parseCategory(input)
  await assertValidParent(id, values.parentId)
  try {
    const [row] = await db.update(storeCategories).set({ ...values, updatedAt: new Date() }).where(eq(storeCategories.id, id)).returning({ id: storeCategories.id })
    if (!row) throw new Error('Category not found.')
    await log('category', id, 'updated', { name: values.name })
    bust()
  } catch (error) {
    if (String((error as { code?: string }).code) === '23505') throw new Error('That slug is already used by another category.')
    throw error
  }
}

export async function bulkUpdateCategoryVisibility(
  ids: unknown,
  changes: { isActive?: unknown; showInMenu?: unknown },
) {
  await requireAdminSession('admin')
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) throw new Error('Select between 1 and 1000 categories.')
  const categoryIds = [...new Set(ids.map((id) => uuid(id, 'Category')))]
  if (!changes || typeof changes !== 'object') throw new Error('Choose category visibility changes.')

  const updates: { isActive?: boolean; showInMenu?: boolean } = {}
  if ('isActive' in changes) {
    if (typeof changes.isActive !== 'boolean') throw new Error('Active status must be enabled or disabled.')
    updates.isActive = changes.isActive
  }
  if ('showInMenu' in changes) {
    if (typeof changes.showInMenu !== 'boolean') throw new Error('Menu visibility must be enabled or disabled.')
    updates.showInMenu = changes.showInMenu
  }
  if (Object.keys(updates).length === 0) throw new Error('Choose at least one category visibility change.')

  const existing = await db.select({ id: storeCategories.id }).from(storeCategories).where(inArray(storeCategories.id, categoryIds))
  if (existing.length !== categoryIds.length) throw new Error('One or more selected categories no longer exist. Refresh the list and try again.')

  await db.transaction(async (tx) => {
    const updated = await tx.update(storeCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(inArray(storeCategories.id, categoryIds))
      .returning({ id: storeCategories.id })
    if (updated.length !== categoryIds.length) throw new Error('One or more selected categories could not be updated.')

    for (const category of updated) {
      await tx.insert(storeActivityEvents).values({
        entityType: 'category',
        entityId: category.id,
        eventType: 'updated',
        payload: { ...updates, bulk: true },
      })
    }
  })
  bust()
}

export async function deleteCategory(id: string) {
  await requireAdminSession('admin')
  uuid(id, 'Category')
  const [child] = await db.select({ id: storeCategories.id }).from(storeCategories).where(eq(storeCategories.parentId, id)).limit(1)
  if (child) throw new Error('Delete or move the sub-categories first.')
  const [product] = await db.select({ id: storeProductCategories.productId }).from(storeProductCategories).where(eq(storeProductCategories.categoryId, id)).limit(1)
  if (product) throw new Error('Move or delete the products in this category first.')
  await db.delete(storeCategories).where(eq(storeCategories.id, id))
  await log('category', id, 'deleted')
  bust()
}

/** Swaps sort order with the neighbouring sibling. */
export async function moveCategory(id: string, direction: 'up' | 'down') {
  await requireAdminSession('admin')
  uuid(id, 'Category')
  const [current] = await db.select().from(storeCategories).where(eq(storeCategories.id, id)).limit(1)
  if (!current) throw new Error('Category not found.')
  const siblings = await db
    .select({ id: storeCategories.id })
    .from(storeCategories)
    .where(current.parentId ? eq(storeCategories.parentId, current.parentId) : sql`${storeCategories.parentId} is null`)
    .orderBy(asc(storeCategories.sortOrder), asc(storeCategories.name))
  const index = siblings.findIndex((row) => row.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= siblings.length) return
  const order = siblings.map((row) => row.id)
  ;[order[index], order[target]] = [order[target], order[index]]
  await db.transaction(async (tx) => {
    for (const [position, siblingId] of order.entries()) {
      await tx.update(storeCategories).set({ sortOrder: position }).where(eq(storeCategories.id, siblingId))
    }
  })
  bust()
}

// ───────────── Products ─────────────

export type AdminProductInput = {
  name: unknown
  slug?: unknown
  categoryIds: unknown
  brandId?: unknown
  lensShadeId?: unknown
  lensTypeId?: unknown
  sku?: unknown
  shortDescription?: unknown
  description?: unknown
  price: unknown
  compareAtPrice?: unknown
  currency?: unknown
  status?: unknown
  diameterMm?: unknown
  baseCurve?: unknown
  waterContent?: unknown
  material?: unknown
  wearDuration?: unknown
  packContents?: unknown
  powerType?: unknown
  powerRange?: unknown
  availablePowerRanges?: unknown
  uvProtection?: unknown
  fdaApproved?: unknown
  features?: unknown
  specs?: unknown
  usageInstructions?: unknown
  isFeatured?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
}

function money(value: unknown, label: string, required: boolean) {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    if (required) throw new Error(`${label} is required.`)
    return null
  }
  if (!moneyPattern.test(raw)) throw new Error(`${label} must be a valid amount.`)
  return raw
}

function decimal(value: unknown, label: string) {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(raw)) throw new Error(`${label} must be a number like 14.2.`)
  return raw
}

function lensMeasurement(value: unknown, label: string) {
  const result = decimal(value, label)
  if (!result) throw new Error(`${label} is required.`)
  const number = Number(result)
  if (number < 0 || number > 12 || Math.round(number * 10) !== number * 10) {
    throw new Error(`${label} must be between 0.00 and 12.00 in 0.10 increments.`)
  }
  return result
}

function waterContent(value: unknown) {
  const result = text(value, 60, 'Water content', true)!
  if (!/^(?:100|[0-9]{1,2})%$/.test(result)) throw new Error('Water content must be selected from 0% to 100%.')
  return result
}

async function currentPowerOptionValues() {
  const [setting] = await db.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.key, 'power_options')).limit(1)
  return normalizePowerLensOptions(setting?.value).map((option) => option.value)
}

function parseProduct(input: AdminProductInput, validPowerOptionValues: string[]) {
  const name = text(input.name, 200, 'Name', true)!
  const slug = typeof input.slug === 'string' && input.slug.trim() ? input.slug.trim().toLowerCase() : slugify(name)
  if (!slugPattern.test(slug) || slug.length > 120) throw new Error('Slug may use lowercase letters, numbers and hyphens only.')
  const status = typeof input.status === 'string' ? input.status : 'active'
  if (!(productStatuses as readonly string[]).includes(status)) throw new Error('Invalid status.')
  if (!Array.isArray(input.categoryIds) || input.categoryIds.length > 30) {
    throw new Error('Choose no more than 30 categories.')
  }
  const categoryIds = [...new Set(input.categoryIds.map((value) => uuid(value, 'Category')))]
  const brandId = input.brandId ? uuid(input.brandId, 'Brand') : null
  const lensShadeId = input.lensShadeId ? uuid(input.lensShadeId, 'Lens shade') : null
  const lensTypeId = input.lensTypeId ? uuid(input.lensTypeId, 'Lens type') : null
  const features = (Array.isArray(input.features) ? input.features : []).map((item) => text(item, 200, 'Feature')).filter((item): item is string => Boolean(item)).slice(0, 30)
  const specs = (Array.isArray(input.specs) ? input.specs : []).slice(0, 30).flatMap((item) => {
    const spec = item as { label?: unknown; value?: unknown }
    const label = text(spec.label, 80, 'Spec label')
    const value = text(spec.value, 300, 'Spec value')
    return label && value ? [{ label, value }] : []
  })
  const currency = typeof input.currency === 'string' && /^[A-Z]{3}$/.test(input.currency) ? input.currency : 'PKR'
  if (input.availablePowerRanges !== undefined && !Array.isArray(input.availablePowerRanges)) {
    throw new Error('Choose valid customer power ranges.')
  }
  const validPowerOptions = new Set(validPowerOptionValues)
  const selectedPowerRanges = new Set((input.availablePowerRanges ?? []).map((value) => {
    if (typeof value !== 'string' || !validPowerOptions.has(value)) {
      throw new Error('One or more selected customer power ranges are invalid.')
    }
    return value
  }))
  const availablePowerRanges = validPowerOptionValues.filter((value) => selectedPowerRanges.has(value))
  return {
    name,
    slug,
    categoryIds,
    categoryId: categoryIds[0] ?? null,
    brandId,
    lensShadeId,
    lensTypeId,
    sku: text(input.sku, 80, 'SKU'),
    shortDescription: text(input.shortDescription, 400, 'Short description'),
    description: text(input.description, 10000, 'Description'),
    price: money(input.price, 'Price', true)!,
    compareAtPrice: money(input.compareAtPrice, 'Compare-at price', false),
    currency,
    status,
    diameterMm: lensMeasurement(input.diameterMm, 'Diameter'),
    baseCurve: lensMeasurement(input.baseCurve, 'Base curve'),
    waterContent: waterContent(input.waterContent),
    material: text(input.material, 120, 'Material'),
    wearDuration: text(input.wearDuration, 120, 'Wear duration'),
    packContents: text(input.packContents, 120, 'Pack contents'),
    powerType: text(input.powerType, 120, 'Power type'),
    powerRange: text(input.powerRange, 200, 'Power range'),
    availablePowerRanges,
    uvProtection: input.uvProtection === true,
    fdaApproved: input.fdaApproved === true,
    features,
    specs,
    usageInstructions: text(input.usageInstructions, 4000, 'Usage instructions'),
    ...(input.isFeatured === undefined ? {} : { isFeatured: input.isFeatured === true }),
    seoTitle: text(input.seoTitle, 160, 'SEO title'),
    seoDescription: text(input.seoDescription, 320, 'SEO description'),
  }
}

async function validateProductReferences(categoryIds: string[], brandId: string | null, lensShadeId: string | null, lensTypeId: string | null) {
  const [categories, brands, shades, types] = await Promise.all([
    db.select({ id: storeCategories.id }).from(storeCategories).where(inArray(storeCategories.id, categoryIds)),
    brandId ? db.select({ id: storeBrands.id }).from(storeBrands).where(eq(storeBrands.id, brandId)) : Promise.resolve([]),
    lensShadeId ? db.select({ id: storeLensShades.id }).from(storeLensShades).where(eq(storeLensShades.id, lensShadeId)) : Promise.resolve([]),
    lensTypeId ? db.select({ id: storeLensTypes.id }).from(storeLensTypes).where(eq(storeLensTypes.id, lensTypeId)) : Promise.resolve([]),
  ])
  if (categories.length !== categoryIds.length) throw new Error('One or more selected categories no longer exist.')
  if (brandId && !brands.length) throw new Error('Selected brand no longer exists.')
  if (lensShadeId && !shades.length) throw new Error('Selected lens shade no longer exists.')
  if (lensTypeId && !types.length) throw new Error('Selected lens type no longer exists.')
}

function duplicateMessage(error: unknown) {
  const code = String((error as { code?: string }).code)
  if (code === '23505') return 'Slug or SKU is already used by another product.'
  if (code === '23503') return 'Selected category no longer exists.'
  return null
}

export async function getAdminProducts() {
  await requireAdminSession('staff')
  const rows = await db
    .select({ product: storeProducts, categoryName: storeCategories.name })
    .from(storeProducts)
    .leftJoin(storeCategories, eq(storeCategories.id, storeProducts.categoryId))
    .orderBy(desc(storeProducts.createdAt))
  const relations = await db.select().from(storeProductRelations).orderBy(asc(storeProductRelations.sortOrder))
  const categories = await db.select().from(storeProductCategories)
  const relatedBy = new Map<string, string[]>()
  for (const relation of relations) relatedBy.set(relation.productId, [...(relatedBy.get(relation.productId) ?? []), relation.relatedProductId])
  const categoriesBy = new Map<string, string[]>()
  for (const relation of categories) categoriesBy.set(relation.productId, [...(categoriesBy.get(relation.productId) ?? []), relation.categoryId])
  return rows.map(({ product, categoryName }) => ({
    ...product,
    category: categoryName ?? '',
    categoryIds: categoriesBy.get(product.id) ?? (product.categoryId ? [product.categoryId] : []),
    relatedProductIds: relatedBy.get(product.id) ?? [],
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }))
}

export type MerchandisingKind = 'featured' | 'new_arrival' | 'on_sale'

export async function getMerchandisingProducts() {
  await requireAdminSession('staff')
  const products = await db.select({
    id: storeProducts.id,
    name: storeProducts.name,
    slug: storeProducts.slug,
    sku: storeProducts.sku,
    price: storeProducts.price,
    compareAtPrice: storeProducts.compareAtPrice,
    currency: storeProducts.currency,
    status: storeProducts.status,
    isFeatured: storeProducts.isFeatured,
    isNewArrival: storeProducts.isNewArrival,
    isOnSale: storeProducts.isOnSale,
  }).from(storeProducts).orderBy(asc(storeProducts.name))
  const variants = products.length
    ? await db.select({
      productId: storeProductVariants.productId,
      effectivePrice: sql<string>`min(${storeProductVariants.price})::text`,
    }).from(storeProductVariants)
      .where(and(inArray(storeProductVariants.productId, products.map((product) => product.id)), eq(storeProductVariants.isActive, true)))
      .groupBy(storeProductVariants.productId)
    : []
  const variantPrices = new Map(variants.map((variant) => [variant.productId, variant.effectivePrice]))
  return products.map((product) => ({
    ...product,
    effectivePrice: variantPrices.get(product.id) ?? product.price,
  }))
}

export async function setProductMerchandising(ids: string[], kind: MerchandisingKind, selected: boolean) {
  await requireAdminSession('admin')
  if (typeof selected !== 'boolean') throw new Error('Choose whether the products should be included.')
  const flagByKind = {
    featured: 'isFeatured',
    new_arrival: 'isNewArrival',
    on_sale: 'isOnSale',
  } as const
  if (!Object.hasOwn(flagByKind, kind)) throw new Error('Merchandising section is invalid.')
  const field = flagByKind[kind]
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    throw new Error('Select between 1 and 100 products.')
  }
  const productIds = [...new Set(ids.map((id) => uuid(id, 'Product')))]
  if (kind === 'on_sale' && selected) {
    const products = await db.select({
      id: storeProducts.id,
      name: storeProducts.name,
      price: storeProducts.price,
      compareAtPrice: storeProducts.compareAtPrice,
    }).from(storeProducts).where(inArray(storeProducts.id, productIds))
    if (products.length !== productIds.length) throw new Error('One or more selected products no longer exist.')
    const variants = await db.select({
      productId: storeProductVariants.productId,
      effectivePrice: sql<string>`min(${storeProductVariants.price})::text`,
    }).from(storeProductVariants)
      .where(and(inArray(storeProductVariants.productId, productIds), eq(storeProductVariants.isActive, true)))
      .groupBy(storeProductVariants.productId)
    const variantPrices = new Map(variants.map((variant) => [variant.productId, variant.effectivePrice]))
    const invalidProduct = products.find((product) => !product.compareAtPrice || Number(product.compareAtPrice) <= Number(variantPrices.get(product.id) ?? product.price))
    if (invalidProduct) throw new Error(`${invalidProduct.name} needs a compare-at price higher than its current price before it can be marked on sale.`)
  }

  await db.transaction(async (tx) => {
    const values = { [field]: selected, updatedAt: new Date() }
    const updated = await tx.update(storeProducts).set(values).where(inArray(storeProducts.id, productIds)).returning({ id: storeProducts.id })
    if (updated.length !== productIds.length) throw new Error('One or more selected products no longer exist.')
    await tx.insert(storeActivityEvents).values(productIds.map((id) => ({
      entityType: 'product',
      entityId: id,
      eventType: 'merchandising_updated',
      payload: { section: kind, selected },
    })))
  })
  bust()
}

export async function addProductsToCategory(ids: string[], categoryId: string) {
  await requireAdminSession('admin')
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    throw new Error('Select between 1 and 100 products.')
  }
  const productIds = [...new Set(ids.map((id) => uuid(id, 'Product')))]
  const selectedCategoryId = uuid(categoryId, 'Category')

  await db.transaction(async (tx) => {
    const [category] = await tx.select({ id: storeCategories.id }).from(storeCategories)
      .where(eq(storeCategories.id, selectedCategoryId)).limit(1)
    if (!category) throw new Error('The selected category no longer exists.')

    const foundProducts = await tx.select({ id: storeProducts.id }).from(storeProducts)
      .where(inArray(storeProducts.id, productIds))
    if (foundProducts.length !== productIds.length) throw new Error('One or more selected products no longer exist.')

    await tx.insert(storeProductCategories)
      .values(productIds.map((productId) => ({ productId, categoryId: selectedCategoryId })))
      .onConflictDoNothing()
    await tx.update(storeProducts)
      .set({ categoryId: selectedCategoryId, updatedAt: new Date() })
      .where(and(inArray(storeProducts.id, productIds), isNull(storeProducts.categoryId)))
    await tx.insert(storeActivityEvents).values(productIds.map((productId) => ({
      entityType: 'product',
      entityId: productId,
      eventType: 'category_added',
      payload: { categoryId: selectedCategoryId, bulk: true },
    })))
  })
  bust()
}

export async function getAdminProduct(id: string) {
  await requireAdminSession('staff')
  uuid(id, 'Product')
  const [[row], categories, assets, relatedProducts] = await Promise.all([
    db.select().from(storeProducts).where(eq(storeProducts.id, id)).limit(1),
    db.select({ categoryId: storeProductCategories.categoryId })
      .from(storeProductCategories)
      .where(eq(storeProductCategories.productId, id)),
    db.select().from(storeProductAssets)
      .where(eq(storeProductAssets.productId, id))
      .orderBy(asc(storeProductAssets.sortOrder)),
    db.select({ relatedProductId: storeProductRelations.relatedProductId })
      .from(storeProductRelations)
      .where(eq(storeProductRelations.productId, id))
      .orderBy(asc(storeProductRelations.sortOrder)),
  ])
  return row
    ? {
        ...row,
        categoryIds: categories.map(({ categoryId }) => categoryId),
        assets: assets.map((asset) => ({
          ...asset,
          createdAt: asset.createdAt.toISOString(),
        })),
        relatedProductIds: relatedProducts.map(({ relatedProductId }) => relatedProductId),
      }
    : null
}

export async function createProduct(input: AdminProductInput) {
  await requireAdminSession('admin')
  const values = parseProduct(input, await currentPowerOptionValues())
  try {
    await validateProductReferences(values.categoryIds, values.brandId, values.lensShadeId, values.lensTypeId)
    const [brand] = values.brandId ? await db.select({ name: storeBrands.name }).from(storeBrands).where(eq(storeBrands.id, values.brandId)) : []
    const { categoryIds, ...productValues } = values
    const [row] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(storeProducts).values({
        ...productValues,
        brand: brand?.name ?? null,
        stockQuantity: 0,
      }).returning({ id: storeProducts.id })
      if (categoryIds.length) {
        await tx.insert(storeProductCategories).values(categoryIds.map((categoryId) => ({ productId: created.id, categoryId })))
      }
      return [created]
    })
    await log('product', row.id, 'created', { name: values.name })
    bust()
    return { id: row.id }
  } catch (error) {
    const message = duplicateMessage(error)
    if (message) throw new Error(message)
    throw error
  }
}

export async function updateProduct(id: string, input: AdminProductInput) {
  await requireAdminSession('admin')
  uuid(id, 'Product')
  const values = parseProduct(input, await currentPowerOptionValues())
  try {
    await validateProductReferences(values.categoryIds, values.brandId, values.lensShadeId, values.lensTypeId)
    const [currentProduct] = await db.select({
      isOnSale: storeProducts.isOnSale,
      price: storeProducts.price,
    }).from(storeProducts).where(eq(storeProducts.id, id)).limit(1)
    if (!currentProduct) throw new Error('Product not found.')
    const [hasVariants] = await db.select({ id: storeProductVariants.id }).from(storeProductVariants).where(eq(storeProductVariants.productId, id)).limit(1)
    if (currentProduct.isOnSale) {
      const [variantPrice] = hasVariants ? await db.select({
        price: sql<string>`min(${storeProductVariants.price})::text`,
      }).from(storeProductVariants)
        .where(and(eq(storeProductVariants.productId, id), eq(storeProductVariants.isActive, true)))
        .groupBy(storeProductVariants.productId) : []
      const currentPrice = hasVariants ? variantPrice?.price ?? currentProduct.price : values.price
      if (!values.compareAtPrice || Number(values.compareAtPrice) <= Number(currentPrice)) {
        throw new Error('This product is featured in On sale. Keep its compare-at price above its current price, or remove it from On sale before changing the price.')
      }
    }
    const [brand] = values.brandId ? await db.select({ name: storeBrands.name }).from(storeBrands).where(eq(storeBrands.id, values.brandId)) : []
    const { categoryIds, ...productValues } = values
    const [row] = await db.transaction(async (tx) => {
      // Price and stock are derived from variants once any exist.
      const { price, ...rest } = productValues
      const [updated] = await tx
        .update(storeProducts)
        .set({ ...rest, brand: brand?.name ?? null, ...(hasVariants ? {} : { price }), updatedAt: new Date() })
        .where(eq(storeProducts.id, id))
        .returning({ id: storeProducts.id })
      if (!updated) throw new Error('Product not found.')
      await tx.delete(storeProductCategories).where(eq(storeProductCategories.productId, id))
      if (categoryIds.length) {
        await tx.insert(storeProductCategories).values(categoryIds.map((categoryId) => ({ productId: id, categoryId })))
      }
      return [updated]
    })
    await log('product', id, 'updated', { name: values.name })
    bust()
  } catch (error) {
    const message = duplicateMessage(error)
    if (message) throw new Error(message)
    throw error
  }
}

export async function deleteProduct(id: string) {
  await requireAdminSession('admin')
  uuid(id, 'Product')
  const assets = await db.select({
    url: storeProductAssets.blobUrl,
    pathname: storeProductAssets.blobPathname,
  }).from(storeProductAssets).where(eq(storeProductAssets.productId, id))
  await db.transaction(async (tx) => {
    await tx.delete(storeProductAssets).where(eq(storeProductAssets.productId, id))
    await tx.delete(storeProductVariants).where(eq(storeProductVariants.productId, id))
    await tx.delete(storeProducts).where(eq(storeProducts.id, id))
  })
  for (const asset of assets) {
    if (mediaPathFromOwnedUrl(asset.url) !== asset.pathname) continue
    try {
      await deleteMedia(asset.pathname)
    } catch (error) {
      console.error('[product-delete] Media cleanup failed', error instanceof Error ? error.name : 'UnknownError')
    }
  }
  await log('product', id, 'deleted')
  bust()
}

export async function setProductRelations(productId: string, relatedIds: string[]) {
  await requireAdminSession('admin')
  uuid(productId, 'Product')
  const ids = [...new Set(relatedIds.map((value) => uuid(value, 'Related product')))].filter((value) => value !== productId).slice(0, 24)
  if (ids.length) {
    const found = await db.select({ id: storeProducts.id }).from(storeProducts).where(inArray(storeProducts.id, ids))
    if (found.length !== ids.length) throw new Error('One of the related products no longer exists.')
  }
  await db.transaction(async (tx) => {
    await tx.delete(storeProductRelations).where(eq(storeProductRelations.productId, productId))
    if (ids.length) await tx.insert(storeProductRelations).values(ids.map((relatedProductId, sortOrder) => ({ productId, relatedProductId, sortOrder })))
  })
  await log('product', productId, 'relations_updated', { count: ids.length })
  bust()
}

// ───────────── Reviews ─────────────

export async function getAdminReviews() {
  await requireAdminSession('staff')
  const rows = await db
    .select({ review: storeProductReviews, productName: storeProducts.name })
    .from(storeProductReviews)
    .innerJoin(storeProducts, eq(storeProducts.id, storeProductReviews.productId))
    .orderBy(asc(storeProductReviews.isApproved), desc(storeProductReviews.createdAt))
    .limit(300)
  return rows.map(({ review, productName }) => ({ ...review, productName, createdAt: review.createdAt.toISOString() }))
}

export async function createAdminReview(input: { productId: unknown; author: unknown; rating: unknown; title?: unknown; body: unknown; isApproved?: unknown }) {
  await requireAdminSession('admin')
  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Rating must be 1–5.')
  await db.insert(storeProductReviews).values({
    productId: uuid(input.productId, 'Product'),
    author: text(input.author, 80, 'Author', true)!,
    rating,
    title: text(input.title, 120, 'Title'),
    body: text(input.body, 2000, 'Review', true)!,
    isApproved: input.isApproved !== false,
  })
  bust()
}

export async function setReviewApproval(id: string, approved: boolean) {
  await requireAdminSession('admin')
  await db.update(storeProductReviews).set({ isApproved: approved }).where(eq(storeProductReviews.id, uuid(id, 'Review')))
  bust()
}

export async function deleteReview(id: string) {
  await requireAdminSession('admin')
  await db.delete(storeProductReviews).where(eq(storeProductReviews.id, uuid(id, 'Review')))
  bust()
}

// ───────────── Product page settings ─────────────

export async function getAdminProductPageSettings(): Promise<ProductPageSettings> {
  await requireAdminSession('staff')
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, 'product_page')).limit(1)
  const value = row?.value as Partial<ProductPageSettings> | undefined
  if (!value || !Array.isArray(value.sections)) return DEFAULT_PRODUCT_PAGE
  return { sections: value.sections, reviews: { ...DEFAULT_PRODUCT_PAGE.reviews, ...(value.reviews ?? {}) } }
}

export async function saveProductPageSettings(input: ProductPageSettings) {
  await requireAdminSession('admin')
  const sections = (Array.isArray(input.sections) ? input.sections : []).slice(0, 12).map((section, index) => {
    if (!(SECTION_SOURCES as readonly string[]).includes(section.source)) throw new Error('Invalid section source.')
    const limit = Number(section.limit)
    return {
      id: typeof section.id === 'string' && /^[a-z0-9-]{1,40}$/.test(section.id) ? section.id : `section-${index + 1}`,
      title: text(section.title, 80, 'Section title', true)!,
      source: section.source,
      limit: Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 12) : 4,
      enabled: section.enabled === true,
    }
  })
  const value: ProductPageSettings = {
    sections,
    reviews: {
      enabled: input.reviews?.enabled === true,
      allowSubmission: input.reviews?.allowSubmission === true,
      autoApprove: input.reviews?.autoApprove === true,
    },
  }
  await db
    .insert(storeSettings)
    .values({ key: 'product_page', value })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } })
  bust()
}

export type BulkPriceMode = 'set' | 'percent' | 'amount'

function toCents(value: string) {
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value)
  return match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : null
}

function fromCents(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/**
 * Bulk price update. `set` takes a price (e.g. "1500.00"); `percent` and `amount`
 * take a signed number (e.g. "-10" or "250"). Variant prices change alongside the product.
 */
export async function bulkUpdateProductPrices(
  ids: string[],
  mode: BulkPriceMode,
  value: string,
  includeCompareAt = true,
) {
  await requireAdminSession('admin')
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) throw new Error('Select between 1 and 100 products.')
  if (!['set', 'percent', 'amount'].includes(mode)) throw new Error('Choose a valid price update type.')
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^-?\d{1,10}(?:\.\d{1,2})?$/.test(raw)) throw new Error('Enter a valid number for the price update.')
  const negative = raw.startsWith('-')
  const magnitude = toCents(negative ? raw.slice(1) : raw)
  if (magnitude === null) throw new Error('Enter a valid number for the price update.')
  if (mode === 'set' && (negative || magnitude <= 0)) throw new Error('The new price must be greater than zero.')

  const adjust = (current: string) => {
    const cents = toCents(current)
    if (cents === null) throw new Error('A selected product has an invalid price.')
    const next = mode === 'set'
      ? magnitude
      : mode === 'percent'
        ? Math.round(cents * (1 + ((negative ? -magnitude : magnitude) / 100) / 100))
        : cents + (negative ? -magnitude : magnitude)
    if (next <= 0 || next > 999_999_999_999) throw new Error('The update would make a price zero, negative, or too large.')
    return fromCents(next)
  }

  const productIds = [...new Set(ids.map((id) => uuid(id, 'Product')))]
  await db.transaction(async (tx) => {
    const products = await tx.select({ id: storeProducts.id, price: storeProducts.price, compareAtPrice: storeProducts.compareAtPrice })
      .from(storeProducts).where(inArray(storeProducts.id, productIds))
    if (products.length !== productIds.length) throw new Error('One or more selected products no longer exist.')
    const variants = await tx.select({ id: storeProductVariants.id, price: storeProductVariants.price })
      .from(storeProductVariants).where(inArray(storeProductVariants.productId, productIds))
    const now = new Date()
    for (const product of products) {
      const price = adjust(product.price)
      const compareAtPrice = includeCompareAt && product.compareAtPrice && mode !== 'set' ? adjust(product.compareAtPrice) : product.compareAtPrice
      await tx.update(storeProducts).set({ price, compareAtPrice, updatedAt: now }).where(eq(storeProducts.id, product.id))
    }
    for (const variant of variants) {
      await tx.update(storeProductVariants).set({ price: adjust(variant.price), updatedAt: now }).where(eq(storeProductVariants.id, variant.id))
    }
    await tx.insert(storeActivityEvents).values(productIds.map((id) => ({
      entityType: 'product',
      entityId: id,
      eventType: 'bulk_price_updated',
      payload: { mode, value: raw, includeCompareAt },
    })))
  })
  bust()
}

export type BulkPowerMode = 'replace' | 'add' | 'remove'

/** Bulk-edit which power lens values customers can choose on the selected products. */
export async function bulkUpdateProductPowerOptions(ids: string[], values: string[], mode: BulkPowerMode) {
  await requireAdminSession('admin')
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) throw new Error('Select between 1 and 100 products.')
  if (!['replace', 'add', 'remove'].includes(mode)) throw new Error('Choose a valid power update type.')
  if (!Array.isArray(values) || (mode !== 'replace' && values.length === 0)) throw new Error('Choose at least one power value.')
  const valid = await currentPowerOptionValues()
  const validSet = new Set(valid)
  if (values.some((entry) => typeof entry !== 'string' || !validSet.has(entry))) throw new Error('One or more selected power values are invalid.')
  const chosen = new Set(values)
  const productIds = [...new Set(ids.map((id) => uuid(id, 'Product')))]

  await db.transaction(async (tx) => {
    const products = await tx.select({ id: storeProducts.id, ranges: storeProducts.availablePowerRanges })
      .from(storeProducts).where(inArray(storeProducts.id, productIds))
    if (products.length !== productIds.length) throw new Error('One or more selected products no longer exist.')
    const now = new Date()
    for (const product of products) {
      const current = new Set(product.ranges ?? [])
      const next = mode === 'replace' ? chosen : mode === 'add' ? new Set([...current, ...chosen]) : new Set([...current].filter((entry) => !chosen.has(entry)))
      await tx.update(storeProducts)
        .set({ availablePowerRanges: valid.filter((entry) => next.has(entry)), updatedAt: now })
        .where(eq(storeProducts.id, product.id))
    }
    await tx.insert(storeActivityEvents).values(productIds.map((id) => ({
      entityType: 'product',
      entityId: id,
      eventType: 'bulk_power_options_updated',
      payload: { mode, values },
    })))
  })
  bust()
}
