# Next Agent Handoff

_Last updated: 2026-11-08_

This document is the operational handoff for continuing the ecommerce storefront + admin CRM project. It intentionally records environment-variable **names and sources**, never secret values.

## Project status

- Framework: Next.js 16 App Router, React 19, Tailwind CSS 4.
- Package manager: `pnpm@12.3.4`.
- Primary database: Neon Postgres.
- File storage: Neon `store_media_objects`, served through the cacheable same-origin `/api/media/[...path]` route.
- AI integration: the chatbot optionally uses a stateless Mastra agent through Vercel AI Gateway when `AI_GATEWAY_API_KEY` is configured; without it, the deterministic FAQ/catalog assistant remains active.
- Production deployment: Vercel routes previously returned HTTP 402 (`DEPLOYMENT_DISABLED`). Cloudflare Worker version `a3508568-ba85-4a96-a5b1-f4c8a545593c` is deployed at `https://isk-lenses-storefront.isklenses.workers.dev` and uses Neon through Hyperdrive, but production traffic is not ready for DNS cutover; see **Cloudflare migration status** below.
- Database migration history: `db/migrations/`.
- Drizzle schema mirror: `lib/db/schema.ts`.
- Drizzle connection: `lib/db/index.ts`.
- Data access: `app/actions/storefront.ts`, `app/actions/admin.ts`.
- Read endpoints: public catalog under `app/api/products/`; authenticated admin data under `app/api/admin/`.
- Client refresh hooks: `lib/hooks/use-storefront-data.ts`, `lib/hooks/use-admin-data.ts`.
- **Permanent API parity rule:** every website behavior or data change must be reflected in the corresponding API and mobile integration contract in the same change, so Flutter/FlutterFlow and other clients can access the same behavior. See `AGENTS.md` and `docs/architect/AGENT_INSTRUCTIONS.md`; document any explicit exception.
- **Plain/power lens selection:** power-enabled listings require an explicit plain or power choice; plain has no surcharge and is stored as `plain` in both order-item eye fields. Legacy clients with two valid power values remain accepted. See `docs/API_MOBILE_INTEGRATION.md`; Toric products remain WhatsApp-only.
- **Product presence:** web and mobile report anonymous per-view-session heartbeats to `POST /api/products/{slug}/viewers`; this is a two-minute recent-session estimate, not verified people. Migration `0024_product_viewer_presence.sql` must be applied to each target before deployment; authoring it does not apply it. Configure distributed edge limits and periodic deletion of expired rows for idle-period retention; see the mobile integration guide.
- **Order details:** shoppers can read their own order details with the account session; guests can read the latest matching receipt on the original device. New signed receipts last 90 days and the next checkout replaces the previous receipt cookie. No migration or existing-order mutation is required. Current order status is store-entered; no courier feed, per-item transit or status history exists. See `docs/API_MOBILE_INTEGRATION.md`.
- **Blog resources:** `/blogs` contains original code-managed articles shared with Flutter through `GET /api/blogs`, and `GET /api/blog-resources` links to Bella Lense's external archive without copying articles or images. No blog tables or editor have been implemented.
- **Checkout autofill:** `GET /api/storefront/session` exposes the latest account-owned order's shipping address for editable web/mobile autofill, never a guest address. Guest email, last name, apartment and province are optional; guest customers without email are separate records. Apply `0025_optional_customer_email.sql` to each target before deployment; authoring the migration does not apply it. Additional original articles include original illustrations, not product photographs.
- **Brand assets:** the supplied ISK eye/lettermark is used in web navigation, admin, footer and browser icons, and bundled in Flutter navigation and Android/iOS launcher icons. Web assets are static (`/isk-logo.png`, `/isk-logo-detailed.png`); this visual change does not add or change API fields. Updating installed mobile icons requires a new signed app release.
- **Android APK hosting:** `/mobile-app` and `GET /api/mobile/android` link to the same-origin static `/isklenses.apk`. Replace it only with an APK signed using the original keystore, verify the signing certificate and increment its build number. The release certificate SHA-256 is `e23755e31e662dd90fc3defdab4e30171b5ab7a2ba3da0b9d0c6278d58e02f8f`; never generate a replacement signing key for normal updates.
- **Database read routing:** setting `DATABASE_READ_URL` routes catalog, site-content, public chatbot, and gift-offer reads (plus public cache snapshot keys) through a separate reader pool; writes, authentication, checkout, order lookups, media, and admin mutations continue using `DATABASE_URL`. Unset it until a dedicated read-only Neon endpoint and role are available; do not use an owner connection string as the reader.
- **Reader endpoint check (2026-11-07):** the candidate endpoint supplied for `DATABASE_READ_URL` connected but did not contain `store_products`; it is not the production catalog replica. The variable was removed and production reads were verified back on the primary. Do not configure a reader until its database contains the production schema/data and its connection is confirmed read-only.
- **Homepage design contract:** `GET /api/storefront/home` is the canonical source for shared hero slides, appearance palette/control styles, ordered/visible homepage sections and copy, plus hero layout/autoplay. Web and Flutter read the same normalized `data.content.appearance` and `data.content.configuration` values; admin writes use the validated settings API.
- **Homepage migration:** migration `0021_home_and_appearance_settings.sql` extends the allowed `store_settings` keys for `appearance` and `home_configuration`. It has been applied to the configured Neon database and verified by reading the live constraint and running `node --env-file-if-exists=.env.local scripts/validate-schema.mjs`. Apply it separately to any other target database before saving these settings there.
- **Storefront announcements:** `GET /api/storefront/home` exposes configured `chrome.deliveryNotice`, `chrome.announcements`, and `chrome.trustNotice`; web and Flutter share the continuous ticker, including the configured delivery amount and exact FDA notice.
- **Lens deals and gifts:** active category-combination offers are exposed at `GET /api/storefront/deals`, configured through the validated `deals` content setting, previewed on web/Flutter, and recalculated from current server prices/categories during checkout. A bundle needs a distinct item from every selected category; only the best-saving offer applies. Delivery uses the discounted subtotal. Show gift choices only during checkout—not in the cart—and only when no deal applies and the discounted merchandise subtotal is at least PKR 2,500; checkout and the server both validate eligibility. Keep API discovery, OpenAPI, and `docs/API_MOBILE_INTEGRATION.md` aligned.
- **Deals migration status:** the operator reports applying `db/migrations/0026_lens_promotions.sql` to the main database. Verified against the configured `DATABASE_URL`: `store_settings_key_check` includes `deals`, and `node --env-file-if-exists=.env.local scripts/validate-schema.mjs` passes. These checks do not prove that a separate Neon branch has the migration.
- **Read-replica migration guidance:** a Neon read-only compute endpoint attached to the same primary branch replays the primary's schema changes; do not run the migration on a read-only endpoint. Wait for replication and verify `store_settings_key_check` there. If `DATABASE_READ_URL` targets a separate Neon branch/database or independent replica, apply migration `0026` to that target through its writable migration connection and validate it before routing reads there. `DATABASE_READ_URL` is currently unset locally, so the app falls back to the primary. Do not reuse the previously checked candidate endpoint: it lacked `store_products`.
- **Cross-platform direction:** retain Next.js as the web and API backend; the Flutter shopper app lives in `apps/mobile` and consumes the existing API/OpenAPI contract. TanStack DB and a sealed public-catalog Neon Realtime path are implemented; the optional Mastra chatbot reads the same current FAQ/catalog facts on every turn. See `docs/architect/ARCHITECTURE_OVERVIEW.md` for security boundaries. Do not introduce TanStack Start as a parallel backend or replace application-owned auth without an explicitly reviewed migration.
- **Integration readiness:** Production Vercel has the existing database, admin-session/recovery, media, Meta, `NEON_REALTIME_URL`, and sensitive `NEON_REALTIME_SECRET` variables. Neon Realtime is enabled on the production `main` branch, restricted to `https://www.isklenses.online`, and the deployed sealed-query endpoint returns 200. `AI_GATEWAY_API_KEY` remains optional and unset; the chatbot's deterministic FAQ/catalog mode stays active without it. Production migration `0020_product_power_choices.sql` is applied and verified. Use Node.js 22.18+ for the Cloudflare toolchain. Do not invent credentials or connect clients directly to Postgres.
- Sync notes: `docs/DATABASE_SYNC.md`.
- `.github/workflows/android-release.yml` remains an optional GitHub release workflow and does not publish the customer-facing download. The production `/mobile-app` page and `GET /api/mobile/android` use the static website APK described above.
- GitHub operation identity: project agents must verify and use `@qaiserfccc` for GitHub mutations; see `AGENTS.md`.
- The ISK Lenses storefront and admin screens use the shared Neon database. Product variants, published product details, image/video galleries, a protected public-catalog draft importer, and a full `/products` index are implemented. Product media uses the Neon-backed media library and public product responses expose only same-origin media URLs. The storefront has a multi-level source category browser and a sky/ice-blue palette. Migrations `0006_store_product_categories.sql` and `0016_database_media_store.sql` are applied and schema validation passes.
- COD checkout and shopper sign-in/registration are implemented in the application: guests and account holders can submit inventory-checked orders, with no online payment. Checkout includes the configured delivery fee and prevents orders until delivery pricing covers the subtotal. Shopper accounts do not verify email, provide password reset, or expose order history.
- Admin access now uses database-backed owner/admin/staff accounts, scrypt password hashes, and revocable signed sessions. Migration `0002_store_admin_users.sql` is applied to the connected Neon main branch, and an initial owner exists.
- Migrations `0003_isk_lens_catalog.sql`, `0004_isk_source_snapshot_import.sql`, `0006_store_product_categories.sql`, and `0016_database_media_store.sql` are applied to the connected Neon database and schema validation passes. The full replacement import was verified on 2026-10-10: 495 distinct products, 757 source-image links across 406 listings, 374 records with extracted table specifications, and no source video links. On the same date, the operator directed that all 495 products be published at a configured stock of 5 each. All are active; this operator-entered quantity is not verified physical stock. Migration 0006 seeds the 33 observed source categories and their parent relationships. All 757 available product-image references, 28 banners, and the footer logo have been restored into Neon media storage. Inaccessible legacy Blob URL references were cleared while preserving asset metadata. No video files were available in the imported source snapshot; no product videos were added. There are zero configured lens-option rows. Descriptions were not copied. Existing orders, order items, customers, and the one admin account were preserved.
- Migration `0005_cod_checkout_and_customer_accounts.sql` adds shopper credentials/session versions, COD and delivery-fee fields, order idempotency, and stock-reservation metadata. It is applied to the connected Neon database and schema validation passes; apply it separately to other target environments before enabling checkout there.

