import 'server-only'

import { and, asc, eq, gt, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { db, readDb } from '@/lib/db'
import { storeCategories, storeLensTypes, storeProductCategories, storeProducts } from '@/lib/db/schema'
import { getSettings } from '@/lib/data/site-content'
import {
  normalizeFreeGiftConfig,
  resolveGiftCategoryId,
  type FreeGiftOffer,
} from '@/lib/free-gift'

export const FREE_GIFT_MINIMUM_SUBTOTAL_CENTS = 250_000

export async function getFreeGiftOffer(): Promise<FreeGiftOffer> {
  const settings = await getSettings()
  const config = normalizeFreeGiftConfig(settings.free_gift)
  if (!config.enabled) return { config, categoryId: null, minimumSubtotalCents: FREE_GIFT_MINIMUM_SUBTOTAL_CENTS, products: [] }

  const categories = await readDb
    .select({ id: storeCategories.id, name: storeCategories.name, slug: storeCategories.slug })
    .from(storeCategories)
    .where(eq(storeCategories.isActive, true))
  const categoryId = resolveGiftCategoryId(config, categories)
  if (!categoryId) return { config, categoryId: null, minimumSubtotalCents: FREE_GIFT_MINIMUM_SUBTOTAL_CENTS, products: [] }

  const rows = await readDb
    .select({
      id: storeProducts.id,
      name: storeProducts.name,
      slug: storeProducts.slug,
      price: storeProducts.price,
      currency: storeProducts.currency,
      heroImageUrl: storeProducts.heroImageUrl,
      sourceImageUrl: storeProducts.sourceImageUrl,
    })
    .from(storeProducts)
    .leftJoin(storeLensTypes, eq(storeProducts.lensTypeId, storeLensTypes.id))
    .leftJoin(storeProductCategories, and(
      eq(storeProductCategories.productId, storeProducts.id),
      eq(storeProductCategories.categoryId, categoryId),
    ))
    .where(and(
      eq(storeProducts.status, 'active'),
      gt(storeProducts.stockQuantity, 0),
      or(eq(storeProducts.categoryId, categoryId), isNotNull(storeProductCategories.productId)),
      sql`(${storeLensTypes.name} IS NULL OR lower(btrim(${storeLensTypes.name})) <> 'toric')`,
    ))
    .orderBy(asc(storeProducts.name))
    .limit(40)
  return {
    config,
    categoryId,
    minimumSubtotalCents: FREE_GIFT_MINIMUM_SUBTOTAL_CENTS,
    products: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      price: row.price,
      currency: row.currency,
      imageUrl: row.heroImageUrl ?? row.sourceImageUrl ?? null,
    })),
  }
}

export async function isGiftEligibleProduct(productIds: string[], categoryId: string) {
  if (!productIds.length) return new Set<string>()
  const rows = await db
    .select({ id: storeProducts.id, categoryId: storeProducts.categoryId })
    .from(storeProducts)
    .where(inArray(storeProducts.id, productIds))
  const memberships = await db
    .select({ productId: storeProductCategories.productId })
    .from(storeProductCategories)
    .where(and(eq(storeProductCategories.categoryId, categoryId), inArray(storeProductCategories.productId, productIds)))
  const member = new Set(memberships.map((row) => row.productId))
  return new Set(rows.filter((row) => row.categoryId === categoryId || member.has(row.id)).map((row) => row.id))
}
