PRAGMA foreign_keys = ON;

CREATE TABLE store_categories (
  id TEXT PRIMARY KEY NOT NULL,
  parent_id TEXT REFERENCES store_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  slug TEXT NOT NULL UNIQUE
    CHECK (length(slug) > 0 AND slug NOT GLOB '*[^a-z0-9-]*'
      AND slug NOT LIKE '-%' AND slug NOT LIKE '%-' AND instr(slug, '--') = 0),
  source_category_id INTEGER,
  source_image_url TEXT,
  description TEXT,
  image_url TEXT CHECK (
    image_url IS NULL OR image_url LIKE 'https://%' OR image_url LIKE '/api/media/%'
  ),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  show_in_menu INTEGER NOT NULL DEFAULT 1 CHECK (show_in_menu IN (0, 1)),
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX store_categories_source_category_id_unique
  ON store_categories(source_category_id);
CREATE UNIQUE INDEX store_categories_lower_name_unique
  ON store_categories(lower(trim(name)));
CREATE INDEX store_categories_parent_idx ON store_categories(parent_id, sort_order);

CREATE TABLE store_brands (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  slug TEXT NOT NULL UNIQUE
    CHECK (length(slug) > 0 AND slug NOT GLOB '*[^a-z0-9-]*'
      AND slug NOT LIKE '-%' AND slug NOT LIKE '%-' AND instr(slug, '--') = 0),
  logo_url TEXT CHECK (logo_url IS NULL OR logo_url LIKE '/api/media/%'),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_brands_lower_name_unique ON store_brands(lower(name));

CREATE TABLE store_lens_shades (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  hex TEXT CHECK (
    hex IS NULL OR hex GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'
  ),
  image_url TEXT CHECK (
    image_url IS NULL OR image_url LIKE 'https://%' OR image_url LIKE '/api/media/%'
  ),
  source_image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_lens_shades_lower_name_hex_unique
  ON store_lens_shades(lower(name), hex);
CREATE UNIQUE INDEX store_lens_shades_lower_name_no_hex_unique
  ON store_lens_shades(lower(name)) WHERE hex IS NULL;

CREATE TABLE store_lens_types (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  source_category_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_lens_types_lower_name_unique ON store_lens_types(lower(name));
CREATE UNIQUE INDEX store_lens_types_source_category_id_unique
  ON store_lens_types(source_category_id) WHERE source_category_id IS NOT NULL;

CREATE TABLE store_products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category_id TEXT REFERENCES store_categories(id) ON DELETE SET NULL,
  brand_id TEXT REFERENCES store_brands(id) ON DELETE SET NULL,
  lens_shade_id TEXT REFERENCES store_lens_shades(id) ON DELETE SET NULL,
  lens_type_id TEXT REFERENCES store_lens_types(id) ON DELETE SET NULL,
  source_product_id INTEGER,
  source_url TEXT,
  source_payload TEXT CHECK (source_payload IS NULL OR json_valid(source_payload)),
  source_content_hash TEXT,
  source_image_url TEXT,
  brand TEXT,
  sku TEXT,
  short_description TEXT,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  compare_at_price_minor INTEGER CHECK (compare_at_price_minor IS NULL OR compare_at_price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  hero_image_url TEXT,
  colors TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(colors)),
  diameter_mm REAL,
  base_curve REAL,
  water_content TEXT,
  material TEXT,
  wear_duration TEXT,
  pack_contents TEXT,
  power_type TEXT,
  power_range TEXT,
  available_power_ranges TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(available_power_ranges)),
  uv_protection INTEGER NOT NULL DEFAULT 0 CHECK (uv_protection IN (0, 1)),
  fda_approved INTEGER NOT NULL DEFAULT 0 CHECK (fda_approved IN (0, 1)),
  features TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(features)),
  specs TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(specs)),
  usage_instructions TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  is_new_arrival INTEGER NOT NULL DEFAULT 0 CHECK (is_new_arrival IN (0, 1)),
  is_on_sale INTEGER NOT NULL DEFAULT 0 CHECK (is_on_sale IN (0, 1)),
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_products_source_product_id_unique
  ON store_products(source_product_id);
CREATE INDEX store_products_category_idx ON store_products(category_id, status);
CREATE INDEX store_products_status_idx ON store_products(status);
CREATE INDEX store_products_lens_type_id_idx ON store_products(lens_type_id);
CREATE UNIQUE INDEX store_products_sku_unique ON store_products(sku) WHERE sku IS NOT NULL;

CREATE TABLE store_product_viewers (
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  viewer_hash TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, viewer_hash)
);
CREATE INDEX store_product_viewers_last_seen_idx ON store_product_viewers(last_seen_at);