## Connected integrations

Verified through the project integration inventory:

1. **Neon** — connected and supplies the Postgres connection variables below.
2. **Neon** — supplies the database connection used for both application data and media objects. Vercel Blob is no longer used by the runtime.
3. **Vercel AI Gateway** — connected; optional Mastra chatbot responses use it when the server key is configured.

Do not replace Neon with another database unless explicitly requested. Do not add a second database driver or use `@neondatabase/serverless`; this project uses `pg` + Drizzle.

## Environment variables

The variables below are currently managed by the Vercel/v0 project environment and mirrored into local development. Vercel remains the production source of truth until a Cloudflare cutover is verified. For a future Cloudflare deployment, copy the required variables into Worker secrets using the platform secret manager; do not print or commit values, and do not upload `.env*` files.

### Required for current database, storage, and admin auth code

| Variable | Source | Usage |
|---|---|---|
| `DATABASE_URL` | Neon | Primary pooled Postgres connection used by `lib/db/index.ts`. |
| `DATABASE_READ_URL` | Neon read-only endpoint (optional) | Read-only catalog, content, chatbot, and public-data queries; falls back to `DATABASE_URL` when unset. Must use a dedicated read-only role/endpoint. |
| `ADMIN_SESSION_SECRET` | Project environment | HMAC key for signed admin session cookies; set a cryptographically random value of at least 32 characters in each environment. |
| `CUSTOMER_SESSION_SECRET` | Project environment (optional) | Separate shopper-session HMAC source; if unset, the app derives a domain-separated shopper key from `ADMIN_SESSION_SECRET`. |

