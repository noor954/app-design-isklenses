# ISK Lenses mobile app

Flutter application for Android and iOS. Shopper and administrator workflows use the existing Next.js REST API as their only business-data boundary; the app does not connect directly to Neon.

## Features

- Paginated product browsing and search, with product images and configured lens variants.
- A visual home discovery feed driven by the same `/api/storefront/home` hero slides, section visibility/order/copy, autoplay, and hero layout as the website; it also applies the shared palette and control styles while arranging sections for native screens.
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
- Homepage design settings are available through the authenticated Storefront content settings API; the web admin also provides the visual **Home and design** workspace.

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

## Test installs (APK and iPhone)

### Android APK
```sh
flutter build apk --release --dart-define=ISK_API_ORIGIN=https://www.isklenses.online
# output: build/app/outputs/flutter-apk/app-release.apk
```
Share the APK, then on the phone allow "Install unknown apps" for the app used to open it (Files/Chrome) and tap the file. Or with USB debugging: `adb install -r app-release.apk`. Without release signing environment variables the local build uses the debug key and is for testing only; never publish it.

### Public Android release

The `/mobile-app` page and `GET /api/mobile/android` look for `isklenses.apk` in the public GitHub release tagged `android-latest`. The release workflow builds on changes under `apps/mobile/` on `main` and can also be started manually on `main`; jobs run only for the repository owner. A successful signed, analyzed and tested build replaces that asset. Until an asset has been published, the page displays an unavailable message. The workflow and page do not publish anything until changes are deployed and the owner configures signing.

The owner must first confirm the permanent application ID (`com.isklenses.isk_lenses_mobile`) and provide a dedicated release keystore, securely backed up outside the repository. Configure GitHub Actions secrets `ANDROID_KEYSTORE_BASE64` (base64-encoded keystore), `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and `ANDROID_CERT_SHA256` (the release certificate SHA-256 fingerprint). The workflow verifies the APK's actual signing fingerprint before upload. Protect the keystore and retain the same signing key across releases: changing it prevents normal upgrades of existing installations. The workflow build number uses the Actions run number; ensure it exceeds any distributed version codes before enabling it. Enable repository Actions permissions to create releases. Workflow failures leave the prior APK intact until asset replacement; GitHub's replace operation may briefly make it unavailable.

For an explicitly signed local build, provide `ISK_ANDROID_KEYSTORE` (absolute file path), `ISK_ANDROID_STORE_PASSWORD`, `ISK_ANDROID_KEY_ALIAS`, and `ISK_ANDROID_KEY_PASSWORD` in the environment. These are never committed. The previously produced debug-key APK is not a public release.

### iPhone
Apple only installs signed apps, so an unsigned bundle needs signing with the tester's Apple ID or a developer account.
1. Build: `flutter build ios --release --no-codesign --dart-define=ISK_API_ORIGIN=https://www.isklenses.online`, then zip `build/ios/iphoneos/Runner.app` inside a `Payload/` folder and rename the zip to `.ipa` (an unsigned `isk-lenses-unsigned.ipa` can be produced this way).
2. Install on a device: (a) open `ios/Runner.xcworkspace` in Xcode, pick your team under Signing & Capabilities, connect the iPhone and Run; (b) sideload the unsigned IPA with AltStore/Sideloadly using a free Apple ID (re-sign every 7 days); or (c) for wider testers, run `flutter build ipa`, upload to App Store Connect and invite testers via TestFlight (requires an Apple Developer account).