CREATE TABLE store_product_categories (
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES store_categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX store_product_categories_category_idx
  ON store_product_categories(category_id, product_id);

CREATE TABLE store_product_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (length(author) BETWEEN 1 AND 80),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT CHECK (title IS NULL OR length(title) <= 120),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  is_approved INTEGER NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX store_product_reviews_product_idx
  ON store_product_reviews(product_id, is_approved, created_at DESC);

CREATE TABLE store_product_relations (
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  related_product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, related_product_id),
  CHECK (product_id <> related_product_id)
);

CREATE TABLE store_customers (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  password_hash TEXT,
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version > 0),
  marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (marketing_opt_in IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_customers_lower_email_unique
  ON store_customers(lower(email)) WHERE email IS NOT NULL;

CREATE TABLE store_orders (
  id TEXT PRIMARY KEY NOT NULL,
  -- D1 writers allocate this from store_order_number_sequence in the same batch as the order insert.
  order_number INTEGER NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method = 'cash_on_delivery'),
  shipping_fee_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (shipping_fee_confirmed IN (0, 1)),
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  shipping_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (shipping_total_minor >= 0),
  tax_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_total_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  shipping_address TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(shipping_address)),
  account_id TEXT,
  checkout_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_orders_checkout_key_unique
  ON store_orders(checkout_key);
CREATE INDEX store_orders_account_created_at_idx ON store_orders(account_id, created_at DESC);
CREATE INDEX store_orders_customer_id_idx ON store_orders(customer_id);
CREATE INDEX store_orders_status_created_at_idx ON store_orders(status, created_at DESC);

CREATE TABLE store_order_number_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_order_number INTEGER NOT NULL CHECK (next_order_number > 0)
);
INSERT INTO store_order_number_sequence (id, next_order_number) VALUES (1, 1);