Admin access and shopper account/order signing fail closed until the required session secret and database migrations are configured. Credentials and roles are stored in `store_admin_users`; passwords are salted scrypt hashes. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are used only by the one-time local bootstrap script and are not read by the deployed application. Staff accounts are read-only; admins can change store data; owners can manage accounts. The owner-only System users panel can create admin/staff accounts and revoke their sessions. Public checkout/account throttles and the in-process admin login throttle are defense in depth, not distributed rate limits; configure edge-level rate limiting before production exposure.

The initial owner currently uses the provisional address `owner@localhost.invalid`; its generated password is stored in the ignored, mode-`600` `.env.local`. Sign in and update the owner email/password in **System users** before normal team use. Set local-only `ADMIN_LOGIN_PREFILL=true` in `.env.local` to prefill credentials and show a one-click **Quick sign in** button when using localhost in development; the production/preview sign-in never returns or displays the password. `ADMIN_SESSION_SECRET` is configured separately for local, Development, Preview, and Production.

### Neon-provided connection aliases

These are available from the Neon integration and may be useful for tooling or migrations. Prefer `DATABASE_URL` in application code unless a specific script needs another connection mode.

- `DATABASE_URL_UNPOOLED`
- `DATABASE_READ_URL` (application-configured reader; not supplied by the Neon integration)
- `NEON_PROJECT_ID`
- `PGDATABASE`
- `PGHOST`
- `PGHOST_UNPOOLED`
- `PGPASSWORD`
- `PGUSER`
- `POSTGRES_DATABASE`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_URL_NO_SSL`
- `POSTGRES_USER`
- `NEON_AUTH_BASE_URL`
- `VITE_NEON_AUTH_URL`

### PostgreSQL TLS mode

The deployed Node `pg` connection setup and database utility scripts normalize legacy `sslmode=prefer`, `sslmode=require`, and `sslmode=verify-ca` aliases to `sslmode=verify-full`. This preserves the current `pg-connection-string` behavior while avoiding its security warning and retaining hostname verification. Keep this normalization in place for every Postgres pool/client. Do not silence the warning by disabling TLS verification or switching to weaker compatibility semantics. Vercel `DATABASE_URL` values may also be configured with `sslmode=verify-full` directly.

The active Neon project identifier observed during schema work is `polished-dust-86909173`. Use the connected Neon tools/integration rather than hardcoding this identifier in runtime code.

### Available but unrelated to current data layer

- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` is present in the project environment inventory, but Supabase is not the active database/auth integration. Do not introduce Supabase code unless the architecture is explicitly changed.

### Optional chatbot integration

| Variable | Source | Usage |
|---|---|---|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway | Enables stateless Mastra responses on `/api/chatbot`; without it, deterministic FAQ/catalog answers remain active. Server-side only. |

### Not currently configured by this project

- `BETTER_AUTH_SECRET` is not present in the available environment inventory. Do not add Better Auth imports or auth routes until this secret is supplied and the Better Auth setup is intentionally approved.
- No custom `BETTER_AUTH_URL` is currently documented or required.

## Database and schema workflow

