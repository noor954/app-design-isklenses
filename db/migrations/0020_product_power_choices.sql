ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS available_power_ranges jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.store_order_items
  ADD COLUMN IF NOT EXISTS power_left text,
  ADD COLUMN IF NOT EXISTS power_right text;
