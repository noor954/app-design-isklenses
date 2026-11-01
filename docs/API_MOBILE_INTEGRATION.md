# Mobile and integration API

The site publishes its machine-readable contract at **`https://<site-origin>/api/openapi.json`** and a compact endpoint directory at **`https://<site-origin>/api`**. The OpenAPI document is also checked in at [`../openapi.json`](../openapi.json). The current contract is **1.0.0**. Existing `/api/...` paths remain the v1 paths for compatibility; no `/api/v1/...` URL aliases exist yet. Breaking changes should be introduced under a new URL prefix rather than silently changing the existing contract.

The API is usable from Flutter Android, iOS, Windows, other native clients, and server integrations. Native apps do not use browser CORS. POST/PUT/PATCH/DELETE requests without `Origin` are accepted for native/server clients; browser cross-origin writes remain rejected. Do not send an `Origin` header that claims to be the website unless the request is actually from that origin. **Flutter Web** is not enabled for cross-origin credentialed calls; host it same-origin or add a separately reviewed, explicit CORS allowlist before enabling it.

## Cross-platform architecture status

Next.js remains the full-stack web application and trusted owner of business rules, database access, and REST endpoints. The Flutter Android/iOS client in [`../apps/mobile`](../apps/mobile) consumes this shared API for shopper and commerce-admin workflows. Admin sessions are separate from shopper sessions and stored in platform secure storage; server authorization remains authoritative. TanStack DB and a server-sealed Neon Realtime catalog-version query are implemented for the web catalog; the Realtime service must be provisioned and its server variables configured before live subscriptions can connect. The chatbot uses Mastra with Vercel AI Gateway when the server-side `AI_GATEWAY_API_KEY` is configured, and otherwise retains its deterministic FAQ/catalog response. Every answer is grounded against current public database facts; ISK does not store conversation history. Third-party AI processing and retention policies may apply. The architecture and external prerequisites are tracked in [`architect/ARCHITECTURE_OVERVIEW.md`](architect/ARCHITECTURE_OVERVIEW.md).

Do not treat adding TanStack Start beside Next.js as a mobile API strategy. TanStack Start is a separate full-stack framework option; the current API contract remains the common boundary. Realtime must not expose database access or bypass the signed-cookie auth model. The web catalog falls back to its API-backed SWR behavior if the Realtime endpoint is unavailable; native clients use the documented REST endpoints and refresh responses as needed. The current Mastra chatbot is server-side, stateless, and read-only; future background agents must use the same permission-checked application operations for business writes.

The Realtime endpoint `GET /api/realtime/catalog` returns a short-lived sealed public aggregate query and Realtime URL. The capability is a bearer credential: do not log it or store it persistently. Only configure approved origins in [`../neon.ts`](../neon.ts); do not expose `NEON_REALTIME_SECRET`.

## Endpoint directory

