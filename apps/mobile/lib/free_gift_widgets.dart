import 'package:flutter/material.dart';

import 'store_api.dart';

const _giftInk = Color(0xff0d3a52);
const _giftAccent = Color(0xff087ba5);

class GiftSelectionState extends ChangeNotifier {
  FreeGiftOffer? offer;
  bool loading = true;
  String? selectedProductId;
  bool decisionMade = false;
  bool confirmed = false;
  String? error;

  bool isEligible(List<CartLine> cart) {
    final currentOffer = offer;
    if (currentOffer == null ||
        !currentOffer.config.enabled ||
        currentOffer.products.isEmpty) {
      return false;
    }
    final giftCategoryId =
        currentOffer.categoryId ?? currentOffer.config.categoryId;
    final lensUnits = cart
        .where(
          (line) =>
              giftCategoryId == null ||
              !line.product.categoryIds.contains(giftCategoryId),
        )
        .fold<int>(0, (total, line) => total + line.quantity);
    return lensUnits >= currentOffer.config.minLensQuantity;
  }

  FreeGiftProduct? get selectedProduct {
    final id = selectedProductId;
    if (id == null) return null;
    for (final product in offer?.products ?? const <FreeGiftProduct>[]) {
      if (product.id == id) return product;
    }
    return null;
  }

  void setOffer(FreeGiftOffer value, List<CartLine> cart) {
    offer = value;
    loading = false;
    _clearIfIneligible(cart);
    notifyListeners();
  }

  void finishLoading() {
    loading = false;
    notifyListeners();
  }

  void updateCart(List<CartLine> cart) {
    if (_clearIfIneligible(cart)) notifyListeners();
  }

  bool _clearIfIneligible(List<CartLine> cart) {
    if (isEligible(cart)) return false;
    final changed =
        selectedProductId != null || decisionMade || confirmed || error != null;
    selectedProductId = null;
    decisionMade = false;
    confirmed = false;
    error = null;
    return changed;
  }

  void choose(String productId) {
    selectedProductId = productId;
    decisionMade = true;
    confirmed = false;
    error = null;
    notifyListeners();
  }

  void skip() {
    selectedProductId = null;
    decisionMade = true;
    confirmed = false;
    error = null;
    notifyListeners();
  }

  void setConfirmed(bool value) {
    confirmed = value;
    error = null;
    notifyListeners();
  }

  void showError(String message) {
    error = message;
    notifyListeners();
  }

  void resetSelection() {
    selectedProductId = null;
    decisionMade = false;
    confirmed = false;
    error = null;
    notifyListeners();
  }
}

class FreeGiftChooser extends StatelessWidget {
  const FreeGiftChooser({required this.state, required this.cart, super.key});

  final GiftSelectionState state;
  final List<CartLine> cart;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        final offer = state.offer;
        if (offer == null || !state.isEligible(cart)) {
          return const SizedBox.shrink();
        }
        final selected = state.selectedProduct;
        return Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xff54c7e9), Color(0xffb8e8f5), Color(0xff87d8f0)],
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xfff7fcff),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: _giftAccent,
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: Text(
                    offer.config.badge,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 11,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  offer.config.title,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: _giftInk,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (offer.config.message.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    offer.config.message,
                    style: const TextStyle(color: _giftInk),
                  ),
                ],
                const SizedBox(height: 14),
                SizedBox(
                  height: 154,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: offer.products.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (context, index) {
                      final product = offer.products[index];
                      final isSelected = selected?.id == product.id;
                      return SizedBox(
                        width: 126,
                        child: Material(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: () => state.choose(product.id),
                            child: Container(
                              padding: const EdgeInsets.all(9),
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: isSelected
                                      ? _giftAccent
                                      : const Color(0xffcfe2eb),
                                  width: isSelected ? 2 : 1,
                                ),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Center(
                                      child: product.imageUrl == null
                                          ? const Icon(
                                              Icons.card_giftcard_outlined,
                                              color: _giftAccent,
                                              size: 38,
                                            )
                                          : Image.network(
                                              product.imageUrl!,
                                              fit: BoxFit.contain,
                                              errorBuilder: (_, __, ___) =>
                                                  const Icon(
                                                    Icons
                                                        .card_giftcard_outlined,
                                                    color: _giftAccent,
                                                    size: 38,
                                                  ),
                                            ),
                                    ),
                                  ),
                                  Text(
                                    product.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: _giftInk,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  const Text(
                                    'FREE',
                                    style: TextStyle(
                                      color: _giftAccent,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    ChoiceChip(
                      label: const Text('No gift, thanks'),
                      selected: state.decisionMade && selected == null,
                      onSelected: (value) {
                        if (value) state.skip();
                      },
                    ),
                    if (!state.decisionMade)
                      const Text(
                        'Choose a gift or select no gift to continue.',
                        style: TextStyle(color: _giftInk, fontSize: 12),
                      ),
                  ],
                ),
                if (selected != null)
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: state.confirmed,
                    activeColor: _giftAccent,
                    title: Text(
                      'I confirm I want ${selected.name} as my free gift',
                      style: const TextStyle(color: _giftInk, fontSize: 13),
                    ),
                    onChanged: (value) => state.setConfirmed(value == true),
                  ),
                if (state.error != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    state.error!,
                    style: const TextStyle(
                      color: Color(0xffb4233e),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class FreeGiftSummaryLine extends StatelessWidget {
  const FreeGiftSummaryLine({required this.state, super.key});

  final GiftSelectionState state;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: state,
    builder: (context, _) {
      final product = state.selectedProduct;
      if (product == null) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '${product.name} gift',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            const Text(
              'FREE',
              style: TextStyle(color: _giftAccent, fontWeight: FontWeight.w800),
            ),
          ],
        ),
      );
    },
  );
}
