# Next Agent Handoff

_Last updated: 2026-11-01_

This document is the operational handoff for continuing the ecommerce storefront + admin CRM project. It intentionally records environment-variable **names and sources**, never secret values.

## Project status

- Framework: Next.js 16 App Router, React 19, Tailwind CSS 4.
- Package manager: `pnpm@12.3.4`.
- Primary database: Neon Postgres.
- File storage: Neon `store_media_objects`, served through the cacheable same-origin `/api/media/[...path]` route.
- AI integration: the chatbot optionally uses a stateless Mastra agent through Vercel AI Gateway when `AI_GATEWAY_API_KEY` is configured; without it, the deterministic FAQ/catalog assistant remains active.
- Deployment target: Vercel. The project is already linked in `.vercel/`.
- Database migration history: `db/migrations/`.
- Drizzle schema mirror: `lib/db/schema.ts`.
- Drizzle connection: `lib/db/index.ts`.
- Data access: `app/actions/storefront.ts`, `app/actions/admin.ts`.
- Read endpoints: public catalog under `app/api/products/`; authenticated admin data under `app/api/admin/`.
- Client refresh hooks: `lib/hooks/use-storefront-data.ts`, `lib/hooks/use-admin-data.ts`.
- **Permanent API parity rule:** every website behavior or data change must be reflected in the corresponding API and mobile integration contract in the same change, so Flutter/FlutterFlow and other clients can access the same behavior. See `AGENTS.md` and `docs/architect/AGENT_INSTRUCTIONS.md`; document any explicit exception.
- **Homepage design contract:** `GET /api/storefront/home` is the canonical source for shared hero slides, appearance palette/control styles, ordered/visible homepage sections and copy, plus hero layout/autoplay. Web and Flutter read the same normalized `data.content.appearance` and `data.content.configuration` values; admin writes use the validated settings API.
- **Homepage migration:** migration `0021_home_and_appearance_settings.sql` extends the allowed `store_settings` keys for `appearance` and `home_configuration`. It has been applied to the configured Neon database and verified by reading the live constraint and running `node --env-file-if-exists=.env.local scripts/validate-schema.mjs`. Apply it separately to any other target database before saving these settings there.
- **Cross-platform direction:** retain Next.js as the web and API backend; the Flutter shopper app lives in `apps/mobile` and consumes the existing API/OpenAPI contract. TanStack DB and a sealed public-catalog Neon Realtime path are implemented; the optional Mastra chatbot reads the same current FAQ/catalog facts on every turn. See `docs/architect/ARCHITECTURE_OVERVIEW.md` for security boundaries. Do not introduce TanStack Start as a parallel backend or replace application-owned auth without an explicitly reviewed migration.
- **Integration readiness:** Production Vercel has the existing database, admin-session/recovery, media, Meta, `NEON_REALTIME_URL`, and sensitive `NEON_REALTIME_SECRET` variables. Neon Realtime is enabled on the production `main` branch, restricted to `https://www.isklenses.online`, and the deployed sealed-query endpoint returns 200. `AI_GATEWAY_API_KEY` remains optional and unset; the chatbot's deterministic FAQ/catalog mode stays active without it. Production migration `0020_product_power_choices.sql` is applied and verified. Use Node.js 22.13+ for local and deployed runtime. Do not invent credentials or connect clients directly to Postgres.
- Sync notes: `docs/DATABASE_SYNC.md`.
- GitHub Actions: no workflow files are currently tracked in `.github/workflows/`.
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

The variables are managed by the Vercel/v0 project environment and mirrored into the local development environment. Use the project Vars/integration settings to inspect or change values. Never commit `.env*`, tokens, passwords, or full connection strings.

### Required for current database, storage, and admin auth code

| Variable | Source | Usage |
|---|---|---|
| `DATABASE_URL` | Neon | Primary pooled Postgres connection used by `lib/db/index.ts`. |
| `ADMIN_SESSION_SECRET` | Project environment | HMAC key for signed admin session cookies; set a cryptographically random value of at least 32 characters in each environment. |
| `CUSTOMER_SESSION_SECRET` | Project environment (optional) | Separate shopper-session HMAC source; if unset, the app derives a domain-separated shopper key from `ADMIN_SESSION_SECRET`. |