| Area | Method and path | Access | Purpose |
|---|---|---|---|
| Discovery | `GET /api` | Public | Endpoint groups and OpenAPI link |
| Discovery | `GET /api/openapi.json` | Public | OpenAPI 3.1 contract for client generation |
| Catalog | `GET /api/products` | Public | Active product search/filter; pass `page` and optional `limit` for bounded pagination |
| Catalog | `GET /api/storefront/home/products?tab=catalog\|featured\|new\|reduced&page=` | Public | Paginated homepage product tabs, 15 per page; `hasMore` drives the next call. Carousels: categories coverflow, brands fade-slide (6th section), shades infinite-loop; tabs smooth-slide/coverflow/fade-slide/infinite-loop |
| Catalog | `GET /api/storefront/home/sections/{section}?page=&q=` | Public | Paginated homepage carousels (`categories`, `brands`, `shades`, `lens-types`); max 15 items per page, `hasMore` drives the next call, search (`q`) is uncapped |
| Catalog | `GET /api/storefront/home` | Public | Canonical home banners plus shared palette/control styles, ordered and visible homepage sections, hero layout/autoplay, site chrome, catalog directories/products, and approved reviews |
| Catalog | `GET /api/products/{slug}` | Public | One active product with variants and media |
| Catalog | `GET /api/product-categories` | Public | Active category hierarchy and product counts |
| Catalog | `GET /api/brands` | Public | Active brands and product counts |
| Catalog | `GET /api/lens-shades` | Public | Lens shades and product counts |
| Catalog | `GET /api/lens-types` | Public | Lens types and product counts |
| Checkout | `GET /api/delivery-rules` | Public | Delivery subtotal bands and fees for displaying checkout totals |
| Reviews | `GET /api/products/{slug}/reviews` | Public | Up to 50 approved reviews |
| Reviews | `POST /api/products/{slug}/reviews` | Public, rate-limited | Submit a review, if review submission is enabled |
| Shopper | `GET, POST /api/storefront/session` | Public / shopper cookie | Read session; register, log in, or log out |
| Shopper | `POST /api/orders` | Public / optional shopper cookie | Place a COD order; server reprices, reserves inventory, and validates delivery |
| Shopper | `GET /api/storefront/orders` | Shopper cookie | Up to 50 summaries for the signed-in shopper |
| Integration | `GET /api/chatbot/knowledge?q=...` | Public | FAQ and up to eight matching published products for grounding |
| Integration | `POST /api/chatbot` | Public, rate-limited | Ask the store assistant using public FAQ/catalog facts only |
| Integration | `GET /api/chatbot/settings` | Public | Read assistant enabled state and welcome message |
| Admin | `PUT /api/chatbot/settings` | Admin or owner cookie | Enable/disable the assistant and edit its welcome message |
| Integration | `GET, HEAD /api/media/{path}` | Public | Product and storefront media |
| Integration | `GET, POST /api/webhooks/meta-leads` | Meta signature/configuration | Meta Lead Ads verification and signed event receiver |
| Integration | `POST /api/errors` | Public, rate-limited | Bounded client error report |
| Admin | `GET, POST, DELETE /api/admin/session` | Public sign-in; admin cookie after sign-in | Admin session status, sign-in, and sign-out |
| Admin | `GET /api/admin/password-reset` | Public | Recovery configuration status |
| Admin | `POST /api/admin/password-reset` | Recovery key | Reset an admin password when recovery is enabled |
| Admin | `GET /api/admin/metrics` | Admin cookie | Dashboard metrics |
| Admin | `GET /api/admin/products` | Admin cookie | Admin product rows, media, and variants |
| Admin | `POST /api/admin/products` | Admin cookie, admin role | Create a product with validated lens fields, category assignments, and power ranges |
| Admin | `GET, PUT, DELETE /api/admin/products/{productId}` | Admin cookie | Read, replace editable product fields, or delete a product |
| Admin | `PATCH /api/admin/products/{productId}/stock` | Admin cookie, admin role | Update stock for products without active variants |
| Admin | `GET, POST /api/admin/products/{productId}/variants` | Admin cookie | List and create product variants |
| Admin | `PUT, DELETE /api/admin/products/{productId}/variants/{variantId}` | Admin cookie, admin role | Update or archive a product variant |
| Admin | `PUT /api/admin/products/{productId}/relations` | Admin cookie, admin role | Replace related products |
| Admin | `GET, PATCH /api/admin/products/merchandising` | Admin cookie | Read merchandising state and bulk-enable featured, new-arrival, or on-sale placement |
| Admin | `POST /api/admin/products/categories` | Admin cookie, admin role | Add selected products to a category |
| Admin | `GET, POST, PATCH /api/admin/categories` | Admin cookie | List, create, and bulk-update active/menu visibility |
| Admin | `PUT, DELETE /api/admin/categories/{categoryId}` | Admin cookie, admin role | Update or delete a category |
| Admin | `POST /api/admin/categories/{categoryId}/move` | Admin cookie, admin role | Move a category among siblings |
| Admin | `GET, POST /api/admin/brands` and `PUT, DELETE /api/admin/brands/{brandId}` | Admin cookie | Manage brands |
| Admin | `GET, POST /api/admin/lens-shades` and `PUT, DELETE /api/admin/lens-shades/{shadeId}` | Admin cookie | Manage lens shades |
| Admin | `GET, POST /api/admin/lens-types` and `PUT, DELETE /api/admin/lens-types/{lensTypeId}` | Admin cookie | Manage lens types |
| Admin | `GET, POST /api/admin/reviews` and `PATCH, DELETE /api/admin/reviews/{reviewId}` | Admin cookie | Create, approve/reject, and delete product reviews |
| Admin | `GET, PUT /api/admin/product-page-settings` | Admin cookie | Read and save product-page sections and review settings |
| Admin | `GET /api/admin/content` | Admin cookie | Read storefront banners, testimonials, and editable content settings |
| Admin | `POST /api/admin/content/banners`; `DELETE /api/admin/content/banners/{bannerId}` | Admin cookie | Create/update or delete a storefront banner |
| Admin | `POST /api/admin/content/reviews`; `DELETE /api/admin/content/reviews/{reviewId}` | Admin cookie | Create/update or delete a storefront testimonial |
| Admin | `PUT /api/admin/content/settings/{key}` | Admin cookie | Update an allowlisted storefront setting, including `appearance` and `home_configuration` used by web and native clients |
| Admin | `PATCH /api/admin/orders/{orderId}` | Admin cookie, admin role | Change order status or confirm cash-on-delivery delivery charges |
| Admin | `GET /api/admin/orders/stats`, `GET /api/admin/customers/stats` | Admin cookie | Read order/revenue and customer totals |
| Admin | `PATCH /api/admin/customers/{customerId}` | Admin cookie, admin role | Update customer details and marketing preference |
| Admin | `POST /api/admin/crm`; `PATCH /api/admin/crm/{leadId}` | Admin cookie, admin role | Create or update CRM leads |
| Admin | `GET, PUT /api/admin/delivery-settings` | Admin cookie | Read and update delivery pricing |
| Admin | `GET, POST /api/admin/system-users`; `PATCH /api/admin/system-users/{userId}` | Admin cookie; role-dependent | Manage staff accounts and reset passwords |
| Admin | `PUT /api/admin/profile` | Admin cookie | Update signed-in administrator credentials |
| Admin | `GET /api/admin/error-logs` | Admin cookie | Read recent application error logs |
| Admin | `GET /api/admin/orders?offset=0&status=pending` | Admin cookie | Up to 50 orders per page |
| Admin | `GET /api/admin/customers?offset=0&q=...` | Admin cookie | Up to 50 matching customers per page |
| Admin | `GET /api/admin/crm?offset=0&q=...&status=...` | Admin cookie | Up to 50 CRM leads per page |
| Admin | `GET /api/admin/activity` | Admin cookie | Recent activity |
| Admin | `PATCH, DELETE /api/admin/assets/{assetId}` | Admin cookie | Reorder or delete an asset |
| Admin | `POST /api/admin/products/{productId}/assets` | Admin cookie | Upload product image/video (4 MB maximum) |
| Admin | `POST /api/admin/content/upload` | Admin cookie | Upload content image (4 MB maximum) |
| Admin | `POST /api/admin/catalog-sync` | Admin cookie, admin role | Sync selected catalog source data |

