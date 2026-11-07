# Database-backed storefront and admin

The storefront and admin use the same Neon Postgres database through Drizzle. Client screens load route-handler data with SWR; writes use server actions that validate inputs, verify admin authorization where required, and create audit events in the same transaction as the database change.

For the public HTTP contract, mobile-client setup, Flutter/Dio cookie handling, and FastAPI starter, see [Mobile and integration API](./API_MOBILE_INTEGRATION.md).

## Storefront

- `GET /api/products` returns active products, supported public media metadata, and active lens options. It supports `category` and `q` filters and is refreshed by `useProducts`.
- `GET /api/products/[slug]` returns one active product with its public media and active options.
- `/products` is the full public catalog index. It loads every active product, supports live category/search navigation, and links each recorded option to its matching product detail selection. It does not manufacture lens options that are absent from the database.
- Search, category selection, price, availability, and product imagery reflect the database catalog. Uploaded hero/gallery images and imported source photos are stored in the database-backed media library and served through same-origin `/api/media/...` URLs. Public product APIs do not expose source image URLs; failed images fall through to the next stored image or the no-photo state.
- `GET /api/product-categories` returns the stored ISK Lenses category taxonomy. `/products` and the home storefront browse source categories and multiple nested levels, with live counts from product assignments; `POST /api/admin/product-categories/sync` refreshes the taxonomy from the source site for authorized admins.
- The bag is in-page state only. `/checkout` supports cash-on-delivery order submission for guests and registered shoppers; no online payment is collected.
- `POST /api/orders` reprices and validates current published products/options, serializes stock reservations in a transaction, uses an idempotency key, and writes the COD order, order lines, shopper, and audit event together. Cancelled reservations are returned to available stock.
- The recorded total initially equals the product subtotal. A store operator must confirm any delivery fee with the shopper before dispatch; the Admin order workflow records the fee and blocks shipping until confirmation. No tax calculation or payment-provider integration is present.
- Shopper accounts use scrypt password hashes and signed HTTP-only sessions. The account email is not verified, password reset is not implemented, and an existing customer record cannot be claimed by self-registration; those shoppers may use guest checkout. Account holders can view their own orders; guests can view the latest order using a signed receipt on the original device. New receipts expire after 90 days and are replaced on the next checkout. See `API_MOBILE_INTEGRATION.md` for access and recovery limitations.
- Public order and account endpoints require same-origin JSON requests, bound request-body sizes, and apply best-effort per-process rate limits. Configure distributed edge-level rate limiting before production exposure.

## Admin authorization