1. Make every schema change in a new numbered SQL file under `db/migrations/`.
2. Keep each migration replayable where practical (`IF NOT EXISTS`, guarded indexes/triggers).
3. Apply DDL to the connected Neon database through the Neon SQL tool, one SQL statement per call.
4. Refresh the live schema through the Neon integration after DDL changes.
5. Update `lib/db/schema.ts` to exactly mirror the live schema.
6. Run the repository validation script after schema changes.

The current schema includes products, product assets, source product categories, product variants, staged source-import runs/items, customers, orders, order items, activity events, and admin users. Migration `0003_isk_lens_catalog.sql` adds source provenance, image/video media typing, product variants, the PKR product-currency default, and updated-at triggers. Migration `0004_isk_source_snapshot_import.sql` adds structured source snapshots and bounded import staging. Migration `0006_store_product_categories.sql` adds the observed WooCommerce category hierarchy and an idempotency index for imported product assets.

## Data synchronization contract

- Storefront reads flow through SWR hooks to `/api/products`, then Drizzle/Neon.
- Admin metrics, products, orders, customers, and activity flow through session-protected `/api/admin/*` routes.
- Every admin server action checks the signed session independently. Mutations validate inputs and write audit events transactionally.
- Product image/video upload, reorder, and delete use authenticated Next.js route handlers and Neon `store_media_objects`; media paths and product metadata are persisted in the catalog.
- Public catalog/detail responses include active lens options, supported uploaded media, and source-category IDs. Product photography is exposed only through same-origin `/api/media/...` URLs; source image URLs are not returned for storefront display. Other import provenance is admin-only.
- The public WooCommerce Store API importer is authenticated and stages all pages of 50 records before atomically replacing the product catalog. It retains structured fields, extracted table specifications, pricing, categories, availability, and image/video URL references; it excludes descriptive copy and does not download/rehost media. After an import, `node --env-file=.env.local scripts/rehost-source-product-images.mjs` copies approved ISK upload images into the database media library; it is bounded, retries transient failures, and is safe to rerun. The source snapshot contained no video links. Each new import creates drafts with zero stock. The current catalog was separately published at the operator's direction; verify listing details and source media rights before relying on or adding claims.
- After a successful admin mutation, call the relevant SWR `mutate()`/refresh function for immediate UI consistency.
- Current UI synchronization uses SWR polling/revalidation as fallback. The web catalog now also uses a server-sealed, aggregate-only Neon Realtime query through TanStack DB when the service is provisioned. Flutter shopper and commerce-admin workflows use the REST API; the admin client includes product/variant/media, taxonomy, order, review, customer, CRM, storefront/settings, chatbot, delivery, profile, and owner-only staff controls.
- Admin access is a database-backed owner/admin/staff system with scrypt-hashed passwords and revocable signed sessions; it is not SSO.
- The storefront bag is in-page state only. COD order creation and signed-in customer order-history reads are available through the existing REST API; online payment is not implemented. Verify delivery settings and target-database migrations before enabling checkout in another environment.
- Completed admin commerce operations are exposed through authenticated REST routes documented in `openapi.json` and `docs/API_MOBILE_INTEGRATION.md`; routes reuse the existing permission-checked server operations rather than duplicating database writes. Project Kanban remains project coordination UI and is not part of the commerce API.

## Deployment reference

- Vercel project is already linked locally via `.vercel/` and remains the current production host.
- Use the Vercel project UI for normal preview/production publishing until the Cloudflare migration has passed every cutover check below.
- The local code session is the linked repository checkout; use its authenticated Vercel CLI context only after reviewing the diff, verifying required environment configuration, and ensuring the intended work is ready to publish.
- Do not deploy from or commit the `.env` files.
- Before deployment, verify Neon is configured for the target environment and apply all numbered database migrations.
- After deployment, verify `/`, `/api/products`, `/api/media/...`, and `/api/admin/metrics` in the deployed environment and inspect runtime logs if a database error appears.
- **Production deployment verified 2026-11-01:** `https://www.isklenses.online` is the Vercel alias that serves this project's API; `https://isklenses.com` does not serve these API routes. The Flutter default `ISK_API_ORIGIN` points to the working API alias. The latest deployment is `e-commerce-app-design-mtpgrkud0-qaiserfcccs-projects.vercel.app` (Production, Ready). `GET /`, `GET /api/products`, `GET /api/chatbot/knowledge`, a chatbot `POST /api/chatbot`, and `GET /api/realtime/catalog` returned 200; unauthenticated `GET /api/admin/metrics` returned the expected 401. Neon Realtime is enabled on the production `main` branch with `https://www.isklenses.online` as the allowed browser origin. Both Neon-provided Realtime variables are configured for Vercel Production, with the signing secret marked sensitive. The Realtime endpoint returns the URL and sealed public-catalog query without exposing the signing secret. An initial API smoke test found missing migration 0020 columns; the existing idempotent migration was applied and verified on Production. Vercel build artifacts under `apps/mobile/build` are excluded with `.vercelignore`. No environment values were displayed. `AI_GATEWAY_API_KEY` remains optional and unset.
- **Shared-homepage deployment:** migration 0021 was applied and verified on the configured Neon database before deployment. The production deployment `e-commerce-app-design-5bb8ga9zo-qaiserfcccs-projects.vercel.app` is aliased to `https://www.isklenses.online`; `GET /`, `GET /api/storefront/home`, and `GET /api/openapi.json` returned 200. The live home response includes appearance, configuration, 26 banners, and nine configurable sections. Production environment-variable names for database, Realtime, media, Meta, and admin/session configuration were present; no values were displayed. The API contract validator and production build passed.