These REST handlers call the same permission-checked server operations used by the web admin, so server-side role, inventory, validation, and business-transition rules remain authoritative. JSON admin writes reject cross-origin browser requests; native clients may omit `Origin`. Do not call internal Server Action URLs from a mobile app. Upload endpoints remain multipart and use the explicit file/type/size validation described above. All newly added endpoints and payload details are also published in the OpenAPI contract; where an operation uses the reusable `AdminJsonObject` schema, the named server operation provides the authoritative field validation.

The home API is the canonical cross-platform design contract. Read `data.content.appearance` for the shared `palette`, `button`, `textbox`, `menu`, and `navigation` values. Read `data.content.configuration` for the visible/order-ranked sections plus `heroLayout` and `heroAutoplayMs`. The banner collection at `data.content.banners` is the same active hero set consumed by the website and mobile storefront. Native clients should treat these values as display settings, preserve API order, and ignore unknown enum values by falling back to the documented sky defaults. Admin clients save these through `PUT /api/admin/content/settings/appearance` or `/api/admin/content/settings/home_configuration`; the server validates every write and database migration `0021_home_and_appearance_settings.sql` must be applied before saving the new settings.

The admin API covers the completed commerce workflows. The web-only Project Kanban is project coordination UI rather than store operations and is not included in the customer/mobile commerce API.

