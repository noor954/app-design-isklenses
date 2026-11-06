CREATE TABLE IF NOT EXISTS store_product_viewers (
  product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  viewer_hash text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, viewer_hash)
);

CREATE INDEX IF NOT EXISTS store_product_viewers_last_seen_idx
  ON store_product_viewers (last_seen_at);
