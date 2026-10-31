import { bigint, boolean, customType, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })

export const storeCategories = pgTable('store_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sourceCategoryId: integer('source_category_id'),
  sourceImageUrl: text('source_image_url'),
  description: text('description'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  showInMenu: boolean('show_in_menu').notNull().default(true),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sourceCategoryUnique: uniqueIndex('store_categories_source_category_id_unique').on(table.sourceCategoryId),
  nameUnique: uniqueIndex('store_categories_lower_name_unique').on(sql`lower(btrim(${table.name}))`),
}))

export const storeBrands = pgTable('store_brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  nameUnique: uniqueIndex('store_brands_lower_name_unique').on(sql`lower(${table.name})`),
}))

export const storeLensShades = pgTable('store_lens_shades', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  hex: text('hex'),
  imageUrl: text('image_url'),
  sourceImageUrl: text('source_image_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  nameColorUnique: uniqueIndex('store_lens_shades_lower_name_hex_unique').on(sql`lower(${table.name})`, table.hex),
}))

export const storeLensTypes = pgTable('store_lens_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  sourceCategoryId: integer('source_category_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  nameUnique: uniqueIndex('store_lens_types_lower_name_unique').on(sql`lower(${table.name})`),
  sourceCategoryUnique: uniqueIndex('store_lens_types_source_category_id_unique')
    .on(table.sourceCategoryId)
    .where(sql`${table.sourceCategoryId} IS NOT NULL`),
}))

export const storeProducts = pgTable('store_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => storeCategories.id, { onDelete: 'set null' }),
  brandId: uuid('brand_id').references(() => storeBrands.id, { onDelete: 'set null' }),
  lensShadeId: uuid('lens_shade_id').references(() => storeLensShades.id, { onDelete: 'set null' }),
  lensTypeId: uuid('lens_type_id').references(() => storeLensTypes.id, { onDelete: 'set null' }),
  sourceProductId: integer('source_product_id'),
  sourceUrl: text('source_url'),
  sourcePayload: jsonb('source_payload').$type<Record<string, unknown> | null>(),
  sourceContentHash: text('source_content_hash'),
  sourceImageUrl: text('source_image_url'),
  brand: text('brand'),
  sku: text('sku'),
  shortDescription: text('short_description'),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  compareAtPrice: numeric('compare_at_price', { precision: 12, scale: 2 }),
  currency: text('currency').notNull().default('PKR'),
  status: text('status').notNull().default('active'),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  heroImageUrl: text('hero_image_url'),
  colors: jsonb('colors').$type<{ name: string; hex: string }[]>().notNull().default([]),
  diameterMm: numeric('diameter_mm', { precision: 4, scale: 2 }),
  baseCurve: numeric('base_curve', { precision: 4, scale: 2 }),
  waterContent: text('water_content'),
  material: text('material'),
  wearDuration: text('wear_duration'),
  packContents: text('pack_contents'),
  powerType: text('power_type'),
  powerRange: text('power_range'),
  availablePowerRanges: jsonb('available_power_ranges').$type<string[]>().notNull().default([]),
  uvProtection: boolean('uv_protection').notNull().default(false),
  fdaApproved: boolean('fda_approved').notNull().default(false),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  specs: jsonb('specs').$type<{ label: string; value: string }[]>().notNull().default([]),
  usageInstructions: text('usage_instructions'),
  isFeatured: boolean('is_featured').notNull().default(false),
  isNewArrival: boolean('is_new_arrival').notNull().default(false),
  isOnSale: boolean('is_on_sale').notNull().default(false),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sourceProductUnique: uniqueIndex('store_products_source_product_id_unique').on(table.sourceProductId),
}))

export const storeProductCategories = pgTable('store_product_categories', {
  productId: uuid('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => storeCategories.id, { onDelete: 'restrict' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.productId, table.categoryId] }),
  categoryIdx: index('store_product_categories_category_idx').on(table.categoryId, table.productId),
}))

export const storeProductReviews = pgTable('store_product_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  author: text('author').notNull(),
  rating: integer('rating').notNull(),
  title: text('title'),
  body: text('body').notNull(),
  isApproved: boolean('is_approved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const storeProductRelations = pgTable('store_product_relations', {
  productId: uuid('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  relatedProductId: uuid('related_product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.productId, table.relatedProductId] }),
}))

export const storeCustomers = pgTable('store_customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  passwordHash: text('password_hash'),
  sessionVersion: integer('session_version').notNull().default(1),
  marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  normalizedEmailUnique: uniqueIndex('store_customers_lower_email_unique').on(sql`lower(${table.email})`),
}))

