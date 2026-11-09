# Architecture Overview — ISK Lenses

## Current production architecture

- Website and full-stack application: Next.js App Router, React 19, TypeScript, Tailwind CSS 4.
- Database and application backend: Neon Postgres through `pg` and Drizzle ORM. Next.js route handlers and server actions are the trusted backend.
- Native-client boundary: the versioned-compatible REST surface documented in `openapi.json`; Flutter/FlutterFlow clients must not connect directly to Postgres or call private Next.js Server Action URLs.
- Authentication: application-owned signed, HttpOnly shopper and admin cookies. Do not silently replace this with Neon Managed Better Auth; it would require an explicit account and session migration.
- Media: database-backed media objects in Neon, delivered through cacheable same-origin routes.
- Package manager: `pnpm`.
- Deployment status: Vercel routes previously returned HTTP 402 (`DEPLOYMENT_DISABLED`). Cloudflare Worker version `a99c7e5f-5380-4f43-aee8-be153911abd9` is deployed at `https://isk-lenses-storefront.isklenses.workers.dev` and connected to Neon through Hyperdrive. Direct Worker storefront/API checks now pass after fixing per-request database pool contention. The `.com` and `.online` zones remain pending because both domains still delegate to Hostinger; `.online` currently serves Hostinger parked-domain HTML for API paths and `.com` redirects to the existing WordPress site.
- Current client refresh: SWR polling/revalidation remains the fallback. A Neon Realtime sealed-query endpoint and TanStack DB catalog-version collection are implemented for the public catalog. Neon Realtime is enabled on the production `main` branch, but the Worker lacks `NEON_REALTIME_SECRET`; live catalog subscriptions are therefore unavailable there until the real secret is configured.
- AI assistant: the chatbot can invoke a stateless, server-side Mastra agent through Vercel AI Gateway when `AI_GATEWAY_API_KEY` is configured. Each turn queries the current public FAQ/catalog data from the same Neon database first. Without the key, the existing deterministic assistant remains available. The agent has no tools, database access, persistent memory, or business-write permissions. ISK does not store conversation history; third-party processing and retention policies may apply.

## Cross-platform target architecture

The platform request is to extend the existing product rather than replace working systems with parallel stacks:

1. **Web:** retain Next.js as the website, backend-for-frontend, and API owner. Adopt TanStack DB/Neon Realtime only for screens that need live, optimistic collections; Neon’s TanStack Start example is an alternative full-stack framework, not an instruction to run TanStack Start beside Next.js or to migrate the website wholesale.
2. **Android and iOS:** use Flutter, consistent with the earlier mobile-client direction. Consume the same documented HTTPS API and cookie-based shopper sessions. Keep commerce validation, pricing, stock reservation, permissions, and persistence on the server.
3. **Live synchronization:** the web catalog uses a server-sealed, aggregate-only live query and TanStack DB to invalidate its existing API-backed SWR catalog cache. The endpoint exposes only active-catalog count/version, not customer or administrative data. Production Realtime is provisioned for `https://www.isklenses.online`; preview environments need their own branch service credentials before subscriptions connect. Never ship `DATABASE_URL` or `NEON_REALTIME_SECRET` to a client. Flutter uses the REST API and explicit refresh; do not connect mobile apps directly to Postgres.
4. **Mastra:** the current chatbot agent runs inside the Node.js 22.18+ Next.js-compatible runtime and receives only the current public FAQ/catalog snapshot. It has no persistent memory, tools, or business-write path. Future background agents must be separate server-side workers triggered by committed, durable application events, with explicit retention, authorization, and approval policies.
5. **TanStack and API parity:** TanStack DB is an optional browser-side reactive collection layer, not a second source of truth. Preserve REST/OpenAPI as the mobile contract and update it whenever a web behavior changes.

## Deployment migration status

