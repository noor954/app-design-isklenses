import 'package:flutter_test/flutter_test.dart';

import 'package:isk_lenses_mobile/promotions.dart';
import 'package:isk_lenses_mobile/store_api.dart';

const _categoryA = 'category-a';
const _categoryB = 'category-b';

StoreProduct _product(String id, String price, List<String> categories) =>
    StoreProduct.fromJson({
      'id': id,
      'name': id,
      'slug': id,
      'price': price,
      'currency': 'PKR',
      'categoryIds': categories,
    }, Uri.parse('https://store.test'));

CartLine _line(
  String id,
  String price,
  List<String> categories, {
  int quantity = 1,
}) => CartLine(
  product: _product(id, price, categories),
  variant: null,
  leftPowerRange: null,
  rightPowerRange: null,
  quantity: quantity,
);

StorePromotion _deal({
  String id = 'deal-a',
  String type = 'buy_get_free',
  List<String> categories = const [_categoryA, _categoryB],
  int buyQuantity = 1,
  int freeQuantity = 1,
  int discountPercent = 0,
  int priority = 0,
}) => StorePromotion(
  id: id,
  name: id,
  enabled: true,
  type: type,
  categoryIds: categories,
  buyQuantity: buyQuantity,
  freeQuantity: freeQuantity,
  discountPercent: discountPercent,
  priority: priority,
);

void main() {
  test(
    'Buy X Get Y Free requires every category and makes the cheapest unit free',
    () {
      final result = calculateBestPromotion(
        [
          _line('lens-a', '10.00', [_categoryA]),
          _line('lens-b', '25.00', [_categoryB]),
        ],
        [_deal()],
      );

      expect(result?.discountCents, 1000);
      expect(result?.freeUnitsByLine, [1, 0]);
      expect(
        calculateBestPromotion(
          [
            _line('lens-a', '10.00', [_categoryA, _categoryB]),
          ],
          [_deal()],
        ),
        isNull,
      );
    },
  );

  test(
    'percentage bundles discount every item and only the best offer applies',
    () {
      final lines = [
        _line('lens-a', '10.00', [_categoryA]),
        _line('lens-b', '25.00', [_categoryB]),
      ];
      final percent = _deal(
        type: 'bundle_discount',
        buyQuantity: 2,
        freeQuantity: 0,
        discountPercent: 20,
      );

      final result = calculateBestPromotion(lines, [
        _deal(priority: 1),
        percent,
      ]);

      expect(result?.discountCents, 1000);
      expect(result?.promotion.type, 'buy_get_free');
    },
  );

  test('priority and stable ID resolve equal savings', () {
    final lines = [
      _line('lens-a', '10.00', [_categoryA]),
      _line('lens-b', '25.00', [_categoryB]),
    ];

    final higherPriority = calculateBestPromotion(lines, [
      _deal(priority: 1),
      _deal(id: 'deal-b', priority: 2),
    ]);
    expect(higherPriority?.promotion.id, 'deal-b');

    final stableId = calculateBestPromotion(lines, [
      _deal(id: 'deal-b'),
      _deal(id: 'deal-a'),
    ]);
    expect(stableId?.promotion.id, 'deal-a');
  });
}
