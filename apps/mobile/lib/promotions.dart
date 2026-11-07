import 'store_api.dart';

class PromotionResult {
  const PromotionResult({
    required this.promotion,
    required this.discountCents,
    required this.freeUnitsByLine,
    required this.discountedUnitsByLine,
    required this.discountCentsByLine,
  });

  final StorePromotion promotion;
  final int discountCents;
  final List<int> freeUnitsByLine;
  final List<int> discountedUnitsByLine;
  final List<int> discountCentsByLine;
}

class _DealUnit {
  const _DealUnit({
    required this.lineIndex,
    required this.priceCents,
    required this.categoryIds,
    required this.ordinal,
  });

  final int lineIndex;
  final int priceCents;
  final List<String> categoryIds;
  final int ordinal;
}

PromotionResult? calculateBestPromotion(
  List<CartLine> lines,
  List<StorePromotion> promotions,
) {
  final candidates = promotions
      .map((promotion) => _calculatePromotion(promotion, lines))
      .whereType<PromotionResult>()
      .where((result) => result.discountCents > 0)
      .toList();
  candidates.sort((left, right) {
    final savings = right.discountCents.compareTo(left.discountCents);
    if (savings != 0) return savings;
    final priority = right.promotion.priority.compareTo(
      left.promotion.priority,
    );
    if (priority != 0) return priority;
    return left.promotion.id.compareTo(right.promotion.id);
  });
  return candidates.isEmpty ? null : candidates.first;
}

PromotionResult? _calculatePromotion(
  StorePromotion promotion,
  List<CartLine> lines,
) {
  if (!promotion.enabled || promotion.categoryIds.isEmpty) return null;
  final isFreeOffer = promotion.type == 'buy_get_free';
  if (!isFreeOffer && promotion.type != 'bundle_discount') return null;
  final bundleSize =
      promotion.buyQuantity + (isFreeOffer ? promotion.freeQuantity : 0);
  if (bundleSize < 1) return null;

  final units = <_DealUnit>[];
  for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    final line = lines[lineIndex];
    final price = moneyToCents(line.price);
    if (price == null || line.quantity < 1) continue;
    final categories = line.product.categoryIds.toSet().toList();
    if (!categories.any(promotion.categoryIds.contains)) continue;
    for (var ordinal = 0; ordinal < line.quantity; ordinal++) {
      units.add(
        _DealUnit(
          lineIndex: lineIndex,
          priceCents: price,
          categoryIds: categories,
          ordinal: ordinal,
        ),
      );
    }
  }
  if (units.length < bundleSize) return null;
  units.sort((left, right) {
    final price = left.priceCents.compareTo(right.priceCents);
    if (price != 0) return price;
    final line = left.lineIndex.compareTo(right.lineIndex);
    return line != 0 ? line : left.ordinal.compareTo(right.ordinal);
  });

  final available = List<bool>.filled(units.length, true);
  final unitsByCategory = <String, List<int>>{
    for (final id in promotion.categoryIds) id: <int>[],
  };
  for (var unitIndex = 0; unitIndex < units.length; unitIndex++) {
    for (final categoryId in units[unitIndex].categoryIds) {
      unitsByCategory[categoryId]?.add(unitIndex);
    }
  }
  final categoryCursors = <String, int>{
    for (final id in promotion.categoryIds) id: 0,
  };
  final freeUnitsByLine = List<int>.filled(lines.length, 0);
  final discountedUnitsByLine = List<int>.filled(lines.length, 0);
  final discountCentsByLine = List<int>.filled(lines.length, 0);
  var discountCents = 0;
  var allUnitsCursor = 0;

  while (true) {
    final selected = <int>{};
    for (final categoryId in promotion.categoryIds) {
      final categoryUnits = unitsByCategory[categoryId] ?? const <int>[];
      var cursor = categoryCursors[categoryId] ?? 0;
      while (cursor < categoryUnits.length &&
          (!available[categoryUnits[cursor]] ||
              selected.contains(categoryUnits[cursor]))) {
        cursor++;
      }
      categoryCursors[categoryId] = cursor + 1;
      if (cursor >= categoryUnits.length) {
        return discountCents > 0
            ? PromotionResult(
                promotion: promotion,
                discountCents: discountCents,
                freeUnitsByLine: freeUnitsByLine,
                discountedUnitsByLine: discountedUnitsByLine,
                discountCentsByLine: discountCentsByLine,
              )
            : null;
      }
      selected.add(categoryUnits[cursor]);
    }

    while (selected.length < bundleSize) {
      while (allUnitsCursor < units.length &&
          (!available[allUnitsCursor] || selected.contains(allUnitsCursor))) {
        allUnitsCursor++;
      }
      if (allUnitsCursor >= units.length) {
        return discountCents > 0
            ? PromotionResult(
                promotion: promotion,
                discountCents: discountCents,
                freeUnitsByLine: freeUnitsByLine,
                discountedUnitsByLine: discountedUnitsByLine,
                discountCentsByLine: discountCentsByLine,
              )
            : null;
      }
      selected.add(allUnitsCursor);
      allUnitsCursor++;
    }

    final group = selected.toList();
    for (final unitIndex in group) {
      available[unitIndex] = false;
    }
    if (isFreeOffer) {
      group.sort((left, right) {
        final price = units[left].priceCents.compareTo(units[right].priceCents);
        if (price != 0) return price;
        final line = units[left].lineIndex.compareTo(units[right].lineIndex);
        return line != 0
            ? line
            : units[left].ordinal.compareTo(units[right].ordinal);
      });
      for (final unitIndex in group.take(promotion.freeQuantity)) {
        final unit = units[unitIndex];
        freeUnitsByLine[unit.lineIndex]++;
        discountCentsByLine[unit.lineIndex] += unit.priceCents;
        discountCents += unit.priceCents;
      }
    } else {
      for (final unitIndex in group) {
        final unit = units[unitIndex];
        final unitDiscount = (unit.priceCents * promotion.discountPercent / 100)
            .round();
        discountedUnitsByLine[unit.lineIndex]++;
        discountCentsByLine[unit.lineIndex] += unitDiscount;
        discountCents += unitDiscount;
      }
    }
  }
}
