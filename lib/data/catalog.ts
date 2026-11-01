import 'server-only'

import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import { cached } from '@/lib/cache'
import { db } from '@/lib/db'
import {
  storeBrands,
  storeCategories,
  storeLensShades,
  storeLensTypes,
  storeOrderItems,
  storeOrders,
  storeProductAssets,
  storeProductCategories,
  storeProductRelations,
  storeProductReviews,
  storeProducts,
  storeProductVariants,
  storeSettings,
} from '@/lib/db/schema'
import {
  buildCategoryPaths,
  DEFAULT_PRODUCT_PAGE,
  descendantIds,
  SECTION_SOURCES,
  type CategoryNode,
  type ProductPageSettings,
} from '@/lib/catalog-types'

export const CATALOG_NAMESPACE = 'catalog'

type ProductImageCandidate = {
  brandId: string | null
  lensShadeId: string | null
  lensTypeId: string | null
  categoryIds: string[]
  imageUrl: string
}

let productImageCandidatesInFlight: Promise<ProductImageCandidate[]> | null = null

function getProductImageCandidates() {
  if (productImageCandidatesInFlight) return productImageCandidatesInFlight
  const request = cached(CATALOG_NAMESPACE, 'product-image-candidates', 300, async () => {
    const products = await db
      .select({
        id: storeProducts.id,
        brandId: storeProducts.brandId,
        lensShadeId: storeProducts.lensShadeId,
        lensTypeId: storeProducts.lensTypeId,
        categoryId: storeProducts.categoryId,
        heroImageUrl: storeProducts.heroImageUrl,
      })
      .from(storeProducts)
      .where(eq(storeProducts.status, 'active'))
      .orderBy(desc(storeProducts.createdAt), desc(storeProducts.id))
    if (!products.length) return []

    const productIds = products.map((product) => product.id)
    const [assignments, assets] = await Promise.all([
      db.select({ productId: storeProductCategories.productId, categoryId: storeProductCategories.categoryId })
        .from(storeProductCategories)
        .where(inArray(storeProductCategories.productId, productIds)),
      db.select({
        productId: storeProductAssets.productId,
        blobUrl: storeProductAssets.blobUrl,
      })
        .from(storeProductAssets)
        .where(and(
          inArray(storeProductAssets.productId, productIds),
          eq(storeProductAssets.mediaType, 'image'),
        ))
        .orderBy(asc(storeProductAssets.sortOrder), asc(storeProductAssets.createdAt), asc(storeProductAssets.id)),
    ])
    const categoryIdsByProduct = new Map<string, Set<string>>()
    for (const product of products) {
      if (product.categoryId) categoryIdsByProduct.set(product.id, new Set([product.categoryId]))
    }
    for (const assignment of assignments) {
      const categories = categoryIdsByProduct.get(assignment.productId) ?? new Set<string>()
      categories.add(assignment.categoryId)
      categoryIdsByProduct.set(assignment.productId, categories)
    }
    const firstAssetByProduct = new Map<string, string>()
    for (const asset of assets) {
      if (asset.blobUrl?.trim() && !firstAssetByProduct.has(asset.productId)) {
        firstAssetByProduct.set(asset.productId, asset.blobUrl)
      }
    }

    return products.flatMap((product) => {
      const imageUrl = product.heroImageUrl?.trim() || firstAssetByProduct.get(product.id)
      return imageUrl ? [{
        brandId: product.brandId,
        lensShadeId: product.lensShadeId,
        lensTypeId: product.lensTypeId,
        categoryIds: [...(categoryIdsByProduct.get(product.id) ?? [])],
        imageUrl,
      }] : []
    })
  })
  productImageCandidatesInFlight = request.finally(() => {
    productImageCandidatesInFlight = null
  })
  return productImageCandidatesInFlight
}