### Cloudflare migration status (deployed, not cut over)

- Cloudflare Workers Free is the selected candidate because it avoids bandwidth-based egress charges, addressing the reported Vercel transfer-limit issue. It is not unlimited: the current Free plan includes a 100,000 requests/day quota and 10 ms CPU per invocation. Confirm live plan limits and expected traffic before cutover.
- `vite.config.ts` and `cloudflare.config.ts` configure the vinext Worker `isk-lenses-storefront`. `cloudflare-worker.ts` injects the Hyperdrive connection string before dynamically loading the application, redirects each apex domain to its matching `www` host, and streams `/isklenses.apk` from the tracked public GitHub raw URL, including byte-range support. The Vite public asset copy excludes the 50.6 MiB APK because Cloudflare's per-asset limit is 25 MiB. No R2 is required.
- Hyperdrive `isk-lenses-neon-primary` (configuration ID `9c96e464feed4d7abbabb9772308999a`) connects to the Neon primary using the unpooled origin, with query caching disabled. It is bound as `HYPERDRIVE`; do not store its origin credentials in the repository. Current Worker version on 2026-11-08: `a3508568-ba85-4a96-a5b1-f4c8a545593c`.
- `lib/db/index.ts` selects a request-scoped PostgreSQL pool through `AsyncLocalStorage`; `cloudflare-worker.ts` creates a one-connection pool per request and closes it when the streamed response finishes or is canceled. This replaces a shared isolate pool after repeated 1101 runtime cancellations. Earlier on 2026-11-08, the Worker passed sequential and concurrent route checks, but the newer runtime status below supersedes those results. Authenticated admin, order-free checkout validation, remaining APIs, and longer monitoring still need verification. Cloudflare TypeScript and vinext build passed with Node 22.
- **Latest runtime status (2026-11-08):** Worker version `a3508568-ba85-4a96-a5b1-f4c8a545593c` (version 10) is deployed. A homepage request returned 200 but took about 29 seconds; subsequent `/api/products`, `/api/storefront/home`, `/api/storefront/deals`, and `/` requests intermittently returned Cloudflare HTTP 503 with error code 1102. Latest checks at 12:43 +05:00 still returned 503 for `/` and `/api/products`. Do not treat the earlier passing smoke checks as proof of production readiness. Error 1102 indicates a Worker resource-limit failure; the Free plan's 10 ms CPU budget is a plausible cause for Next.js SSR, but the available evidence does not distinguish CPU from memory exhaustion. Diagnose Worker resource use and database latency, then repeat sequential and concurrent checks before considering DNS cutover. Cloudflare documents higher CPU limits only on its Paid plan; do not upgrade or incur charges without the user's approval. The Cloudflare Worker API currently reports observability/log persistence disabled; Ray ID log lookup returned 403 and CPU profiling found no recent executions. Wrangler tail requires a `CLOUDFLARE_API_TOKEN`, which is not available in this session; runtime logs remain inaccessible.
- `/api/realtime/catalog` returns 503 (`Catalog live updates are not configured.`): the Worker lacks `NEON_REALTIME_SECRET`; it also lacks the existing Meta app secret, page access token, and webhook verify token. Vercel CLI `env pull` returned empty values for these sensitive variables, so none were transferred. The local `.env.local` also lacks these values and names a Neon project ID that is not available in the connected Neon account; its database hostname does not identify a safe Realtime project credential source. Provision the production values directly in Cloudflare using its secret manager before claiming parity for Realtime or Meta lead integrations. Do not rotate or retrieve a secret from the unrelated Neon project, and do not copy the unverified `DATABASE_READ_URL`.
- Cloudflare CLI OAuth authentication is configured for the selected account. Both zones are still `pending`: `isklenses.com` (`997ac69884c64f7a9ba0103a8b19e171`) and `isklenses.online` (`3748d0c8bd7d7e4b45445ea9681dfb03`). Both are assigned `annalise.ns.cloudflare.com` and `chip.ns.cloudflare.com`; both currently delegate to Hostinger (`ns1.dns-parking.com`, `ns2.dns-parking.com`). The Worker has custom-domain bindings for apex and `www` on both domains, but they will not serve public traffic until delegation changes and Cloudflare activates the zones. No nameserver change has been made.
- **DNS preparation (2026-11-08):** Refreshed the expired Hostinger Connector OAuth session using the extension's official Hostinger issuer and retrieved the authoritative zone records plus domain details. Hostinger lists 9 records for `.com` and 11 for `.online`; Cloudflare now has 12 and 19 records, respectively. All records from Hostinger's zone API are accounted for: mail, SPF/DKIM/DMARC, FTP, Vercel verification, the `expense` subdomain, and Hostinger's autoconfig/autodiscover records are preserved; apex and `www` are replaced by Cloudflare Worker-managed records. Added the missing `_vercel.isklenses.com` TXT, `expense.isklenses.com` CNAME, and `hostingermail-c._domainkey.isklenses.online` CNAME. Cloudflare's existing CAA entries were retained. Its DNS scan also found wildcard and `mail` A records on `.online`; those remain DNS-only in Cloudflare. Hostinger's existing snapshots are available for both zones. Both zones remain pending and registrar nameservers remain Hostinger; no cutover has occurred.
- **Hostinger fallback eligibility:** The connected account has one active `hostinger_premium` order (`200729108`), and the `.online` and `.com` websites currently run WordPress. Per Hostinger's deployment requirements, Node.js apps require Business or Cloud plans; this Premium plan is not eligible. The Next.js app cannot be deployed there as a functional full-stack site without a plan change or a separate suitable host. Do not upgrade or purchase a plan without approval.
- **Production incident (2026-11-08):** read-only `curl` checks of `https://www.isklenses.online/`, `/api/openapi.json`, the apex domain, and the latest direct Vercel Production deployment URL return HTTP 402 with `x-vercel-error: DEPLOYMENT_DISABLED`. Vercel CLI still lists recent deployment builds as Ready, but their HTTP routes are disabled. Treat the live web/API as unavailable until a host with required runtime configuration is deployed and verified.
- DNS record reconciliation is complete against Hostinger's API inventory, but DNS cutover is blocked by Worker 503/1102 failures. Before nameserver changes, verify the Worker serves the site reliably and obtain explicit confirmation for the registrar nameserver change. Do not cut over while the Worker is failing. Do not purchase or upgrade a Cloudflare or Hostinger plan without explicit approval.
- The Worker currently has secrets named `ADMIN_RECOVERY_KEY`, `ADMIN_SESSION_SECRET`, `DATABASE_URL`, `META_GRAPH_API_VERSION`, `META_PAGE_ID`, and `NEON_REALTIME_URL`. `DATABASE_URL` is overwritten with `HYPERDRIVE.connectionString` before the application imports its database module. `ADMIN_SESSION_SECRET` was newly generated, so existing Vercel admin/shopper signed sessions are invalid on this Worker and users would need to sign in again. `CUSTOMER_SESSION_SECRET` falls back to the admin secret; `NEON_REALTIME_SECRET`, Meta access/webhook/app secrets, and `AI_GATEWAY_API_KEY` are not configured. Keep `DATABASE_READ_URL` unset unless its endpoint is confirmed current and read-only. Never place secrets in `cloudflare.config.ts`, Vite variables, or browser code.
- To redeploy, use `pnpm run deploy:vinext` with Node.js 22.18+. Earlier successful checks on 2026-11-08 were followed by intermittent 503/1102 responses; repeat the full route suite only after the runtime issue is diagnosed. Authenticated admin, order-free checkout validation, remaining APIs, and Realtime/Meta integrations still need verification.
- After successful production checks and complete DNS reconciliation, the user-requested target is both domains: apex redirects to the matching `www` host, and all four custom domains are already bound to the Worker. Historical Vercel checks showed that `.com` was not then serving this project's API; do not treat Vercel as a working rollback while its routes return 402. Keep its configuration untouched in case service is re-enabled. Set up Cloudflare Web Analytics separately if analytics are required; Vercel Analytics was removed from the app shell because it does not collect on Cloudflare.

