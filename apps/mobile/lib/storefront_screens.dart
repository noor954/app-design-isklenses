import 'dart:async';

import 'package:flutter/material.dart';

import 'store_api.dart';

const _ink = Color(0xff15384d);
const _navy = Color(0xff033473);
const _blue = Color(0xff006f9b);
const _paper = Color(0xfff7fcff);
const _pale = Color(0xffe8f6fb);
const _rule = Color(0xffcfe2eb);

class StorefrontHomeScreen extends StatefulWidget {
  const StorefrontHomeScreen({
    required this.api,
    required this.onBrowse,
    required this.onProduct,
    required this.onCompare,
    required this.onPage,
    super.key,
  });

  final StoreApi api;
  final ValueChanged<StoreBrowseFilter> onBrowse;
  final ValueChanged<StoreProduct> onProduct;
  final ValueChanged<StoreProduct> onCompare;
  final ValueChanged<String> onPage;

  @override
  State<StorefrontHomeScreen> createState() => _StorefrontHomeScreenState();
}

class _StorefrontHomeScreenState extends State<StorefrontHomeScreen> {
  late Future<StoreHomeData> _data;
  final _heroController = PageController();
  Timer? _heroTimer;
  int _heroPage = 0;

  @override
  void initState() {
    super.initState();
    _data = widget.api.getHomeData();
    _heroTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!_heroController.hasClients) return;
      final count = _cachedBanners.length;
      if (count < 2) return;
      _heroPage = (_heroPage + 1) % count;
      _heroController.animateToPage(
        _heroPage,
        duration: const Duration(milliseconds: 540),
        curve: Curves.easeOutCubic,
      );
    });
  }

  List<StoreBanner> _cachedBanners = const [];

  @override
  void dispose() {
    _heroTimer?.cancel();
    _heroController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() => _data = widget.api.getHomeData());
    try {
      await _data;
    } on StoreApiException {
      // FutureBuilder renders the request failure and lets the shopper retry.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _paper,
      body: FutureBuilder<StoreHomeData>(
        future: _data,
        builder: (context, snapshot) {
          if (snapshot.hasError && !snapshot.hasData) {
            return _HomeError(
              message: snapshot.error is StoreApiException
                  ? snapshot.error.toString()
                  : 'Storefront content is unavailable.',
              onRetry: _refresh,
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator(color: _blue));
          }
          final data = snapshot.data!;
          final heroBanners = data.banners
              .where((banner) => banner.placement == 'hero')
              .toList();
          _cachedBanners = heroBanners;
          final products = data.products;
          final categories = data.categories
              .where(
                (item) =>
                    item.isActive && item.showInMenu && item.productCount > 0,
              )
              .toList();
          final brands = data.brands
              .where((item) => item.productCount > 0)
              .toList();
          final shades = data.shades
              .where((item) => item.productCount > 0)
              .toList();
          final featured = products.where((item) => item.isFeatured).toList();
          final arrivals = products.where((item) => item.isNewArrival).toList();
          final offers = products.where((item) => item.isOnSale).toList();

          return RefreshIndicator(
            onRefresh: _refresh,
            color: _blue,
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _HeroCarousel(
                    banners: heroBanners,
                    controller: _heroController,
                    onPage: widget.onPage,
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 6),
                    child: _SearchPanel(onSearch: widget.onBrowse),
                  ),
                ),
                if (categories.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _DirectorySection<StoreCategory>(
                      title: 'Find your collection',
                      subtitle: 'Browse lenses by collection',
                      items: categories,
                      itemBuilder: (item) => _ImageDirectoryCard(
                        title: item.name,
                        count: item.productCount,
                        imageUrl: item.imageUrl,
                        icon: Icons.category_outlined,
                        onTap: () => widget.onBrowse(
                          StoreBrowseFilter(category: item.slug),
                        ),
                      ),
                      onViewAll: () => widget.onPage('/product-category'),
                    ),
                  ),
                if (brands.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _DirectorySection<StoreBrand>(
                      title: 'Shop by brand',
                      subtitle: 'Explore the brand directory',
                      items: brands,
                      itemBuilder: (item) => _ImageDirectoryCard(
                        title: item.name,
                        count: item.productCount,
                        imageUrl: item.imageUrl,
                        icon: Icons.remove_red_eye_outlined,
                        onTap: () => widget.onBrowse(
                          StoreBrowseFilter(brand: item.slug),
                        ),
                      ),
                      onViewAll: () => widget.onPage('/brands'),
                    ),
                  ),
                if (shades.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _DirectorySection<StoreShade>(
                      title: 'Explore lens shades',
                      subtitle: 'Browse the shades linked to active listings',
                      items: shades,
                      itemBuilder: (item) => _ImageDirectoryCard(
                        title: item.name,
                        count: item.productCount,
                        imageUrl: item.imageUrl,
                        icon: Icons.palette_outlined,
                        swatch: _colorFromHex(item.hex),
                        onTap: () => widget.onBrowse(
                          StoreBrowseFilter(shadeId: item.id),
                        ),
                      ),
                      onViewAll: () => widget.onPage('/shop'),
                    ),
                  ),
                if (featured.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _ProductShelf(
                      title: 'Featured for you',
                      products: featured,
                      onProduct: widget.onProduct,
                      onCompare: widget.onCompare,
                      onViewAll: () => widget.onBrowse(
                        const StoreBrowseFilter(sort: 'featured'),
                      ),
                    ),
                  ),
                if (arrivals.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _ProductShelf(
                      title: 'Just arrived',
                      products: arrivals,
                      onProduct: widget.onProduct,
                      onCompare: widget.onCompare,
                      onViewAll: () =>
                          widget.onBrowse(const StoreBrowseFilter()),
                    ),
                  ),
                if (offers.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _ProductShelf(
                      title: 'On sale',
                      products: offers,
                      onProduct: widget.onProduct,
                      onCompare: widget.onCompare,
                      onViewAll: () =>
                          widget.onBrowse(const StoreBrowseFilter()),
                    ),
                  ),
                if (data.lensTypes.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _LensTypeSection(
                      items: data.lensTypes,
                      onTap: (type) => widget.onBrowse(
                        StoreBrowseFilter(lensTypeId: type.id),
                      ),
                    ),
                  ),
                if (data.reviews.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _ReviewSection(reviews: data.reviews),
                  ),
                SliverToBoxAdapter(
                  child: _GuidanceBanner(onTap: () => widget.onPage('/faq')),
                ),
                SliverToBoxAdapter(
                  child: StoreSiteFooter(data: data, onPage: widget.onPage),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HeroCarousel extends StatelessWidget {
  const _HeroCarousel({
    required this.banners,
    required this.controller,
    required this.onPage,
  });

  final List<StoreBanner> banners;
  final PageController controller;
  final ValueChanged<String> onPage;

  @override
  Widget build(BuildContext context) {
    final slides = banners.isEmpty
        ? const [
            StoreBanner(
              id: 'editorial-one',
              placement: 'hero',
              title: 'See color differently.',
              body:
                  'Explore lens shades, browse the catalog, and compare the details.',
              imageUrl:
                  'https://www.isklenses.online/isk-home/hero-editorial-1.jpg',
              href: '/shop',
            ),
            StoreBanner(
              id: 'editorial-two',
              placement: 'hero',
              title: 'A shade for your point of view.',
              body: 'Find your next look in the ISK Lenses collection.',
              imageUrl:
                  'https://www.isklenses.online/isk-home/hero-editorial-2.jpg',
              href: '/shop',
            ),
            StoreBanner(
              id: 'editorial-three',
              placement: 'hero',
              title: 'Let your look take the lead.',
              body: 'Discover colors and compare active lens listings.',
              imageUrl:
                  'https://www.isklenses.online/isk-home/hero-editorial-3.jpg',
              href: '/shop',
            ),
          ]
        : banners.take(7).toList();
    final wide = MediaQuery.sizeOf(context).width >= 760;
    final height = wide ? 390.0 : 340.0;
    return SizedBox(
      height: height,
      child: PageView.builder(
        controller: controller,
        itemCount: slides.length,
        itemBuilder: (context, index) {
          final slide = slides[index];
          return Stack(
            fit: StackFit.expand,
            children: [
              if (slide.imageUrl.isNotEmpty)
                Image.network(
                  slide.imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const ColoredBox(color: _navy),
                )
              else
                const ColoredBox(color: _navy),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xe615384d), Color(0x0015384d)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                ),
              ),
              Positioned(
                left: wide ? 42 : 24,
                right: wide ? 42 : 24,
                bottom: wide ? 52 : 42,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 700),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        slide.title.isEmpty ? 'ISK Lenses' : slide.title,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.headlineLarge
                            ?.copyWith(
                              color: Colors.white,
                              height: 1,
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                      if (slide.body?.isNotEmpty == true) ...[
                        const SizedBox(height: 10),
                        Text(
                          slide.body!,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(color: Colors.white.withAlpha(225)),
                        ),
                      ],
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: () => onPage(slide.href ?? '/shop'),
                        icon: const Icon(Icons.arrow_forward_rounded),
                        label: const Text('Explore the collection'),
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                top: 20,
                right: 20,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.black.withAlpha(90),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 7,
                    ),
                    child: Text(
                      '${index + 1} / ${slides.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SearchPanel extends StatefulWidget {
  const _SearchPanel({required this.onSearch});

  final ValueChanged<StoreBrowseFilter> onSearch;

  @override
  State<_SearchPanel> createState() => _SearchPanelState();
}

class _SearchPanelState extends State<_SearchPanel> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _search() {
    widget.onSearch(StoreBrowseFilter(query: _controller.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      textInputAction: TextInputAction.search,
      onSubmitted: (_) => _search(),
      decoration: InputDecoration(
        hintText: 'Search lenses, brands, or shades',
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: IconButton(
          tooltip: 'Search',
          onPressed: _search,
          icon: const Icon(Icons.arrow_forward_rounded),
        ),
      ),
    );
  }
}

class _DirectorySection<T> extends StatelessWidget {
  const _DirectorySection({
    required this.title,
    required this.subtitle,
    required this.items,
    required this.itemBuilder,
    required this.onViewAll,
  });

  final String title;
  final String subtitle;
  final List<T> items;
  final Widget Function(T item) itemBuilder;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final cardWidth = width >= 980
        ? 236.0
        : width >= 680
        ? 208.0
        : 174.0;
    return Padding(
      padding: const EdgeInsets.only(top: 30),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeading(
            title: title,
            subtitle: subtitle,
            action: 'View all',
            onAction: onViewAll,
          ),
          const SizedBox(height: 15),
          SizedBox(
            height: 208,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              scrollDirection: Axis.horizontal,
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) =>
                  SizedBox(width: cardWidth, child: itemBuilder(items[index])),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImageDirectoryCard extends StatelessWidget {
  const _ImageDirectoryCard({
    required this.title,
    required this.count,
    required this.imageUrl,
    required this.icon,
    required this.onTap,
    this.swatch,
  });

  final String title;
  final int count;
  final String? imageUrl;
  final IconData icon;
  final VoidCallback onTap;
  final Color? swatch;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (imageUrl != null)
                      Image.network(
                        imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            _DirectoryPlaceholder(icon: icon, swatch: swatch),
                      )
                    else
                      _DirectoryPlaceholder(icon: icon, swatch: swatch),
                    Align(
                      alignment: Alignment.bottomCenter,
                      child: Container(
                        height: 58,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Colors.transparent, Color(0x88000000)],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      right: 10,
                      bottom: 8,
                      child: Text(
                        '$count ${count == 1 ? 'listing' : 'listings'}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: _ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DirectoryPlaceholder extends StatelessWidget {
  const _DirectoryPlaceholder({required this.icon, this.swatch});

  final IconData icon;
  final Color? swatch;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: swatch ?? _pale,
    child: Center(child: Icon(icon, size: 38, color: _blue.withAlpha(220))),
  );
}

class _ProductShelf extends StatelessWidget {
  const _ProductShelf({
    required this.title,
    required this.products,
    required this.onProduct,
    required this.onCompare,
    required this.onViewAll,
  });

  final String title;
  final List<StoreProduct> products;
  final ValueChanged<StoreProduct> onProduct;
  final ValueChanged<StoreProduct> onCompare;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 800;
    final cardWidth = wide ? 226.0 : 190.0;
    return Padding(
      padding: const EdgeInsets.only(top: 34),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeading(
            title: title,
            action: 'Shop all',
            onAction: onViewAll,
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 320,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (_, __) => const SizedBox(width: 14),
              itemBuilder: (context, index) => SizedBox(
                width: cardWidth,
                child: StoreProductCard(
                  product: products[index],
                  onTap: () => onProduct(products[index]),
                  onCompare: () => onCompare(products[index]),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class StoreProductCard extends StatelessWidget {
  const StoreProductCard({
    required this.product,
    required this.onTap,
    this.onCompare,
    super.key,
  });

  final StoreProduct product;
  final VoidCallback onTap;
  final VoidCallback? onCompare;

  @override
  Widget build(BuildContext context) {
    final image = product.imageUrl;
    final onSale =
        product.compareAtPrice != null &&
        (double.tryParse(product.compareAtPrice!) ?? 0) >
            (double.tryParse(product.price) ?? 0);
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (image != null)
                    Image.network(
                      image,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const _ProductPlaceholder(),
                    )
                  else
                    const _ProductPlaceholder(),
                  if (onSale)
                    Positioned(
                      left: 10,
                      top: 10,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: _navy,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          child: Text(
                            'On sale',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (onCompare != null)
                    Positioned(
                      top: 2,
                      right: 2,
                      child: IconButton(
                        tooltip: 'Add to compare',
                        onPressed: onCompare,
                        icon: const Icon(Icons.compare_arrows_rounded),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withAlpha(230),
                          foregroundColor: _navy,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (product.brand?.isNotEmpty == true)
                    Text(
                      product.brand!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: _blue,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _ink,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    _money(product.price, product.currency),
                    style: const TextStyle(
                      color: _navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductPlaceholder extends StatelessWidget {
  const _ProductPlaceholder();

  @override
  Widget build(BuildContext context) => const ColoredBox(
    color: _pale,
    child: Center(
      child: Icon(Icons.remove_red_eye_outlined, size: 42, color: _navy),
    ),
  );
}

class _LensTypeSection extends StatelessWidget {
  const _LensTypeSection({required this.items, required this.onTap});

  final List<StoreLensType> items;
  final ValueChanged<StoreLensType> onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 30, 18, 0),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeading(title: 'Browse by lens type'),
        const SizedBox(height: 12),
        for (final item in items)
          ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 4),
            leading: CircleAvatar(
              backgroundColor: _pale,
              foregroundImage: item.imageUrl == null
                  ? null
                  : NetworkImage(item.imageUrl!),
              child: const Icon(Icons.remove_red_eye_outlined),
            ),
            title: Text(
              item.name,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text('${item.productCount} active listings'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => onTap(item),
          ),
      ],
    ),
  );
}

class _ReviewSection extends StatelessWidget {
  const _ReviewSection({required this.reviews});

  final List<StoreReview> reviews;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 26),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeading(
          title: 'Product reviews',
          subtitle: 'Approved reviews linked to active products',
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 170,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            scrollDirection: Axis.horizontal,
            itemCount: reviews.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final review = reviews[index];
              return SizedBox(
                width: 290,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: _rule),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${'★' * review.rating.clamp(0, 5)}  ${review.rating}/5',
                          style: const TextStyle(
                            color: Color(0xffa45d14),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (review.title?.isNotEmpty == true) ...[
                          const SizedBox(height: 5),
                          Text(
                            review.title!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ],
                        const SizedBox(height: 6),
                        Expanded(
                          child: Text(
                            review.body,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: _ink, height: 1.35),
                          ),
                        ),
                        Text(
                          review.author,
                          style: const TextStyle(
                            color: _blue,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    ),
  );
}

class _GuidanceBanner extends StatelessWidget {
  const _GuidanceBanner({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 30, 18, 0),
    child: Material(
      color: _navy,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: const Padding(
          padding: EdgeInsets.all(20),
          child: Row(
            children: [
              Icon(Icons.info_outline_rounded, color: Colors.white, size: 28),
              SizedBox(width: 14),
              Expanded(
                child: Text(
                  'Contact lenses are medical devices. Follow the guidance of your eye-care professional.',
                  style: TextStyle(color: Colors.white, height: 1.4),
                ),
              ),
              Icon(Icons.arrow_forward_rounded, color: Colors.white),
            ],
          ),
        ),
      ),
    ),
  );
}

class StoreSiteFooter extends StatelessWidget {
  const StoreSiteFooter({required this.data, required this.onPage, super.key});

  final StoreHomeData data;
  final ValueChanged<String> onPage;

  @override
  Widget build(BuildContext context) {
    final about = data.chrome.footer['about']?.toString();
    final email = data.chrome.contact['email']?.toString();
    final phone = data.chrome.contact['phone']?.toString();
    return Container(
      margin: const EdgeInsets.only(top: 30),
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 18),
      color: _navy,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ISK Lenses',
            style: TextStyle(
              color: Colors.white,
              fontSize: 23,
              fontWeight: FontWeight.w900,
            ),
          ),
          if (about != null && about.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              about,
              style: TextStyle(color: Colors.white.withAlpha(210), height: 1.4),
            ),
          ],
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (label, route) in const [
                ('Shop all', '/shop'),
                ('Brands', '/brands'),
                ('FAQs', '/faq'),
                ('Contact', '/contact-us'),
                ('Shipping', '/shipping-returns'),
                ('Privacy', '/privacy-policy'),
                ('Terms', '/terms-conditions'),
                ('Blogs', '/blogs'),
              ])
                ActionChip(
                  label: Text(label),
                  backgroundColor: Colors.white.withAlpha(20),
                  side: BorderSide(color: Colors.white.withAlpha(85)),
                  labelStyle: const TextStyle(color: Colors.white),
                  onPressed: () => onPage(route),
                ),
            ],
          ),
          if (email?.isNotEmpty == true || phone?.isNotEmpty == true) ...[
            const SizedBox(height: 16),
            if (email?.isNotEmpty == true)
              Text(
                email!,
                style: TextStyle(color: Colors.white.withAlpha(220)),
              ),
            if (phone?.isNotEmpty == true)
              Text(
                phone!,
                style: TextStyle(color: Colors.white.withAlpha(220)),
              ),
          ],
          const Divider(color: Color(0x55ffffff), height: 28),
          Text(
            '© ${DateTime.now().year} ISK Lenses. Contact lenses are medical devices; follow professional guidance.',
            style: TextStyle(color: Colors.white.withAlpha(175), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class StoreDirectoryScreen extends StatefulWidget {
  const StoreDirectoryScreen({
    required this.api,
    required this.path,
    required this.onBrowse,
    required this.onProduct,
    required this.onCompare,
    super.key,
  });

  final StoreApi api;
  final String path;
  final ValueChanged<StoreBrowseFilter> onBrowse;
  final ValueChanged<StoreProduct> onProduct;
  final ValueChanged<StoreProduct> onCompare;

  @override
  State<StoreDirectoryScreen> createState() => _StoreDirectoryScreenState();
}

class _StoreDirectoryScreenState extends State<StoreDirectoryScreen> {
  late Future<StoreHomeData> _data;

  @override
  void initState() {
    super.initState();
    _data = widget.api.getHomeData();
  }

  @override
  Widget build(BuildContext context) {
    final path = widget.path;
    final title = switch (path) {
      '/brands' => 'All brands',
      '/product-category' => 'All categories',
      '/blogs' => 'From ISK Lenses',
      _ => 'Store information',
    };
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      backgroundColor: _paper,
      body: FutureBuilder<StoreHomeData>(
        future: _data,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            if (snapshot.hasError) {
              return _HomeError(
                message: snapshot.error.toString(),
                onRetry: () => setState(() => _data = widget.api.getHomeData()),
              );
            }
            return const Center(child: CircularProgressIndicator());
          }
          final data = snapshot.data!;
          if (path == '/brands' || path == '/product-category') {
            final isBrand = path == '/brands';
            final entries = isBrand
                ? data.brands.where((item) => item.productCount > 0).toList()
                : data.categories
                      .where((item) => item.isActive && item.productCount > 0)
                      .toList();
            return ListView(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 26),
              children: [
                Text(
                  isBrand
                      ? 'Choose a brand to browse its active listings.'
                      : 'Explore the active categories in the store.',
                  style: const TextStyle(color: _ink, height: 1.4),
                ),
                const SizedBox(height: 16),
                for (final entry in entries)
                  _DirectoryRow(
                    name: isBrand
                        ? (entry as StoreBrand).name
                        : (entry as StoreCategory).name,
                    count: isBrand
                        ? (entry as StoreBrand).productCount
                        : (entry as StoreCategory).productCount,
                    image: isBrand
                        ? (entry as StoreBrand).imageUrl
                        : (entry as StoreCategory).imageUrl,
                    onTap: () => widget.onBrowse(
                      isBrand
                          ? StoreBrowseFilter(brand: (entry as StoreBrand).slug)
                          : StoreBrowseFilter(
                              category: (entry as StoreCategory).slug,
                            ),
                    ),
                  ),
                StoreSiteFooter(
                  data: data,
                  onPage: (route) {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => StoreInformationScreen(
                          api: widget.api,
                          path: route,
                        ),
                      ),
                    );
                  },
                ),
              ],
            );
          }
          return ListView(
            padding: EdgeInsets.zero,
            children: [
              if (path == '/blogs')
                const _InfoArticle(
                  title: 'Lens notes & store updates',
                  paragraphs: [
                    'Explore the catalog by brand, shade, and lens type. Product details shown in the store come from active listings.',
                    'For lens fit and suitability, consult your eye-care professional.',
                  ],
                )
              else
                _InfoContent(path: path, chrome: data.chrome),
              StoreSiteFooter(
                data: data,
                onPage: (route) {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          StoreInformationScreen(api: widget.api, path: route),
                    ),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DirectoryRow extends StatelessWidget {
  const _DirectoryRow({
    required this.name,
    required this.count,
    required this.image,
    required this.onTap,
  });

  final String name;
  final int count;
  final String? image;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    minTileHeight: 76,
    contentPadding: const EdgeInsets.symmetric(horizontal: 8),
    leading: CircleAvatar(
      radius: 25,
      backgroundColor: _pale,
      foregroundImage: image == null ? null : NetworkImage(image!),
      child: const Icon(Icons.remove_red_eye_outlined, color: _blue),
    ),
    title: Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
    subtitle: Text('$count active ${count == 1 ? 'listing' : 'listings'}'),
    trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
    onTap: onTap,
  );
}

class StoreInformationScreen extends StatefulWidget {
  const StoreInformationScreen({
    required this.api,
    required this.path,
    super.key,
  });

  final StoreApi api;
  final String path;

  @override
  State<StoreInformationScreen> createState() => _StoreInformationScreenState();
}

class _StoreInformationScreenState extends State<StoreInformationScreen> {
  late Future<StoreHomeData> _data;

  @override
  void initState() {
    super.initState();
    _data = widget.api.getHomeData();
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (widget.path) {
      '/faq' => 'Frequently asked questions',
      '/contact-us' => 'Contact the store',
      '/shipping-returns' => 'Shipping & returns',
      '/privacy-policy' => 'Privacy',
      '/terms-conditions' => 'Terms',
      '/blogs' => 'ISK Lenses journal',
      _ => 'ISK Lenses',
    };
    return Scaffold(
      backgroundColor: _paper,
      appBar: AppBar(title: Text(title)),
      body: FutureBuilder<StoreHomeData>(
        future: _data,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            if (snapshot.hasError) {
              return _HomeError(
                message: snapshot.error.toString(),
                onRetry: () => setState(() => _data = widget.api.getHomeData()),
              );
            }
            return const Center(child: CircularProgressIndicator());
          }
          final data = snapshot.data!;
          return ListView(
            padding: EdgeInsets.zero,
            children: [
              _InfoContent(path: widget.path, chrome: data.chrome),
              StoreSiteFooter(
                data: data,
                onPage: (route) => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        StoreInformationScreen(api: widget.api, path: route),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _InfoContent extends StatelessWidget {
  const _InfoContent({required this.path, required this.chrome});

  final String path;
  final StoreChrome chrome;

  static const _faq = [
    (
      'How do I pay for my order?',
      'Orders are paid for with cash on delivery. No online payment is collected in the app.',
    ),
    (
      'How is delivery priced?',
      'The configured delivery fee is shown during checkout before you place your order.',
    ),
    (
      'Do I need an account?',
      'No. Guest checkout is available. You can also create an account to see recent orders.',
    ),
    (
      'How do I choose lenses?',
      'Choose from the options shown on each listing. Consult your eye-care professional about lens fit and suitability.',
    ),
    (
      'Can I change or cancel an order?',
      'Contact the store with your order reference as soon as possible. Changes may not be possible after dispatch.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    if (path == '/faq') {
      return Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Answers for your next order',
              style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 14),
            for (final (question, answer) in _faq)
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: Text(
                  question,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(answer, style: const TextStyle(height: 1.45)),
                  ),
                ],
              ),
          ],
        ),
      );
    }
    if (path == '/contact-us') {
      final entries = [
        ('Call', chrome.contact['phone']?.toString()),
        ('WhatsApp', chrome.contact['whatsapp']?.toString()),
        ('Email', chrome.contact['email']?.toString()),
        ('Address', chrome.contact['address']?.toString()),
      ].where((entry) => entry.$2?.isNotEmpty == true);
      return _InfoArticle(
        title: 'Questions about a listing or an order?',
        paragraphs: [
          for (final entry in entries) '${entry.$1}: ${entry.$2}',
          if (entries.isEmpty)
            'Store contact details have not been published yet. Please check back soon.',
          'Include your order reference and the phone number used at checkout when asking about an order.',
        ],
      );
    }
    final content = switch (path) {
      '/shipping-returns' => (
        'Delivery and order changes',
        [
          'The delivery charge is calculated from the store’s current delivery rules and shown before an order is placed.',
          'Orders are cash on delivery. Contact the store with your order reference as soon as possible if you need to change or cancel an order.',
        ],
      ),
      '/privacy-policy' => (
        'Your information',
        [
          'Contact and delivery details are used to process and confirm orders and to support your account.',
          'Do not share payment details or health information in the store assistant chat.',
        ],
      ),
      '/terms-conditions' => (
        'Using the store',
        [
          'Catalog availability, prices, and stock are verified by the store when an order is reviewed.',
          'Product specifications are shown when they are recorded for a listing. Contact lenses are medical devices; consult an eye-care professional about fit and suitability.',
        ],
      ),
      _ => ('ISK Lenses', ['Browse the active ISK Lenses catalog.']),
    };
    return _InfoArticle(title: content.$1, paragraphs: content.$2);
  }
}

class _InfoArticle extends StatelessWidget {
  const _InfoArticle({required this.title, required this.paragraphs});

  final String title;
  final List<String> paragraphs;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 22, 20, 26),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: _navy,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 12),
        for (final paragraph in paragraphs)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              paragraph,
              style: const TextStyle(color: _ink, height: 1.5),
            ),
          ),
      ],
    ),
  );
}

class StoreComparisonScreen extends StatefulWidget {
  const StoreComparisonScreen({
    required this.api,
    required this.products,
    required this.onRemove,
    required this.onAdd,
    required this.onProduct,
    required this.onPage,
    super.key,
  });

  final StoreApi api;
  final List<StoreProduct> products;
  final ValueChanged<StoreProduct> onRemove;
  final ValueChanged<StoreProduct> onAdd;
  final ValueChanged<StoreProduct> onProduct;
  final ValueChanged<String> onPage;

  @override
  State<StoreComparisonScreen> createState() => _StoreComparisonScreenState();
}

class _StoreComparisonScreenState extends State<StoreComparisonScreen> {
  late Future<StoreHomeData> _footerData;

  @override
  void initState() {
    super.initState();
    _footerData = widget.api.getHomeData();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.products.isEmpty) {
      return const Scaffold(backgroundColor: _paper, body: _EmptyCompare());
    }
    final width = MediaQuery.sizeOf(context).width;
    final columnWidth = width >= 900 ? 290.0 : 248.0;
    return Scaffold(
      backgroundColor: _paper,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
        children: [
          const Text(
            'Compare lenses',
            style: TextStyle(
              color: _navy,
              fontSize: 25,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Compare listed product details side by side. Ask an eye-care professional about fit and suitability.',
            style: TextStyle(color: _ink, height: 1.4),
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final product in widget.products)
                  SizedBox(
                    width: columnWidth,
                    child: Padding(
                      padding: const EdgeInsets.only(right: 12),
                      child: _CompareColumn(
                        product: product,
                        onRemove: () => widget.onRemove(product),
                        onAdd: () => widget.onAdd(product),
                        onProduct: () => widget.onProduct(product),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          for (final (label, value) in [
            for (final row in _compareRows)
              (
                row.$1,
                widget.products.map((product) => row.$2(product)).toList(),
              ),
          ])
            _CompareRow(label: label, values: value),
          FutureBuilder<StoreHomeData>(
            future: _footerData,
            builder: (context, snapshot) => snapshot.hasData
                ? StoreSiteFooter(data: snapshot.data!, onPage: widget.onPage)
                : const SizedBox(height: 24),
          ),
        ],
      ),
    );
  }
}

class _CompareColumn extends StatelessWidget {
  const _CompareColumn({
    required this.product,
    required this.onRemove,
    required this.onAdd,
    required this.onProduct,
  });

  final StoreProduct product;
  final VoidCallback onRemove;
  final VoidCallback onAdd;
  final VoidCallback onProduct;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    color: Colors.white,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 170,
          width: double.infinity,
          child: product.imageUrl == null
              ? const _ProductPlaceholder()
              : Image.network(
                  product.imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const _ProductPlaceholder(),
                ),
        ),
        Padding(
          padding: const EdgeInsets.all(13),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                product.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _ink,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                _money(product.price, product.currency),
                style: const TextStyle(
                  color: _navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: onProduct,
                  child: const Text('View details'),
                ),
              ),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: onAdd,
                  child: const Text('Choose options'),
                ),
              ),
              Center(
                child: TextButton(
                  onPressed: onRemove,
                  child: const Text('Remove'),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

final _compareRows = <(String, String Function(StoreProduct))>[
  ('Brand', (product) => product.brand ?? 'Not listed'),
  ('Category', (product) => product.category ?? 'Not listed'),
  ('Shade', (product) => product.shade?['name']?.toString() ?? 'Not listed'),
  (
    'Lens type',
    (product) => product.lensType?['name']?.toString() ?? 'Not listed',
  ),
  ('Diameter', (product) => _withUnit(product.diameterMm, ' mm')),
  ('Base curve', (product) => _withUnit(product.baseCurve, ' mm')),
  ('Water content', (product) => _withUnit(product.waterContent, '%')),
  ('Material', (product) => product.material ?? 'Not listed'),
  ('Wear duration', (product) => product.wearDuration ?? 'Not listed'),
  ('Power range', (product) => product.powerRange ?? 'Not listed'),
  (
    'Availability',
    (product) => product.stockQuantity > 0 ? 'Available' : 'Unavailable',
  ),
];

class _CompareRow extends StatelessWidget {
  const _CompareRow({required this.label, required this.values});

  final String label;
  final List<String> values;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final columnWidth = width >= 900 ? 290.0 : 248.0;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _rule)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 92,
            child: Text(
              label,
              style: const TextStyle(color: _ink, fontWeight: FontWeight.w800),
            ),
          ),
          for (final value in values)
            SizedBox(
              width: columnWidth - 92,
              child: Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Text(value, style: const TextStyle(color: _ink)),
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyCompare extends StatelessWidget {
  const _EmptyCompare();

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.compare_arrows_rounded, size: 50, color: _blue),
          const SizedBox(height: 12),
          const Text(
            'Your comparison is empty',
            style: TextStyle(
              color: _navy,
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Add products from the catalog to compare their listed details.',
            textAlign: TextAlign.center,
            style: TextStyle(color: _ink),
          ),
        ],
      ),
    ),
  );
}

class StoreProductDetailsScreen extends StatefulWidget {
  const StoreProductDetailsScreen({
    required this.api,
    required this.product,
    required this.onAdd,
    required this.onPage,
    super.key,
  });

  final StoreApi api;
  final StoreProduct product;
  final ValueChanged<CartLine> onAdd;
  final ValueChanged<String> onPage;

  @override
  State<StoreProductDetailsScreen> createState() =>
      _StoreProductDetailsScreenState();
}

class _StoreProductDetailsScreenState extends State<StoreProductDetailsScreen> {
  ProductVariant? _variant;
  String? _leftPower;
  String? _rightPower;
  String? _error;
  var _imageIndex = 0;
  late Future<StoreHomeData> _footerData;

  @override
  void initState() {
    super.initState();
    _footerData = widget.api.getHomeData();
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final images = product.images.isEmpty
        ? (product.imageUrl == null ? const <String>[] : [product.imageUrl!])
        : product.images;
    final availableVariants = product.variants
        .where((variant) => variant.stockQuantity > 0)
        .toList();
    final available = product.stockQuantity > 0 || availableVariants.isNotEmpty;
    final wide = MediaQuery.sizeOf(context).width >= 760;
    final gallery = SizedBox(
      height: wide ? 480 : 380,
      child: Stack(
        children: [
          PageView.builder(
            itemCount: images.isEmpty ? 1 : images.length,
            onPageChanged: (value) => setState(() => _imageIndex = value),
            itemBuilder: (context, index) => images.isEmpty
                ? const _ProductPlaceholder()
                : Image.network(
                    images[index],
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const _ProductPlaceholder(),
                  ),
          ),
          if (images.length > 1)
            Positioned(
              left: 0,
              right: 0,
              bottom: 16,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var index = 0; index < images.length; index++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      width: index == _imageIndex ? 22 : 8,
                      height: 8,
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
    final details = Padding(
      padding: EdgeInsets.fromLTRB(wide ? 26 : 20, 20, wide ? 26 : 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (product.brand?.isNotEmpty == true)
            Text(
              product.brand!.toUpperCase(),
              style: const TextStyle(
                color: _blue,
                fontSize: 12,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.1,
              ),
            ),
          const SizedBox(height: 7),
          Text(
            product.name,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: _navy,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          if (product.ratingAvg != null)
            Row(
              children: [
                const Icon(Icons.star_rounded, color: Color(0xffa45d14)),
                Text(
                  '${product.ratingAvg!.toStringAsFixed(1)} (${product.ratingCount} reviews)',
                  style: const TextStyle(color: _ink),
                ),
              ],
            ),
          const SizedBox(height: 12),
          Text(
            _money(_variant?.price ?? product.price, product.currency),
            style: const TextStyle(
              color: _navy,
              fontSize: 23,
              fontWeight: FontWeight.w900,
            ),
          ),
          if (product.description?.isNotEmpty == true) ...[
            const SizedBox(height: 16),
            Text(
              product.description!,
              style: const TextStyle(color: _ink, height: 1.5),
            ),
          ],
          if (product.variants.isNotEmpty) ...[
            const SizedBox(height: 18),
            DropdownButtonFormField<String>(
              initialValue: _variant?.id,
              decoration: const InputDecoration(labelText: 'Lens option'),
              items: availableVariants
                  .map(
                    (item) => DropdownMenuItem(
                      value: item.id,
                      child: Text(item.name),
                    ),
                  )
                  .toList(),
              onChanged: (id) => setState(() {
                _variant = availableVariants
                    .where((item) => item.id == id)
                    .firstOrNull;
                _error = null;
              }),
            ),
          ],
          if (product.availablePowerRanges.isNotEmpty) ...[
            const SizedBox(height: 18),
            const Text(
              'Power selection',
              style: TextStyle(color: _ink, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _leftPower,
              decoration: const InputDecoration(labelText: 'Left eye'),
              items: product.availablePowerRanges
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
              onChanged: (value) => setState(() {
                _leftPower = value;
                _error = null;
              }),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _rightPower,
              decoration: const InputDecoration(labelText: 'Right eye'),
              items: product.availablePowerRanges
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
              onChanged: (value) => setState(() {
                _rightPower = value;
                _error = null;
              }),
            ),
          ],
          const SizedBox(height: 18),
          _SpecList(product: product),
          if (product.features.isNotEmpty) ...[
            const SizedBox(height: 18),
            const Text(
              'Product details',
              style: TextStyle(color: _navy, fontWeight: FontWeight.w900),
            ),
            for (final feature in product.features)
              ListTile(
                dense: true,
                leading: const Icon(Icons.check_circle_outline, color: _blue),
                title: Text(feature),
                contentPadding: EdgeInsets.zero,
              ),
          ],
          if (!available) ...[
            const SizedBox(height: 12),
            const Text(
              'Currently unavailable',
              style: TextStyle(color: Colors.red),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: available ? _add : null,
              icon: const Icon(Icons.shopping_bag_outlined),
              label: const Text('Add to bag'),
            ),
          ),
          FutureBuilder<StoreHomeData>(
            future: _footerData,
            builder: (context, snapshot) => snapshot.hasData
                ? StoreSiteFooter(data: snapshot.data!, onPage: widget.onPage)
                : const SizedBox(height: 20),
          ),
        ],
      ),
    );
    return Scaffold(
      backgroundColor: _paper,
      appBar: AppBar(title: const Text('Product details')),
      body: wide
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: gallery),
                Expanded(child: SingleChildScrollView(child: details)),
              ],
            )
          : ListView(padding: EdgeInsets.zero, children: [gallery, details]),
    );
  }

  void _add() {
    final product = widget.product;
    if (product.variants.isNotEmpty && _variant == null) {
      setState(() => _error = 'Choose a lens option to continue.');
      return;
    }
    if (product.availablePowerRanges.isNotEmpty &&
        (_leftPower == null || _rightPower == null)) {
      setState(() => _error = 'Select a power range for both eyes.');
      return;
    }
    widget.onAdd(
      CartLine(
        product: product,
        variant: _variant,
        leftPowerRange: _leftPower,
        rightPowerRange: _rightPower,
        quantity: 1,
      ),
    );
    Navigator.of(context).pop();
  }
}

class _SpecList extends StatelessWidget {
  const _SpecList({required this.product});

  final StoreProduct product;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String?)>[
      ('Category', product.category),
      ('Shade', product.shade?['name']?.toString()),
      ('Lens type', product.lensType?['name']?.toString()),
      ('Diameter', _withUnit(product.diameterMm, ' mm')),
      ('Base curve', _withUnit(product.baseCurve, ' mm')),
      ('Water content', _withUnit(product.waterContent, '%')),
      ('Material', product.material),
      ('Wear duration', product.wearDuration),
      ('Pack contents', product.packContents),
      ('Power range', product.powerRange),
    ];
    final specs = [
      ...rows.where((row) => row.$2?.isNotEmpty == true),
      ...product.specs.map(
        (spec) => (spec['label']?.toString() ?? '', spec['value']?.toString()),
      ),
    ];
    if (specs.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Specifications',
          style: TextStyle(color: _navy, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        for (final (label, value) in specs)
          if (value?.isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(
                        color: _ink,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      value!,
                      textAlign: TextAlign.end,
                      style: const TextStyle(color: _ink),
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({
    required this.title,
    this.subtitle,
    this.action,
    this.onAction,
  });

  final String title;
  final String? subtitle;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 18),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: _navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 3),
                Text(subtitle!, style: const TextStyle(color: _ink)),
              ],
            ],
          ),
        ),
        if (action != null && onAction != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ],
    ),
  );
}

class _HomeError extends StatelessWidget {
  const _HomeError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, color: _blue, size: 44),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 14),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}

void openStoreInformation(
  BuildContext context, {
  required StoreApi api,
  required String path,
}) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => StoreInformationScreen(api: api, path: path),
    ),
  );
}

Color? _colorFromHex(String? value) {
  if (value == null || !RegExp(r'^#[\da-fA-F]{6}$').hasMatch(value)) {
    return null;
  }
  return Color(int.parse(value.substring(1), radix: 16) + 0xff000000);
}

String _withUnit(String? value, String unit) =>
    value == null || value.isEmpty ? 'Not listed' : '$value$unit';

String _money(String value, String currency) {
  final amount = double.tryParse(value);
  if (amount == null) return '$currency $value';
  return '$currency ${amount.toStringAsFixed(amount == amount.roundToDouble() ? 0 : 2)}';
}