- `vite.config.ts`, `cloudflare.config.ts`, and `cloudflare-worker.ts` provide the vinext Worker build path. The Worker is deployed but is not yet the domain's production host.
- The Worker excludes `public/isklenses.apk` from static assets because the APK exceeds Cloudflare's 25 MiB per-asset limit. The custom Worker serves `/isklenses.apk` by streaming the tracked release from the public GitHub raw origin with `GET`, `HEAD`, and byte-range support. This avoids requiring R2 for APK delivery.
- The Worker injects `HYPERDRIVE.connectionString` into `process.env.DATABASE_URL` before dynamically loading the application. Drizzle uses an AsyncLocalStorage-selected pool of up to 10 connections per Worker request, closed after the response body completes or is canceled. The previous one-connection limit serialized concurrent homepage reads; `pg-pool` timed out queued acquisitions. Hyperdrive uses the Neon unpooled origin with query caching disabled. Keep database/session/recovery, Meta, Realtime, and optional AI Gateway secrets in the Worker secret manager; `DATABASE_READ_URL` is unset.
- The current Worker config binds apex and `www` for both requested domains and redirects each apex to its matching `www`. The active version `a99c7e5f-5380-4f43-aee8-be153911abd9` passed direct checks on 2026-11-09: the home page and product/home/deal/gift/category/delivery/OpenAPI APIs returned 200; an unauthenticated admin metrics request returned 401; invalid checkout returned 400 before creating an order; APK byte ranges returned 206. The root and full product catalog remain relatively slow, and authenticated admin/checkout flows plus longer monitoring are unverified. Persisted Worker logs are enabled with query-string redaction; application errors include nested causes while redacting SQL parameters. The Meta app secret, page access token, webhook verify token, and `NEON_REALTIME_SECRET` are not configured in the Worker, so Realtime and Meta integrations remain unavailable. Vinext's default cache is in-memory per isolate; no shared persistent cache adapter is configured.
- New Flutter shopper and admin builds default to the verified Worker API origin until custom-domain DNS is cut over; existing installed builds retain their compiled origin.
- Cloudflare Workers Free avoids bandwidth-based egress charges but is not unlimited: the plan has request/day and CPU-time limits (currently 100,000 requests/day and 10 ms CPU per invocation). Review the live Cloudflare plan limits before relying on it for production traffic.
- Hostinger's authoritative DNS API inventory has been retrieved and reconciled with Cloudflare. Missing `.com` Vercel verification and `expense` subdomain records, plus the `.online` third Hostinger DKIM record, were added; existing mail and service records are retained. The pending Cloudflare zones have 12 (`.com`) and 19 (`.online`) records. Both domains still delegate to Hostinger; no nameserver change has been made. Hostinger OAuth was refreshed and its profile verified as `ashehzad707@gmail.com`; the API confirms one active `hostinger_unlimited` order (`200729108`). Current Hostinger docs require Business Web Hosting or Cloud Startup/Professional/Enterprise/Enterprise Plus for managed Node.js Web Apps ([requirements](https://docs.hostinger.com/node.js/creating-an-app.md)); Web Hosting Unlimited is not eligible for that flow. The `.com` domain still serves the existing WordPress site and `.online` currently serves Hostinger's parked-domain page; the Next.js application has not been deployed to Hostinger. The Node.js environment endpoint has no variables configured for the current `.com` WordPress site. Confirm an eligible order and deployment target before deploying; the existing WordPress content remains untouched.

## Readiness and external prerequisites

The platform foundations are implemented; production Realtime is active, while AI chatbot generation and native store distribution have separate prerequisites:

- `AI_GATEWAY_API_KEY` in server-only runtime secrets for Mastra responses; Node.js 22.18+ is required for the Cloudflare configuration toolchain. The deterministic chatbot fallback works without this key.
- A reviewed agent use case, access policy, retention policy, and approval boundary for any agent-authored business-data changes.
- Android application ID, Apple bundle ID, signing, store accounts, and a deployment/release process before publishing mobile binaries.
- Any database migration and production environment changes through the repository’s documented review/deployment process.

Do not treat an existing `NEON_AUTH_BASE_URL` as proof that Neon Realtime is enabled. Do not assume Neon Managed Better Auth is configured. Current user accounts remain under the existing application-owned session system.

## Code layout

- Database migrations: `db/migrations/`, mirrored in `lib/db/schema.ts`.
- Server actions: `app/actions/`.
- REST API route handlers: `app/api/`.
- Client refresh hooks: `lib/hooks/`.
- Native/mobile integration contract: `openapi.json` and `docs/API_MOBILE_INTEGRATION.md`.
- Flutter shopper app: `apps/mobile/`; uses the API contract for catalog, power selection, COD checkout, chatbot, shopper sessions, and order summaries.
- Architecture decisions and operational status: this file and `docs/NEXT_AGENT_HANDOFF.md`.

## Scripts

- `scripts/validate-build.mjs` — build validation.
- `scripts/validate-schema.mjs` — schema validation (requires `DATABASE_URL`).
- `scripts/validate-openapi.mjs` — OpenAPI paths and references validation.
- `scripts/rehost-source-product-images.mjs` — restores product photos into the database-backed media library.
- `scripts/restore-content-images.mjs` — restores seeded storefront images into the database-backed media library.

## Security notes

- Admin sessions require `ADMIN_SESSION_SECRET`; shopper sessions use the configured shopper signing secret.
- Keep database credentials, Realtime signing secrets, model-provider credentials, and session keys server-side; never commit them.
- Do not let a Realtime subscription replace authorization checks in API handlers or database mutations.
