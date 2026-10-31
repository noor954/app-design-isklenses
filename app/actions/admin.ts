'use server'

import { createHash, randomUUID } from 'node:crypto'
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { invalidateCache } from '@/lib/cache'
import { isOwnedMediaUrl } from '@/lib/server/media-storage.mjs'
import { db } from '@/lib/db'
import {
  buildDeliveryRules,
  deliverySettingsFromRules,
  parseDeliveryRules,
  type DeliverySettings,
} from '@/lib/delivery'
import {
  storeActivityEvents,
  storeCustomers,
  storeOrderItems,
  storeOrders,
  storeProductAssets,
  storeProducts,
  storeProductVariants,
  storeAdminUsers,
  storeSettings,
  storeCrmLeads,
} from '@/lib/db/schema'
import { clearAdminSession, hashAdminPassword, requireAdminSession } from '@/lib/auth/admin'
import { getMetaLeadAdsSetupStatus } from '@/lib/server/meta-leads'

const productStatuses = ['active', 'draft', 'archived'] as const
const orderStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const pricePattern = /^\d{1,10}(?:\.\d{1,2})?$/
const maxMoneyCents = 999_999_999_999

type ProductVariantInput = {
  sku?: unknown
  name: unknown
  color?: unknown
  powerDiopters?: unknown
  baseCurve?: unknown
  diameterMm?: unknown
  packSize?: unknown
  price: unknown
  currency?: unknown
  stockQuantity: unknown
  isActive?: unknown
}

const variantDecimalPattern = /^-?\d{1,4}(?:\.\d{1,2})?$/