export const storeOrders = pgTable('store_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: bigint('order_number', { mode: 'number' }).generatedAlwaysAsIdentity().unique(),
  customerId: uuid('customer_id').notNull(),
  status: text('status').notNull().default('pending'),
  paymentMethod: text('payment_method'),
  shippingFeeConfirmed: boolean('shipping_fee_confirmed').notNull().default(false),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  shippingTotal: numeric('shipping_total', { precision: 12, scale: 2 }).notNull().default('0'),
  taxTotal: numeric('tax_total', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  shippingAddress: jsonb('shipping_address').$type<Record<string, string>>().notNull().default({}),
  accountId: uuid('account_id'),
  checkoutKey: uuid('checkout_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  checkoutKeyUnique: uniqueIndex('store_orders_checkout_key_unique').on(table.checkoutKey),
  accountCreatedIdx: index('store_orders_account_created_at_idx').on(table.accountId, table.createdAt),
}))

export const storeOrderItems = pgTable('store_order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull(),
  productId: uuid('product_id').notNull(),
  productName: text('product_name').notNull(),
  variantId: uuid('variant_id'),
  powerLeft: text('power_left'),
  powerRight: text('power_right'),
  inventoryReserved: boolean('inventory_reserved').notNull().default(false),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const storeProductAssets = pgTable('store_product_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull(),
  blobPathname: text('blob_pathname').notNull(),
  blobUrl: text('blob_url'),
  altText: text('alt_text'),
  mediaType: text('media_type').notNull().default('image'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pathnamePerProductUnique: uniqueIndex('store_product_assets_product_pathname_unique')
    .on(table.productId, table.blobPathname),
}))

export const storeProductVariants = pgTable('store_product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  sku: text('sku'),
  name: text('name').notNull(),
  color: text('color'),
  powerDiopters: numeric('power_diopters', { precision: 6, scale: 2 }),
  baseCurve: numeric('base_curve', { precision: 4, scale: 2 }),
  diameterMm: numeric('diameter_mm', { precision: 4, scale: 2 }),
  packSize: integer('pack_size'),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('PKR'),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  skuUnique: uniqueIndex('store_product_variants_sku_unique').on(table.sku).where(sql`${table.sku} IS NOT NULL`),
}))

export const storeActivityEvents = pgTable('store_activity_events', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const storeErrorLogs = pgTable('store_error_logs', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  source: text('source').notNull(),
  errorName: text('error_name').notNull(),
  message: text('message').notNull(),
  stack: text('stack'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdIdx: index('store_error_logs_created_at_idx').on(table.createdAt),
}))

export const storeAdminUsers = pgTable('store_admin_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('staff'),
  isActive: boolean('is_active').notNull().default(true),
  sessionVersion: integer('session_version').notNull().default(1),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailUnique: uniqueIndex('store_admin_users_email_unique').on(sql`lower(${table.email})`),
}))

export const storeBanners = pgTable('store_banners', {
  id: uuid('id').defaultRandom().primaryKey(),
  placement: text('placement').notNull(),
  title: text('title').notNull().default(''),
  body: text('body'),
  imageUrl: text('image_url').notNull(),
  blobPathname: text('blob_pathname'),
  href: text('href'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const storeMediaObjects = pgTable('store_media_objects', {
  pathname: text('pathname').primaryKey(),
  contentType: text('content_type').notNull(),
  byteLength: integer('byte_length').notNull(),
  digest: bytea('digest').notNull(),
  content: bytea('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const storeReviews = pgTable('store_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  author: text('author').notNull(),
  body: text('body').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const storeSettings = pgTable('store_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const storeCrmLeads = pgTable('store_crm_leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: text('source').notNull().default('manual'),
  status: text('status').notNull().default('new'),
  fullName: text('full_name'),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  followUpAt: timestamp('follow_up_at', { withTimezone: true }),
  matchedCustomerId: uuid('matched_customer_id').references(() => storeCustomers.id, { onDelete: 'set null' }),
  metaLeadId: text('meta_lead_id'),
  metaPageId: text('meta_page_id'),
  metaFormId: text('meta_form_id'),
  metaAdId: text('meta_ad_id'),
  metaCampaignId: text('meta_campaign_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  metaLeadUnique: uniqueIndex('store_crm_leads_meta_lead_id_unique').on(table.metaLeadId).where(sql`${table.metaLeadId} IS NOT NULL`),
  statusCreatedIdx: index('store_crm_leads_status_created_at_idx').on(table.status, table.createdAt),
  customerIdx: index('store_crm_leads_matched_customer_id_idx').on(table.matchedCustomerId),
}))
