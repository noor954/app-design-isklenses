# Architecture Overview — ISK Lenses

## Current production architecture

- Website and full-stack application: Next.js App Router, React 19, TypeScript, Tailwind CSS 4.
- Database and application backend: Neon Postgres through `pg` and Drizzle ORM. Next.js route handlers and server actions are the trusted backend.
- Native-client boundary: the versioned-compatible REST surface documented in `openapi.json`; Flutter/FlutterFlow clients must not connect directly to Postgres or call private Next.js Server Action URLs.
- Authentication: application-owned signed, HttpOnly shopper and admin cookies. Do not silently replace this with Neon Managed Better Auth; it would require an explicit account and session migration.
- Media: database-backed media objects in Neon, delivered through cacheable same-origin routes.
- Package manager: `pnpm`.
- Deployment status: Vercel remains the configured DNS target, but its production routes currently return HTTP 402 (`DEPLOYMENT_DISABLED`). Cloudflare Worker version `5891bd04-1db3-4cff-9cea-2fd9fe827f5d` is deployed at `https://isk-lenses-storefront.isklenses.workers.dev` and connected to Neon through Hyperdrive. Initial sequential and concurrent storefront smoke checks passed, but authenticated/admin, checkout, media, remaining API, longer-duration, and DNS verification are still required before cutover.
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
- Worker version `5891bd04-1db3-4cff-9cea-2fd9fe827f5d` passed repeated sequential and concurrent checks for the root and public storefront APIs; unauthenticated admin metrics returned the expected 401, public media and checkout page returned 200, and APK HEAD/range returned 200/206. The root remained slow. `/api/realtime/catalog` returns 503 because `NEON_REALTIME_SECRET` is absent; the Meta app secret, page access token, and webhook verify token are also missing from the Worker. Vercel CLI export returned empty values for these sensitive variables, so they must be provisioned directly before Realtime/Meta parity is claimed. Full authenticated admin, order-free checkout validation, remaining API, and longer-duration verification are still needed before cutover. Vinext's default cache is in-memory per isolate; no shared persistent cache adapter is configured.
- Cloudflare Workers Free avoids bandwidth-based egress charges but is not unlimited: the plan has request/day and CPU-time limits (currently 100,000 requests/day and 10 ms CPU per invocation). Review the live Cloudflare plan limits before relying on it for production traffic.
- Do not change DNS until all database-backed APIs (including gift eligibility), admin authorization, media, checkout, and APK download have passed production smoke tests and every existing DNS record is reconciled. The current `isklenses.online` Cloudflare zone is pending and no nameserver changes have been made. The verified historical API domain is `https://www.isklenses.online`; `https://isklenses.com` was not previously verified as serving this project's API.

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
