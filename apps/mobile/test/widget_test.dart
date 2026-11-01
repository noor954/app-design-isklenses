import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isk_lenses_mobile/admin_product_editor.dart';
import 'package:isk_lenses_mobile/main.dart';
import 'package:isk_lenses_mobile/store_api.dart';

class _FakeStoreApi extends StoreApi {
  _FakeStoreApi() : super(apiOrigin: 'https://isklenses.com');

  @override
  Future<ShopperSession?> getSession() async => null;

  @override
  Future<ProductPage> getProducts({int page = 1, String query = ''}) async =>
      ProductPage(products: const [], page: page, totalPages: 1);

  @override
  Future<List<DeliveryRule>> getDeliveryRules() async => const [];
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
  testWidgets('renders the ISK Lenses shopper navigation', (tester) async {
    await tester.pumpWidget(
      IskLensesApp(api: _FakeStoreApi(), adminApi: _FakeAdminApi()),
    );
    await tester.pumpAndSettle();

    expect(find.text('ISK Lenses'), findsOneWidget);
    expect(find.text('Shop'), findsOneWidget);
    expect(find.text('Bag'), findsOneWidget);
    expect(find.text('Help'), findsOneWidget);
    expect(find.text('Account'), findsOneWidget);
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
  });
}