- Admin sign-in uses `store_admin_users` and `ADMIN_SESSION_SECRET`. Passwords are scrypt-hashed in the database; the signed HTTP-only cookie references a database user and session version.
- Sign-in issues an eight-hour, HTTP-only, same-site signed cookie. Admin API routes, upload routes, and every admin server action verify it on the server.
- Configure a cryptographically random `ADMIN_SESSION_SECRET` of at least 32 characters in each deployment environment. The application fails closed if it is absent or invalid.
- The initial owner is provisioned once using `node --env-file=.env.local scripts/bootstrap-admin.mjs`; the local `ADMIN_EMAIL` and `ADMIN_PASSWORD` values are bootstrap-only and are not used for sign-in. Create subsequent staff/admin accounts in the owner-only System users panel.
- Staff accounts are read-only, admins can mutate store data, and owners can also manage system users. Owner access is required to create or deactivate accounts. The app does not support identity-provider SSO. Deactivation increments the session version and invalidates active sessions.
- The sign-in route also limits failed attempts per process. This is not a distributed limiter; production deployments should apply edge-level rate limiting.
- For local verification only, set `ADMIN_LOGIN_PREFILL=true` in ignored `.env.local` alongside the bootstrap `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The form offers a one-click **Quick sign in** button after prefill; the session endpoint returns these values only in development on a localhost hostname with no existing session. Preview and Production never prefill credentials or offer the shortcut.
- Session status and admin responses are never cached. The public product API is the only endpoint with CDN caching.

## Admin routes and mutations

- `GET /api/admin/metrics` returns order counts, pending orders, counts by status, and recognized order value grouped by currency. COD revenue is recognized only after payment is marked paid; other payment-method orders retain the existing paid/processing/shipped/delivered recognition rule. Pending, cancelled, and refunded orders are excluded.
- `GET /api/admin/products`, `/orders`, `/customers`, and `/activity` require an admin session.
- Product create/edit/archive, stock updates, order status changes, delivery-price configuration, and customer marketing-preference updates are authenticated server actions. Invalid values and invalid order-status transitions are rejected. COD orders include the configured delivery price in checkout; admins can adjust the fee and mark payment received after delivery.
- Product options support SKU, color, prescription power, base curve, diameter, pack size, price, currency, and stock. Parent price and stock are derived from active options; direct price/stock edits are blocked while options are active.
- `POST /api/admin/products/import` reads the public ISK Lenses WooCommerce Store API in pages of 50. Each page is staged and validated; the live product catalog is replaced in one transaction only after the final page succeeds. A failed, empty, oversized, or incomplete import leaves the existing catalog untouched. The staging run is resumable only in sequence and expires after 24 hours.
- Imported `source_payload` retains the public API's structured factual fields, pricing, category/tag/brand and option metadata, stock/availability flags, source image references, and any video URLs exposed in video-specific API fields. Product-table specifications and package contents embedded in the source description are extracted as factual label/value data. Descriptive/marketing text, HTML, image alt copy, and binary media files are not copied; the source description is fingerprinted for change detection, and operators can open the original listing/media links in Admin.
- The importer itself does not download or rehost source photos/videos. After import, `node --env-file=.env.local scripts/rehost-source-product-images.mjs` copies validated `isklenses.com` upload images into `store_media_objects` and records their media paths in Neon. It accepts only supported image signatures, approved HTTPS source hosts and upload paths, enforces a 12 MB limit, retries network failures, and is idempotent. The current snapshot contained no source video links. Each import still creates draft records with zero stock; missing source categories are labeled `Uncategorized`.
- System-user listing, creation, and activation/deactivation are owner-only. Passwords require at least 16 characters and are stored as salted scrypt hashes.
- Mutations create `store_activity_events` entries transactionally. Activity payloads do not contain customer names, addresses, email addresses, or other personal fields.
- The CRM workspace at `/admin/crm` manages manual and Meta Lead Ads leads with search, pagination, status, notes, follow-up, and matching store-customer/order summaries. `db/migrations/0017_crm_meta_leads.sql` adds the idempotent lead table. Meta integration is fail-closed and uses a signed `leadgen` webhook plus server-only Graph API credentials; configure and validate it using [CRM and Meta Lead Ads](./CRM_META_LEAD_ADS.md). Messenger, Instagram DMs, and WhatsApp are not included.
- The storefront chatbot is available on public storefront pages and is configured at `/admin/chatbot`. It answers from public FAQ/catalog information only; it does not read customer accounts or orders and redirects fitting/eye-health questions to an eye-care professional. `db/migrations/0019_chatbot_settings.sql` constrains the `store_settings` allowlist to recognized keys and has been applied to the configured database.
- Order and customer endpoints return 50 records per page with database counts and server-side customer search. Customer password hashes and checkout idempotency/account internals are not returned to admin clients. COD revenue is counted only after an order is marked paid. The admin screens paginate through all matching records and expose empty/loading/error states.
- Admin writes refresh the relevant SWR keys immediately. Storefront catalog reads revalidate periodically and after product changes.

## Product media storage

- Admin uploads accept JPEG, PNG, WebP, or AVIF images and MP4 or WebM video up to 4 MB through `POST /api/admin/products/[productId]/assets`.
- Media bytes, MIME types, sizes, and SHA-256 digests are stored in `store_media_objects` in the same Neon database as the catalog. Asset metadata references same-origin `/api/media/...` URLs; no Blob token, external object-store account, or additional media environment variable is required.
- `GET /api/media/[...path]` reads only normalized media paths and returns public image/video bytes with an ETag. Stored responses must be revalidated before reuse because media paths can be overwritten; matching ETags return 304. Reordering remains database-only; `DELETE /api/admin/assets/[assetId]` removes the media object and its product metadata.
- Migration `0016_database_media_store.sql` creates the media table and adjusts image URL constraints. Run `node --env-file=.env.local scripts/validate-schema.mjs` after applying it.
- After switching from the former Vercel Blob URLs, run `node --env-file=.env.local scripts/rehost-source-product-images.mjs` to repopulate product photos from validated ISK source URLs, then `node --env-file=.env.local scripts/restore-content-images.mjs` to restore banner/footer images from their saved migration sources. Both scripts can be run again safely.

## Lens catalog state

Migrations `0003_isk_lens_catalog.sql`, `0004_isk_source_snapshot_import.sql`, `0005_cod_checkout_and_customer_accounts.sql`, `0006_store_product_categories.sql`, `0016_database_media_store.sql`, `0017_crm_meta_leads.sql`, and `0019_chatbot_settings.sql` are applied to the connected Neon database; schema validation passes, including the CRM lead table and its timestamp trigger. Migration `0005` adds shopper credentials/session versions, COD and delivery-fee fields, order idempotency, and stock-reservation metadata. Apply migrations to each other target database before enabling checkout there. Migration `0015_delivery_rules.sql` adds the delivery-pricing key to the settings constraint for databases that enforce one. The Neon media library now contains all 757 available product source images and all 28 saved banner images plus the footer logo (786 objects, approximately 46 MB). Product, shade, banner, and footer image references now use `/api/media/...`; inaccessible legacy Blob links were cleared while preserving their product-asset metadata. One product has no available source image. No delivery rules have been configured yet. The former Vercel Blob store returned HTTP 403 ("Your store is blocked"); runtime image delivery no longer depends on that service.

The latest complete import contains 495 distinct source listings; on 2026-10-10 the operator directed that all be published with a configured stock quantity of 5 each. This stock was explicitly entered by the operator, not inferred from source data. Eighty-nine products are `Uncategorized`. The saved snapshot contains 757 source-image links across 406 listings, and 374 listings have extracted product-table data; the source API exposed no video links. All 757 image references are represented by Blob-backed assets across 406 products; no non-Blob hero or image URLs remain. There are no configured lens-option rows or source video assets. Source descriptions were not copied. The listing facts, stock, specifications, and image rights have not been independently verified.

## Data flow

An optional `DATABASE_READ_URL` provides a separate Neon reader pool for public catalog, content, chatbot, and gift-offer reads. The primary `DATABASE_URL` remains authoritative for writes, authentication, checkout, orders, media, and administrative work. The reader cache snapshot follows the reader's visible state so replica lag does not produce cache keys ahead of replicated data. Configure this variable only with a dedicated read-only Neon endpoint/role; without it, reads use the primary pool.

For schema changes, a Neon read-only compute endpoint attached to the same primary branch replays DDL from the primary; wait for replication and verify the resulting schema on the reader rather than attempting to run migrations through its read-only connection. A separate Neon branch/database is an independent schema target: apply and validate each migration there using its writable migration connection before directing `DATABASE_READ_URL` to it. Do not configure a reader that is missing application tables or has not been confirmed read-only.

```text
Storefront SWR ──> /api/products ──> public catalog reads ──> Neon reader (optional)
Checkout ────────> /api/orders ────> reprice + reserve stock ──> Neon transaction + audit
Shopper account ─> /api/storefront/session ──> signed session + shopper auth ──> Neon
Admin SWR ───────> /api/admin/* ──> session-checked reads ──> Neon
Admin forms ─────> server actions ─> session + validation ──> Neon transaction + audit event
Media upload ────> authenticated route ──> media bytes + metadata in Neon
Media delivery ──> public /api/media path ──> ETag revalidation ──> Neon media object
Catalog import ──> authenticated route ──> public ISK Store API ──> draft records + audit events
```

Polling/revalidation is used; the application does not use database WebSockets. Do not describe these updates as instantaneous realtime subscriptions.

## Validation

From the repository root:

```bash
pnpm exec tsc --noEmit
node scripts/validate-build.mjs
pnpm build
```

`node scripts/validate-schema.mjs` requires `DATABASE_URL` and access to the configured Neon database. Never print environment variable values when diagnosing a connection issue.
