# Project Agent Instructions — ISK Lenses Storefront

This file is the canonical agent-facing instructions for working on this repository.

- **Repository scope**: Next.js App Router + React + TypeScript storefront and admin for ISK Lenses. Data and media objects are persisted in Neon Postgres via Drizzle/`pg`.
- **Primary branches**: `main` is canonical. Work on topic branches, open PRs to `main` when ready.
- **GitHub identity**: All GitHub mutations must be performed as `@qaiserfccc` — verify with:

```bash
gh api user --jq .login

# proceed only when result is exactly: qaiserfccc
```

- **Packaging & build**: use `pnpm` (scripts validated by `scripts/validate-build.mjs`). Typical checks:

```bash
pnpm exec tsc --noEmit
node scripts/validate-build.mjs
pnpm build
```

- **Database workflow**:
  - Add schema DDL as a new numbered file under `db/migrations/` (do not rewrite applied migrations).
  - Apply DDL to Neon, update `lib/db/schema.ts` to mirror live schema, and run `node --env-file=.env.local scripts/validate-schema.mjs` (requires `DATABASE_URL`).

- **Runtime & operations**:
  - Admin sessions require `ADMIN_SESSION_SECRET`. Shopper sessions use `CUSTOMER_SESSION_SECRET` or derive from admin secret.
  - Admin password recovery (`/admin/forgot-password`) is enabled only when `ADMIN_RECOVERY_KEY` (8+ characters) is set; owners can also reset other accounts from the System users panel.
  - Media uploads are stored in `store_media_objects` in Neon and served through `/api/media/[...path]`. Do not reintroduce a hosted object-store dependency.
  - Do not commit secret values; use the Vercel UI for environment variables.

- **Areas of responsibility**:
  - Keep server-side data access inside `app/actions/` and HTTP endpoints under `app/api/`.
  - Maintain DB schema in `db/migrations/` and corresponding Drizzle schema in `lib/db/schema.ts`.
  - Keep client-side revalidation in `lib/hooks/` and use targeted `mutate()` calls after server mutations.
  - **Platform boundary:** Next.js remains the canonical web app, trusted API, and business-rules backend. Flutter is the intended Android/iOS client and must use the documented REST/OpenAPI contract. Do not add TanStack Start as a parallel backend or silently migrate the existing app/auth; TanStack DB is an optional web data layer, not a second source of truth.
  - **API/mobile parity is mandatory:** whenever a storefront or admin behavior, data field, validation rule, filter, sorting rule, visibility rule, or workflow changes, update the corresponding public or authenticated API in the same change so mobile clients (including Flutter/FlutterFlow) can observe and perform the same behavior. Keep the API discovery document, OpenAPI contract, and `docs/API_MOBILE_INTEGRATION.md` aligned whenever endpoint behavior or schemas change. Never leave a web-only behavior without explicitly documenting why parity is impossible or intentionally out of scope.
  - Trace each change through UI, shared data/domain logic, route handlers, response schemas, and API documentation. Add or update parity tests/contract validation when suitable coverage exists.
  - **Shared homepage and appearance configuration:** use `GET /api/storefront/home` as the single source for hero banners, palette/control styles, homepage section visibility/order/copy, and hero layout/autoplay across web and Flutter. Admin changes go through the validated content-setting operations; keep OpenAPI and the mobile integration guide synchronized. Apply and verify migration `0021_home_and_appearance_settings.sql` in each target database before saving these settings; never imply that authoring a migration applied it.
  - **Realtime and agents:** Neon Realtime requires explicit provisioning and verified server variables. The optional Mastra chatbot uses `AI_GATEWAY_API_KEY` only on the server and is grounded from current public API/database data; it is stateless and must not receive database credentials, customer records, or business-write tools. Never expose `DATABASE_URL`, Realtime signing secrets, or model-provider credentials to browser/native clients. Realtime subscriptions must be server-authorized and do not replace API permission checks. Any future background agents must use durable application events and route writes through existing permission-checked operations.

- **Security & safety**:
  - Never hardcode credentials, tokens or plaintext secrets.
  - Validate all server-side inputs and enforce allowed status values.
  - Admin GitHub operations must be verified (`gh api user`) and performed only as `qaiserfccc`.

- **Agent handoff & memory**: Read `docs/NEXT_AGENT_HANDOFF.md` for operational context before changing database integrations, migrations, authentication, or deployment.

- **When adding workflows or actions**: Gate every job with `if: github.actor == 'qaiserfccc' && github.triggering_actor == 'qaiserfccc'`.

If you are uncertain about an operation that touches DB, secrets, or deployment, stop and request explicit review from the repository owner.

## Power lens pricing and shared carousels

- Power options are configured in the `power_options` setting (admin: Power lens options); checkout recomputes base + per-eye surcharge server-side and compares quotes in cents. Keep web, Flutter and OpenAPI aligned.
- Homepage directory sections are paginated at 15 items via `GET /api/storefront/home/sections/{section}` and use the shared carousels (web `components/ui/shared-carousel.tsx`, Flutter `isk_carousel.dart`); change both together.
- Product/catalog imagery uses contain-fit; heroes may use cover. Hero images are topped up to five shared defaults.

- Free Cosmetic gift: `free_gift` setting, `GET /api/storefront/gift`, `giftProductId`/`giftConfirmed` on orders; lens line = non-Cosmetics product. Homepage carousels are full width; lens types use the continuous carousel on web and mobile.

- Gift flash bar + cart gift choice shared with checkout; homepage `showcase` section (config id `showcase`) with big spotlight images; default order puts brands 6th. Keep web and Flutter identical.
- Bulk price/power product endpoints (`/api/admin/products/bulk-price|bulk-power`) must stay in parity with admin product list tools; default power values 0.00 to -14.00.
- Cache public catalog and content through `lib/cache.ts`; cache keys use PostgreSQL MVCC snapshots to detect committed writes, including direct SQL, without write-side triggers. Snapshot reads add a database call and unrelated transactions can invalidate entries. Keep checkout validation and private data uncached; self-hosted multi-instance deployments need a shared Next.js cache handler and the same primary database.
- Toric lens types are surfaced in a derived Toric category and require WhatsApp confirmation and full advance payment; cash-on-delivery orders reject them server-side. Do not infer Toric prescription ranges, pricing, or payment status from other retailers. See `docs/API_MOBILE_INTEGRATION.md`.
- The Android download is resolved from the public `android-latest` GitHub release through `GET /api/mobile/android`. The owner-gated workflow must verify the configured release signing fingerprint before publishing; never publish debug-signed APKs. Signing setup and stable-key/version-code requirements are in `apps/mobile/README.md`.
