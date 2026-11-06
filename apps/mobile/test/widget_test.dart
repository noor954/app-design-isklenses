import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isk_lenses_mobile/admin_product_editor.dart';
import 'package:isk_lenses_mobile/main.dart';
import 'package:isk_lenses_mobile/store_api.dart';
import 'package:isk_lenses_mobile/storefront_screens.dart';

class _FakeStoreApi extends StoreApi {
  _FakeStoreApi() : super(apiOrigin: 'https://isklenses.com');

  @override
  Future<ShopperSession?> getSession() async => null;

  @override
  Future<ProductPage> getProducts({
    int page = 1,
    String query = '',
    String? category,
    String? brand,
    String? shadeId,
    String? lensTypeId,
    String sort = 'newest',
  }) async => ProductPage(products: const [], page: page, totalPages: 1);

  @override
  Future<StoreHomeData> getHomeData() async => const StoreHomeData(
    banners: [
      StoreBanner(
        id: 'hero-1',
        placement: 'hero',
        title: 'See color differently.',
        body: null,
        imageUrl: '',
        href: '/shop',
      ),
      StoreBanner(
        id: 'hero-2',
        placement: 'hero',
        title: 'A shade for your point of view.',
        body: null,
        imageUrl: '',
        href: '/shop',
      ),
      StoreBanner(
        id: 'hero-3',
        placement: 'hero',
        title: 'Let your look take the lead.',
        body: null,
        imageUrl: '',
        href: '/shop',
      ),
    ],
    products: [],
    categories: [],
    brands: [],
    shades: [],
    lensTypes: [],
    reviews: [],
    chrome: StoreChrome(
      contact: {},
      footer: {},
      whatsappSupportUrl:
          'https://wa.me/923015740405?text=Hello%2C%20I%20have%20a%20question%20about%20ISK%20Lenses.',
    ),
    headings: {},
    appearance: {'palette': 'sky'},
    origin: 'https://isklenses.com',
    configuration: {
      'heroLayout': 'full-bleed',
      'heroAutoplayMs': 5500,
      'sections': [
        {'id': 'hero', 'enabled': true, 'order': 0},
      ],
    },
  );

  @override
  Future<List<DeliveryRule>> getDeliveryRules() async => const [];

  @override
  Future<ChatbotAnswer> askChatbot(String message) async => const ChatbotAnswer(
    answer: 'Open the link to start a chat.',
    links: [
      (
        label: 'Connect on WhatsApp',
        href: 'https://wa.me/923015740405?text=Hello',
      ),
      (label: 'Unsafe', href: 'https://wa.me.example.com/123'),
    ],
  );
}

class _FakeAdminApi extends AdminApi {
  _FakeAdminApi() : super(apiOrigin: 'https://isklenses.com');

  @override
  Future<AdminSession?> getSession() async => null;

  @override
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) async => {'data': []};
}