function requireText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${field} is required and must be at most ${maxLength} characters.`)
  }
  return value.trim()
}

function validateUuid(value: string, field: string) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error(`${field} is invalid.`)
}

function validateProductVariantInput(data: ProductVariantInput) {
  if (!data || typeof data !== 'object') throw new Error('Variant details are required.')
  const name = requireText(data.name, 'Variant name', 180)
  const optionalText = (value: unknown, field: string, maxLength: number) => {
    if (value === undefined || value === null || value === '') return null
    return requireText(value, field, maxLength)
  }
  const sku = optionalText(data.sku, 'SKU', 64)
  const color = optionalText(data.color, 'Color', 80)
  const optionalDecimal = (value: unknown, field: string) => {
    if (value === undefined || value === null || value === '') return null
    if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`${field} is invalid.`)
    const normalized = String(value).trim()
    if (!variantDecimalPattern.test(normalized)) throw new Error(`${field} must be a number with up to two decimal places.`)
    return normalized
  }
  const powerDiopters = optionalDecimal(data.powerDiopters, 'Power')
  const baseCurve = optionalDecimal(data.baseCurve, 'Base curve')
  const diameterMm = optionalDecimal(data.diameterMm, 'Diameter')
  if (powerDiopters !== null && (Number(powerDiopters) < -9999.99 || Number(powerDiopters) > 9999.99)) {
    throw new Error('Power is outside the supported range.')
  }
  for (const [value, field] of [[baseCurve, 'Base curve'], [diameterMm, 'Diameter']] as const) {
    if (value !== null && (Number(value) <= 0 || Number(value) > 99.99)) throw new Error(`${field} must be greater than zero and at most 99.99.`)
  }
  let packSize: number | null = null
  if (data.packSize !== undefined && data.packSize !== null && data.packSize !== '') {
    if ((typeof data.packSize !== 'number' && typeof data.packSize !== 'string') ||
        (typeof data.packSize === 'string' && !/^\d+$/.test(data.packSize))) {
      throw new Error('Pack size must be a whole number from 1 to 1000.')
    }
    packSize = Number(data.packSize)
    if (!Number.isSafeInteger(packSize) || packSize < 1 || packSize > 1000) {
      throw new Error('Pack size must be a whole number from 1 to 1000.')
    }
  }
  const price = requireText(data.price, 'Price', 16)
  if (data.currency !== undefined && typeof data.currency !== 'string') throw new Error('Currency is invalid.')
  const currency = (data.currency || 'PKR').trim().toUpperCase()
  const stockQuantity = data.stockQuantity
  if (!pricePattern.test(price)) throw new Error('Enter a price with up to two decimal places.')
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter ISO code.')
  if (typeof stockQuantity !== 'number' || !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2_147_483_647) {
    throw new Error('Stock quantity must be a whole number between zero and 2,147,483,647.')
  }
  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') throw new Error('Variant status is invalid.')
  return {
    sku,
    name,
    color,
    powerDiopters,
    baseCurve,
    diameterMm,
    packSize,
    price,
    currency,
    stockQuantity,
    isActive: data.isActive ?? true,
  }
}

async function refreshProductVariantSummary(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], productId: string) {
  const activeVariants = await tx
    .select({ price: storeProductVariants.price, currency: storeProductVariants.currency, stockQuantity: storeProductVariants.stockQuantity })
    .from(storeProductVariants)
    .where(and(eq(storeProductVariants.productId, productId), eq(storeProductVariants.isActive, true)))
    .orderBy(storeProductVariants.price)
  if (activeVariants.length) {
    const maximumStock = 2_147_483_647
    let stockQuantity = 0
    for (const variant of activeVariants) {
      if (variant.stockQuantity > maximumStock - stockQuantity) {
        throw new Error('Combined variant stock exceeds the supported range.')
      }
      stockQuantity += variant.stockQuantity
    }
    await tx
      .update(storeProducts)
      .set({
        price: activeVariants[0].price,
        currency: activeVariants[0].currency,
        stockQuantity: Number(stockQuantity),
        updatedAt: new Date(),
      })
      .where(eq(storeProducts.id, productId))
  } else {
    await tx.update(storeProducts).set({ stockQuantity: 0, updatedAt: new Date() }).where(eq(storeProducts.id, productId))
  }
}

async function ensureOnSaleDiscount(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  product: { id: string; isOnSale: boolean; compareAtPrice: string | null },
) {
  if (!product.isOnSale) return
  const [variant] = await tx
    .select({ price: sql<string>`min(${storeProductVariants.price})::text` })
    .from(storeProductVariants)
    .where(and(eq(storeProductVariants.productId, product.id), eq(storeProductVariants.isActive, true)))
    .groupBy(storeProductVariants.productId)
  const [current] = await tx
    .select({ price: storeProducts.price })
    .from(storeProducts)
    .where(eq(storeProducts.id, product.id))
  const effectivePrice = variant?.price ?? current?.price
  if (!effectivePrice || !product.compareAtPrice || Number(product.compareAtPrice) <= Number(effectivePrice)) {
    throw new Error('This product is in On sale. Keep its compare-at price above its current price, or remove it from On sale first.')
  }
}

function boundedLimit(limit: number, fallback: number, maximum: number) {
  if (!Number.isInteger(limit) || limit < 1) return fallback
  return Math.min(limit, maximum)
}

function moneyToCents(value: string, field: string) {
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) throw new Error(`${field} must be a non-negative amount with up to two decimal places.`)
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > maxMoneyCents) throw new Error(`${field} is outside the supported range.`)
  return cents
}

function centsToMoney(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

export async function getAllProductAssets() {
  await requireAdminSession()
  return db.select().from(storeProductAssets).orderBy(asc(storeProductAssets.sortOrder), asc(storeProductAssets.createdAt))
}

export async function getAllProductVariants() {
  await requireAdminSession()
  return db.select().from(storeProductVariants).orderBy(storeProductVariants.name)
}

export async function getProductVariants(productId: string) {
  await requireAdminSession()
  validateUuid(productId, 'Product ID')
  return db
    .select()
    .from(storeProductVariants)
    .where(eq(storeProductVariants.productId, productId))
    .orderBy(storeProductVariants.name)
}

async function createProductVariantImpl(productId: string, data: ProductVariantInput) {
  await requireAdminSession('admin')
  validateUuid(productId, 'Product ID')
  const values = validateProductVariantInput(data)

  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(storeProducts).where(eq(storeProducts.id, productId)).limit(1).for('update')
    if (!product) throw new Error('Product not found.')
    if (values.currency !== product.currency) throw new Error('Variant currency must match the product currency.')
    const [variant] = await tx.insert(storeProductVariants).values({ ...values, productId }).returning()
    await refreshProductVariantSummary(tx, productId)
    await ensureOnSaleDiscount(tx, product)
    await tx.insert(storeActivityEvents).values({
      entityType: 'product_variant',
      entityId: variant.id,
      eventType: 'created',
      payload: { productId },
    })
    return variant
  })
}

async function updateProductVariantImpl(productId: string, variantId: string, data: ProductVariantInput) {
  await requireAdminSession('admin')
  validateUuid(productId, 'Product ID')
  validateUuid(variantId, 'Variant ID')
  const values = validateProductVariantInput(data)

  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(storeProducts).where(eq(storeProducts.id, productId)).limit(1).for('update')
    if (!product) throw new Error('Product not found.')
    if (values.currency !== product.currency) throw new Error('Variant currency must match the product currency.')
    const [variant] = await tx
      .update(storeProductVariants)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(storeProductVariants.id, variantId), eq(storeProductVariants.productId, productId)))
      .returning()
    if (!variant) throw new Error('Product variant not found.')
    await refreshProductVariantSummary(tx, productId)
    await ensureOnSaleDiscount(tx, product)
    await tx.insert(storeActivityEvents).values({
      entityType: 'product_variant',
      entityId: variant.id,
      eventType: 'updated',
      payload: { productId },
    })
    return variant
  })
}

async function archiveProductVariantImpl(productId: string, variantId: string) {
  await requireAdminSession('admin')
  validateUuid(productId, 'Product ID')
  validateUuid(variantId, 'Variant ID')
  return db.transaction(async (tx) => {
    const [product] = await tx.select({
      id: storeProducts.id,
      isOnSale: storeProducts.isOnSale,
      compareAtPrice: storeProducts.compareAtPrice,
    }).from(storeProducts).where(eq(storeProducts.id, productId)).limit(1).for('update')
    if (!product) throw new Error('Product not found.')
    const [variant] = await tx
      .update(storeProductVariants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(storeProductVariants.id, variantId), eq(storeProductVariants.productId, productId)))
      .returning()
    if (!variant) throw new Error('Product variant not found.')
    await refreshProductVariantSummary(tx, productId)
    await ensureOnSaleDiscount(tx, product)
    await tx.insert(storeActivityEvents).values({
      entityType: 'product_variant',
      entityId: variant.id,
      eventType: 'archived',
      payload: { productId },
    })
    return variant
  })
}

async function updateProductStockImpl(productId: string, quantity: number) {
  await requireAdminSession('admin')
  validateUuid(productId, 'Product ID')
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Stock quantity must be a non-negative whole number.')
  const [variant] = await db
    .select({ id: storeProductVariants.id })
    .from(storeProductVariants)
    .where(and(eq(storeProductVariants.productId, productId), eq(storeProductVariants.isActive, true)))
    .limit(1)
  if (variant) throw new Error('Manage stock on active variants for this product.')

  return db.transaction(async (tx) => {
    const [product] = await tx
      .update(storeProducts)
      .set({ stockQuantity: quantity, updatedAt: new Date() })
      .where(eq(storeProducts.id, productId))
      .returning()
    if (!product) throw new Error('Product not found.')

    await tx.insert(storeActivityEvents).values({
      entityType: 'product',
      entityId: productId,
      eventType: 'stock_updated',
      payload: { newQuantity: quantity },
    })
    return product
  })
}

async function addProductAssetImpl(
  productId: string,
  blobPathname: string,
  blobUrl: string,
  altText?: string,
  mediaType: 'image' | 'video' = 'image',
) {
  await requireAdminSession('admin')
  validateUuid(productId, 'Product ID')
  const pathname = requireText(blobPathname, 'Blob path', 500)
  if (altText !== undefined && typeof altText !== 'string') throw new Error('Image description is invalid.')
  const text = altText?.trim() || null
  if (text && text.length > 500) throw new Error('Image description must be at most 500 characters.')
  if (mediaType !== 'image' && mediaType !== 'video') throw new Error('Media type is invalid.')
  if (!isOwnedMediaUrl(blobUrl)) {
    throw new Error('Media must be uploaded to the site media library.')
  }

  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(storeProducts).where(eq(storeProducts.id, productId)).limit(1)
    if (!product) throw new Error('Product not found.')
    const [lastAsset] = await tx
      .select({ sortOrder: storeProductAssets.sortOrder })
      .from(storeProductAssets)
      .where(eq(storeProductAssets.productId, productId))
      .orderBy(desc(storeProductAssets.sortOrder))
      .limit(1)

    const [asset] = await tx
      .insert(storeProductAssets)
      .values({
        productId,
        blobPathname: pathname,
        blobUrl,
        altText: text,
        mediaType,
        sortOrder: (lastAsset?.sortOrder ?? -1) + 1,
      })
      .returning()
    if (mediaType === 'image' && !product.heroImageUrl) {
      await tx.update(storeProducts).set({ heroImageUrl: asset.blobUrl, updatedAt: new Date() }).where(eq(storeProducts.id, productId))
    }
    await tx.insert(storeActivityEvents).values({
      entityType: 'product_asset',
      entityId: asset.id,
      eventType: 'created',
      payload: { productId, mediaType },
    })
    return asset
  })
}

async function moveProductAssetImpl(assetId: string, direction: 'up' | 'down') {
  await requireAdminSession('admin')
  validateUuid(assetId, 'Asset ID')
  if (direction !== 'up' && direction !== 'down') throw new Error('Media direction is invalid.')
  return db.transaction(async (tx) => {
    const [asset] = await tx.select().from(storeProductAssets).where(eq(storeProductAssets.id, assetId)).limit(1)
    if (!asset) throw new Error('Product media not found.')
    const assets = await tx
      .select()
      .from(storeProductAssets)
      .where(eq(storeProductAssets.productId, asset.productId))
      .orderBy(asc(storeProductAssets.sortOrder), asc(storeProductAssets.createdAt))
    const index = assets.findIndex((item) => item.id === assetId)
    const neighbor = assets[index + (direction === 'up' ? -1 : 1)]
    if (!neighbor) return asset
    const reordered = [...assets]
    ;[reordered[index], reordered[index + (direction === 'up' ? -1 : 1)]] = [
      reordered[index + (direction === 'up' ? -1 : 1)],
      reordered[index],
    ]
    for (const [sortOrder, item] of reordered.entries()) {
      await tx.update(storeProductAssets).set({ sortOrder }).where(eq(storeProductAssets.id, item.id))
    }
    await tx.insert(storeActivityEvents).values({
      entityType: 'product_asset',
      entityId: asset.id,
      eventType: 'reordered',
      payload: { productId: asset.productId, direction },
    })
    return { ...asset, sortOrder: reordered.findIndex((item) => item.id === assetId) }
  })
}

export async function getProductAssetById(assetId: string) {
  await requireAdminSession()
  validateUuid(assetId, 'Asset ID')
  const [asset] = await db.select().from(storeProductAssets).where(eq(storeProductAssets.id, assetId)).limit(1)
  return asset ?? null
}

async function deleteProductAssetImpl(assetId: string) {
  await requireAdminSession('admin')
  validateUuid(assetId, 'Asset ID')

  return db.transaction(async (tx) => {
    const [asset] = await tx.select().from(storeProductAssets).where(eq(storeProductAssets.id, assetId)).limit(1)
    if (!asset) throw new Error('Product image not found.')

    await tx.delete(storeProductAssets).where(eq(storeProductAssets.id, assetId))
    const [product] = await tx.select().from(storeProducts).where(eq(storeProducts.id, asset.productId)).limit(1)
    if (product?.heroImageUrl === asset.blobUrl && asset.mediaType === 'image') {
      const [nextAsset] = await tx
        .select()
        .from(storeProductAssets)
        .where(and(eq(storeProductAssets.productId, asset.productId), eq(storeProductAssets.mediaType, 'image')))
        .orderBy(asc(storeProductAssets.sortOrder))
        .limit(1)
      await tx
        .update(storeProducts)
        .set({ heroImageUrl: nextAsset?.blobUrl ?? null, updatedAt: new Date() })
        .where(eq(storeProducts.id, asset.productId))
    }
    await tx.insert(storeActivityEvents).values({
      entityType: 'product_asset',
      entityId: asset.id,
      eventType: 'deleted',
      payload: { productId: asset.productId },
    })
    return { success: true }
  })
}

export async function getAllOrders(limit = 50, offset = 0, status = '') {
  await requireAdminSession()
  const pageSize = boundedLimit(limit, 50, 100)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new Error('Order page is invalid.')
  if (typeof status !== 'string' || (status && !orderStatuses.includes(status as (typeof orderStatuses)[number]))) {
    throw new Error('Order status filter is invalid.')
  }
  const conditions = status ? eq(storeOrders.status, status) : undefined
  const [rows, countRows] = await Promise.all([
    (conditions
      ? db
          .select({ order: storeOrders, customer: storeCustomers })
          .from(storeOrders)
          .leftJoin(storeCustomers, eq(storeOrders.customerId, storeCustomers.id))
          .where(conditions)
      : db
          .select({ order: storeOrders, customer: storeCustomers })
          .from(storeOrders)
          .leftJoin(storeCustomers, eq(storeOrders.customerId, storeCustomers.id)))
      .orderBy(desc(storeOrders.createdAt))
      .limit(pageSize)
      .offset(offset),
    (conditions
      ? db.select({ total: sql<number>`count(*)::int` }).from(storeOrders).where(conditions)
      : db.select({ total: sql<number>`count(*)::int` }).from(storeOrders)),
  ])
  const ids = rows.map(({ order }) => order.id)
  const items = ids.length
    ? await db
        .select({
          id: storeOrderItems.id,
          orderId: storeOrderItems.orderId,
          productName: storeOrderItems.productName,
          powerLeft: storeOrderItems.powerLeft,
          powerRight: storeOrderItems.powerRight,
          unitPrice: storeOrderItems.unitPrice,
          quantity: storeOrderItems.quantity,
          lineTotal: storeOrderItems.lineTotal,
        })
        .from(storeOrderItems)
        .where(inArray(storeOrderItems.orderId, ids))
    : []

  return {
    items: rows.map(({ order, customer }) => {
      const {
        accountId: _accountId,
        checkoutKey: _checkoutKey,
        ...publicOrder
      } = order
      return {
        ...publicOrder,
        customer: customer
          ? {
              email: customer.email,
              firstName: customer.firstName,
              lastName: customer.lastName,
            }
          : null,
        items: items.filter((item) => item.orderId === order.id),
      }
    }),
    total: Number(countRows[0]?.total ?? 0),
  }
}

export async function getOrderStats() {
  await requireAdminSession()
  const [summaryRows, revenueRows, statusRows] = await Promise.all([
    db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      pendingOrders: sql<number>`count(*) filter (where ${storeOrders.status} = 'pending')::int`,
    })
    .from(storeOrders),
    db
      .select({
        currency: storeOrders.currency,
        totalRevenue: sql<string>`coalesce(sum(${storeOrders.total}), 0)::text`,
        avgOrderValue: sql<string>`coalesce(avg(${storeOrders.total}), 0)::text`,
      })
      .from(storeOrders)
      .where(sql`(
        (${storeOrders.paymentMethod} = 'cash_on_delivery' AND ${storeOrders.status} = 'paid')
        OR (
          ${storeOrders.paymentMethod} IS DISTINCT FROM 'cash_on_delivery'
          AND ${storeOrders.status} IN ('paid', 'processing', 'shipped', 'delivered')
        )
      )`)
      .groupBy(storeOrders.currency)
      .orderBy(storeOrders.currency),
    db
      .select({ status: storeOrders.status, count: sql<number>`count(*)::int` })
      .from(storeOrders)
      .groupBy(storeOrders.status)
      .orderBy(storeOrders.status),
  ])
  const summary = summaryRows[0] ?? { totalOrders: 0, pendingOrders: 0 }
  return {
    totalOrders: Number(summary.totalOrders),
    pendingOrders: Number(summary.pendingOrders),
    revenueByCurrency: revenueRows,
    ordersByStatus: Object.fromEntries(statusRows.map((row) => [row.status, Number(row.count)])),
  }
}

async function updateOrderStatusImpl(orderId: string, status: string) {
  await requireAdminSession('admin')
  validateUuid(orderId, 'Order ID')
  if (!orderStatuses.includes(status as (typeof orderStatuses)[number])) throw new Error('Order status is invalid.')

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(storeOrders).where(eq(storeOrders.id, orderId)).limit(1).for('update')
    if (!current) throw new Error('Order not found.')
    if (current.status === status) return { success: true, status: current.status }

    const standardTransitions: Record<string, readonly string[]> = {
      pending: ['paid', 'processing', 'cancelled'],
      paid: ['processing', 'cancelled', 'refunded'],
      processing: ['shipped', 'cancelled', 'refunded'],
      shipped: ['delivered', 'refunded'],
      delivered: ['refunded'],
      cancelled: [],
      refunded: [],
    }
    const codTransitions: Record<string, readonly string[]> = {
      pending: ['processing', 'cancelled'],
      paid: ['refunded'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: ['paid', 'refunded'],
      cancelled: [],
      refunded: [],
    }
    const transitions = current.paymentMethod === 'cash_on_delivery' ? codTransitions : standardTransitions
    if (!transitions[current.status]?.includes(status)) {
      throw new Error(`An order cannot move from ${current.status} to ${status}.`)
    }
    if (current.paymentMethod === 'cash_on_delivery' && status === 'shipped' && !current.shippingFeeConfirmed) {
      throw new Error('Confirm the delivery charge with the customer before dispatch.')
    }

    if (status === 'cancelled') {
      const reservedItems = await tx
        .select()
        .from(storeOrderItems)
        .where(and(eq(storeOrderItems.orderId, orderId), eq(storeOrderItems.inventoryReserved, true)))
        .for('update')
      for (const item of reservedItems) {
        if (item.variantId) {
          const [variant] = await tx
            .select()
            .from(storeProductVariants)
            .where(eq(storeProductVariants.id, item.variantId))
            .limit(1)
            .for('update')
          if (variant) {
            const stockQuantity = variant.stockQuantity + item.quantity
            if (!Number.isSafeInteger(stockQuantity) || stockQuantity > 2_147_483_647) {
              throw new Error('Cancelled order inventory exceeds the supported stock range.')
            }
            await tx.update(storeProductVariants).set({ stockQuantity, updatedAt: new Date() }).where(eq(storeProductVariants.id, variant.id))
            await refreshProductVariantSummary(tx, variant.productId)
          }
        } else {
          const [product] = await tx
            .select()
            .from(storeProducts)
            .where(eq(storeProducts.id, item.productId))
            .limit(1)
            .for('update')
          if (product) {
            const [activeVariant] = await tx
              .select({ id: storeProductVariants.id })
              .from(storeProductVariants)
              .where(and(eq(storeProductVariants.productId, product.id), eq(storeProductVariants.isActive, true)))
              .limit(1)
            if (!activeVariant) {
              const stockQuantity = product.stockQuantity + item.quantity
              if (!Number.isSafeInteger(stockQuantity) || stockQuantity > 2_147_483_647) {
                throw new Error('Cancelled order inventory exceeds the supported stock range.')
              }
              await tx.update(storeProducts).set({ stockQuantity, updatedAt: new Date() }).where(eq(storeProducts.id, product.id))
            }
          }
        }
      }
      if (reservedItems.length) {
        await tx
          .update(storeOrderItems)
          .set({ inventoryReserved: false })
          .where(and(eq(storeOrderItems.orderId, orderId), eq(storeOrderItems.inventoryReserved, true)))
      }
    }

    const [updated] = await tx
      .update(storeOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(storeOrders.id, orderId))
      .returning()
    if (!updated) throw new Error('Order status was not updated.')
    await tx.insert(storeActivityEvents).values({
      entityType: 'order',
      entityId: orderId,
      eventType: 'status_updated',
      payload: { newStatus: status, inventoryReleased: status === 'cancelled' },
    })
    return { success: true, status: updated.status }
  })
}

export async function updateOrderDeliveryFee(orderId: string, value: string) {
  await requireAdminSession('admin')
  validateUuid(orderId, 'Order ID')
  const amount = requireText(value, 'Delivery fee', 16)
  const shippingCents = moneyToCents(amount, 'Delivery fee')

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(storeOrders)
      .where(eq(storeOrders.id, orderId))
      .limit(1)
      .for('update')
    if (!order) throw new Error('Order not found.')
    if (order.paymentMethod !== 'cash_on_delivery') throw new Error('Delivery charges can only be changed for cash-on-delivery orders.')
    if (order.status !== 'pending' && order.status !== 'processing') {
      throw new Error('Confirm delivery charges before an order is dispatched.')
    }
    const subtotalCents = moneyToCents(order.subtotal, 'Order subtotal')
    const taxCents = moneyToCents(order.taxTotal, 'Order tax')
    if (subtotalCents > maxMoneyCents - shippingCents || subtotalCents + shippingCents > maxMoneyCents - taxCents) {
      throw new Error('The confirmed order total is outside the supported range.')
    }
    const [updated] = await tx
      .update(storeOrders)
      .set({
        shippingTotal: centsToMoney(shippingCents),
        shippingFeeConfirmed: true,
        total: centsToMoney(subtotalCents + shippingCents + taxCents),
        updatedAt: new Date(),
      })
      .where(eq(storeOrders.id, orderId))
      .returning()
    if (!updated) throw new Error('Delivery fee was not updated.')
    await tx.insert(storeActivityEvents).values({
      entityType: 'order',
      entityId: orderId,
      eventType: 'delivery_fee_confirmed',
      payload: { shippingFeeConfirmed: true },
    })
    return { success: true, total: updated.total, shippingTotal: updated.shippingTotal }
  })
}

export async function getAllCustomers(limit = 50, offset = 0, query = '') {
  await requireAdminSession()
  const pageSize = boundedLimit(limit, 50, 100)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new Error('Customer page is invalid.')
  if (typeof query !== 'string' || query.length > 100) throw new Error('Customer search is invalid.')
  const normalizedQuery = query.trim()
  const conditions = normalizedQuery
    ? or(
        ilike(storeCustomers.email, `%${normalizedQuery}%`),
        ilike(storeCustomers.firstName, `%${normalizedQuery}%`),
        ilike(storeCustomers.lastName, `%${normalizedQuery}%`),
      )
    : undefined
  const [items, countRows] = await Promise.all([
    (conditions
      ? db.select({
          id: storeCustomers.id,
          email: storeCustomers.email,
          firstName: storeCustomers.firstName,
          lastName: storeCustomers.lastName,
          phone: storeCustomers.phone,
          marketingOptIn: storeCustomers.marketingOptIn,
          createdAt: storeCustomers.createdAt,
          updatedAt: storeCustomers.updatedAt,
        }).from(storeCustomers).where(conditions)
      : db.select({
          id: storeCustomers.id,
          email: storeCustomers.email,
          firstName: storeCustomers.firstName,
          lastName: storeCustomers.lastName,
          phone: storeCustomers.phone,
          marketingOptIn: storeCustomers.marketingOptIn,
          createdAt: storeCustomers.createdAt,
          updatedAt: storeCustomers.updatedAt,
        }).from(storeCustomers))
      .orderBy(desc(storeCustomers.createdAt))
      .limit(pageSize)
      .offset(offset),
    conditions
      ? db.select({ total: sql<number>`count(*)::int` }).from(storeCustomers).where(conditions)
      : db.select({ total: sql<number>`count(*)::int` }).from(storeCustomers),
  ])
  return { items, total: Number(countRows[0]?.total ?? 0) }
}

export async function getCustomerStats() {
  await requireAdminSession()
  const [stats] = await db.select({ totalCustomers: sql<number>`count(*)::int` }).from(storeCustomers)
  return stats
}

export async function updateCustomer(
  customerId: string,
  data: Partial<Pick<typeof storeCustomers.$inferInsert, 'firstName' | 'lastName' | 'phone' | 'marketingOptIn'>>,
) {
  await requireAdminSession('admin')
  if (!data || typeof data !== 'object') throw new Error('Customer changes are required.')
  validateUuid(customerId, 'Customer ID')

  const changes: Partial<typeof storeCustomers.$inferInsert> = {}
  for (const key of ['firstName', 'lastName', 'phone'] as const) {
    const value = data[key]
    if (value !== undefined) {
      if (value !== null && (typeof value !== 'string' || value.length > 180)) {
        throw new Error(`${key} must be at most 180 characters.`)
      }
      changes[key] = value?.trim() || null
    }
  }
  if (data.marketingOptIn !== undefined) {
    if (typeof data.marketingOptIn !== 'boolean') throw new Error('Marketing preference is invalid.')
    changes.marketingOptIn = data.marketingOptIn
  }
  if (!Object.keys(changes).length) throw new Error('No customer changes were supplied.')

  return db.transaction(async (tx) => {
    const [customer] = await tx
      .update(storeCustomers)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(storeCustomers.id, customerId))
      .returning({
        id: storeCustomers.id,
        email: storeCustomers.email,
        firstName: storeCustomers.firstName,
        lastName: storeCustomers.lastName,
        phone: storeCustomers.phone,
        marketingOptIn: storeCustomers.marketingOptIn,
        createdAt: storeCustomers.createdAt,
        updatedAt: storeCustomers.updatedAt,
      })
    if (!customer) throw new Error('Customer not found.')
    await tx.insert(storeActivityEvents).values({
      entityType: 'customer',
      entityId: customerId,
      eventType: 'updated',
      payload: { updatedFields: Object.keys(changes) },
    })
    return customer
  })
}

const crmStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const

export async function getCrmLeads(limit = 50, offset = 0, query = '', status = '') {
  await requireAdminSession()
  const pageSize = boundedLimit(limit, 50, 100)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new Error('Lead page is invalid.')
  if (typeof query !== 'string' || query.length > 100) throw new Error('Lead search is invalid.')
  if (typeof status !== 'string' || (status && !crmStatuses.includes(status as (typeof crmStatuses)[number]))) {
    throw new Error('Lead status filter is invalid.')
  }
  const terms = query.trim()
  const conditions = [
    status ? eq(storeCrmLeads.status, status) : undefined,
    terms ? or(
      ilike(storeCrmLeads.fullName, `%${terms}%`),
      ilike(storeCrmLeads.email, `%${terms}%`),
      ilike(storeCrmLeads.phone, `%${terms}%`),
      ilike(storeCrmLeads.metaCampaignId, `%${terms}%`),
      ilike(storeCrmLeads.metaFormId, `%${terms}%`),
    ) : undefined,
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined
  const [leads, countRows] = await Promise.all([
    db.select({
      lead: storeCrmLeads,
      customer: {
        id: storeCustomers.id,
        email: storeCustomers.email,
        firstName: storeCustomers.firstName,
        lastName: storeCustomers.lastName,
      },
    })
      .from(storeCrmLeads)
      .leftJoin(storeCustomers, eq(storeCrmLeads.matchedCustomerId, storeCustomers.id))
      .where(where)
      .orderBy(desc(storeCrmLeads.createdAt))
      .limit(pageSize)
      .offset(offset),
    where
      ? db.select({ total: sql<number>`count(*)::int` }).from(storeCrmLeads).where(where)
      : db.select({ total: sql<number>`count(*)::int` }).from(storeCrmLeads),
  ])
  const customerIds = [...new Set(leads.flatMap(({ customer }) => customer ? [customer.id] : []))]
  const orderCounts = customerIds.length
    ? await db.select({
        customerId: storeOrders.customerId,
        orderCount: sql<number>`count(*)::int`,
      }).from(storeOrders).where(inArray(storeOrders.customerId, customerIds)).groupBy(storeOrders.customerId)
    : []
  const countsByCustomer = new Map(orderCounts.map((item) => [item.customerId, Number(item.orderCount)]))
  return {
    items: leads.map(({ lead, customer }) => ({
      ...lead,
      customer: customer ? {
        id: customer.id,
        email: customer.email,
        fullName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || null,
        orderCount: countsByCustomer.get(customer.id) ?? 0,
      } : null,
    })),
    total: Number(countRows[0]?.total ?? 0),
    metaSetup: getMetaLeadAdsSetupStatus(),
  }
}

export async function createCrmLead(input: {
  fullName: string
  email?: string
  phone?: string
  notes?: string
  followUpAt?: string
}) {
  const actor = await requireAdminSession('admin')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Lead details are required.')
  if (typeof input.fullName !== 'string') throw new Error('Lead name is required and must be at most 180 characters.')
  const optionalText = (value: unknown, label: string, maximum: number) => {
    if (value === undefined || value === null || value === '') return null
    if (typeof value !== 'string' || value.length > maximum) throw new Error(`${label} must be at most ${maximum} characters.`)
    return value.trim() || null
  }
  const fullName = input.fullName.trim()
  const email = optionalText(input.email, 'Email', 254)?.toLowerCase() ?? null
  const phone = optionalText(input.phone, 'Phone', 80)
  const notes = optionalText(input.notes, 'Notes', 5000)
  if (!fullName || fullName.length > 180) throw new Error('Lead name is required and must be at most 180 characters.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  if (input.followUpAt !== undefined && typeof input.followUpAt !== 'string') throw new Error('Follow-up date is invalid.')
  const followUpAt = input.followUpAt ? new Date(input.followUpAt) : null
  if (followUpAt && !Number.isFinite(followUpAt.getTime())) throw new Error('Follow-up date is invalid.')
  const [customer] = email
    ? await db.select({ id: storeCustomers.id }).from(storeCustomers)
        .where(sql`lower(${storeCustomers.email}) = ${email}`).limit(1)
    : []
  return db.transaction(async (tx) => {
    const [lead] = await tx.insert(storeCrmLeads).values({
      source: 'manual',
      status: 'new',
      fullName,
      email,
      phone,
      notes,
      followUpAt,
      matchedCustomerId: customer?.id ?? null,
    }).returning()
    await tx.insert(storeActivityEvents).values({
      entityType: 'crm_lead',
      entityId: lead.id,
      eventType: 'created',
      payload: { source: 'manual', actorId: actor.userId },
    })
    return lead
  })
}

export async function updateCrmLead(
  leadId: string,
  changes: { status?: string; notes?: string; followUpAt?: string | null },
) {
  const actor = await requireAdminSession('admin')
  validateUuid(leadId, 'Lead ID')
  if (!changes || typeof changes !== 'object') throw new Error('Lead changes are required.')
  const update: Partial<typeof storeCrmLeads.$inferInsert> = {}
  if (changes.status !== undefined) {
    if (!crmStatuses.includes(changes.status as (typeof crmStatuses)[number])) throw new Error('Lead status is invalid.')
    update.status = changes.status
  }
  if (changes.notes !== undefined) {
    if (typeof changes.notes !== 'string' || changes.notes.length > 5000) throw new Error('Notes must be at most 5000 characters.')
    update.notes = changes.notes.trim() || null
  }
  if (changes.followUpAt !== undefined) {
    if (changes.followUpAt === null || changes.followUpAt === '') update.followUpAt = null
    else {
      if (typeof changes.followUpAt !== 'string') throw new Error('Follow-up date is invalid.')
      const date = new Date(changes.followUpAt)
      if (!Number.isFinite(date.getTime())) throw new Error('Follow-up date is invalid.')
      update.followUpAt = date
    }
  }
  if (!Object.keys(update).length) throw new Error('No lead changes were supplied.')
  return db.transaction(async (tx) => {
    const [lead] = await tx.update(storeCrmLeads)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(storeCrmLeads.id, leadId))
      .returning()
    if (!lead) throw new Error('Lead not found.')
    await tx.insert(storeActivityEvents).values({
      entityType: 'crm_lead',
      entityId: leadId,
      eventType: 'updated',
      payload: {
        updatedFields: Object.keys(update),
        ...(update.status ? { status: update.status } : {}),
        actorId: actor.userId,
      },
    })
    return lead
  })
}

export async function getRecentActivity(limit = 20) {
  await requireAdminSession()
  return db
    .select({
      id: storeActivityEvents.id,
      entityType: storeActivityEvents.entityType,
      entityId: storeActivityEvents.entityId,
      eventType: storeActivityEvents.eventType,
      createdAt: storeActivityEvents.createdAt,
    })
    .from(storeActivityEvents)
    .orderBy(desc(storeActivityEvents.createdAt))
    .limit(boundedLimit(limit, 20, 100))
}

export async function getDashboardMetrics() {
  await requireAdminSession()
  const [orders, customers] = await Promise.all([getOrderStats(), getCustomerStats()])
  return {
    orders: {
      ...orders,
    },
    customers: { totalCustomers: Number(customers.totalCustomers) },
  }
}

const systemUserRoles = ['admin', 'staff'] as const

function validateSystemUserEmail(email: unknown) {
  if (typeof email !== 'string') throw new Error('A valid email address is required.')
  const normalizedEmail = email.trim().toLowerCase()
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('A valid email address is required.')
  }
  return normalizedEmail
}

export async function getSystemUsers() {
  await requireAdminSession('owner')
  return db
    .select({
      id: storeAdminUsers.id,
      email: storeAdminUsers.email,
      role: storeAdminUsers.role,
      isActive: storeAdminUsers.isActive,
      lastLoginAt: storeAdminUsers.lastLoginAt,
      createdAt: storeAdminUsers.createdAt,
    })
    .from(storeAdminUsers)
    .orderBy(desc(storeAdminUsers.createdAt))
}

export async function createSystemUser(input: { email: string; password: string; role: string }) {
  const actor = await requireAdminSession('owner')
  if (!input || typeof input !== 'object') throw new Error('System user details are required.')
  const email = validateSystemUserEmail(input?.email)
  if (!systemUserRoles.includes(input?.role as (typeof systemUserRoles)[number])) {
    throw new Error('Choose an admin or staff account role.')
  }
  if (typeof input.password !== 'string') throw new Error('A password is required.')
  const passwordHash = await hashAdminPassword(input.password)

  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(storeAdminUsers)
        .values({ email, passwordHash, role: input.role })
        .returning({
          id: storeAdminUsers.id,
          email: storeAdminUsers.email,
          role: storeAdminUsers.role,
          isActive: storeAdminUsers.isActive,
          lastLoginAt: storeAdminUsers.lastLoginAt,
          createdAt: storeAdminUsers.createdAt,
        })
      await tx.insert(storeActivityEvents).values({
        entityType: 'admin_user',
        entityId: user.id,
        eventType: 'created',
        payload: { role: user.role, actorId: actor.userId },
      })
      return user
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new Error('A system user with that email already exists.')
    }
    throw error
  }
}

export async function setSystemUserActive(userId: string, isActive: boolean) {
  const actor = await requireAdminSession('owner')
  validateUuid(userId, 'System user ID')
  if (typeof isActive !== 'boolean') throw new Error('Account status is invalid.')
  if (userId === actor.userId && !isActive) throw new Error('You cannot deactivate your own account.')

  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(storeAdminUsers).where(eq(storeAdminUsers.id, userId)).limit(1)
    if (!target) throw new Error('System user not found.')
    if (target.role === 'owner' && target.isActive && !isActive) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(731824615)`)
      const [owners] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(storeAdminUsers)
        .where(and(eq(storeAdminUsers.role, 'owner'), eq(storeAdminUsers.isActive, true)))
      if (owners.total <= 1) throw new Error('The last active owner account cannot be deactivated.')
    }

    const [user] = await tx
      .update(storeAdminUsers)
      .set({ isActive, sessionVersion: sql`${storeAdminUsers.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(storeAdminUsers.id, userId))
      .returning({
        id: storeAdminUsers.id,
        email: storeAdminUsers.email,
        role: storeAdminUsers.role,
        isActive: storeAdminUsers.isActive,
        lastLoginAt: storeAdminUsers.lastLoginAt,
        createdAt: storeAdminUsers.createdAt,
      })
    await tx.insert(storeActivityEvents).values({
      entityType: 'admin_user',
      entityId: userId,
      eventType: isActive ? 'activated' : 'deactivated',
      payload: { role: user.role, actorId: actor.userId },
    })
    return user
  })
}

export async function resetSystemUserPassword(userId: string, newPassword: string) {
  const actor = await requireAdminSession('owner')
  validateUuid(userId, 'System user ID')
  if (userId === actor.userId) throw new Error('Use "Update your owner login" to change your own password.')
  if (typeof newPassword !== 'string') throw new Error('A new password is required.')
  const passwordHash = await hashAdminPassword(newPassword)

  return db.transaction(async (tx) => {
    const [user] = await tx
      .update(storeAdminUsers)
      .set({ passwordHash, sessionVersion: sql`${storeAdminUsers.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(storeAdminUsers.id, userId))
      .returning({ id: storeAdminUsers.id, email: storeAdminUsers.email, role: storeAdminUsers.role })
    if (!user) throw new Error('System user not found.')
    await tx.insert(storeActivityEvents).values({
      entityType: 'admin_user',
      entityId: user.id,
      eventType: 'password_reset',
      payload: { role: user.role, actorId: actor.userId },
    })
    return { id: user.id, email: user.email }
  })
}

