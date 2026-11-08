# Architecture Overview — ISK Lenses

## Current production architecture

- Website and full-stack application: Next.js App Router, React 19, TypeScript, Tailwind CSS 4.
- Database and application backend: Neon Postgres through `pg` and Drizzle ORM. Next.js route handlers and server actions are the trusted backend.
- Native-client boundary: the versioned-compatible REST surface documented in `openapi.json`; Flutter/FlutterFlow clients must not connect directly to Postgres or call private Next.js Server Action URLs.
- Authentication: application-owned signed, HttpOnly shopper and admin cookies. Do not silently replace this with Neon Managed Better Auth; it would require an explicit account and session migration.
- Media: database-backed media objects in Neon, delivered through cacheable same-origin routes.
- Package manager: `pnpm`.
- Deployment status: Vercel routes previously returned HTTP 402 (`DEPLOYMENT_DISABLED`). Cloudflare Worker version `a3508568-ba85-4a96-a5b1-f4c8a545593c` is deployed at `https://isk-lenses-storefront.isklenses.workers.dev` and connected to Neon through Hyperdrive, but the latest checks returned intermittent HTTP 503 with Cloudflare error 1102. The `.com` and `.online` zones are pending on Hostinger nameservers; DNS reconciliation and runtime verification remain incomplete, so no cutover has occurred.
- Current client refresh: SWR polling/revalidation remains the fallback. A Neon Realtime sealed-query endpoint and TanStack DB catalog-version collection are implemented for the public catalog. Neon Realtime is enabled on the production `main` branch, and the production Vercel runtime has the branch URL and server-only signing secret.
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
- The Worker injects `HYPERDRIVE.connectionString` into `process.env.DATABASE_URL` before dynamically loading the application. Drizzle uses an AsyncLocalStorage-selected one-connection pool per Worker request, closed after the response body completes or is canceled, to avoid shared-pool contention. Hyperdrive uses the Neon unpooled origin with query caching disabled. Keep database/session/recovery, Meta, Realtime, and optional AI Gateway secrets in the Worker secret manager; `DATABASE_READ_URL` is unset.
- The current Worker config binds apex and `www` for both requested domains and redirects each apex to its matching `www`. Earlier version checks passed, but version `a3508568-ba85-4a96-a5b1-f4c8a545593c` subsequently returned intermittent 503/1102 responses; the homepage took about 29 seconds on one successful request. Error 1102 indicates a Worker resource-limit failure; the Free plan's 10 ms CPU budget is a plausible cause for Next.js SSR, but the available evidence does not distinguish CPU from memory exhaustion. Cloudflare documents higher CPU limits only on its Paid plan; do not upgrade or incur charges without the user's approval. Worker observability logs are disabled in the account, Ray ID lookup returned 403, and CPU profiling found no recent executions. Do not cut over until resource use and database latency are diagnosed and repeatable production checks pass. `/api/realtime/catalog` returns 503 because `NEON_REALTIME_SECRET` is absent; the Meta app secret, page access token, and webhook verify token are also missing from the Worker. Provision these directly before Realtime/Meta parity is claimed. Authenticated admin, additional APIs, and longer-duration verification remain required. Vinext's default cache is in-memory per isolate; no shared persistent cache adapter is configured.
- Cloudflare Workers Free avoids bandwidth-based egress charges but is not unlimited: the plan has request/day and CPU-time limits (currently 100,000 requests/day and 10 ms CPU per invocation). Review the live Cloudflare plan limits before relying on it for production traffic.
- Hostinger's authoritative DNS API inventory has been retrieved and reconciled with Cloudflare. Missing `.com` Vercel verification and `expense` subdomain records, plus the `.online` third Hostinger DKIM record, were added; existing mail and service records are retained. The pending Cloudflare zones have 12 (`.com`) and 19 (`.online`) records. Both domains still delegate to Hostinger; do not change nameservers while the Worker returns 503/1102. The connected Hostinger Premium plan does not support Node.js apps (Hostinger requires Business or Cloud plans), so it is not a full-stack Next.js fallback. Do not incur hosting or Cloudflare plan costs without approval.

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