async function loadCategories(): Promise<CategoryNode[]> {
  const [rows, counts, imageCandidates] = await Promise.all([
    db.select().from(storeCategories).where(eq(storeCategories.isActive, true)).orderBy(asc(storeCategories.sortOrder), asc(storeCategories.name)),
    db
      .select({ categoryId: storeProductCategories.categoryId, count: sql<number>`count(distinct ${storeProducts.id})::int` })
      .from(storeProductCategories)
      .innerJoin(storeProducts, eq(storeProducts.id, storeProductCategories.productId))
      .where(eq(storeProducts.status, 'active'))
      .groupBy(storeProductCategories.categoryId),
    getProductImageCandidates(),
  ])
  const direct = new Map(counts.map((row) => [row.categoryId, row.count]))
  const nodes = buildCategoryPaths(rows.map((row) => ({
    id: row.id, parentId: row.parentId, name: row.name, slug: row.slug, description: row.description,
    imageUrl: row.imageUrl, sortOrder: row.sortOrder, isActive: row.isActive, showInMenu: row.showInMenu,
  })))
  return nodes.map((node) => {
    const branch = descendantIds(nodes, node.id)
    let productCount = 0
    for (const id of branch) productCount += direct.get(id) ?? 0
    const fallbackImageUrl = imageCandidates.find((product) => product.categoryIds.some((id) => branch.has(id)))?.imageUrl ?? null
    return { ...node, fallbackImageUrl, productCount }
  })
}

export function getCategories() {
  return cached(CATALOG_NAMESPACE, 'categories:product-image-fallback-v1', 600, loadCategories)
}

const productColumns = {
  id: storeProducts.id,
  name: storeProducts.name,
  slug: storeProducts.slug,
  description: storeProducts.description,
  shortDescription: storeProducts.shortDescription,
  categoryId: storeProducts.categoryId,
  brandId: storeProducts.brandId,
  lensShadeId: storeProducts.lensShadeId,
  lensTypeId: storeProducts.lensTypeId,
  category: storeCategories.name,
  brand: storeProducts.brand,
  sku: storeProducts.sku,
  price: storeProducts.price,
  compareAtPrice: storeProducts.compareAtPrice,
  currency: storeProducts.currency,
  status: storeProducts.status,
  stockQuantity: storeProducts.stockQuantity,
  heroImageUrl: storeProducts.heroImageUrl,
  colors: storeProducts.colors,
  diameterMm: storeProducts.diameterMm,
  baseCurve: storeProducts.baseCurve,
  waterContent: storeProducts.waterContent,
  material: storeProducts.material,
  wearDuration: storeProducts.wearDuration,
  packContents: storeProducts.packContents,
  powerType: storeProducts.powerType,
  powerRange: storeProducts.powerRange,
  availablePowerRanges: storeProducts.availablePowerRanges,
  uvProtection: storeProducts.uvProtection,
  fdaApproved: storeProducts.fdaApproved,
  features: storeProducts.features,
  specs: storeProducts.specs,
  usageInstructions: storeProducts.usageInstructions,
  isFeatured: storeProducts.isFeatured,
  isNewArrival: storeProducts.isNewArrival,
  isOnSale: storeProducts.isOnSale,
  seoTitle: storeProducts.seoTitle,
  seoDescription: storeProducts.seoDescription,
  createdAt: storeProducts.createdAt,
  updatedAt: storeProducts.updatedAt,
}