CREATE TABLE store_order_items (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_id TEXT,
  power_left TEXT,
  power_right TEXT,
  inventory_reserved INTEGER NOT NULL DEFAULT 0 CHECK (inventory_reserved IN (0, 1)),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX store_order_items_order_id_idx ON store_order_items(order_id);

CREATE TABLE store_product_assets (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  blob_pathname TEXT NOT NULL,
  blob_url TEXT,
  alt_text TEXT,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_product_assets_product_pathname_unique
  ON store_product_assets(product_id, blob_pathname);
CREATE INDEX store_product_assets_product_id_idx ON store_product_assets(product_id, sort_order);

CREATE TABLE store_product_variants (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  color TEXT,
  power_diopters REAL,
  base_curve REAL,
  diameter_mm REAL,
  pack_size INTEGER CHECK (pack_size IS NULL OR pack_size > 0),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'PKR',
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_product_variants_sku_unique
  ON store_product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX store_product_variants_product_id_idx
  ON store_product_variants(product_id, is_active);

CREATE TABLE store_activity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX store_activity_events_entity_idx
  ON store_activity_events(entity_type, entity_id, id DESC);
CREATE INDEX store_activity_events_created_at_idx ON store_activity_events(created_at DESC);

CREATE TABLE store_error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (length(source) <= 120),
  error_name TEXT NOT NULL CHECK (length(error_name) <= 200),
  message TEXT NOT NULL CHECK (length(message) <= 4000),
  stack TEXT CHECK (stack IS NULL OR length(stack) <= 12000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX store_error_logs_created_at_idx ON store_error_logs(created_at);

CREATE TABLE store_admin_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version > 0),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_admin_users_email_unique ON store_admin_users(lower(email));
CREATE INDEX store_admin_users_active_role_idx ON store_admin_users(is_active, role);

CREATE TABLE store_banners (
  id TEXT PRIMARY KEY NOT NULL,
  placement TEXT NOT NULL CHECK (
    placement IN ('hero', 'promo', 'brand', 'category', 'service', 'new_arrival', 'feature', 'why_choose')
  ),
  title TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
  body TEXT CHECK (body IS NULL OR length(body) <= 500),
  image_url TEXT NOT NULL CHECK (
    image_url LIKE 'https://%' OR image_url GLOB '/api/media/[a-zA-Z0-9._/-]*'
  ),
  blob_pathname TEXT,
  href TEXT CHECK (
    href IS NULL OR (length(href) <= 500 AND (href LIKE '/%' OR href LIKE 'https://%'))
  ),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX store_banners_placement_idx
  ON store_banners(placement, sort_order) WHERE is_active = 1;

CREATE TABLE store_media_objects (
  pathname TEXT PRIMARY KEY NOT NULL,
  content_type TEXT NOT NULL CHECK (
    instr(content_type, '/') > 1
      AND length(content_type) - length(replace(content_type, '/', '')) = 1
      AND length(content_type) - instr(content_type, '/') > 0
      AND replace(content_type, '/', '') NOT GLOB '*[^A-Za-z0-9.+_-]*'
  ),
  byte_length INTEGER NOT NULL CHECK (byte_length BETWEEN 1 AND 12582912),
  digest BLOB NOT NULL CHECK (length(digest) = 32),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    length(pathname) BETWEEN 1 AND 1024
      AND pathname NOT LIKE '/%'
      AND pathname NOT GLOB '*[^a-zA-Z0-9._/-]*'
      AND instr(pathname, '//') = 0
      AND pathname <> '.'
      AND pathname <> '..'
      AND pathname NOT LIKE './%'
      AND pathname NOT LIKE '../%'
      AND pathname NOT LIKE '%/./%'
      AND pathname NOT LIKE '%/../%'
      AND pathname NOT LIKE '%/.'
      AND pathname NOT LIKE '%/..'
  )
);
CREATE TABLE store_media_object_chunks (
  pathname TEXT NOT NULL REFERENCES store_media_objects(pathname) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content BLOB NOT NULL CHECK (length(content) <= 1000000),
  PRIMARY KEY (pathname, chunk_index)
);

CREATE TABLE store_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  author TEXT NOT NULL CHECK (length(author) BETWEEN 1 AND 100),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE store_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL CHECK (json_valid(value)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (key IN (
    'announcements', 'contact', 'headings', 'seo_sections', 'footer', 'product_page',
    'delivery_rules', 'chatbot', 'appearance', 'home_configuration', 'power_options',
    'free_gift', 'deals'
  ))
);

CREATE TABLE store_crm_leads (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'meta')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  full_name TEXT CHECK (full_name IS NULL OR length(full_name) <= 180),
  email TEXT CHECK (email IS NULL OR length(email) <= 254),
  phone TEXT CHECK (phone IS NULL OR length(phone) <= 80),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 5000),
  follow_up_at TEXT,
  matched_customer_id TEXT REFERENCES store_customers(id) ON DELETE SET NULL,
  meta_lead_id TEXT,
  meta_page_id TEXT,
  meta_form_id TEXT,
  meta_ad_id TEXT,
  meta_campaign_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX store_crm_leads_meta_lead_id_unique
  ON store_crm_leads(meta_lead_id) WHERE meta_lead_id IS NOT NULL;
CREATE INDEX store_crm_leads_status_created_at_idx
  ON store_crm_leads(status, created_at DESC);
CREATE INDEX store_crm_leads_matched_customer_id_idx ON store_crm_leads(matched_customer_id);

CREATE TABLE store_secrets (
  name TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'customer', 'guest')),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX app_users_email_unique ON app_users(email);