## Validation checklist

From the repository root:

```bash
pnpm exec tsc --noEmit
node scripts/validate-build.mjs
node --env-file=.env.local scripts/validate-schema.mjs
pnpm build
```

Schema validation requires `DATABASE_URL` and access to the configured Neon database. The canonical production check remains `pnpm build`.

Also inspect:

- `git diff -- db/migrations lib/db app/actions app/api lib/hooks docs`
- live Neon schema through the integration tool when available
- deployment/build logs on the currently active platform after publishing

## Safe handoff rules

- Never print or commit secret environment values.
- Never use localStorage as the source of truth for products, orders, customers, or admin metrics.
- Never hardcode product/catalog records in the storefront once database-backed records are available.
- Preserve migration history; add a new migration instead of rewriting an applied migration.
- Keep SQL in `db/migrations/` and application queries in Drizzle modules.
- If a required integration variable appears missing, refresh the integration inventory once before concluding it is unavailable.

## Repository snapshot and agent memory

_Verified in the repository on 2026-10-10._

- The implementation is Next.js App Router with React 19, TypeScript, Tailwind CSS 4, and `pnpm`; data routes and server actions run inside Next.js. There is no Express service in this codebase. Preserve this architecture unless a framework migration is explicitly approved.
- The approved customer-facing brand is **ISK Lenses**, replacing the previous lifestyle-goods direction. Keep product statements factual and do not invent medical or performance claims.
- The current GitHub-operation policy is to verify `gh api user --jq .login` and operate only as `qaiserfccc`. A check on 2026-10-10 returned `qaiserfcc`, so no GitHub operations were performed in that session; do not switch identities to work around the mismatch. GitHub Actions are enabled in repository settings, but there are no checked-in workflows or recorded workflow runs. The repository allows all actions. One other collaborator, `qaiserfcc`, was previously observed with write access. Repository instructions do not enforce account exclusivity for other repository users; enforce it through GitHub access controls if repository-wide exclusivity is required. Attempts to lower the collaborator's role via the collaborator permission API were rejected, and access was not otherwise changed.
- The storefront reads active products through `app/api/products/route.ts` and `lib/hooks/use-storefront-data.ts`. The admin overview reads metrics through `app/api/admin/metrics/route.ts` and `lib/hooks/use-admin-data.ts`. Admin workspace areas have direct `/admin/<section>` URLs.
- Admin sign-in uses database-backed identities and a signed HTTP-only cookie. Product/order/customer reads, admin mutations, and image endpoints verify the session on the server.
- Admin sign-in uses database-backed owner/admin/staff accounts and signed HTTP-only cookies; owner-only user management is available in the workspace. The admin migration and initial owner have been provisioned in Neon.
- Product, order, customer, and analytics screens are connected to authenticated database routes; mutations validate inputs and log metadata-only audit events.
- Product image/video upload, preview, reorder, and deletion use Neon `store_media_objects` and `store_product_assets`; media responses carry ETags and require revalidation before reuse. Product and content media restoration scripts are `scripts/rehost-source-product-images.mjs` and `scripts/restore-content-images.mjs`. Lens-option management is database-backed. COD order creation uses an idempotency key and transactional stock reservation; cancellation restores reserved inventory. Admin-managed delivery prices are included in checkout quotes and orders; admins can adjust delivery fees and mark payment received after delivery. There is no online payment, email verification, password reset, customer order history, configured tax calculation, or automatic delivery-fee notification.
- `components/admin/project-kanban.tsx` is a read-only snapshot of requirements versus repository status. Its task definitions are code-level project context, not order/customer records or persistent task data. It deliberately does not mutate business data.