async function enrich<T extends { id: string; categoryId: string | null; lensShadeId: string | null; lensTypeId: string | null }>(products: T[]) {
  const ids = products.map((product) => product.id)
  if (!ids.length) return []
  const [assets, variants, ratings, categories, assignments, shades, types, imageCandidates] = await Promise.all([
    db.select().from(storeProductAssets).where(inArray(storeProductAssets.productId, ids)).orderBy(asc(storeProductAssets.sortOrder), asc(storeProductAssets.createdAt)),
    db.select().from(storeProductVariants).where(and(inArray(storeProductVariants.productId, ids), eq(storeProductVariants.isActive, true))).orderBy(asc(storeProductVariants.price)),
    db
      .select({ productId: storeProductReviews.productId, avg: sql<string>`avg(${storeProductReviews.rating})`, count: sql<number>`count(*)::int` })
      .from(storeProductReviews)
      .where(and(inArray(storeProductReviews.productId, ids), eq(storeProductReviews.isApproved, true)))
      .groupBy(storeProductReviews.productId),
    getCategories(),
    db.select({ productId: storeProductCategories.productId, categoryId: storeProductCategories.categoryId, name: storeCategories.name })
      .from(storeProductCategories)
      .innerJoin(storeCategories, eq(storeCategories.id, storeProductCategories.categoryId))
      .where(inArray(storeProductCategories.productId, ids)),
    db.select().from(storeLensShades).where(inArray(storeLensShades.id, products.map((product) => product.lensShadeId).filter((id): id is string => Boolean(id)))),
    db.select().from(storeLensTypes).where(inArray(storeLensTypes.id, products.map((product) => product.lensTypeId).filter((id): id is string => Boolean(id)))),
    getProductImageCandidates(),
  ])
  const group = <R extends { productId: string }>(rows: R[]) => {
    const map = new Map<string, R[]>()
    for (const row of rows) map.set(row.productId, [...(map.get(row.productId) ?? []), row])
    return map
  }
  const assetMap = group(assets)
  const variantMap = group(variants)
  const ratingMap = new Map(ratings.map((row) => [row.productId, row]))
  const pathMap = new Map(categories.map((category) => [category.id, category.path]))
  const assigned = new Map<string, Array<{ id: string; name: string }>>()
  for (const row of assignments) assigned.set(row.productId, [...(assigned.get(row.productId) ?? []), { id: row.categoryId, name: row.name }])
  const shadesById = new Map(shades.map((shade) => [shade.id, {
    ...shade,
    fallbackImageUrl: imageCandidates.find((candidate) => candidate.lensShadeId === shade.id)?.imageUrl ?? null,
  }]))
  const typesById = new Map(types.map((type) => [type.id, type]))
  return products.map((product) => ({
    ...product,
    categoryPath: product.categoryId ? pathMap.get(product.categoryId) ?? '' : '',
    categoryIds: assigned.get(product.id)?.map((category) => category.id) ?? (product.categoryId ? [product.categoryId] : []),
    categories: assigned.get(product.id) ?? [],
    lensShade: product.lensShadeId ? shadesById.get(product.lensShadeId) ?? null : null,
    lensType: product.lensTypeId ? typesById.get(product.lensTypeId) ?? null : null,
    assets: assetMap.get(product.id) ?? [],
    variants: variantMap.get(product.id) ?? [],
    ratingAvg: ratingMap.get(product.id) ? Math.round(Number(ratingMap.get(product.id)!.avg) * 10) / 10 : null,
    ratingCount: ratingMap.get(product.id)?.count ?? 0,
  }))
}

type CatalogSort = 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'featured'

async function buildCatalogConditions(
  categorySlug: string | null,
  query: string | null,
  brandSlug: string | null,
  lensShadeId: string | null = null,
  lensTypeId: string | null = null,
) {
  const conditions = [eq(storeProducts.status, 'active')]
  if (categorySlug) {
    const all = await getCategories()
    const target = all.find((category) => category.slug === categorySlug)
    if (!target) return null
    const matchingCategoryIds = [...descendantIds(all, target.id)]
    conditions.push(inArray(storeProducts.id, db.select({ productId: storeProductCategories.productId }).from(storeProductCategories).where(inArray(storeProductCategories.categoryId, matchingCategoryIds))))
  }
  if (query) {
    const like = `%${query.replace(/[%_\\]/g, '\\$&')}%`
    conditions.push(or(
      ilike(storeProducts.name, like),
      ilike(storeProducts.brand, like),
      ilike(storeProducts.description, like),
      ilike(storeCategories.name, like),
      ilike(storeLensShades.name, like),
      ilike(storeLensTypes.name, like),
    )!)
  }
  if (brandSlug) conditions.push(eq(storeBrands.slug, brandSlug), eq(storeBrands.isActive, true))
  if (lensShadeId) conditions.push(eq(storeProducts.lensShadeId, lensShadeId))
  if (lensTypeId) conditions.push(eq(storeProducts.lensTypeId, lensTypeId))
  return conditions
}

