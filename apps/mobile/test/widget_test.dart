import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isk_lenses_mobile/admin_product_editor.dart';
import 'package:isk_lenses_mobile/main.dart';
import 'package:isk_lenses_mobile/free_gift_widgets.dart';
import 'package:isk_lenses_mobile/store_api.dart';
import 'package:isk_lenses_mobile/storefront_screens.dart';

class _FakeStoreApi extends StoreApi {
  _FakeStoreApi() : super(apiOrigin: 'https://isklenses.com');

  @override
  Future<ShopperSession?> getSession() async => null;

  @override
  Future<int> recordProductViewer(String slug, String viewerId) async => 1;

  @override
  Future<Map<String, dynamic>> getProductReviews(String slug) async => {
    'data': [
      {'author': 'Customer', 'rating': 4, 'body': 'A genuine review'},
    ],
    'settings': {
      'enabled': true,
      'allowSubmission': true,
      'autoApprove': false,
    },
  };

  @override
  Future<Map<String, dynamic>> submitProductReview(
    String slug,
    Map<String, dynamic> review,
  ) async => {'pending': true};

  @override
  Future<List<Map<String, dynamic>>> getBlogArticles() async => [
    {
      'slug': 'test',
      'title': 'Lens care',
      'summary': 'A guide',
      'sections': [],
    },
  ];

  @override
  Future<List<Map<String, dynamic>>> getBlogResources() async => [
    {
      'id': 'bella-contact-lens-blog',
      'title': 'Contact lens articles',
      'publisher': 'Bella Lense',
      'description':
          'Browse the publisher’s complete contact lens article archive on its own website.',
      'url': 'https://bellalense.com/blogs/contact-lenses',
    },
  ];

  @override
  Future<Map<String, dynamic>> getOrderDetail(String id) async => {
    'orderNumber': 123,
    'status': 'shipped',
    'paymentMethod': 'cash_on_delivery',
    'currency': 'PKR',
    'subtotal': '100',
    'shippingTotal': '10',
    'shippingFeeConfirmed': true,
    'taxTotal': '0',
    'total': '110',
    'shippingAddress': {'city': 'Lahore'},
    'items': [
      {
        'productName': 'Sample lens',
        'quantity': 1,
        'unitPrice': '100',
        'lineTotal': '100',
        'powerLeft': 'plain',
        'powerRight': 'plain',
      },
    ],
  };

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

class _AddressStoreApi extends _FakeStoreApi {
  final session = Completer<ShopperSession?>();