## Next recommended work

1. Replace the provisional owner credentials in **System users** before normal team use; apply edge-level sign-in rate limiting before production exposure.
2. Review the published listings and verify lens specifications, prices, imagery, claims, media rights, and configured stock; the operator-entered quantity of 5 does not attest to physical inventory. One listing has no available source image; the 89 uncategorized products have no source categories.
3. Set the actual delivery fee and optional free-delivery minimum in Admin → Delivery before enabling checkout. Migration `0015_delivery_rules.sql` adds the delivery key to the settings constraint for target databases that enforce one; the connected database currently has no `store_settings` key check constraint. Configure edge-level rate limiting before production exposure.
4. Manage repository collaborator access in GitHub settings if repository-wide operator exclusivity is required.
5. If GitHub Actions workflows are introduced, gate every job to `github.actor == 'qaiserfccc' && github.triggering_actor == 'qaiserfccc'`.
6. Keep this file updated whenever integrations, environment variables, deployment settings, migrations, or verified project status change.

## Quick file map

```text
db/migrations/0001_storefront_workspace.sql
db/migrations/0005_cod_checkout_and_customer_accounts.sql
lib/db/schema.ts
lib/db/index.ts
app/actions/storefront.ts
app/actions/checkout.ts
app/actions/admin.ts
app/api/orders/route.ts
app/api/products/route.ts
app/api/admin/
app/checkout/
lib/hooks/use-storefront-data.ts
lib/hooks/use-admin-data.ts
docs/DATABASE_SYNC.md
docs/NEXT_AGENT_HANDOFF.md
```

This file is a reference, not a secret store. The authoritative environment values remain in the connected Vercel project integrations and Vars settings.

## Eyelenses.pk-style redesign (branch `qaiserfccc-eyelenses-pk-redesign`)

- Storefront routes live in `app/(store)/`: `/`, `/shop`, `/product-category/[...path]`, `/product/[slug]`, `/cart`, `/checkout`, `/checkout/confirmation`, `/my-account`, `/faq`, `/contact-us`, `/blogs`, `/shipping-returns`, `/privacy-policy`, `/terms-conditions`. `/products*` redirects to `/shop` and `/product/*`.
- Admin moved to `/admin` (`components/admin/admin-shell.tsx` wraps `AdminWorkspace`, themed via `.admin-theme` in `globals.css`).
- Shell: `components/storefront/shell/` (announcement bar, header, mega-menu, mini-cart, footer). Palette navy `#033473`, font Outfit. Legacy checkout/product-detail are re-themed through `.storefront-sky` colour remaps.
- Optional env vars (names only): `NEXT_PUBLIC_STORE_PHONE`, `NEXT_PUBLIC_STORE_EMAIL`, `NEXT_PUBLIC_STORE_WHATSAPP`, `NEXT_PUBLIC_STORE_INSTAGRAM_URL`, `NEXT_PUBLIC_STORE_FACEBOOK_URL`.
- Static/policy pages are neutral drafts; blogs has no posts. Have the owner review legal text, return terms, and contact details before launch.
- `DESIGN.md` still describes the earlier design and needs a rewrite for this system.

## Roles, cache and DB-driven storefront

