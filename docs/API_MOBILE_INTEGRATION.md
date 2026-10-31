# Mobile and integration API

The site publishes its machine-readable contract at **`https://<site-origin>/api/openapi.json`** and a compact endpoint directory at **`https://<site-origin>/api`**. The OpenAPI document is also checked in at [`../openapi.json`](../openapi.json). The current contract is **1.0.0**. Existing `/api/...` paths remain the v1 paths for compatibility; no `/api/v1/...` URL aliases exist yet. Breaking changes should be introduced under a new URL prefix rather than silently changing the existing contract.

The API is usable from Flutter Android, iOS, Windows, other native clients, and server integrations. Native apps do not use browser CORS. POST/DELETE/PATCH requests without `Origin` are accepted for native/server clients; browser cross-origin writes remain rejected. Do not send an `Origin` header that claims to be the website unless the request is actually from that origin. **Flutter Web** is not enabled for cross-origin credentialed calls; host it same-origin or add a separately reviewed, explicit CORS allowlist before enabling it.

## Endpoint directory

| Area | Method and path | Access | Purpose |
|---|---|---|---|
| Discovery | `GET /api` | Public | Endpoint groups and OpenAPI link |
| Discovery | `GET /api/openapi.json` | Public | OpenAPI 3.1 contract for client generation |
| Catalog | `GET /api/products` | Public | Active product search/filter; pass `page` and optional `limit` for bounded pagination |
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
| Admin | `GET /api/admin/orders?offset=0&status=pending` | Admin cookie | Up to 50 orders per page |
| Admin | `GET /api/admin/customers?offset=0&q=...` | Admin cookie | Up to 50 matching customers per page |
| Admin | `GET /api/admin/crm?offset=0&q=...&status=...` | Admin cookie | Up to 50 CRM leads per page |
| Admin | `GET /api/admin/activity` | Admin cookie | Recent activity |
| Admin | `PATCH, DELETE /api/admin/assets/{assetId}` | Admin cookie | Reorder or delete an asset |
| Admin | `POST /api/admin/products/{productId}/assets` | Admin cookie | Upload product image/video (4 MB maximum) |
| Admin | `POST /api/admin/content/upload` | Admin cookie | Upload content image (4 MB maximum) |
| Admin | `POST /api/admin/catalog-sync` | Admin cookie, admin role | Sync selected catalog source data |

Admin product/order/customer mutations and other controls currently run through authenticated Next.js Server Actions used by the website, not a complete public REST CRUD API. Do not call internal Server Action URLs from a mobile app. Add explicit REST handlers with role checks and request/response validation before building a mobile admin client.

## Flutter / FlutterFlow / Windows setup

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
- `GET /api/products` retains the legacy unbounded response when called without `page`; mobile clients should always pass `page` and may pass `limit` (1–100, default 24). Filters are `category`, `brand`, and `q`.
- Public catalog and media responses are cacheable. Account, order, and admin responses are `no-store`; honor HTTP cache headers rather than persisting stale inventory or prices.
- Expect `400` validation errors, `401` unauthenticated/invalid credentials, `403` forbidden/origin rejection, `404` missing resources, `409` checkout conflicts, `413` oversized bodies, `415` unsupported content types, `429` rate limits, and `5xx` service failures. Retry transient failures with bounded backoff; for checkout always reuse its idempotency key.
- Current public throttling is best-effort per process, not distributed. Configure edge-level rate limits before broad production traffic.
- The Meta webhook is server-to-server only and verifies `X-Hub-Signature-256`; it is not a mobile client endpoint.
- The store assistant is deterministic and grounded in public FAQ/catalog data. `POST /api/chatbot` accepts `{ "message": "..." }` (1–200 characters) and is rate limited to 20 requests per IP per 10 minutes. It cannot access orders or accounts and must not be used for lens fitting or eye-health advice. `GET /api/chatbot/knowledge` preserves lens specification fields in product matches. Admin changes use `PUT /api/chatbot/settings` with the admin cookie. Migration `0019_chatbot_settings.sql` is applied to the configured database; apply it to other target databases before saving chatbot settings there.

## FastAPI quick-service starter

The independent scaffold at [`services/fastapi/README.md`](../services/fastapi/README.md) provides a health endpoint, a `/api/v1` namespace, generated Swagger/OpenAPI docs, explicit CORS allowlisting, and tests. Run it separately with Uvicorn when starting a new service. It is intentionally not wired into the Next.js deployment and does not duplicate or proxy the live Neon commerce backend.
