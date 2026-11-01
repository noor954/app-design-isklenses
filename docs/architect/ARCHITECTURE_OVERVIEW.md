# Architecture Overview — ISK Lenses

## Current production architecture

- Website and full-stack application: Next.js App Router, React 19, TypeScript, Tailwind CSS 4.
- Database and application backend: Neon Postgres through `pg` and Drizzle ORM. Next.js route handlers and server actions are the trusted backend.
- Native-client boundary: the versioned-compatible REST surface documented in `openapi.json`; Flutter/FlutterFlow clients must not connect directly to Postgres or call private Next.js Server Action URLs.
- Authentication: application-owned signed, HttpOnly shopper and admin cookies. Do not silently replace this with Neon Managed Better Auth; it would require an explicit account and session migration.
- Media: database-backed media objects in Neon, delivered through cacheable same-origin routes.
- Package manager: `pnpm`.
- Current client refresh: SWR polling/revalidation remains the fallback. A Neon Realtime sealed-query endpoint and TanStack DB catalog-version collection are implemented for the public catalog. Neon Realtime is enabled on the production `main` branch, and the production Vercel runtime has the branch URL and server-only signing secret.
- AI assistant: the chatbot can invoke a stateless, server-side Mastra agent through Vercel AI Gateway when `AI_GATEWAY_API_KEY` is configured. Each turn queries the current public FAQ/catalog data from the same Neon database first. Without the key, the existing deterministic assistant remains available. The agent has no tools, database access, persistent memory, or business-write permissions. ISK does not store conversation history; third-party processing and retention policies may apply.

## Cross-platform target architecture

The platform request is to extend the existing product rather than replace working systems with parallel stacks:

1. **Web:** retain Next.js as the website, backend-for-frontend, and API owner. Adopt TanStack DB/Neon Realtime only for screens that need live, optimistic collections; Neon’s TanStack Start example is an alternative full-stack framework, not an instruction to run TanStack Start beside Next.js or to migrate the website wholesale.
2. **Android and iOS:** use Flutter, consistent with the earlier mobile-client direction. Consume the same documented HTTPS API and cookie-based shopper sessions. Keep commerce validation, pricing, stock reservation, permissions, and persistence on the server.
3. **Live synchronization:** the web catalog uses a server-sealed, aggregate-only live query and TanStack DB to invalidate its existing API-backed SWR catalog cache. The endpoint exposes only active-catalog count/version, not customer or administrative data. Production Realtime is provisioned for `https://www.isklenses.online`; preview environments need their own branch service credentials before subscriptions connect. Never ship `DATABASE_URL` or `NEON_REALTIME_SECRET` to a client. Flutter uses the REST API and explicit refresh; do not connect mobile apps directly to Postgres.
4. **Mastra:** the current chatbot agent runs inside the Node.js 22.13+ Next.js server runtime and receives only the current public FAQ/catalog snapshot. It has no persistent memory, tools, or business-write path. Future background agents must be separate server-side workers triggered by committed, durable application events, with explicit retention, authorization, and approval policies.
5. **TanStack and API parity:** TanStack DB is an optional browser-side reactive collection layer, not a second source of truth. Preserve REST/OpenAPI as the mobile contract and update it whenever a web behavior changes.

## Readiness and external prerequisites

The platform foundations are implemented; production Realtime is active, while AI chatbot generation and native store distribution have separate prerequisites:

- `AI_GATEWAY_API_KEY` in server-only Vercel environment settings for Mastra responses; Node.js 22.13+ is required. The deterministic chatbot fallback works without this key.
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
