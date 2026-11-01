# ISK Lenses mobile app

Flutter application for Android and iOS. Shopper and administrator workflows use the existing Next.js REST API as their only business-data boundary; the app does not connect directly to Neon.

## Features

- Paginated product browsing and search, with product images and configured lens variants.
- A visual home discovery feed with hero banners, category/brand/shade shelves, featured and newly added listings, sale pricing, and recorded product ratings when available.
- A guided lens finder that combines live category, shade, brand, and lens-type filters, plus a native shopping guide for comparison, product options, and COD checkout.
- Dedicated category, brand, information, lens-finder, and shopping-guide pages linked from the home feed, app drawer, and shared footer.
- Per-eye power-range selection when a product requires it.
- Local shopping bag and cash-on-delivery checkout. The server independently validates prices, inventory, delivery fees, and the checkout idempotency key.
- Shopper registration/sign-in with the existing HttpOnly session cookie stored in platform secure storage, plus customer order summaries.
- Store assistant backed by the same FAQ/catalog-grounded API as the website. The server may use a stateless Mastra model when configured; the deterministic assistant remains available otherwise.
- A separate administrator sign-in using the existing HttpOnly admin session cookie, stored independently in platform secure storage.
- An administrator module browser for dashboard metrics, products, merchandising, orders, taxonomy, reviews, customers, CRM, storefront content, product-page settings, delivery, chatbot, system users, error logs, and activity.
- Product create/edit with categories, lens attributes, customer power-range choices, related products, variant CRUD, stock, and uploaded image/video management.
- Storefront banner/testimonial editing, settings, media uploads, delivery pricing, product-page sections, chatbot configuration, customer updates, CRM follow-up notes, review approval, order status, and owner-only staff/profile controls.

The mobile workspace exposes the completed commerce-admin workflows through the shared authenticated REST API. Some web-specific layout and bulk workflows remain optimized for desktop; Project Kanban is project coordination UI and is not included in the commerce app.

## Run locally

Install the Flutter SDK and an Android emulator or Xcode/iOS simulator. From this directory:

```sh
flutter pub get
flutter run --dart-define=ISK_API_ORIGIN=https://www.isklenses.online
```

Set `ISK_API_ORIGIN` to the origin that serves this project's API. For a local Android emulator, the host machine is usually reachable at `http://10.0.2.2:3000`; for an iOS simulator use `http://localhost:3000`. Do not use plain HTTP for production. The default production origin is `https://www.isklenses.online`.

## Build

```sh
flutter analyze
flutter test
flutter build appbundle --dart-define=ISK_API_ORIGIN=https://www.isklenses.online
flutter build ipa --dart-define=ISK_API_ORIGIN=https://www.isklenses.online
```

The generated application/bundle identifiers are provisional. Before store distribution, the owner must confirm the permanent Android application ID and Apple bundle ID, configure signing certificates/profiles, provide store accounts and review privacy/store listing requirements. This repository does not contain release credentials.

The Android NDK version is pinned in `android/app/build.gradle.kts` to the valid locally tested `27.1.12297006`; ensure that NDK is installed in the build environment. The current mobile code has passed Flutter analysis/tests and Android debug/iOS simulator builds, but release identifiers and signing credentials must be supplied by the app owner before store distribution.