- Roles: admin side (`owner > admin > staff`, `lib/auth/admin.ts`), buyer (customer account, `lib/auth/store-customer.ts`, `/my-account` incl. "My orders" via `/api/storefront/orders`), and guest COD checkout.
- Migration `db/migrations/0007_storefront_content.sql` adds `store_banners`, `store_reviews`, `store_settings` (seeded from the former dummy homepage data). **Must be applied to Neon** before the home page, header and footer show content.
- Home, header and footer are loaded from the DB via `lib/data/site-content.ts`; the catalog via `lib/data/catalog.ts`. Admin edits them under "Storefront content" (`app/actions/content.ts`, media upload at `/api/admin/content/upload`).
- Cache (`lib/cache.ts`): Next.js Data Cache with `catalog` (300s/600s) and `content` (300s) tags. Each cache lookup obtains a PostgreSQL MVCC snapshot for its cache key; committed direct SQL or application writes change the snapshot without write-side locks or triggers. All database transactions can change the key, even unrelated writes or rollbacks, so the extra read and cache churn should be monitored under real traffic. On snapshot-query failure the cache is bypassed. App mutations also expire relevant tags. Public catalog/content APIs return `no-store`, and pages render dynamically. Media URLs can be overwritten, so clients and CDNs must revalidate them via ETag; each media revalidation still reads the database. Previously cached media may remain stale until the old CDN/browser cache lifetime expires or the URL changes. Checkout reads authoritative prices and stock directly. Do not cache authentication or private customer/order data; self-hosted multi-instance deployments need a shared Next.js cache handler and all instances must connect to the same primary database. Flush the Data Cache after changing or restoring the database because snapshot identifiers alone do not identify a database or restore timeline.
- Seeded source-image references are restored by `scripts/restore-content-images.mjs` into the database media library.

### Applied to Neon (main branch, only branch)
Migration 0007 applied and schema validated. `scripts/mirror-content-images.mjs` remains as a compatibility wrapper for `scripts/restore-content-images.mjs`, which rewrites seeded banner/footer image URLs to the database media library.

### Auth now fully DB-backed
Admin and customer credentials live in `store_admin_users` / `store_customers`. The session signing secret is stored in `store_secrets` (migration 0008, lazily created by `lib/auth/secret.ts`); `ADMIN_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET`, `ADMIN_EMAIL/PASSWORD/LOGIN_PREFILL` are no longer used. Optional recovery key: row `admin_recovery_key` in `store_secrets`. Create owners with `SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed-admin.mjs`. No media-provider credentials are required; the database connection is used for media storage.

## Nested categories and category-bound catalog (migration 0009, applied to Neon)

- All legacy products (and their 757 Blob files via `scripts/purge-product-blobs.mjs`), the ISK import/sync tooling and `store_product_categories`/import tables were removed. Order history is kept (`store_order_items.product_id` has no FK).
- `store_categories`: unlimited nesting (`parent_id`), globally unique slug, URL `/product-category/<slug chain>` (short slug paths remain addressable and resolve without redirecting). Managed in Admin → Categories (`app/actions/catalog-admin.ts`, `components/admin/category-manager.tsx`).
- `store_products.category_id` is NOT NULL (RESTRICT): a product always belongs to a category and also shows in every ancestor. New fields: brand, SKU, short description, compare-at price, colors, diameter, base curve, water content, material, wear duration, pack contents, power type/range, UV, features, specs, usage, featured, SEO. Variants/assets/checkout are unchanged.
- `store_product_reviews` (guest submit via `POST /api/products/[slug]/reviews`, moderated in admin) and `store_product_relations` (hand-picked related products).
- Product-page bottom sections (related, also bought, best sellers, recent orders, featured, newest, same category) are configured in Admin → Reviews & product page, stored in `store_settings` key `product_page`.
- `lib/data/catalog.ts` + `lib/catalog-types.ts` are the cached loaders/types. `scripts/seed-catalog.mjs` seeds a starter tree and 3 sample products (idempotent). Products now have to be created in admin.

## Power lens pricing and shared carousels

- Power options are configured in the `power_options` setting (admin: Power lens options); checkout recomputes base + per-eye surcharge server-side and compares quotes in cents. Keep web, Flutter and OpenAPI aligned.
- Homepage directory sections are paginated at 15 items via `GET /api/storefront/home/sections/{section}` and use the shared carousels (web `components/ui/shared-carousel.tsx`, Flutter `isk_carousel.dart`); change both together.
- Product/catalog imagery uses contain-fit; heroes may use cover. Hero images are topped up to five shared defaults.

- Free Cosmetic gift: `free_gift` setting, `GET /api/storefront/gift`, `giftProductId`/`giftConfirmed` on orders; lens line = non-Cosmetics product. Homepage carousels are full width; lens types use the continuous carousel on web and mobile.

- Gift flash bar links to checkout; gift choices are checkout-only and never shown on the cart page. Homepage `showcase` section (config id `showcase`) with big spotlight images; default order puts brands 6th. Keep web and Flutter identical.

- Bulk price/power product actions: `bulkUpdateProductPrices`, `bulkUpdateProductPowerOptions` (catalog-admin.ts), REST `/api/admin/products/bulk-price|bulk-power`. Power defaults extend to -14.00. Mobile admin bulk UI not implemented.
# Toric ordering

Toric lens types use a derived storefront category and must be confirmed on WhatsApp with full advance payment; cash-on-delivery checkout rejects them server-side. No prescription combinations, pricing or payment verification are inferred or implemented; consult `docs/API_MOBILE_INTEGRATION.md` before extending this workflow.
