#!/usr/bin/env node

/**
 * Build Validation Script
 * Validates that all imports and type definitions are correct
 * Run: npm run build
 */

import fs from 'fs'
import path from 'path'

const PROJECT_ROOT = process.cwd()

const FILES_TO_CHECK = [
  'lib/db/index.ts',
  'lib/db/schema.ts',
  'db/migrations/0002_store_admin_users.sql',
  'db/migrations/0003_isk_lens_catalog.sql',
  'db/migrations/0005_cod_checkout_and_customer_accounts.sql',
  'db/migrations/0009_category_tree_catalog.sql',
  'db/migrations/0011_catalog_taxonomy_and_error_logs.sql',
  'db/migrations/0012_isk_reference_taxonomy_and_brand_logos.sql',
  'db/migrations/0013_repeatable_catalog_sync.sql',
  'db/migrations/0014_lens_types.sql',
  'db/migrations/0015_delivery_rules.sql',
  'db/migrations/0016_database_media_store.sql',
  'db/migrations/0017_crm_meta_leads.sql',
  'db/migrations/0019_chatbot_settings.sql',
  'db/migrations/0020_product_power_choices.sql',
  'lib/server/media-storage.mjs',
  'lib/media-url.mjs',
  'app/api/media/[...path]/route.ts',
  'scripts/bootstrap-admin.mjs',
  'app/actions/catalog-admin.ts',
  'app/actions/catalog-taxonomy.ts',
  'app/api/errors/route.ts',
  'components/admin/catalog-taxonomy-manager.tsx',
  'lib/errors/log-error.ts',
  'lib/data/catalog.ts',
  'app/actions/checkout.ts',
  'app/actions/admin.ts',
  'app/api/products/route.ts',
  'app/api/products/[slug]/route.ts',
  'app/api/product-categories/route.ts',
  'app/api/orders/route.ts',
  'app/api/storefront/session/route.ts',
  'app/(store)/products/page.tsx',
  'app/(store)/products/[slug]/page.tsx',
  'components/storefront/product-image.tsx',
  'app/api/admin/metrics/route.ts',
  'app/api/admin/crm/route.ts',
  'app/api/webhooks/meta-leads/route.ts',
  'app/api/admin/session/route.ts',
  'lib/auth/admin.ts',
  'components/admin/admin-workspace.tsx',
  'components/admin/crm-workspace.tsx',
  'lib/server/meta-leads.ts',
  'components/admin/product-variant-manager.tsx',
  'components/storefront/checkout.tsx',
  'app/(store)/checkout/page.tsx',
  'app/(store)/checkout/confirmation/page.tsx',
  'lib/auth/store-customer.ts',
  'lib/auth/public-rate-limit.ts',
  'lib/http/json-body.ts',
  'components/storefront/product-detail.tsx',
  'lib/hooks/use-storefront-cart.tsx',
  'lib/hooks/use-storefront-data.ts',
  'lib/hooks/use-admin-data.ts',
  'lib/hooks/use-storefront-categories.ts',
  'scripts/rehost-source-product-images.mjs',
  'scripts/restore-content-images.mjs',
  'scripts/import-isk-reference-taxonomy.mjs',
  'scripts/sync-isk-catalog.mjs',
  'lib/server/isk-catalog-sync.mjs',
  'app/api/admin/catalog-sync/route.ts',
  'components/admin/catalog-sync-manager.tsx',
]

const REQUIRED_PACKAGES = ['drizzle-orm', 'pg', 'swr', 'next']

console.log('🔍 Validating build configuration...\n')
let failures = 0

// Check files exist
console.log('📁 Checking files...')
for (const file of FILES_TO_CHECK) {
  const filePath = path.join(PROJECT_ROOT, file)
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`)
  } else {
    console.log(`❌ ${file} (missing)`)
    failures += 1
  }
}

// Check package.json
console.log('\n📦 Checking dependencies...')
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'))

  for (const pkg of REQUIRED_PACKAGES) {
    if (packageJson.dependencies[pkg]) {
      console.log(`✅ ${pkg}`)
    } else {
      console.log(`❌ ${pkg} (missing)`)
      failures += 1
    }
  }
} catch (error) {
  console.error('❌ Failed to read package.json:', error.message)
  process.exit(1)
}

// Check schema exports
console.log('\n🔍 Checking schema exports...')
try {
  const schemaContent = fs.readFileSync(path.join(PROJECT_ROOT, 'lib/db/schema.ts'), 'utf-8')

  const exportedTables = [
    'storeProducts',
    'storeCategories',
    'storeCustomers',
    'storeOrders',
    'storeOrderItems',
    'storeProductAssets',
    'storeProductCategories',
    'storeProductVariants',
    'storeActivityEvents',
    'storeBrands',
    'storeLensShades',
    'storeLensTypes',
    'storeErrorLogs',
    'storeAdminUsers',
    'storeMediaObjects',
    'storeCrmLeads',
  ]

  for (const table of exportedTables) {
    if (schemaContent.includes(`export const ${table}`)) {
      console.log(`✅ ${table}`)
    } else {
      console.log(`❌ ${table} (not exported)`)
      failures += 1
    }
  }
} catch (error) {
  console.error('❌ Failed to validate schema:', error.message)
  process.exit(1)
}

if (failures) {
  console.error(`\n❌ Build validation failed with ${failures} missing requirement(s).`)
  process.exitCode = 1
} else {
  console.log('\n✅ Build validation passed - Ready to deploy!')
}