void main() {
  testWidgets('assistant offers the safe WhatsApp link and opens it', (
    tester,
  ) async {
    const channel = MethodChannel('plugins.flutter.io/url_launcher');
    String? openedUrl;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      call,
    ) async {
      if (call.method == 'launch') {
        openedUrl = (call.arguments as Map)['url'] as String?;
        return true;
      }
      return false;
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );
    await tester.pumpWidget(
      MaterialApp(home: AssistantScreen(api: _FakeStoreApi())),
    );
    await tester.enterText(find.byType(TextField), 'Connect on WhatsApp');
    await tester.tap(find.byTooltip('Send'));
    await tester.pumpAndSettle();
    expect(find.text('Unsafe'), findsNothing);
    await tester.tap(find.text('Connect on WhatsApp'));
    await tester.pump();
    expect(openedUrl, 'https://wa.me/923015740405?text=Hello');
  });

  testWidgets('contact page opens the shared WhatsApp link', (tester) async {
    const channel = MethodChannel('plugins.flutter.io/url_launcher');
    String? openedUrl;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      call,
    ) async {
      if (call.method == 'launch') {
        openedUrl = (call.arguments as Map)['url'] as String?;
        return true;
      }
      return false;
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: StoreInformationScreen(api: _FakeStoreApi(), path: '/contact-us'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Connect on WhatsApp'));
    await tester.pump();
    expect(openedUrl, contains('https://wa.me/923015740405'));
  });

  testWidgets('product card previews another gallery image on mouse hover', (
    tester,
  ) async {
    final product = StoreProduct.fromJson({
      'id': 'preview-product',
      'name': 'Preview lens',
      'slug': 'preview-lens',
      'price': '100',
      'currency': 'PKR',
      'stockQuantity': 1,
      'heroImageUrl': '/api/media/first.webp',
      'assets': [
        {'mediaType': 'image', 'blobUrl': '/api/media/first.webp'},
        {'mediaType': 'image', 'blobUrl': '/api/media/second.webp'},
      ],
    }, Uri.parse('https://isklenses.com'));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 200,
              height: 300,
              child: StoreProductCard(product: product, onTap: () {}),
            ),
          ),
        ),
      ),
    );
    final alternate = find.byWidgetPredicate(
      (widget) =>
          widget is Image &&
          widget.image is NetworkImage &&
          (widget.image as NetworkImage).url.endsWith('/second.webp'),
    );
    expect(alternate, findsNothing);
    final gesture = await tester.createGesture(kind: PointerDeviceKind.mouse);
    await gesture.addPointer(
      location:
          tester.getTopLeft(find.byType(StoreProductCard)) +
          const Offset(50, 50),
    );
    await tester.pump();
    expect(alternate, findsOneWidget);
    await gesture.moveTo(Offset.zero);
    await tester.pump();
    expect(alternate, findsNothing);
    await gesture.removePointer();
  });

  testWidgets('Toric details require WhatsApp and advance payment', (
    tester,
  ) async {
    const channel = MethodChannel('plugins.flutter.io/url_launcher');
    String? openedUrl;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      call,
    ) async {
      if (call.method == 'launch') {
        openedUrl = (call.arguments as Map)['url'] as String?;
        return true;
      }
      return false;
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );
    final product = StoreProduct.fromJson({
      'id': 'product-1',
      'name': 'Toric sample',
      'slug': 'toric-sample',
      'price': '100',
      'currency': 'PKR',
      'stockQuantity': 1,
      'lensType': {'name': 'Toric'},
      'orderingPolicy': {
        'mode': 'whatsapp_advance_payment',
        'whatsappUrl': 'https://wa.me/923015740405?text=Toric',
      },
    }, Uri.parse('https://isklenses.com'));
    var added = false;
    await tester.pumpWidget(
      MaterialApp(
        home: StoreProductDetailsScreen(
          api: _FakeStoreApi(),
          product: product,
          onAdd: (_) => added = true,
          onPage: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Full payment in advance is required'),
      findsOneWidget,
    );
    final action = find.text('Confirm this order on WhatsApp');
    await tester.ensureVisible(action);
    await tester.tap(action);
    await tester.pump();
    expect(openedUrl, 'https://wa.me/923015740405?text=Toric');
    expect(added, isFalse);
    expect(find.text('Add to bag'), findsNothing);
  });

  testWidgets('renders the ISK Lenses shopper navigation', (tester) async {
    await tester.pumpWidget(
      IskLensesApp(api: _FakeStoreApi(), adminApi: _FakeAdminApi()),
    );
    await tester.pumpAndSettle();

    expect(find.text('ISK Lenses'), findsOneWidget);
    expect(find.text('Shop'), findsOneWidget);
    expect(find.byTooltip('Open your bag'), findsOneWidget);
    expect(find.text('Help'), findsOneWidget);
    expect(find.text('Account'), findsOneWidget);
    expect(find.byTooltip('Connect on WhatsApp'), findsOneWidget);
  });

  testWidgets('home fits a narrow phone with larger text', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpWidget(
      IskLensesApp(api: _FakeStoreApi(), adminApi: _FakeAdminApi()),
    );
    await tester.pumpAndSettle();
    expect(find.byTooltip('Connect on WhatsApp'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('WhatsApp button opens the shared support link', (tester) async {
    const channel = MethodChannel('plugins.flutter.io/url_launcher');
    String? openedUrl;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      call,
    ) async {
      if (call.method == 'launch') {
        openedUrl = (call.arguments as Map)['url'] as String?;
        return true;
      }
      return false;
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );
    await tester.pumpWidget(
      IskLensesApp(api: _FakeStoreApi(), adminApi: _FakeAdminApi()),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Connect on WhatsApp'));
    await tester.pump();
    expect(
      openedUrl,
      'https://wa.me/923015740405?text=Hello%2C%20I%20have%20a%20question%20about%20ISK%20Lenses.',
    );
  });

  testWidgets('WhatsApp launch failure is visible', (tester) async {
    const channel = MethodChannel('plugins.flutter.io/url_launcher');
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      channel,
      (_) async => false,
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );
    await tester.pumpWidget(
      IskLensesApp(api: _FakeStoreApi(), adminApi: _FakeAdminApi()),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Connect on WhatsApp'));
    await tester.pump();
    expect(
      find.text('Could not open WhatsApp. Please try again.'),
      findsOneWidget,
    );
  });

  testWidgets('animates configured slides on autoplay and swipe', (
    tester,
  ) async {
    await tester.pumpWidget(
      IskLensesApp(api: _FakeStoreApi(), adminApi: _FakeAdminApi()),
    );
    await tester.pumpAndSettle();

    expect(find.text('1 / 3'), findsOneWidget);
    await tester.pump(const Duration(seconds: 6));
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('2 / 3'), findsOneWidget);
    expect(find.text('A shade for your point of view.'), findsOneWidget);
    await tester.drag(find.byType(PageView).first, const Offset(-500, 0));
    await tester.pumpAndSettle();

    expect(find.text('3 / 3'), findsOneWidget);
    expect(find.text('Let your look take the lead.'), findsOneWidget);
  });

  testWidgets('opens the separate administrator sign-in', (tester) async {
    await tester.pumpWidget(
      IskLensesApp(api: _FakeStoreApi(), adminApi: _FakeAdminApi()),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Account'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Admin workspace'));
    await tester.pumpAndSettle();

    expect(find.text('Admin sign in'), findsOneWidget);
    expect(find.text('Sign in securely'), findsOneWidget);
  });

  testWidgets('opens the lens finder from app navigation', (tester) async {
    await tester.pumpWidget(
      IskLensesApp(api: _FakeStoreApi(), adminApi: _FakeAdminApi()),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Open navigation menu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Find your lenses'));
    await tester.pumpAndSettle();

    expect(find.text('Find your lenses'), findsOneWidget);
    expect(find.text('Browse all lenses'), findsOneWidget);
    expect(find.text('How to compare and choose options'), findsOneWidget);
  });

  testWidgets('shows the guided shopping page from the navigation drawer', (
    tester,
  ) async {
    await tester.pumpWidget(
      IskLensesApp(api: _FakeStoreApi(), adminApi: _FakeAdminApi()),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Open navigation menu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('How to shop'));
    await tester.pumpAndSettle();

    expect(find.text('From browsing to bag.'), findsOneWidget);
    expect(find.textContaining('Step 1 · Browse the catalog'), findsOneWidget);
    await tester.drag(find.byType(ListView).last, const Offset(0, -900));
    await tester.pumpAndSettle();
    expect(find.text('Find your lenses'), findsWidgets);
  });

  testWidgets('renders the structured product editor', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: AdminProductEditorScreen(api: _FakeAdminApi())),
    );
    await tester.pumpAndSettle();

    expect(find.text('Create product'), findsOneWidget);
    expect(find.text('Product identity'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -1200));
    await tester.pumpAndSettle();
    expect(find.text('Lens specifications'), findsOneWidget);
    expect(find.text('Diameter (mm)'), findsOneWidget);
    expect(find.text('Base curve (mm)'), findsOneWidget);
    expect(find.text('Water content (%)'), findsOneWidget);
    expect(find.text('0.00'), findsNothing);
    expect(find.text('0%'), findsNothing);
    await tester.tap(find.text('Diameter (mm)'));
    await tester.pumpAndSettle();
    expect(find.text('14.00'), findsOneWidget);
    expect(find.text('14.20'), findsOneWidget);
    expect(find.text('14.50'), findsOneWidget);
    expect(find.text('14.80'), findsOneWidget);
  });
}