function catalogQuery(conditions: NonNullable<Awaited<ReturnType<typeof buildCatalogConditions>>>) {
  return db
    .select(productColumns)
    .from(storeProducts)
    .leftJoin(storeCategories, eq(storeCategories.id, storeProducts.categoryId))
    .leftJoin(storeBrands, eq(storeBrands.id, storeProducts.brandId))
    .leftJoin(storeLensShades, eq(storeLensShades.id, storeProducts.lensShadeId))
    .leftJoin(storeLensTypes, eq(storeLensTypes.id, storeProducts.lensTypeId))
    .where(and(...conditions))
}

async function loadCatalog(categorySlug: string | null, query: string | null, brandSlug: string | null) {
  const conditions = await buildCatalogConditions(categorySlug, query, brandSlug)
  if (!conditions) return []
  const rows = await catalogQuery(conditions).orderBy(desc(storeProducts.createdAt))
  return enrich(rows)
}

async function loadCatalogPage(
  categorySlug: string | null,
  query: string | null,
  brandSlug: string | null,
  page: number,
  pageSize: number,
  lensShadeId: string | null,
  lensTypeId: string | null,
  sort: CatalogSort,
) {
  const conditions = await buildCatalogConditions(categorySlug, query, brandSlug, lensShadeId, lensTypeId)
  if (!conditions) return { data: [], total: 0, page, pageSize, totalPages: 0 }

  const orderBy = {
    newest: [desc(storeProducts.createdAt), asc(storeProducts.name)],
    price_asc: [asc(storeProducts.price), asc(storeProducts.name)],
    price_desc: [desc(storeProducts.price), asc(storeProducts.name)],
    name_asc: [asc(storeProducts.name)],
    featured: [desc(storeProducts.isFeatured), desc(storeProducts.createdAt)],
  }[sort]
  const [rows, countRows] = await Promise.all([
    catalogQuery(conditions)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(distinct ${storeProducts.id})::int` })
      .from(storeProducts)
      .leftJoin(storeCategories, eq(storeCategories.id, storeProducts.categoryId))
      .leftJoin(storeBrands, eq(storeBrands.id, storeProducts.brandId))
      .leftJoin(storeLensShades, eq(storeLensShades.id, storeProducts.lensShadeId))
      .leftJoin(storeLensTypes, eq(storeLensTypes.id, storeProducts.lensTypeId))
      .where(and(...conditions)),
  ])
  const total = countRows[0]?.total ?? 0
  return {
    data: await enrich(rows),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export function getCatalogPage(
  category: string | null,
  query: string | null,
  brand: string | null,
  page: number,
  pageSize: number,
  lensShadeId: string | null = null,
  lensTypeId: string | null = null,
  sort: CatalogSort = 'newest',
) {
  return cached(
    CATALOG_NAMESPACE,
    `products-page:image-fallback-v1:${category ?? ''}:${(query ?? '').toLowerCase()}:${brand ?? ''}:${lensShadeId ?? ''}:${lensTypeId ?? ''}:${sort}:${page}:${pageSize}`,
    60,
    () => loadCatalogPage(category, query, brand, page, pageSize, lensShadeId, lensTypeId, sort),
  )
}

export function getCatalog(category: string | null = null, query: string | null = null, brand: string | null = null) {
  return cached(CATALOG_NAMESPACE, `products:image-fallback-v1:${category ?? ''}:${(query ?? '').toLowerCase()}:${brand ?? ''}`, 300, () => loadCatalog(category, query, brand))
}

export type CatalogProduct = Awaited<ReturnType<typeof loadCatalog>>[number]
export type StorefrontBrand = Awaited<ReturnType<typeof getStorefrontBrands>>[number]

async function loadHomeCatalog() {
  const loadProducts = (selection?: typeof storeProducts.isFeatured | typeof storeProducts.isNewArrival | typeof storeProducts.isOnSale) => {
    const conditions = [eq(storeProducts.status, 'active')]
    if (selection) conditions.push(eq(selection, true))
    return db
      .select(productColumns)
      .from(storeProducts)
      .leftJoin(storeCategories, eq(storeCategories.id, storeProducts.categoryId))
      .where(and(...conditions))
      .orderBy(desc(storeProducts.isFeatured), desc(storeProducts.isNewArrival), desc(storeProducts.isOnSale), desc(storeProducts.createdAt))
      .limit(selection ? 4 : 12)
  }
  const [catalog, featured, arrivals, onSale] = await Promise.all([
    loadProducts(),
    loadProducts(storeProducts.isFeatured),
    loadProducts(storeProducts.isNewArrival),
    loadProducts(storeProducts.isOnSale),
  ])
  const uniqueProducts = new Map([...catalog, ...featured, ...arrivals, ...onSale].map((product) => [product.id, product]))
  const rows = [...uniqueProducts.values()]
  const products = await enrich(rows)
  return products.map((product) => ({
    ...product,
    createdAt: typeof product.createdAt === 'string' ? product.createdAt : product.createdAt.toISOString(),
    updatedAt: typeof product.updatedAt === 'string' ? product.updatedAt : product.updatedAt.toISOString(),
  }))
}

export function getHomeCatalog() {
  return cached(CATALOG_NAMESPACE, 'home-products:image-fallback-v1', 300, loadHomeCatalog)
}

async function loadStorefrontBrands() {
  const brandsQuery = db
    .select({
      id: storeBrands.id,
      name: storeBrands.name,
      slug: storeBrands.slug,
      logoUrl: storeBrands.logoUrl,
      productCount: sql<number>`count(distinct case when ${storeProducts.status} = 'active' then ${storeProducts.id} end)::int`,
    })
    .from(storeBrands)
    .leftJoin(storeProducts, eq(storeProducts.brandId, storeBrands.id))
    .where(eq(storeBrands.isActive, true))
    .groupBy(storeBrands.id, storeBrands.name, storeBrands.slug, storeBrands.logoUrl)
    .orderBy(asc(storeBrands.name))
  const [brands, imageCandidates] = await Promise.all([brandsQuery, getProductImageCandidates()])
  return brands.map((brand) => ({
    ...brand,
    fallbackImageUrl: imageCandidates.find((product) => product.brandId === brand.id)?.imageUrl ?? null,
  }))
}

export function getStorefrontBrands() {
  return cached(CATALOG_NAMESPACE, 'storefront-brands:image-fallback-v1', 300, loadStorefrontBrands)
}

async function loadStorefrontShades() {
  const shadesQuery = db
    .select({
      id: storeLensShades.id,
      name: storeLensShades.name,
      hex: storeLensShades.hex,
      imageUrl: storeLensShades.imageUrl,
      productCount: sql<number>`count(${storeProducts.id})::int`,
    })
    .from(storeLensShades)
    .innerJoin(storeProducts, and(eq(storeProducts.lensShadeId, storeLensShades.id), eq(storeProducts.status, 'active')))
    .where(eq(storeLensShades.isActive, true))
    .groupBy(storeLensShades.id, storeLensShades.name, storeLensShades.hex, storeLensShades.imageUrl)
    .orderBy(asc(storeLensShades.name))
  const [shades, imageCandidates] = await Promise.all([shadesQuery, getProductImageCandidates()])
  return shades.map((shade) => ({
    ...shade,
    fallbackImageUrl: imageCandidates.find((product) => product.lensShadeId === shade.id)?.imageUrl ?? null,
  }))
}

export function getStorefrontShades() {
  return cached(CATALOG_NAMESPACE, 'storefront-shades:image-fallback-v1', 300, loadStorefrontShades)
}

async function loadStorefrontLensTypes() {
  const typesQuery = db
    .select({
      id: storeLensTypes.id,
      name: storeLensTypes.name,
      productCount: sql<number>`count(${storeProducts.id})::int`,
    })
    .from(storeLensTypes)
    .leftJoin(storeProducts, and(eq(storeProducts.lensTypeId, storeLensTypes.id), eq(storeProducts.status, 'active')))
    .where(eq(storeLensTypes.isActive, true))
    .groupBy(storeLensTypes.id, storeLensTypes.name)
    .orderBy(asc(storeLensTypes.name))
  const [types, imageCandidates] = await Promise.all([typesQuery, getProductImageCandidates()])
  return types.map((type) => ({
    ...type,
    fallbackImageUrl: imageCandidates.find((product) => product.lensTypeId === type.id)?.imageUrl ?? null,
  }))
}

export function getStorefrontLensTypes() {
  return cached(CATALOG_NAMESPACE, 'storefront-lens-types:image-fallback-v1', 300, loadStorefrontLensTypes)
}

async function loadStorefrontReviews() {
  return db
    .select({
      id: storeProductReviews.id,
      author: storeProductReviews.author,
      body: storeProductReviews.body,
      rating: storeProductReviews.rating,
      title: storeProductReviews.title,
      createdAt: storeProductReviews.createdAt,
    })
    .from(storeProductReviews)
    .innerJoin(storeProducts, eq(storeProducts.id, storeProductReviews.productId))
    .where(and(eq(storeProductReviews.isApproved, true), eq(storeProducts.status, 'active')))
    .orderBy(desc(storeProductReviews.createdAt))
    .limit(8)
}

export function getStorefrontReviews() {
  return cached(CATALOG_NAMESPACE, 'storefront-reviews', 300, loadStorefrontReviews)
}

async function loadProduct(slug: string) {
  const [row] = await db
    .select(productColumns)
    .from(storeProducts)
    .leftJoin(storeCategories, eq(storeCategories.id, storeProducts.categoryId))
    .where(and(eq(storeProducts.slug, slug), eq(storeProducts.status, 'active')))
    .limit(1)
  if (!row) return null
  return (await enrich([row]))[0]
}

export function getProduct(slug: string) {
  return cached(CATALOG_NAMESPACE, `product:image-fallback-v1:${slug}`, 300, () => loadProduct(slug))
}

export async function getProductPageSettings(): Promise<ProductPageSettings> {
  return cached('content', 'product_page', 300, async () => {
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, 'product_page')).limit(1)
    const value = row?.value as Partial<ProductPageSettings> | undefined
    if (!value || !Array.isArray(value.sections)) return DEFAULT_PRODUCT_PAGE
    return { sections: value.sections, reviews: { ...DEFAULT_PRODUCT_PAGE.reviews, ...(value.reviews ?? {}) } }
  })
}

export async function getApprovedReviews(productId: string) {
  return db
    .select({ id: storeProductReviews.id, author: storeProductReviews.author, rating: storeProductReviews.rating, title: storeProductReviews.title, body: storeProductReviews.body, createdAt: storeProductReviews.createdAt })
    .from(storeProductReviews)
    .where(and(eq(storeProductReviews.productId, productId), eq(storeProductReviews.isApproved, true)))
    .orderBy(desc(storeProductReviews.createdAt))
    .limit(50)
}

async function activeByIds(ids: string[]) {
  if (!ids.length) return []
  const rows = await db
    .select(productColumns)
    .from(storeProducts)
    .leftJoin(storeCategories, eq(storeCategories.id, storeProducts.categoryId))
    .where(and(inArray(storeProducts.id, ids), eq(storeProducts.status, 'active')))
  const order = new Map(ids.map((id, index) => [id, index]))
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return enrich(rows)
}

const activeOrders = ne(storeOrders.status, 'cancelled')

async function idsFor(source: (typeof SECTION_SOURCES)[number], product: { id: string; categoryId: string | null }, limit: number) {
  const overfetch = limit + 8
  switch (source) {
    case 'manual': {
      const rows = await db.select({ id: storeProductRelations.relatedProductId }).from(storeProductRelations).where(eq(storeProductRelations.productId, product.id)).orderBy(asc(storeProductRelations.sortOrder))
      return rows.map((row) => row.id)
    }
    case 'same_category': {
      if (!product.categoryId) return []
      const rows = await db.select({ id: storeProducts.id }).from(storeProducts).where(and(eq(storeProducts.categoryId, product.categoryId), eq(storeProducts.status, 'active'), ne(storeProducts.id, product.id))).orderBy(desc(storeProducts.createdAt)).limit(overfetch)
      return rows.map((row) => row.id)
    }
    case 'co_purchased': {
      const mine = db.select({ orderId: storeOrderItems.orderId }).from(storeOrderItems).where(eq(storeOrderItems.productId, product.id))
      const rows = await db
        .select({ id: storeOrderItems.productId, n: sql<number>`sum(${storeOrderItems.quantity})` })
        .from(storeOrderItems)
        .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
        .where(and(inArray(storeOrderItems.orderId, mine), ne(storeOrderItems.productId, product.id), activeOrders))
        .groupBy(storeOrderItems.productId)
        .orderBy(desc(sql`sum(${storeOrderItems.quantity})`))
        .limit(overfetch)
      return rows.map((row) => row.id)
    }
    case 'best_selling': {
      const rows = await db
        .select({ id: storeOrderItems.productId })
        .from(storeOrderItems)
        .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
        .where(and(ne(storeOrderItems.productId, product.id), activeOrders))
        .groupBy(storeOrderItems.productId)
        .orderBy(desc(sql`sum(${storeOrderItems.quantity})`))
        .limit(overfetch)
      return rows.map((row) => row.id)
    }
    case 'recent_orders': {
      const rows = await db
        .select({ id: storeOrderItems.productId, at: sql<string>`max(${storeOrders.createdAt})` })
        .from(storeOrderItems)
        .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
        .where(and(ne(storeOrderItems.productId, product.id), activeOrders))
        .groupBy(storeOrderItems.productId)
        .orderBy(desc(sql`max(${storeOrders.createdAt})`))
        .limit(overfetch)
      return rows.map((row) => row.id)
    }
    case 'featured': {
      const rows = await db.select({ id: storeProducts.id }).from(storeProducts).where(and(eq(storeProducts.isFeatured, true), eq(storeProducts.status, 'active'), ne(storeProducts.id, product.id))).orderBy(desc(storeProducts.updatedAt)).limit(overfetch)
      return rows.map((row) => row.id)
    }
    case 'newest': {
      const rows = await db.select({ id: storeProducts.id }).from(storeProducts).where(and(eq(storeProducts.status, 'active'), ne(storeProducts.id, product.id))).orderBy(desc(storeProducts.createdAt)).limit(overfetch)
      return rows.map((row) => row.id)
    }
  }
}

/** Resolves every enabled product-page section (configured in admin) into product lists. */
export function getProductSections(product: { id: string; categoryId: string | null }) {
  return cached(CATALOG_NAMESPACE, `sections:image-fallback-v1:${product.id}`, 300, async () => {
    const settings = await getProductPageSettings()
    const sections = []
    const shown = new Set<string>()
    for (const section of settings.sections.filter((item) => item.enabled)) {
      const ids = (await idsFor(section.source, product, section.limit)).filter((id) => !shown.has(id) || section.source === 'manual')
      const products = (await activeByIds(ids)).slice(0, section.limit)
      if (!products.length) continue
      products.forEach((item) => shown.add(item.id))
      sections.push({ id: section.id, title: section.title, products })
    }
    return sections
  })
}

export async function getProductsByIds(ids: string[]) {
  return activeByIds(ids)
}