Admin access and shopper account/order signing fail closed until the required session secret and database migrations are configured. Credentials and roles are stored in `store_admin_users`; passwords are salted scrypt hashes. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are used only by the one-time local bootstrap script and are not read by the deployed application. Staff accounts are read-only; admins can change store data; owners can manage accounts. The owner-only System users panel can create admin/staff accounts and revoke their sessions. Public checkout/account throttles and the in-process admin login throttle are defense in depth, not distributed rate limits; configure edge-level rate limiting before production exposure.

The initial owner currently uses the provisional address `owner@localhost.invalid`; its generated password is stored in the ignored, mode-`600` `.env.local`. Sign in and update the owner email/password in **System users** before normal team use. Set local-only `ADMIN_LOGIN_PREFILL=true` in `.env.local` to prefill credentials and show a one-click **Quick sign in** button when using localhost in development; the production/preview sign-in never returns or displays the password. `ADMIN_SESSION_SECRET` is configured separately for local, Development, Preview, and Production.

### Neon-provided connection aliases

These are available from the Neon integration and may be useful for tooling or migrations. Prefer `DATABASE_URL` in application code unless a specific script needs another connection mode.

- `DATABASE_URL_UNPOOLED`
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

- Vercel project is already linked locally via `.vercel/`.
- Use the Vercel project UI for normal preview/production publishing.
- The local code session is the linked repository checkout; use its authenticated Vercel CLI context only after reviewing the diff, verifying required environment configuration, and ensuring the intended work is ready to publish.
- Do not deploy from or commit the `.env` files.
- Before deployment, verify Neon is configured for the target environment and apply all numbered database migrations.
- After deployment, verify `/`, `/api/products`, `/api/media/...`, and `/api/admin/metrics` in the deployed environment and inspect runtime logs if a database error appears.
- **Production deployment verified 2026-11-01:** `https://www.isklenses.online` is the Vercel alias that serves this project's API; `https://isklenses.com` does not serve these API routes. The Flutter default `ISK_API_ORIGIN` points to the working API alias. The latest deployment is `e-commerce-app-design-mtpgrkud0-qaiserfcccs-projects.vercel.app` (Production, Ready). `GET /`, `GET /api/products`, `GET /api/chatbot/knowledge`, a chatbot `POST /api/chatbot`, and `GET /api/realtime/catalog` returned 200; unauthenticated `GET /api/admin/metrics` returned the expected 401. Neon Realtime is enabled on the production `main` branch with `https://www.isklenses.online` as the allowed browser origin. Both Neon-provided Realtime variables are configured for Vercel Production, with the signing secret marked sensitive. The Realtime endpoint returns the URL and sealed public-catalog query without exposing the signing secret. An initial API smoke test found missing migration 0020 columns; the existing idempotent migration was applied and verified on Production. Vercel build artifacts under `apps/mobile/build` are excluded with `.vercelignore`. No environment values were displayed. `AI_GATEWAY_API_KEY` remains optional and unset.
- **Shared-homepage deployment:** migration 0021 was applied and verified on the configured Neon database before deployment. The production deployment `e-commerce-app-design-5bb8ga9zo-qaiserfcccs-projects.vercel.app` is aliased to `https://www.isklenses.online`; `GET /`, `GET /api/storefront/home`, and `GET /api/openapi.json` returned 200. The live home response includes appearance, configuration, 26 banners, and nine configurable sections. Production environment-variable names for database, Realtime, media, Meta, and admin/session configuration were present; no values were displayed. The API contract validator and production build passed.

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
- Vercel deployment/build logs after publishing

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
- Product image/video upload, preview, reorder, and deletion use Neon `store_media_objects` and `store_product_assets`; media responses carry ETags and shared-cache headers. Product and content media restoration scripts are `scripts/rehost-source-product-images.mjs` and `scripts/restore-content-images.mjs`. Lens-option management is database-backed. COD order creation uses an idempotency key and transactional stock reservation; cancellation restores reserved inventory. Admin-managed delivery prices are included in checkout quotes and orders; admins can adjust delivery fees and mark payment received after delivery. There is no online payment, email verification, password reset, customer order history, configured tax calculation, or automatic delivery-fee notification.
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
- Cache (`lib/cache.ts`): Redis REST when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`/`KV_REST_API_TOKEN`) are set, else per-process memory. Namespaces `catalog` (300s/600s) and `content` (300s); invalidated on admin/checkout writes.
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