## Flutter / FlutterFlow / Windows setup

The Flutter Android/iOS storefront and commerce-admin client is in `apps/mobile`. See its README for local setup, API-origin configuration, build commands, admin module coverage, and the current release-readiness boundary.

1. Use the deployed site origin as the base URL, for example `https://shop.example.com`; all API paths above are relative to that origin.
2. Open `/api/openapi.json` in an OpenAPI client generator or use it as the reference when configuring FlutterFlow API Calls. Set `Accept: application/json` and `Content-Type: application/json` on JSON writes.
3. Use a cookie jar/session-preserving HTTP client for shopper login. Login/register sets the HttpOnly `isk-lenses-customer-session` cookie; send it on later order-history and checkout requests. Retain the cookie securely, honor its expiry, and clear it on logout. The API does **not** issue bearer tokens. On FlutterFlow, if its API-call client does not retain `Set-Cookie`, implement the login/checkout sequence in a custom action with a cookie-aware client rather than copying the password into app state.
4. Admin cookies use `isk-lenses-admin-session`; keep admin credentials and session access out of logs, URLs, analytics, and client source. Staff/admin/owner permissions are still enforced server-side.
5. In Flutter Web, same-origin hosting is the supported browser option. For a separate web origin, a reviewed explicit CORS policy is required; the FastAPI starter has a separate `API_CORS_ORIGINS` setting but does not configure CORS for the Next.js API.

Native Flutter sketch using Dio (`dio`, `cookie_jar`, and `dio_cookie_manager`):

```dart
final cookieJar = CookieJar();
final api = Dio(BaseOptions(
  baseUrl: 'https://shop.example.com',
  headers: {'Accept': 'application/json'},
));
api.interceptors.add(CookieManager(cookieJar));

final page = await api.get(
  '/api/products',
  queryParameters: {'page': 1, 'limit': 24, 'q': 'blue'},
);
final session = await api.post('/api/storefront/session', data: {
  'action': 'login',
  'email': email,
  'password': password,
});
// Dio's cookie manager stores Set-Cookie and sends the session cookie later.
```

For guest or signed-in checkout, first load `/api/delivery-rules`. Compute the matching fee for the current subtotal for display, then send the quote with the selected products. The server independently checks current product prices, stock, and delivery pricing; never treat client totals as authoritative.

```json
{
  "checkoutKey": "00000000-0000-4000-8000-000000000001",
  "email": "shopper@example.com",
  "shippingAddress": {
    "firstName": "Ayesha",
    "lastName": "Khan",
    "phone": "+923001234567",
    "addressLine1": "House and street",
    "addressLine2": "",
    "city": "Karachi",
    "province": "Sindh",
    "postalCode": "74000"
  },
  "items": [{
    "productId": "00000000-0000-4000-8000-000000000002",
    "variantId": null,
    "quantity": 1,
    "quotedUnitPrice": "2199.00",
    "quotedCurrency": "PKR"
  }],
  "quotedDeliveryFee": "200.00"
}
```

Use the same `checkoutKey` only when retrying the same checkout attempt; generate a new UUID for a new attempt. `email` is required for guests and should be omitted for an authenticated shopper. Payment is cash on delivery only; there is no online payment API. The cart is client-side state. Shopper order history currently returns summaries, not full order-line details.

