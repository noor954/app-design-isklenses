#!/usr/bin/env node

/**
 * Schema Validation Script
 * Validates that all database tables exist with correct structure
 * Run: node --env-file-if-exists=/vercel/share/.env.project scripts/validate-schema.mjs
 */

import { Pool } from 'pg'
import { normalizePostgresConnectionString } from '../lib/db/postgres-connection.mjs'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({
  connectionString: normalizePostgresConnectionString(DATABASE_URL),
})

const REQUIRED_TABLES = [
  'store_products',
  'store_customers',
  'store_orders',
  'store_order_items',
  'store_product_assets',
  'store_categories',
  'store_product_variants',
  'store_product_reviews',
  'store_product_relations',
  'store_activity_events',
  'store_admin_users',
  'store_banners',
  'store_reviews',
  'store_settings',
  'store_brands',
  'store_lens_shades',
  'store_lens_types',
  'store_error_logs',
  'store_media_objects',
  'store_crm_leads',
]

const TABLE_SCHEMAS = {
  store_products: [
    'id', 'name', 'slug', 'description', 'category_id', 'brand', 'brand_id', 'lens_shade_id', 'lens_type_id', 'source_product_id', 'source_url', 'source_payload', 'source_content_hash', 'source_image_url', 'sku', 'short_description', 'price', 'compare_at_price',
    'currency', 'status', 'stock_quantity', 'hero_image_url', 'colors', 'diameter_mm', 'base_curve', 'water_content',
    'material', 'wear_duration', 'pack_contents', 'power_type', 'power_range', 'available_power_ranges', 'uv_protection', 'fda_approved', 'features', 'specs',
    'usage_instructions', 'is_featured', 'is_new_arrival', 'is_on_sale', 'seo_title', 'seo_description', 'created_at', 'updated_at',
  ],
  store_customers: [
    'id',
    'email',
    'first_name',
    'last_name',
    'phone',
    'password_hash',
    'session_version',
    'marketing_opt_in',
    'created_at',
    'updated_at',
  ],
  store_orders: [
    'id',
    'order_number',
    'customer_id',
    'status',
    'payment_method',
    'shipping_fee_confirmed',
    'account_id',
    'checkout_key',
    'subtotal',
    'shipping_total',
    'tax_total',
    'total',
    'currency',
    'shipping_address',
    'created_at',
    'updated_at',
  ],
  store_order_items: [
    'id',
    'order_id',
    'product_id',
    'product_name',
    'variant_id',
    'inventory_reserved',
    'unit_price',
    'quantity',
    'line_total',
    'power_left',
    'power_right',
    'created_at',
  ],
  store_product_assets: ['id', 'product_id', 'blob_pathname', 'blob_url', 'alt_text', 'media_type', 'sort_order', 'created_at'],
  store_categories: ['id', 'parent_id', 'source_category_id', 'source_image_url', 'name', 'slug', 'description', 'image_url', 'sort_order', 'is_active', 'show_in_menu', 'seo_title', 'seo_description', 'created_at', 'updated_at'],
  store_product_reviews: ['id', 'product_id', 'author', 'rating', 'title', 'body', 'is_approved', 'created_at'],
  store_product_relations: ['product_id', 'related_product_id', 'sort_order'],
  store_product_variants: [
    'id',
    'product_id',
    'sku',
    'name',
    'color',
    'power_diopters',
    'base_curve',
    'diameter_mm',
    'pack_size',
    'price',
    'currency',
    'stock_quantity',
    'is_active',
    'created_at',
    'updated_at',
  ],
  store_activity_events: ['id', 'entity_type', 'entity_id', 'event_type', 'payload', 'created_at'],
  store_banners: ['id', 'placement', 'title', 'body', 'image_url', 'blob_pathname', 'href', 'sort_order', 'is_active', 'created_at', 'updated_at'],
  store_reviews: ['id', 'author', 'body', 'sort_order', 'is_active', 'created_at', 'updated_at'],
  store_settings: ['key', 'value', 'updated_at'],
  store_brands: ['id', 'name', 'slug', 'logo_url', 'is_active', 'created_at', 'updated_at'],
  store_lens_shades: ['id', 'name', 'hex', 'image_url', 'source_image_url', 'is_active', 'created_at', 'updated_at'],
  store_lens_types: ['id', 'name', 'source_category_id', 'is_active', 'created_at', 'updated_at'],
  store_error_logs: ['id', 'source', 'error_name', 'message', 'stack', 'created_at'],
  store_media_objects: ['pathname', 'content_type', 'byte_length', 'digest', 'content', 'created_at', 'updated_at'],
  store_crm_leads: [
    'id', 'source', 'status', 'full_name', 'email', 'phone', 'notes', 'follow_up_at', 'matched_customer_id',
    'meta_lead_id', 'meta_page_id', 'meta_form_id', 'meta_ad_id', 'meta_campaign_id', 'created_at', 'updated_at',
  ],
  store_admin_users: [
    'id',
    'email',
    'password_hash',
    'role',
    'is_active',
    'session_version',
    'last_login_at',
    'created_at',
    'updated_at',
  ],
}

async function validateSchema() {
  try {
    console.log('🔍 Validating database schema...\n')
    let hasErrors = false

    for (const tableName of REQUIRED_TABLES) {
      const result = await pool.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `,
        [tableName],
      )

      if (!result.rows[0].exists) {
        console.error(`❌ Table missing: ${tableName}`)
        hasErrors = true
        continue
      }

      // Get columns
      const columnsResult = await pool.query(
        `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `,
        [tableName],
      )

      const columns = columnsResult.rows.map((row) => row.column_name)
      const expectedColumns = TABLE_SCHEMAS[tableName]

      const missing = expectedColumns.filter((col) => !columns.includes(col))
      const extra = columns.filter((col) => !expectedColumns.includes(col))

      if (missing.length === 0 && extra.length === 0) {
        console.log(`✅ ${tableName}`)
      } else {
        console.log(`⚠️  ${tableName}`)
        if (missing.length > 0) {
          console.log(`   Missing: ${missing.join(', ')}`)
          hasErrors = true
        }
        if (extra.length > 0) console.log(`   Extra: ${extra.join(', ')}`)
      }
    }

    // Check triggers
    console.log('\n🔍 Validating triggers...')
    const triggerResult = await pool.query(`
      SELECT trigger_name FROM information_schema.triggers
      WHERE trigger_schema = 'public'
    `)

    const triggers = triggerResult.rows.map((row) => row.trigger_name)
    const requiredTriggers = [
      'store_products_updated_at',
      'store_customers_updated_at',
      'store_orders_updated_at',
      'store_product_variants_updated_at',
      'store_crm_leads_updated_at',
    ]

    for (const trigger of requiredTriggers) {
      if (triggers.includes(trigger)) {
        console.log(`✅ ${trigger}`)
      } else {
        console.log(`⚠️  ${trigger} (missing)`)
        hasErrors = true
      }
    }

    console.log(hasErrors ? '\n❌ Schema validation failed' : '\n✅ Schema validation complete')
    if (hasErrors) process.exitCode = 1
  } catch (error) {
    console.error('❌ Validation error:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

validateSchema()