export async function updateOwnSystemUserCredentials(input: { email: string; password?: string }) {
  const actor = await requireAdminSession('owner')
  if (!input || typeof input !== 'object') throw new Error('Account details are required.')
  const email = validateSystemUserEmail(input.email)
  if (input.password !== undefined && typeof input.password !== 'string') {
    throw new Error('Password is invalid.')
  }
  if (email === actor.email && !input.password) throw new Error('Enter a new email or password before saving.')
  const changes: Partial<typeof storeAdminUsers.$inferInsert> = { email }
  if (input.password) changes.passwordHash = await hashAdminPassword(input.password)

  try {
    await db.transaction(async (tx) => {
      const [user] = await tx
        .update(storeAdminUsers)
        .set({
          ...changes,
          sessionVersion: sql`${storeAdminUsers.sessionVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(storeAdminUsers.id, actor.userId))
        .returning({ id: storeAdminUsers.id })
      if (!user) throw new Error('Owner account not found.')
      await tx.insert(storeActivityEvents).values({
        entityType: 'admin_user',
        entityId: user.id,
        eventType: 'credentials_updated',
        payload: { actorId: actor.userId, emailChanged: email !== actor.email, passwordChanged: Boolean(input.password) },
      })
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new Error('A system user with that email already exists.')
    }
    throw error
  }
  await clearAdminSession()
  return { email }
}

export async function createProductVariant(...args: Parameters<typeof createProductVariantImpl>) {
  const result = await createProductVariantImpl(...args)
  await invalidateCache('catalog')
  return result
}

export async function updateProductVariant(...args: Parameters<typeof updateProductVariantImpl>) {
  const result = await updateProductVariantImpl(...args)
  await invalidateCache('catalog')
  return result
}

export async function archiveProductVariant(...args: Parameters<typeof archiveProductVariantImpl>) {
  const result = await archiveProductVariantImpl(...args)
  await invalidateCache('catalog')
  return result
}

export async function updateProductStock(...args: Parameters<typeof updateProductStockImpl>) {
  const result = await updateProductStockImpl(...args)
  await invalidateCache('catalog')
  return result
}

export async function addProductAsset(...args: Parameters<typeof addProductAssetImpl>) {
  const result = await addProductAssetImpl(...args)
  await invalidateCache('catalog')
  return result
}

export async function moveProductAsset(...args: Parameters<typeof moveProductAssetImpl>) {
  const result = await moveProductAssetImpl(...args)
  await invalidateCache('catalog')
  return result
}

export async function deleteProductAsset(...args: Parameters<typeof deleteProductAssetImpl>) {
  const result = await deleteProductAssetImpl(...args)
  await invalidateCache('catalog')
  return result
}

export async function updateOrderStatus(...args: Parameters<typeof updateOrderStatusImpl>) {
  const result = await updateOrderStatusImpl(...args)
  await invalidateCache('catalog')
  return result
}

export async function getDeliverySettings(): Promise<DeliverySettings> {
  await requireAdminSession('staff')
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, 'delivery_rules')).limit(1)
  return deliverySettingsFromRules(parseDeliveryRules(row?.value ?? []))
}

export async function saveDeliverySettings(input: { deliveryFee: string; freeShippingThreshold: string }) {
  await requireAdminSession('admin')
  const rules = buildDeliveryRules(input.deliveryFee, input.freeShippingThreshold)
  await db.insert(storeSettings).values({ key: 'delivery_rules', value: rules }).onConflictDoUpdate({ target: storeSettings.key, set: { value: rules, updatedAt: new Date() } })
  await invalidateCache('catalog')
  await invalidateCache('content')
  return deliverySettingsFromRules(rules)
}
