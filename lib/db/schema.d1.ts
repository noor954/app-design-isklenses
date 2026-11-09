import { randomUUID } from 'node:crypto'
import { desc, sql } from 'drizzle-orm'
import {
  blob,
  customType,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const uuid = (name = 'id') => text(name).$defaultFn(() => randomUUID())
const timestamp = customType<{ data: Date; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value) => value.toISOString(),
  fromDriver: (value) => new Date(value),
})
const money = customType<{ data: string; driverData: number }>({
  dataType: () => 'integer',
  toDriver: (value) => {
    const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value)
    if (!match) {
      throw new Error('Money value must be a non-negative decimal with at most two fractional digits.')
    }
    const minorUnits = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
    if (!Number.isSafeInteger(minorUnits)) {
      throw new Error('Money value is outside the supported range.')
    }
    return minorUnits
  },
  fromDriver: (value) => {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('Stored money value is invalid.')
    }
    return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`
  },
})

export const storeCategories = sqliteTable('store_categories', {
  id: uuid().primaryKey(),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  sourceCategoryId: integer('source_category_id'),
  sourceImageUrl: text('source_image_url'),
  description: text('description'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  showInMenu: integer('show_in_menu', { mode: 'boolean' }).notNull().default(true),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  sourceCategoryUnique: uniqueIndex('store_categories_source_category_id_unique').on(table.sourceCategoryId),
  nameUnique: uniqueIndex('store_categories_lower_name_unique').on(sql`lower(trim(${table.name}))`),
  parentIdx: index('store_categories_parent_idx').on(table.parentId, table.sortOrder),
}))

export const storeBrands = sqliteTable('store_brands', {
  id: uuid().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  logoUrl: text('logo_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameUnique: uniqueIndex('store_brands_lower_name_unique').on(sql`lower(${table.name})`),
}))

export const storeLensShades = sqliteTable('store_lens_shades', {
  id: uuid().primaryKey(),
  name: text('name').notNull(),
  hex: text('hex'),
  imageUrl: text('image_url'),
  sourceImageUrl: text('source_image_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameColorUnique: uniqueIndex('store_lens_shades_lower_name_hex_unique')
    .on(sql`lower(${table.name})`, table.hex),
  nameWithoutHexUnique: uniqueIndex('store_lens_shades_lower_name_no_hex_unique')
    .on(sql`lower(${table.name})`)
    .where(sql`${table.hex} IS NULL`),
}))

export const storeLensTypes = sqliteTable('store_lens_types', {
  id: uuid().primaryKey(),
  name: text('name').notNull(),
  sourceCategoryId: integer('source_category_id'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameUnique: uniqueIndex('store_lens_types_lower_name_unique').on(sql`lower(${table.name})`),
  sourceCategoryUnique: uniqueIndex('store_lens_types_source_category_id_unique')
    .on(table.sourceCategoryId)
    .where(sql`${table.sourceCategoryId} IS NOT NULL`),
}))

export const storeProducts = sqliteTable('store_products', {
  id: uuid().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  categoryId: text('category_id').references(() => storeCategories.id, { onDelete: 'set null' }),
  brandId: text('brand_id').references(() => storeBrands.id, { onDelete: 'set null' }),
  lensShadeId: text('lens_shade_id').references(() => storeLensShades.id, { onDelete: 'set null' }),
  lensTypeId: text('lens_type_id').references(() => storeLensTypes.id, { onDelete: 'set null' }),
  sourceProductId: integer('source_product_id'),
  sourceUrl: text('source_url'),
  sourcePayload: text('source_payload', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  sourceContentHash: text('source_content_hash'),
  sourceImageUrl: text('source_image_url'),
  brand: text('brand'),
  sku: text('sku'),
  shortDescription: text('short_description'),
  price: money('price_minor').notNull(),
  compareAtPrice: money('compare_at_price_minor'),
  currency: text('currency').notNull().default('PKR'),
  status: text('status').notNull().default('active'),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  heroImageUrl: text('hero_image_url'),
  colors: text('colors', { mode: 'json' }).$type<{ name: string; hex: string }[]>().notNull().default([]),
  diameterMm: real('diameter_mm'),
  baseCurve: real('base_curve'),
  waterContent: text('water_content'),
  material: text('material'),
  wearDuration: text('wear_duration'),
  packContents: text('pack_contents'),
  powerType: text('power_type'),
  powerRange: text('power_range'),
  availablePowerRanges: text('available_power_ranges', { mode: 'json' }).$type<string[]>().notNull().default([]),
  uvProtection: integer('uv_protection', { mode: 'boolean' }).notNull().default(false),
  fdaApproved: integer('fda_approved', { mode: 'boolean' }).notNull().default(false),
  features: text('features', { mode: 'json' }).$type<string[]>().notNull().default([]),
  specs: text('specs', { mode: 'json' }).$type<{ label: string; value: string }[]>().notNull().default([]),
  usageInstructions: text('usage_instructions'),
  isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
  isNewArrival: integer('is_new_arrival', { mode: 'boolean' }).notNull().default(false),
  isOnSale: integer('is_on_sale', { mode: 'boolean' }).notNull().default(false),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  sourceProductUnique: uniqueIndex('store_products_source_product_id_unique').on(table.sourceProductId),
  categoryIdx: index('store_products_category_idx').on(table.categoryId, table.status),
  statusIdx: index('store_products_status_idx').on(table.status),
  lensTypeIdx: index('store_products_lens_type_id_idx').on(table.lensTypeId),
  skuUnique: uniqueIndex('store_products_sku_unique')
    .on(table.sku)
    .where(sql`${table.sku} IS NOT NULL`),
}))

export const storeProductViewers = sqliteTable('store_product_viewers', {
  productId: text('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  viewerHash: text('viewer_hash').notNull(),
  lastSeenAt: timestamp('last_seen_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey({ columns: [table.productId, table.viewerHash] }),
  lastSeenIndex: index('store_product_viewers_last_seen_idx').on(table.lastSeenAt),
}))

export const storeProductCategories = sqliteTable('store_product_categories', {
  productId: text('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => storeCategories.id, { onDelete: 'restrict' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.productId, table.categoryId] }),
  categoryIdx: index('store_product_categories_category_idx').on(table.categoryId, table.productId),
}))

export const storeProductReviews = sqliteTable('store_product_reviews', {
  id: uuid().primaryKey(),
  productId: text('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  author: text('author').notNull(),
  rating: integer('rating').notNull(),
  title: text('title'),
  body: text('body').notNull(),
  isApproved: integer('is_approved', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  productIdx: index('store_product_reviews_product_idx')
    .on(table.productId, table.isApproved, desc(table.createdAt)),
}))

export const storeProductRelations = sqliteTable('store_product_relations', {
  productId: text('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  relatedProductId: text('related_product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.productId, table.relatedProductId] }),
}))

export const storeCustomers = sqliteTable('store_customers', {
  id: uuid().primaryKey(),
  email: text('email').unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  passwordHash: text('password_hash'),
  sessionVersion: integer('session_version').notNull().default(1),
  marketingOptIn: integer('marketing_opt_in', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  normalizedEmailUnique: uniqueIndex('store_customers_lower_email_unique').on(sql`lower(${table.email})`),
}))

export const storeOrders = sqliteTable('store_orders', {
  id: uuid().primaryKey(),
  orderNumber: integer('order_number').notNull().unique(),
  customerId: text('customer_id').notNull(),
  status: text('status').notNull().default('pending'),
  paymentMethod: text('payment_method'),
  shippingFeeConfirmed: integer('shipping_fee_confirmed', { mode: 'boolean' }).notNull().default(false),
  subtotal: money('subtotal_minor').notNull(),
  shippingTotal: money('shipping_total_minor').notNull().default('0.00'),
  taxTotal: money('tax_total_minor').notNull().default('0.00'),
  total: money('total_minor').notNull(),
  currency: text('currency').notNull().default('USD'),
  shippingAddress: text('shipping_address', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
  accountId: text('account_id'),
  checkoutKey: text('checkout_key'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  checkoutKeyUnique: uniqueIndex('store_orders_checkout_key_unique').on(table.checkoutKey),
  accountCreatedIdx: index('store_orders_account_created_at_idx').on(table.accountId, desc(table.createdAt)),
  customerIdx: index('store_orders_customer_id_idx').on(table.customerId),
  statusCreatedIdx: index('store_orders_status_created_at_idx').on(table.status, desc(table.createdAt)),
}))

export const storeOrderNumberSequence = sqliteTable('store_order_number_sequence', {
  id: integer('id').primaryKey(),
  nextOrderNumber: integer('next_order_number').notNull(),
})

export const storeOrderItems = sqliteTable('store_order_items', {
  id: uuid().primaryKey(),
  orderId: text('order_id').notNull().references(() => storeOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  variantId: text('variant_id'),
  powerLeft: text('power_left'),
  powerRight: text('power_right'),
  inventoryReserved: integer('inventory_reserved', { mode: 'boolean' }).notNull().default(false),
  unitPrice: money('unit_price_minor').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: money('line_total_minor').notNull(),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  orderIdx: index('store_order_items_order_id_idx').on(table.orderId),
}))

export const storeProductAssets = sqliteTable('store_product_assets', {
  id: uuid().primaryKey(),
  productId: text('product_id').notNull(),
  blobPathname: text('blob_pathname').notNull(),
  blobUrl: text('blob_url'),
  altText: text('alt_text'),
  mediaType: text('media_type').notNull().default('image'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pathnamePerProductUnique: uniqueIndex('store_product_assets_product_pathname_unique')
    .on(table.productId, table.blobPathname),
  productIdx: index('store_product_assets_product_id_idx').on(table.productId, table.sortOrder),
}))

export const storeProductVariants = sqliteTable('store_product_variants', {
  id: uuid().primaryKey(),
  productId: text('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  sku: text('sku'),
  name: text('name').notNull(),
  color: text('color'),
  powerDiopters: real('power_diopters'),
  baseCurve: real('base_curve'),
  diameterMm: real('diameter_mm'),
  packSize: integer('pack_size'),
  price: money('price_minor').notNull(),
  currency: text('currency').notNull().default('PKR'),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  skuUnique: uniqueIndex('store_product_variants_sku_unique')
    .on(table.sku)
    .where(sql`${table.sku} IS NOT NULL`),
  productIdx: index('store_product_variants_product_id_idx').on(table.productId, table.isActive),
}))

export const storeActivityEvents = sqliteTable('store_activity_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  entityIdx: index('store_activity_events_entity_idx').on(table.entityType, table.entityId, desc(table.id)),
  createdIdx: index('store_activity_events_created_at_idx').on(desc(table.createdAt)),
}))

export const storeErrorLogs = sqliteTable('store_error_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source').notNull(),
  errorName: text('error_name').notNull(),
  message: text('message').notNull(),
  stack: text('stack'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  createdIdx: index('store_error_logs_created_at_idx').on(table.createdAt),
}))

export const storeAdminUsers = sqliteTable('store_admin_users', {
  id: uuid().primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('staff'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sessionVersion: integer('session_version').notNull().default(1),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  emailUnique: uniqueIndex('store_admin_users_email_unique').on(sql`lower(${table.email})`),
  activeRoleIdx: index('store_admin_users_active_role_idx').on(table.isActive, table.role),
}))

export const storeBanners = sqliteTable('store_banners', {
  id: uuid().primaryKey(),
  placement: text('placement').notNull(),
  title: text('title').notNull().default(''),
  body: text('body'),
  imageUrl: text('image_url').notNull(),
  blobPathname: text('blob_pathname'),
  href: text('href'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  placementIdx: index('store_banners_placement_idx').on(table.placement, table.sortOrder)
    .where(sql`${table.isActive} = 1`),
}))

export const storeMediaObjects = sqliteTable('store_media_objects', {
  pathname: text('pathname').primaryKey(),
  contentType: text('content_type').notNull(),
  byteLength: integer('byte_length').notNull(),
  digest: blob('digest', { mode: 'buffer' }).notNull(),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const storeMediaObjectChunks = sqliteTable('store_media_object_chunks', {
  pathname: text('pathname').notNull().references(() => storeMediaObjects.pathname, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: blob('content', { mode: 'buffer' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.pathname, table.chunkIndex] }),
}))

export const storeReviews = sqliteTable('store_reviews', {
  id: uuid().primaryKey(),
  author: text('author').notNull(),
  body: text('body').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const storeSettings = sqliteTable('store_settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const storeCrmLeads = sqliteTable('store_crm_leads', {
  id: uuid().primaryKey(),
  source: text('source').notNull().default('manual'),
  status: text('status').notNull().default('new'),
  fullName: text('full_name'),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  followUpAt: timestamp('follow_up_at'),
  matchedCustomerId: text('matched_customer_id').references(() => storeCustomers.id, { onDelete: 'set null' }),
  metaLeadId: text('meta_lead_id'),
  metaPageId: text('meta_page_id'),
  metaFormId: text('meta_form_id'),
  metaAdId: text('meta_ad_id'),
  metaCampaignId: text('meta_campaign_id'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  metaLeadUnique: uniqueIndex('store_crm_leads_meta_lead_id_unique')
    .on(table.metaLeadId)
    .where(sql`${table.metaLeadId} IS NOT NULL`),
  statusCreatedIdx: index('store_crm_leads_status_created_at_idx').on(table.status, desc(table.createdAt)),
  customerIdx: index('store_crm_leads_matched_customer_id_idx').on(table.matchedCustomerId),
}))

export const storeSecrets = sqliteTable('store_secrets', {
  name: text('name').primaryKey(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const appUsers = sqliteTable('app_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull(),
})