The UUIDs in the JSON are illustrative: replace `productId` with an actual UUID returned by the catalog, and generate a fresh `checkoutKey` per checkout attempt.

## API behavior and operational notes

- JSON success responses generally use `{ "data": ... }`; errors use `{ "error": "..." }`. Checkout returns `orderNumber` and `reused`. The paginated product response includes `{ data, pagination: { page, limit, total, totalPages }, timestamp }`.
- `GET /api/products` retains the legacy unbounded response when called without `page`; mobile clients should always pass `page` and may pass `limit` (1–100, default 24). Filters are `category`, `brand`, `shadeId`, `lensTypeId`, and `q`; supported sort orders are `newest`, `price_asc`, `price_desc`, `name_asc`, and `featured`.
- Public catalog and media responses are cacheable. Account, order, and admin responses are `no-store`; honor HTTP cache headers rather than persisting stale inventory or prices.
- Expect `400` validation errors, `401` unauthenticated/invalid credentials, `403` forbidden/origin rejection, `404` missing resources, `409` checkout conflicts, `413` oversized bodies, `415` unsupported content types, `429` rate limits, and `5xx` service failures. Retry transient failures with bounded backoff; for checkout always reuse its idempotency key.
- Current public throttling is best-effort per process, not distributed. Configure edge-level rate limits before broad production traffic.
- The Meta webhook is server-to-server only and verifies `X-Hub-Signature-256`; it is not a mobile client endpoint.
- The store assistant is grounded in the current public FAQ/catalog data. `POST /api/chatbot` accepts `{ "message": "..." }` (1–200 characters) and is rate limited to 20 requests per IP per 10 minutes. With `AI_GATEWAY_API_KEY`, the server runs the response through the `vercel/google/gemini-2.5-flash` Mastra agent; without it, the deterministic response remains available. The agent has no tools, account/order access, persistent memory, or write permissions; it cannot provide lens fitting or eye-health advice. `GET /api/chatbot/knowledge` preserves lens specification fields in product matches. Admin changes use `PUT /api/chatbot/settings` with the admin cookie. Migration `0019_chatbot_settings.sql` is applied to the configured database; apply it to other target databases before saving chatbot settings there.

## FastAPI quick-service starter

The independent scaffold at [`services/fastapi/README.md`](../services/fastapi/README.md) provides a health endpoint, a `/api/v1` namespace, generated Swagger/OpenAPI docs, explicit CORS allowlisting, and tests. Run it separately with Uvicorn when starting a new service. It is intentionally not wired into the Next.js deployment and does not duplicate or proxy the live Neon commerce backend.


## Configurable power lens options and carousels

- Admin-managed power options live in the `power_options` content setting (`GET /api/admin/content` returns `settings.power_options`; save with `PUT /api/admin/content/settings/power_options`). Each option has an exact `value` (e.g. `-2.25`), a `label`, and a per-eye `surcharge`. The public home response also returns `powerOptions`.
- Products expose `availablePowerOptions` (value/label/surcharge). Product create/update accepts exact option values; legacy grouped ranges are still resolved to exact values.
- Checkout `leftPowerRange` / `rightPowerRange` are exact option values. The server price is base price + left surcharge + right surcharge; `quotedUnitPrice` must equal that total (compared in cents). Clients must display the same surcharge-inclusive price.
- Homepage hero slides are topped up with the shared default editorial images (`/isk-home/hero-editorial-*.jpg`) so at least five slides are served to web and mobile alike.
- Homepage carousels (web `components/ui/shared-carousel.tsx`, Flutter `apps/mobile/lib/isk_carousel.dart`) share five styles: coverflow, fade-slide, infinite-loop, smooth-slide, continuous. Autoplay advances right-to-left every 3 seconds, pauses on interaction, respects reduced motion, and loads at most 15 items per request. Catalog imagery uses contain-fit so images are never cropped.