  @override
  Future<ShopperSession?> getSession() => session.future;
}

void main() {
  testWidgets('checkout fills only untouched account address fields', (
    tester,
  ) async {
    final api = _AddressStoreApi();
    final gift = GiftSelectionState();
    await tester.pumpWidget(
      MaterialApp(
        home: CheckoutScreen(
          api: api,
          cart: const [],
          initialEmail: 'shopper@example.com',
          giftSelection: gift,
        ),
      ),
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'First name'),
      'Edited',
    );
    api.session.complete(
      const ShopperSession(
        email: 'shopper@example.com',
        savedShippingAddress: {
          'firstName': 'Saved',
          'phone': '03001234567',
          'addressLine1': 'Saved street',
          'city': 'Lahore',
        },
      ),
    );
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<TextFormField>(
            find.widgetWithText(TextFormField, 'First name'),
          )
          .controller!
          .text,
      'Edited',
    );
    expect(
      tester
          .widget<TextFormField>(
            find.widgetWithText(TextFormField, 'Street address'),
          )
          .controller!
          .text,
      'Saved street',
    );
    expect(find.text('Account email'), findsOneWidget);
    expect(find.text('Last name (optional)'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    gift.dispose();
  });

  testWidgets('journal identifies external reading resources', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: StoreInformationScreen(api: _FakeStoreApi(), path: '/blogs'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Bella Lense · External website'), findsOneWidget);
    expect(find.text('Lens care'), findsOneWidget);
    expect(find.text('Visit archive'), findsOneWidget);
  });

  testWidgets('product displays and submits reviews', (tester) async {
    final product = StoreProduct.fromJson({
      'id': 'review-test',
      'name': 'Review lens',
      'slug': 'review-lens',
      'price': '100',
      'currency': 'PKR',
      'stockQuantity': 1,
    }, Uri.parse('https://isklenses.com'));
    await tester.pumpWidget(
      MaterialApp(
        home: StoreProductDetailsScreen(
          api: _FakeStoreApi(),
          product: product,
          onAdd: (_) {},
          onPage: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    final scrollable = find
        .descendant(
          of: find.byType(StoreProductDetailsScreen),
          matching: find.byType(Scrollable),
        )
        .first;
    await tester.scrollUntilVisible(
      find.text('A genuine review'),
      200,
      scrollable: scrollable,
    );
    expect(find.text('A genuine review'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Submit review'),
      200,
      scrollable: scrollable,
    );
    await tester.enterText(find.widgetWithText(TextField, 'Your name'), 'Sam');
    await tester.enterText(
      find.widgetWithText(TextField, 'Your review'),
      'Good product',
    );
    await Scrollable.ensureVisible(tester.element(find.text('Submit review')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit review'));
    await tester.pumpAndSettle();
    expect(
      find.text('Thank you. Your review will appear once approved.'),
      findsOneWidget,
    );
  });

  testWidgets('plain selection hides power controls and adds at base price', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final product = StoreProduct.fromJson({
      'id': 'plain-test',
      'name': 'Choice lens',
      'slug': 'choice-lens',
      'price': '1000.00',
      'currency': 'PKR',
      'stockQuantity': 5,
      'availablePowerRanges': ['-0.50'],
      'availablePowerOptions': [
        {'value': '-0.50', 'label': '-0.50', 'surcharge': '150.00'},
      ],
    }, Uri.parse('https://isklenses.com'));
    CartLine? added;
    StoreProduct? compared;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => StoreProductDetailsScreen(
                    api: _FakeStoreApi(),
                    product: product,
                    onAdd: (line) => added = line,
                    onPage: (_) {},
                    onCompare: (item) => compared = item,
                  ),
                ),
              ),
              child: const Text('Open lens'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open lens'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Power lenses'),
      250,
      scrollable: find
          .descendant(
            of: find.byType(StoreProductDetailsScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(find.text('Left eye'), findsNothing);
    await tester.tap(find.text('Power lenses'));
    await tester.pumpAndSettle();
    expect(find.text('Left eye'), findsOneWidget);
    await Scrollable.ensureVisible(
      tester.element(find.text('Plain lenses')),
      alignment: 0.5,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Plain lenses'));
    await tester.pumpAndSettle();
    expect(find.text('Left eye'), findsNothing);
    await tester.scrollUntilVisible(
      find.text('Compare'),
      250,
      scrollable: find
          .descendant(
            of: find.byType(StoreProductDetailsScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(
      find.text('1 viewing session in the last 2 minutes'),
      findsOneWidget,
    );
    expect(find.text('Ask a question'), findsOneWidget);
    expect(find.text('Copy link'), findsOneWidget);
    await Scrollable.ensureVisible(
      tester.element(find.text('Compare')),
      alignment: 0.5,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Compare'));
    expect(compared?.id, product.id);
    await tester.scrollUntilVisible(
      find.text('Add to bag'),
      250,
      scrollable: find
          .descendant(
            of: find.byType(StoreProductDetailsScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.tap(find.text('Add to bag'));
    await tester.pumpAndSettle();
    expect(added?.lensChoice, 'plain');
    expect(added?.leftPowerRange, isNull);
    expect(added?.rightPowerRange, isNull);
    expect(added?.price, '1000.00');
    expect(added?.withQuantity(2).lensChoice, 'plain');
  });

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
    await tester.tap(find.text('Connect on WhatsApp').last);
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
    await Scrollable.ensureVisible(
      tester.element(find.text('Admin workspace')),
      alignment: 0.5,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Admin workspace'));
    await tester.pumpAndSettle();

    expect(find.text('Admin sign in'), findsOneWidget);
    expect(find.text('Sign in securely'), findsOneWidget);
  });

  testWidgets('guest receipt shows current status and selected items', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: OrderDetailScreen(api: _FakeStoreApi(), orderId: 'receipt'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Order #123'), findsOneWidget);
    expect(find.text('Order status: shipped'), findsOneWidget);
    expect(find.text('Delivery status: Dispatched'), findsOneWidget);
    expect(find.text('Sample lens × 1'), findsOneWidget);
    expect(find.textContaining('Plain lenses'), findsOneWidget);
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
