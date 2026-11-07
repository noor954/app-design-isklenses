import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:uuid/uuid.dart';

import 'isk_carousel.dart';
import 'store_api.dart';

const _ink = Color(0xff15384d);
const _navy = _ink;
const _blue = Color(0xff006f9b);
const _paper = Color(0xfff7fcff);
const _pale = Color(0xffe8f6fb);
const _rule = Color(0xffcfe2eb);

List<StoreBanner> _heroSlides(List<StoreBanner> banners) =>
    banners.take(7).toList();

Map<String, dynamic> _homeSection(StoreHomeData data, String id) {
  final sections = data.configuration['sections'];
  if (sections is! List) return const {};
  for (final section in sections) {
    if (section is Map && section['id'] == id) {
      return Map<String, dynamic>.from(section);
    }
  }
  return const {};
}

bool _homeSectionEnabled(StoreHomeData data, String id) =>
    _homeSection(data, id)['enabled'] == true;

int _homeSectionOrder(StoreHomeData data, String id) =>
    (_homeSection(data, id)['order'] as num?)?.toInt() ?? 0;

String _homeSectionTitle(StoreHomeData data, String id, String fallback) {
  final value = _homeSection(data, id)['title'];
  return value is String && value.isNotEmpty ? value : fallback;
}

String _homeSectionDescription(StoreHomeData data, String id, String fallback) {
  final value = _homeSection(data, id)['description'];
  return value is String && value.isNotEmpty ? value : fallback;
}

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

class _StorefrontHomeScreenState extends State<StorefrontHomeScreen>
    with WidgetsBindingObserver {
  late Future<StoreHomeData> _data;
  final _heroController = PageController();
  Timer? _heroTimer;
  Duration? _heroTimerDuration;
  var _appIsResumed = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _appIsResumed =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    _data = widget.api.getHomeData();
    _configureHeroTimer(const Duration(milliseconds: 5500));
  }

  void _configureHeroTimer(Duration duration) {
    if (_heroTimerDuration == duration) return;
    _heroTimer?.cancel();
    _heroTimerDuration = duration;
    _heroTimer = Timer.periodic(duration, (_) {
      if (!mounted ||
          !_appIsResumed ||
          !TickerMode.of(context) ||
          MediaQuery.disableAnimationsOf(context) ||
          !_heroController.hasClients) {
        return;
      }
      final count = _cachedBanners.length;
      if (count < 2) return;
      final currentPage = _heroController.page?.round() ?? 0;
      final nextPage = (currentPage + 1) % count;
      _heroController.animateToPage(
        nextPage,
        duration: const Duration(milliseconds: 540),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appIsResumed = state == AppLifecycleState.resumed;
  }

  List<StoreBanner> _cachedBanners = const [];

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
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
          final configuredAutoplay = data.configuration['heroAutoplayMs'];
          final autoplayDuration = Duration(
            milliseconds:
                configuredAutoplay is num &&
                    configuredAutoplay >= 3000 &&
                    configuredAutoplay <= 15000
                ? configuredAutoplay.toInt()
                : 5500,
          );
          _configureHeroTimer(autoplayDuration);
          final heroBanners = data.banners
              .where((banner) => banner.placement == 'hero')
              .toList();
          _cachedBanners = _heroSlides(heroBanners);
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

          final configuredSections =
              <({String id, List<Widget> slivers})>[
                (
                  id: 'hero',
                  slivers: [
                    SliverToBoxAdapter(
                      child: _HeroCarousel(
                        banners: heroBanners,
                        controller: _heroController,
                        onPage: widget.onPage,
                        layout:
                            data.configuration['heroLayout']?.toString() ??
                            'full-bleed',
                        sectionTitle: _homeSectionTitle(
                          data,
                          'hero',
                          'Featured lens collections',
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 24, 20, 6),
                        child: _SearchPanel(onSearch: widget.onBrowse),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: _FindYourLookBanner(
                        onTap: () => widget.onPage('/find-your-look'),
                      ),
                    ),
                  ],
                ),
                (
                  id: 'showcase',
                  slivers: [
                    SliverToBoxAdapter(
                      child: _ShowcaseSection(
                        title: _homeSectionTitle(
                          data,
                          'showcase',
                          'Made to be seen',
                        ),
                        subtitle: _homeSectionDescription(
                          data,
                          'showcase',
                          'Big, image-led highlights from the featured catalog.',
                        ),
                        products: data.products,
                        onProduct: widget.onProduct,
                        onBrowse: () =>
                            widget.onBrowse(const StoreBrowseFilter()),
                      ),
                    ),
                  ],
                ),
                (
                  id: 'bloom',
                  slivers: [
                    SliverToBoxAdapter(
                      child: _DirectorySection<StoreCategory>(
                        title: _homeSectionTitle(
                          data,
                          'bloom',
                          'Find your collection',
                        ),
                        subtitle: _homeSectionDescription(
                          data,
                          'bloom',
                          'Browse lenses by collection',
                        ),
                        variant: IskCarouselVariant.coverflow,
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
                  ],
                ),
                (
                  id: 'brands',
                  slivers: [
                    SliverToBoxAdapter(
                      child: _DirectorySection<StoreBrand>(
                        title: _homeSectionTitle(
                          data,
                          'brands',
                          'Shop by brand',
                        ),
                        subtitle: _homeSectionDescription(
                          data,
                          'brands',
                          'Explore the brand directory',
                        ),
                        variant: IskCarouselVariant.fadeSlide,
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
                  ],
                ),
                (
                  id: 'shades',
                  slivers: [
                    SliverToBoxAdapter(
                      child: _DirectorySection<StoreShade>(
                        title: _homeSectionTitle(
                          data,
                          'shades',
                          'Explore lens shades',
                        ),
                        subtitle: _homeSectionDescription(
                          data,
                          'shades',
                          'Browse the shades linked to active listings',
                        ),
                        variant: IskCarouselVariant.infiniteLoop,
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
                  ],
                ),
                (
                  id: 'trending',
                  slivers: [
                    SliverToBoxAdapter(
                      child: _HomeSectionIntro(
                        title: _homeSectionTitle(
                          data,
                          'trending',
                          'Browse the catalog',
                        ),
                        description: _homeSectionDescription(
                          data,
                          'trending',
                          'Product details and prices come from active listings.',
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: _HomeProductTabs(
                        api: widget.api,
                        onProduct: widget.onProduct,
                        onCompare: widget.onCompare,
                      ),
                    ),
                  ],
                ),
                (
                  id: 'types',
                  slivers: [
                    SliverToBoxAdapter(
                      child: _DirectorySection<StoreLensType>(
                        title: _homeSectionTitle(
                          data,
                          'types',
                          'Browse by lens type',
                        ),
                        subtitle: _homeSectionDescription(
                          data,
                          'types',
                          'See the options in each listing',
                        ),
                        variant: IskCarouselVariant.continuous,
                        items: data.lensTypes
                            .where((item) => item.productCount > 0)
                            .toList(),
                        itemBuilder: (item) => _ImageDirectoryCard(
                          title: item.name,
                          count: item.productCount,
                          imageUrl: item.imageUrl,
                          icon: Icons.remove_red_eye_outlined,
                          onTap: () => widget.onBrowse(
                            StoreBrowseFilter(lensTypeId: item.id),
                          ),
                        ),
                        onViewAll: () => widget.onPage('/find-your-look'),
                      ),
                    ),
                  ],
                ),
                (
                  id: 'why-us',
                  slivers: [
                    SliverToBoxAdapter(
                      child: _HomeSectionIntro(
                        title: _homeSectionTitle(
                          data,
                          'why-us',
                          'Browse with confidence',
                        ),
                        description: _homeSectionDescription(
                          data,
                          'why-us',
                          'Review product details and follow your eye-care professional’s guidance.',
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: _ShoppingGuideBanner(
                        onTap: () => widget.onPage('/shopping-guide'),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: _GuidanceBanner(
                        onTap: () => widget.onPage('/faq'),
                      ),
                    ),
                  ],
                ),
                (
                  id: 'reviews',
                  slivers: [
                    if (data.reviews.isNotEmpty)
                      SliverToBoxAdapter(
                        child: _ReviewSection(
                          reviews: data.reviews,
                          title: _homeSectionTitle(
                            data,
                            'reviews',
                            'Product reviews',
                          ),
                          subtitle: _homeSectionDescription(
                            data,
                            'reviews',
                            'Approved reviews linked to active products',
                          ),
                        ),
                      ),
                  ],
                ),
                (
                  id: 'contact',
                  slivers: [
                    SliverToBoxAdapter(
                      child: _HomeSectionIntro(
                        title: _homeSectionTitle(
                          data,
                          'contact',
                          'Questions about a listing or an order?',
                        ),
                        description: _homeSectionDescription(
                          data,
                          'contact',
                          'Contact the store team about catalog or order questions.',
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: StoreSiteFooter(data: data, onPage: widget.onPage),
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: 32)),
                  ],
                ),
              ]..sort(
                (left, right) => _homeSectionOrder(
                  data,
                  left.id,
                ).compareTo(_homeSectionOrder(data, right.id)),
              );
          final homeSlivers = configuredSections
              .where((section) => _homeSectionEnabled(data, section.id))
              .expand((section) => section.slivers)
              .toList(growable: false);

          return RefreshIndicator(
            onRefresh: _refresh,
            color: _blue,
            child: CustomScrollView(slivers: homeSlivers),
          );
        },
      ),
    );
  }
}

class _HeroCarousel extends StatefulWidget {
  const _HeroCarousel({
    required this.banners,
    required this.controller,
    required this.onPage,
    required this.layout,
    required this.sectionTitle,
  });

  final List<StoreBanner> banners;
  final PageController controller;
  final ValueChanged<String> onPage;
  final String layout;
  final String sectionTitle;

  @override
  State<_HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<_HeroCarousel> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final slides = _heroSlides(widget.banners);
    if (slides.isEmpty) {
      return const SizedBox(
        height: 340,
        child: ColoredBox(
          color: _blue,
          child: Center(
            child: Text(
              'Featured collections are unavailable.',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ),
      );
    }
    final activeIndex = _currentIndex < slides.length ? _currentIndex : 0;
    final activeSlide = slides[activeIndex];
    final motionDuration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 360);
    final wide = MediaQuery.sizeOf(context).width >= 760;
    const height = 390.0;
    final centered = widget.layout == 'centered';
    final split = widget.layout == 'split';
    final editorial = widget.layout == 'editorial';
    return SizedBox(
      height: height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          PageView.builder(
            controller: widget.controller,
            itemCount: slides.length,
            onPageChanged: (index) {
              if (_currentIndex != index) setState(() => _currentIndex = index);
            },
            itemBuilder: (context, index) {
              final slide = slides[index];
              return Stack(
                fit: StackFit.expand,
                children: [
                  if (slide.imageUrl.isNotEmpty)
                    Image.network(
                      slide.imageUrl,
                      fit: BoxFit.contain,
                      alignment: split || editorial
                          ? Alignment.centerRight
                          : Alignment.center,
                      errorBuilder: (_, __, ___) =>
                          const ColoredBox(color: _blue),
                    )
                  else
                    const ColoredBox(color: _blue),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: centered
                            ? [const Color(0x9921384d), const Color(0xb321384d)]
                            : split
                            ? [
                                const Color(0xf515384d),
                                const Color(0xe015384d),
                                const Color(0x1415384d),
                              ]
                            : [
                                const Color(0xd9006f9b),
                                const Color(0x00006f9b),
                              ],
                        begin: centered
                            ? Alignment.topCenter
                            : Alignment.centerLeft,
                        end: centered
                            ? Alignment.bottomCenter
                            : Alignment.centerRight,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          Positioned(
            left: centered
                ? 20
                : wide
                ? 42
                : 24,
            right: centered
                ? 20
                : wide
                ? 42
                : 24,
            top: 60,
            bottom: wide ? 40 : 24,
            child: Align(
              alignment: centered ? Alignment.center : Alignment.bottomLeft,
              child: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: editorial ? 760 : 700),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: centered
                        ? CrossAxisAlignment.center
                        : CrossAxisAlignment.start,
                    children: [
                      IgnorePointer(
                        child: AnimatedSwitcher(
                          duration: motionDuration,
                          switchInCurve: Curves.easeOutCubic,
                          switchOutCurve: Curves.easeInCubic,
                          transitionBuilder: (child, animation) =>
                              FadeTransition(
                                opacity: animation,
                                child: SlideTransition(
                                  position: animation.drive(
                                    Tween(
                                      begin: const Offset(0.06, 0),
                                      end: Offset.zero,
                                    ).chain(
                                      CurveTween(curve: Curves.easeOutCubic),
                                    ),
                                  ),
                                  child: child,
                                ),
                              ),
                          child: Column(
                            key: ValueKey(activeSlide.id),
                            crossAxisAlignment: centered
                                ? CrossAxisAlignment.center
                                : CrossAxisAlignment.start,
                            children: [
                              Text(
                                activeSlide.title.isEmpty
                                    ? widget.sectionTitle
                                    : activeSlide.title,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.headlineLarge
                                    ?.copyWith(
                                      color: Colors.white,
                                      height: 1,
                                      fontWeight: editorial
                                          ? FontWeight.w600
                                          : FontWeight.w900,
                                    ),
                              ),
                              if (activeSlide.body?.isNotEmpty == true) ...[
                                const SizedBox(height: 10),
                                Text(
                                  activeSlide.body!,
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.bodyLarge
                                      ?.copyWith(
                                        color: Colors.white.withAlpha(225),
                                      ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Align(
                        alignment: centered
                            ? Alignment.center
                            : Alignment.centerLeft,
                        child: FilledButton.icon(
                          onPressed: () =>
                              widget.onPage(activeSlide.href ?? '/shop'),
                          icon: const Icon(Icons.arrow_forward_rounded),
                          label: const Text('Explore the collection'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: 20,
            right: 20,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: _blue.withAlpha(220),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var index = 0; index < slides.length; index++)
                      AnimatedContainer(
                        duration: motionDuration,
                        curve: Curves.easeOutCubic,
                        width: index == activeIndex ? 18 : 6,
                        height: 6,
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        decoration: BoxDecoration(
                          color: Colors.white.withAlpha(
                            index == activeIndex ? 255 : 140,
                          ),
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    const SizedBox(width: 8),
                    AnimatedSwitcher(
                      duration: motionDuration,
                      child: Text(
                        '${activeIndex + 1} / ${slides.length}',
                        key: ValueKey(activeIndex),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
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

class _FindYourLookBanner extends StatelessWidget {
  const _FindYourLookBanner({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
    child: Material(
      color: _blue,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 14, 18),
          child: Row(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(20),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: const Icon(
                  Icons.palette_outlined,
                  color: Color(0xffb8e8f5),
                  size: 29,
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Find your next shade',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Filter the catalog by color, collection, and lens type.',
                      style: TextStyle(color: Color(0xffe6f4fb), height: 1.35),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.arrow_forward_rounded, color: Colors.white),
            ],
          ),
        ),
      ),
    ),
  );
}

class _DirectorySection<T> extends StatefulWidget {
  const _DirectorySection({
    required this.title,
    required this.subtitle,
    required this.items,
    required this.itemBuilder,
    required this.onViewAll,
    required this.variant,
  });

  final IskCarouselVariant variant;
  final String title;
  final String subtitle;
  final List<T> items;
  final Widget Function(T item) itemBuilder;
  final VoidCallback onViewAll;

  @override
  State<_DirectorySection<T>> createState() => _DirectorySectionState<T>();
}

class _DirectorySectionState<T> extends State<_DirectorySection<T>> {
  static const _pageSize = 15;
  late final _variant = widget.variant;
  int _loaded = _pageSize;

  void _loadMore() {
    if (_loaded >= widget.items.length) return;
    setState(
      () => _loaded = math.min(_loaded + _pageSize, widget.items.length),
    );
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final cardWidth = width >= 980
        ? math.min(width / 4.4, 320.0)
        : width >= 680
        ? math.min(width / 3.2, 280.0)
        : math.min(width * 0.62, 240.0);
    final cardHeight = width >= 680 ? 300.0 : 252.0;
    final visible = widget.items.take(_loaded).toList(growable: false);
    return Padding(
      padding: const EdgeInsets.only(top: 30),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeading(
            title: widget.title,
            subtitle: widget.subtitle,
            action: 'View all',
            onAction: widget.onViewAll,
          ),
          const SizedBox(height: 15),
          IskCarousel(
            variant: _variant,
            height: cardHeight,
            itemWidth: cardWidth,
            itemCount: visible.length,
            hasMore: _loaded < widget.items.length,
            onNeedMore: _loadMore,
            itemBuilder: (context, index) => widget.itemBuilder(visible[index]),
          ),
        ],
      ),
    );
  }
}

class _ShowcaseSection extends StatelessWidget {
  const _ShowcaseSection({
    required this.title,
    required this.subtitle,
    required this.products,
    required this.onProduct,
    required this.onBrowse,
  });

  final String title;
  final String subtitle;
  final List<StoreProduct> products;
  final ValueChanged<StoreProduct> onProduct;
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    final withImage = products
        .where((product) => product.imageUrl != null)
        .toList(growable: false);
    final pool = [
      ...withImage.where((product) => product.isFeatured),
      ...withImage.where((product) => !product.isFeatured),
    ];
    if (pool.isEmpty) return const SizedBox.shrink();
    final spotlight = pool.first;
    final tiles = pool.skip(1).take(2).toList(growable: false);
    final wide = MediaQuery.sizeOf(context).width >= 760;

    Widget spotlightCard() => Material(
      color: _pale,
      borderRadius: BorderRadius.circular(28),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => onProduct(spotlight),
        child: Container(
          decoration: const BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(-0.4, -0.6),
              radius: 1.2,
              colors: [Colors.white, Color(0xffd7f0fa), Color(0xffb8e1f0)],
            ),
          ),
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: wide ? 1.6 : 1.05,
                child: Image.network(
                  spotlight.imageUrl!,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) =>
                      const Icon(Icons.remove_red_eye_outlined, size: 64),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xffd3ff48),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  spotlight.isFeatured ? 'FEATURED' : 'SPOTLIGHT',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                    color: _ink,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              if (spotlight.brand != null)
                Text(
                  spotlight.brand!.toUpperCase(),
                  style: const TextStyle(
                    color: _blue,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.4,
                  ),
                ),
              Text(
                spotlight.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _ink,
                  fontSize: 26,
                  height: 1.1,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(
                    _money(spotlight.price, spotlight.currency),
                    style: const TextStyle(
                      color: _ink,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const Spacer(),
                  FilledButton.icon(
                    onPressed: () => onProduct(spotlight),
                    icon: const Icon(Icons.arrow_forward, size: 18),
                    label: const Text('Shop now'),
                    style: FilledButton.styleFrom(backgroundColor: _blue),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    Widget tile(StoreProduct product) => Material(
      color: _pale,
      borderRadius: BorderRadius.circular(28),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => onProduct(product),
        child: AspectRatio(
          aspectRatio: wide ? 1.1 : 1.5,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Padding(
                padding: const EdgeInsets.all(14),
                child: Image.network(
                  product.imageUrl!,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.center,
                    colors: [Color(0xd9071d2b), Colors.transparent],
                  ),
                ),
              ),
              Positioned(
                left: 16,
                right: 16,
                bottom: 14,
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            product.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            _money(product.price, product.currency),
                            style: const TextStyle(
                              color: Colors.white70,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward, color: Colors.white),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );

    final perks = [
      (Icons.card_giftcard, 'Free gift on every order'),
      (Icons.verified_outlined, 'Authentic lenses'),
      (Icons.local_shipping_outlined, 'Cash on delivery'),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 30, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeading(
            title: title,
            subtitle: subtitle,
            action: 'Browse all',
            onAction: onBrowse,
          ),
          const SizedBox(height: 15),
          if (wide)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(flex: 3, child: spotlightCard()),
                  const SizedBox(width: 14),
                  Expanded(
                    flex: 2,
                    child: Column(
                      children: [
                        for (final item in tiles) ...[
                          Expanded(child: tile(item)),
                          if (item != tiles.last) const SizedBox(height: 14),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            )
          else ...[
            spotlightCard(),
            for (final item in tiles) ...[
              const SizedBox(height: 12),
              tile(item),
            ],
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final perk in perks)
                Chip(
                  avatar: Icon(perk.$1, size: 18, color: _blue),
                  label: Text(perk.$2),
                  backgroundColor: Colors.white,
                  side: const BorderSide(color: _rule),
                ),
            ],
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
                    const ColoredBox(color: _pale),
                    if (imageUrl != null)
                      Image.network(
                        imageUrl!,
                        fit: BoxFit.contain,
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

class _HomeProductTabs extends StatefulWidget {
  const _HomeProductTabs({
    required this.api,
    required this.onProduct,
    required this.onCompare,
  });

  final StoreApi api;
  final ValueChanged<StoreProduct> onProduct;
  final ValueChanged<StoreProduct> onCompare;

  @override
  State<_HomeProductTabs> createState() => _HomeProductTabsState();
}

class _HomeProductTabsState extends State<_HomeProductTabs> {
  static const _tabs = [
    ('catalog', 'Catalog', IskCarouselVariant.smoothSlide),
    ('featured', 'Featured', IskCarouselVariant.coverflow),
    ('new', 'New arrivals', IskCarouselVariant.fadeSlide),
    ('reduced', 'On sale', IskCarouselVariant.infiniteLoop),
  ];
  final _items = <String, List<StoreProduct>>{};
  final _pages = <String, int>{};
  final _more = <String, bool>{};
  final _busy = <String>{};
  var _tab = 0;

  @override
  void initState() {
    super.initState();
    _load('catalog');
  }

  Future<void> _load(String tab) async {
    if (_busy.contains(tab) || _more[tab] == false) return;
    _busy.add(tab);
    try {
      final next = (_pages[tab] ?? 0) + 1;
      final page = await widget.api.getHomeProducts(tab, next);
      if (!mounted) return;
      setState(() {
        final known = (_items[tab] ?? const []).map((item) => item.id).toSet();
        _items[tab] = [
          ...?_items[tab],
          ...page.items.where((item) => !known.contains(item.id)),
        ];
        _pages[tab] = next;
        _more[tab] = page.hasMore;
      });
    } catch (_) {
      if (mounted) setState(() => _more[tab] = false);
    } finally {
      _busy.remove(tab);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tab = _tabs[_tab];
    final items = _items[tab.$1] ?? const <StoreProduct>[];
    final wide = MediaQuery.sizeOf(context).width >= 800;
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              itemCount: _tabs.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) => ChoiceChip(
                label: Text(_tabs[index].$2),
                selected: _tab == index,
                onSelected: (_) {
                  setState(() => _tab = index);
                  _load(_tabs[index].$1);
                },
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                (_more[tab.$1] ?? true)
                    ? 'Loading listings…'
                    : 'No matching listings in this view.',
              ),
            )
          else
            IskCarousel(
              key: ValueKey(tab.$1),
              variant: tab.$3,
              height: 320,
              itemWidth: wide ? 226 : 190,
              itemCount: items.length,
              hasMore: _more[tab.$1] ?? false,
              onNeedMore: () => _load(tab.$1),
              itemBuilder: (context, index) => StoreProductCard(
                product: items[index],
                onTap: () => widget.onProduct(items[index]),
                onCompare: () => widget.onCompare(items[index]),
              ),
            ),
        ],
      ),
    );
  }
}

class StoreProductCard extends StatefulWidget {
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
  State<StoreProductCard> createState() => _StoreProductCardState();
}

class _StoreProductCardState extends State<StoreProductCard> {
  bool _hoveringImage = false;

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final image = product.imageUrl;
    final alternate = product.images.where((url) => url != image).firstOrNull;
    final onSale =
        product.compareAtPrice != null &&
        (double.tryParse(product.compareAtPrice!) ?? 0) >
            (double.tryParse(product.price) ?? 0);
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: widget.onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: MouseRegion(
                onEnter: (_) => setState(() => _hoveringImage = true),
                onExit: (_) => setState(() => _hoveringImage = false),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (image != null)
                      Image.network(
                        image,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            const _ProductPlaceholder(),
                      )
                    else
                      const _ProductPlaceholder(),
                    if (_hoveringImage && alternate != null)
                      Image.network(
                        alternate,
                        fit: BoxFit.contain,
                        excludeFromSemantics: true,
                        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                      ),
                    if (onSale)
                      Positioned(
                        left: 10,
                        top: 10,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: _blue,
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
                    if (widget.onCompare != null)
                      Positioned(
                        top: 2,
                        right: 2,
                        child: IconButton(
                          tooltip: 'Add to compare',
                          onPressed: widget.onCompare,
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
                      color: _blue,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (product.ratingAvg != null && product.ratingCount > 0) ...[
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          size: 15,
                          color: Color(0xffa45d14),
                        ),
                        const SizedBox(width: 3),
                        Text(
                          '${product.ratingAvg!.toStringAsFixed(1)} · ${product.ratingCount} reviews',
                          style: const TextStyle(
                            color: _ink,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
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

class _HomeSectionIntro extends StatelessWidget {
  const _HomeSectionIntro({required this.title, required this.description});

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 28, 20, 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w900,
            height: 1.05,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          description,
          style: const TextStyle(color: Color(0xff526b7b), height: 1.5),
        ),
      ],
    ),
  );
}

class _ReviewSection extends StatelessWidget {
  const _ReviewSection({
    required this.reviews,
    required this.title,
    required this.subtitle,
  });

  final List<StoreReview> reviews;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 26),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeading(title: title, subtitle: subtitle),
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
      color: _blue,
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

class _ShoppingGuideBanner extends StatelessWidget {
  const _ShoppingGuideBanner({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 30, 18, 0),
    child: Material(
      color: const Color(0xffe8f6fb),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          child: Row(
            children: [
              const Icon(Icons.menu_book_outlined, color: _blue, size: 27),
              const SizedBox(width: 13),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'A clearer way to shop',
                      style: TextStyle(
                        color: _blue,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'See how listings, comparison, and checkout work.',
                      style: TextStyle(color: _ink, height: 1.35),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_rounded, color: _blue),
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
    final theme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(top: 30),
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 18),
      color: theme.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/isk-logo.png',
                width: 38,
                height: 38,
                fit: BoxFit.contain,
                excludeFromSemantics: true,
              ),
              const SizedBox(width: 8),
              Text(
                'ISK Lenses',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: theme.onSurface,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          if (about != null && about.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              about,
              style: TextStyle(color: theme.onSurfaceVariant, height: 1.4),
            ),
          ],
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (label, route) in const [
                ('Shop all', '/shop'),
                ('Find your lenses', '/find-your-look'),
                ('How to shop', '/shopping-guide'),
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
                  backgroundColor: Colors.white,
                  side: BorderSide(color: theme.outlineVariant),
                  labelStyle: TextStyle(
                    color: theme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                  onPressed: () => onPage(route),
                ),
            ],
          ),
          if (email?.isNotEmpty == true || phone?.isNotEmpty == true) ...[
            const SizedBox(height: 16),
            if (email?.isNotEmpty == true)
              Text(email!, style: TextStyle(color: theme.onSurface)),
            if (phone?.isNotEmpty == true)
              Text(phone!, style: TextStyle(color: theme.onSurface)),
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

class StoreLensFinderScreen extends StatefulWidget {
  const StoreLensFinderScreen({
    required this.api,
    required this.onBrowse,
    required this.onPage,
    super.key,
  });

  final StoreApi api;
  final ValueChanged<StoreBrowseFilter> onBrowse;
  final ValueChanged<String> onPage;

  @override
  State<StoreLensFinderScreen> createState() => _StoreLensFinderScreenState();
}

class _StoreLensFinderScreenState extends State<StoreLensFinderScreen> {
  late Future<StoreHomeData> _data;
  final _shadeSearch = TextEditingController();
  String? _category;
  String? _brand;
  String? _shadeId;
  String? _lensTypeId;

  @override
  void initState() {
    super.initState();
    _data = widget.api.getHomeData();
  }

  @override
  void dispose() {
    _shadeSearch.dispose();
    super.dispose();
  }

  void _browse() {
    widget.onBrowse(
      StoreBrowseFilter(
        category: _category,
        brand: _brand,
        shadeId: _shadeId,
        lensTypeId: _lensTypeId,
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _paper,
      appBar: AppBar(title: const Text('Find your lenses')),
      body: FutureBuilder<StoreHomeData>(
        future: _data,
        builder: (context, snapshot) {
          if (snapshot.hasError && !snapshot.hasData) {
            return _HomeError(
              message: snapshot.error.toString(),
              onRetry: () => setState(() => _data = widget.api.getHomeData()),
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator(color: _blue));
          }

          final data = snapshot.data!;
          final categories = data.categories
              .where(
                (item) =>
                    item.isActive && item.showInMenu && item.productCount > 0,
              )
              .toList();
          final brands = data.brands
              .where((item) => item.productCount > 0)
              .toList();
          final availableShades = data.shades
              .where((item) => item.productCount > 0)
              .toList();
          final shades = availableShades
              .where(
                (item) => item.name.toLowerCase().contains(
                  _shadeSearch.text.trim().toLowerCase(),
                ),
              )
              .toList();
          final visibleShades = shades.take(18).toList();
          final lensTypes = data.lensTypes
              .where((item) => item.productCount > 0)
              .toList();
          final selectedCount = [
            _category,
            _brand,
            _shadeId,
            _lensTypeId,
          ].where((value) => value != null).length;

          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
                children: [
                  _FinderIntro(selectedCount: selectedCount),
                  const SizedBox(height: 28),
                  if (categories.isNotEmpty) ...[
                    const _FinderHeading(
                      title: 'Start with a collection',
                      subtitle: 'Choose a category to narrow the listings.',
                    ),
                    const SizedBox(height: 12),
                    _FinderChoiceGroup(
                      items: categories
                          .map((item) => (item.slug, item.name, null))
                          .toList(),
                      selected: _category,
                      onSelected: (value) => setState(
                        () => _category = _category == value ? null : value,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  if (availableShades.isNotEmpty) ...[
                    const _FinderHeading(
                      title: 'Choose a shade',
                      subtitle:
                          'Search the available shade names or browse the edit.',
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _shadeSearch,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        hintText: 'Search shades',
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _shadeSearch.text.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Clear shade search',
                                onPressed: () {
                                  _shadeSearch.clear();
                                  setState(() {});
                                },
                                icon: const Icon(Icons.close_rounded),
                              ),
                      ),
                    ),
                    const SizedBox(height: 11),
                    _FinderChoiceGroup(
                      items: visibleShades
                          .map(
                            (item) => (
                              item.id,
                              '${item.name} · ${item.productCount}',
                              _colorFromHex(item.hex) ?? _pale,
                            ),
                          )
                          .toList(),
                      selected: _shadeId,
                      onSelected: (value) => setState(
                        () => _shadeId = _shadeId == value ? null : value,
                      ),
                    ),
                    if (shades.length > visibleShades.length)
                      Padding(
                        padding: const EdgeInsets.only(top: 7),
                        child: Text(
                          'Showing 18 matches. Refine your search to see other shades.',
                          style: TextStyle(color: _ink.withAlpha(190)),
                        ),
                      ),
                    if (shades.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 10),
                        child: Text(
                          'No shades match that search. Try another name.',
                          style: TextStyle(color: _ink),
                        ),
                      ),
                  ],
                  const SizedBox(height: 24),
                  if (lensTypes.isNotEmpty) ...[
                    const _FinderHeading(
                      title: 'Choose a lens type',
                      subtitle: 'Only types with active listings are shown.',
                    ),
                    const SizedBox(height: 12),
                    _FinderChoiceGroup(
                      items: lensTypes
                          .map(
                            (item) => (
                              item.id,
                              '${item.name} · ${item.productCount}',
                              null,
                            ),
                          )
                          .toList(),
                      selected: _lensTypeId,
                      onSelected: (value) => setState(
                        () => _lensTypeId = _lensTypeId == value ? null : value,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  if (brands.isNotEmpty) ...[
                    const _FinderHeading(
                      title: 'Or browse a brand',
                      subtitle: 'Choose from brands linked to active listings.',
                    ),
                    const SizedBox(height: 12),
                    _FinderChoiceGroup(
                      items: brands
                          .map(
                            (item) => (
                              item.slug,
                              '${item.name} · ${item.productCount}',
                              null,
                            ),
                          )
                          .toList(),
                      selected: _brand,
                      onSelected: (value) => setState(
                        () => _brand = _brand == value ? null : value,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  TextButton.icon(
                    onPressed: () => widget.onPage('/shopping-guide'),
                    icon: const Icon(Icons.menu_book_outlined),
                    label: const Text('How to compare and choose options'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(18, 10, 18, 14),
        child: Row(
          children: [
            if (_category != null ||
                _brand != null ||
                _shadeId != null ||
                _lensTypeId != null)
              TextButton(
                onPressed: () => setState(() {
                  _category = null;
                  _brand = null;
                  _shadeId = null;
                  _lensTypeId = null;
                }),
                child: const Text('Clear'),
              ),
            Expanded(
              child: FilledButton.icon(
                onPressed: _browse,
                icon: const Icon(Icons.search_rounded),
                label: Text(
                  _category == null &&
                          _brand == null &&
                          _shadeId == null &&
                          _lensTypeId == null
                      ? 'Browse all lenses'
                      : 'See matching lenses',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FinderIntro extends StatelessWidget {
  const _FinderIntro({required this.selectedCount});

  final int selectedCount;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: _navy,
      borderRadius: BorderRadius.circular(24),
    ),
    child: Row(
      children: [
        const Icon(
          Icons.remove_red_eye_outlined,
          color: Color(0xffb8e8f5),
          size: 42,
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Browse by what catches your eye.',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  height: 1.15,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                selectedCount == 0
                    ? 'Mix and match filters, then see the matching active listings.'
                    : '$selectedCount ${selectedCount == 1 ? 'filter' : 'filters'} selected. Add another or see matching lenses.',
                style: const TextStyle(color: Color(0xffe6f4fb), height: 1.4),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _FinderHeading extends StatelessWidget {
  const _FinderHeading({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: const TextStyle(
          color: _navy,
          fontSize: 19,
          fontWeight: FontWeight.w900,
        ),
      ),
      const SizedBox(height: 3),
      Text(subtitle, style: const TextStyle(color: _ink, height: 1.4)),
    ],
  );
}

class _FinderChoiceGroup extends StatelessWidget {
  const _FinderChoiceGroup({
    required this.items,
    required this.selected,
    required this.onSelected,
  });

  final List<(String, String, Color?)> items;
  final String? selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 9,
    runSpacing: 8,
    children: [
      for (final (id, label, swatch) in items)
        ChoiceChip(
          avatar: swatch == null
              ? null
              : CircleAvatar(
                  backgroundColor: swatch,
                  child: swatch.computeLuminance() < 0.34
                      ? const Icon(Icons.check, size: 13, color: Colors.white)
                      : null,
                ),
          label: Text(label),
          selected: selected == id,
          onSelected: (_) => onSelected(id),
        ),
    ],
  );
}

class StoreShoppingGuideScreen extends StatefulWidget {
  const StoreShoppingGuideScreen({
    required this.api,
    required this.onPage,
    super.key,
  });

  final StoreApi api;
  final ValueChanged<String> onPage;

  @override
  State<StoreShoppingGuideScreen> createState() =>
      _StoreShoppingGuideScreenState();
}

class _StoreShoppingGuideScreenState extends State<StoreShoppingGuideScreen> {
  late Future<StoreHomeData> _data;

  void _openPage(String path) {
    Navigator.of(context).pop();
    widget.onPage(path);
  }

  @override
  void initState() {
    super.initState();
    _data = widget.api.getHomeData();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _paper,
    appBar: AppBar(title: const Text('How to shop')),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 780),
        child: FutureBuilder<StoreHomeData>(
          future: _data,
          builder: (context, snapshot) {
            if (snapshot.hasError && !snapshot.hasData) {
              return _HomeError(
                message: snapshot.error.toString(),
                onRetry: () => setState(() => _data = widget.api.getHomeData()),
              );
            }
            if (!snapshot.hasData) {
              return const Center(
                child: CircularProgressIndicator(color: _blue),
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              children: [
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: _navy,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.shopping_bag_outlined,
                        color: Color(0xffb8e8f5),
                        size: 34,
                      ),
                      SizedBox(height: 14),
                      Text(
                        'From browsing to bag.',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 25,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'A quick guide to the product details, comparison, and checkout available in the app.',
                        style: TextStyle(
                          color: Color(0xffe6f4fb),
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 25),
                for (final (index, step) in _shoppingSteps.indexed)
                  _ShoppingStep(
                    number: index + 1,
                    icon: step.$1,
                    title: step.$2,
                    description: step.$3,
                    isLast: index == _shoppingSteps.length - 1,
                  ),
                const SizedBox(height: 22),
                const Text(
                  'Product specifications and selection options vary by listing. For lens fit and suitability, consult your eye-care professional.',
                  style: TextStyle(color: _ink, height: 1.5),
                ),
                const SizedBox(height: 18),
                FilledButton.icon(
                  onPressed: () => _openPage('/find-your-look'),
                  icon: const Icon(Icons.palette_outlined),
                  label: const Text('Find your lenses'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => _openPage('/shop'),
                  icon: const Icon(Icons.storefront_outlined),
                  label: const Text('Browse the full catalog'),
                ),
                StoreSiteFooter(data: snapshot.data!, onPage: _openPage),
              ],
            );
          },
        ),
      ),
    ),
  );
}

const _shoppingSteps = <(IconData, String, String)>[
  (
    Icons.search_rounded,
    'Browse the catalog',
    'Search products or filter by a listed category, brand, shade, or lens type.',
  ),
  (
    Icons.fact_check_outlined,
    'Review the listing',
    'Check the current price, availability, recorded specifications, and any options shown on that product.',
  ),
  (
    Icons.compare_arrows_rounded,
    'Compare details',
    'Add up to three products to compare their listed details side by side.',
  ),
  (
    Icons.tune_rounded,
    'Choose available options',
    'If the listing offers variants or power ranges, select the options shown before adding it to your bag.',
  ),
  (
    Icons.local_shipping_outlined,
    'Review checkout',
    'Enter delivery details, check the configured delivery fee, and place a cash-on-delivery order. The server verifies current price and stock.',
  ),
];

class _ShoppingStep extends StatelessWidget {
  const _ShoppingStep({
    required this.number,
    required this.icon,
    required this.title,
    required this.description,
    required this.isLast,
  });

  final int number;
  final IconData icon;
  final String title;
  final String description;
  final bool isLast;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 54,
          child: Column(
            children: [
              CircleAvatar(
                radius: 23,
                backgroundColor: _pale,
                child: Icon(icon, color: _blue),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 1,
                    color: _rule,
                    margin: const EdgeInsets.symmetric(vertical: 5),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 21, top: 3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Step $number · $title',
                  style: const TextStyle(
                    color: _navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  description,
                  style: const TextStyle(color: _ink, height: 1.45),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
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
              if (widget.path == '/blogs')
                _ExternalBlogResources(api: widget.api)
              else
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

class _ExternalBlogResources extends StatefulWidget {
  const _ExternalBlogResources({required this.api});
  final StoreApi api;

  @override
  State<_ExternalBlogResources> createState() => _ExternalBlogResourcesState();
}

class _ExternalBlogResourcesState extends State<_ExternalBlogResources> {
  late Future<List<Map<String, dynamic>>> _resources;
  late Future<List<Map<String, dynamic>>> _articles;

  @override
  void initState() {
    super.initState();
    _resources = widget.api.getBlogResources();
    _articles = widget.api.getBlogArticles();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(20),
    child: FutureBuilder<List<Map<String, dynamic>>>(
      future: _resources,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Reading resources are unavailable.'),
              TextButton(
                onPressed: () =>
                    setState(() => _resources = widget.api.getBlogResources()),
                child: const Text('Try again'),
              ),
            ],
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Lens reading',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: _navy,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'For personal advice, speak with an eye-care professional.',
            ),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: _articles,
              builder: (context, articles) {
                if (articles.hasError) {
                  return TextButton(
                    onPressed: () => setState(
                      () => _articles = widget.api.getBlogArticles(),
                    ),
                    child: const Text('Articles unavailable. Try again'),
                  );
                }
                if (!articles.hasData) return const CircularProgressIndicator();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final article in articles.data!)
                      ExpansionTile(
                        title: Text(article['title']?.toString() ?? ''),
                        subtitle: Text(article['summary']?.toString() ?? ''),
                        children: [
                          if (article['image'] is String)
                            Image.network(
                              widget.api.assetUrl(article['image'] as String),
                              semanticLabel:
                                  article['imageAlt']?.toString() ??
                                  'Article illustration',
                              errorBuilder: (context, error, stackTrace) =>
                                  const Text(
                                    'Article illustration unavailable.',
                                  ),
                            ),
                          for (final section
                              in (article['sections'] is List
                                      ? article['sections'] as List
                                      : const [])
                                  .whereType<Map>())
                            Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    section['heading']?.toString() ?? '',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  for (final paragraph
                                      in (section['paragraphs'] is List
                                          ? section['paragraphs'] as List
                                          : const []))
                                    Padding(
                                      padding: const EdgeInsets.only(top: 8),
                                      child: Text(paragraph.toString()),
                                    ),
                                ],
                              ),
                            ),
                          const Padding(
                            padding: EdgeInsets.all(12),
                            child: Text(
                              'General information only; consult an eye-care professional. Source: CDC contact lens guidance.',
                            ),
                          ),
                        ],
                      ),
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            const Text(
              'External articles are published by other websites, not ISK Lenses.',
            ),
            for (final resource in snapshot.data!) ...[
              const Divider(height: 32),
              Text('${resource['publisher']} · External website'),
              Text(
                resource['title']?.toString() ?? '',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              Text(resource['description']?.toString() ?? ''),
              TextButton.icon(
                onPressed: () async {
                  final uri = Uri.tryParse(resource['url']?.toString() ?? '');
                  if (uri != null &&
                      uri.scheme == 'https' &&
                      uri.host == 'bellalense.com') {
                    try {
                      if (await launchUrl(
                        uri,
                        mode: LaunchMode.externalApplication,
                      )) {
                        return;
                      }
                    } catch (error) {
                      debugPrint(
                        'External article archive could not be opened: $error',
                      );
                    }
                  }
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Could not open the article archive. Please try again.',
                        ),
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.open_in_new),
                label: const Text('Visit archive'),
              ),
            ],
          ],
        );
      },
    ),
  );
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
      final whatsapp = whatsappSupportUri(chrome.whatsappSupportUrl);
      final entries = [
        ('Call', chrome.contact['phone']?.toString()),
        ('Email', chrome.contact['email']?.toString()),
        ('Address', chrome.contact['address']?.toString()),
      ].where((entry) => entry.$2?.isNotEmpty == true);
      return _InfoArticle(
        title: 'Questions about a listing or an order?',
        paragraphs: [
          for (final entry in entries) '${entry.$1}: ${entry.$2}',
          if (entries.isEmpty && whatsapp == null)
            'Store contact details have not been published yet. Please check back soon.',
          'Include your order reference and the phone number used at checkout when asking about an order.',
        ],
        action: whatsapp == null
            ? null
            : FilledButton.icon(
                onPressed: () async {
                  try {
                    if (await launchUrl(
                      whatsapp,
                      mode: LaunchMode.externalApplication,
                    )) {
                      return;
                    }
                  } catch (error) {
                    debugPrint(
                      'WhatsApp support link could not be opened: $error',
                    );
                  }
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Could not open WhatsApp. Please try again.',
                        ),
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.chat_outlined),
                label: const Text('Connect on WhatsApp'),
              ),
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
  const _InfoArticle({
    required this.title,
    required this.paragraphs,
    this.action,
  });

  final String title;
  final List<String> paragraphs;
  final Widget? action;

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
        if (action != null) action!,
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

class _ProductReviews extends StatefulWidget {
  const _ProductReviews({required this.api, required this.slug, super.key});
  final StoreApi api;
  final String slug;

  @override
  State<_ProductReviews> createState() => _ProductReviewsState();
}

class _ProductReviewsState extends State<_ProductReviews> {
  late Future<Map<String, dynamic>> _reviews;
  final _author = TextEditingController();
  final _text = TextEditingController();
  int _rating = 5;
  bool _sending = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _reviews = widget.api.getProductReviews(widget.slug);
  }

  @override
  void dispose() {
    _author.dispose();
    _text.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_author.text.trim().isEmpty || _text.text.trim().isEmpty) {
      setState(() => _message = 'Enter your name and review.');
      return;
    }
    setState(() {
      _sending = true;
      _message = null;
    });
    try {
      final result = await widget.api.submitProductReview(widget.slug, {
        'author': _author.text.trim(),
        'body': _text.text.trim(),
        'rating': _rating,
      });
      if (!mounted) return;
      _author.clear();
      _text.clear();
      setState(() {
        _message = result['pending'] == true
            ? 'Thank you. Your review will appear once approved.'
            : 'Thank you. Your review is live.';
        _reviews = widget.api.getProductReviews(widget.slug);
      });
    } catch (error) {
      if (mounted) {
        setState(
          () => _message =
              'Your review could not be submitted. Please try again.',
        );
      }
      debugPrint('Review submission failed: $error');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
    future: _reviews,
    builder: (context, snapshot) {
      if (snapshot.hasError) {
        return TextButton(
          onPressed: () => setState(
            () => _reviews = widget.api.getProductReviews(widget.slug),
          ),
          child: const Text('Reviews unavailable. Try again'),
        );
      }
      if (!snapshot.hasData) return const SizedBox.shrink();
      final body = snapshot.data!;
      final settings = body['settings'];
      if (settings is! Map || settings['enabled'] != true) {
        return const SizedBox.shrink();
      }
      final reviews = body['data'] is List
          ? (body['data'] as List).whereType<Map>()
          : <Map>[];
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 32),
          Text('Reviews', style: Theme.of(context).textTheme.titleLarge),
          if (reviews.isEmpty) const Text('No reviews yet.'),
          for (final review in reviews)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('${review['rating']} / 5 · ${review['author']}'),
              subtitle: Text(
                [
                  if (review['title'] is String &&
                      (review['title'] as String).isNotEmpty)
                    review['title'],
                  review['body'],
                ].join('\n'),
              ),
            ),
          if (settings['allowSubmission'] == true) ...[
            TextField(
              controller: _author,
              maxLength: 80,
              decoration: const InputDecoration(labelText: 'Your name'),
            ),
            DropdownButtonFormField<int>(
              initialValue: _rating,
              decoration: const InputDecoration(labelText: 'Rating'),
              items: [
                for (var value = 1; value <= 5; value++)
                  DropdownMenuItem(value: value, child: Text('$value / 5')),
              ],
              onChanged: (value) => setState(() => _rating = value ?? 5),
            ),
            TextField(
              controller: _text,
              maxLength: 2000,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Your review'),
            ),
            if (_message != null) Text(_message!),
            FilledButton(
              onPressed: _sending ? null : _submit,
              child: Text(_sending ? 'Submitting…' : 'Submit review'),
            ),
          ],
        ],
      );
    },
  );
}

class StoreProductDetailsScreen extends StatefulWidget {
  const StoreProductDetailsScreen({
    required this.api,
    required this.product,
    required this.onAdd,
    required this.onPage,
    this.onCompare,
    super.key,
  });

  final StoreApi api;
  final StoreProduct product;
  final ValueChanged<CartLine> onAdd;
  final ValueChanged<String> onPage;
  final ValueChanged<StoreProduct>? onCompare;

  @override
  State<StoreProductDetailsScreen> createState() =>
      _StoreProductDetailsScreenState();
}

class _StoreProductDetailsScreenState extends State<StoreProductDetailsScreen>
    with WidgetsBindingObserver {
  ProductVariant? _variant;
  String? _lensChoice;
  String? _leftPower;
  String? _rightPower;
  String? _error;
  var _imageIndex = 0;
  late Future<StoreHomeData> _footerData;
  String _viewerId = const Uuid().v4();
  Timer? _viewerTimer;
  int? _viewerCount;
  bool _viewerRequestPending = false;
  bool _appIsResumed = true;

  Future<void> _recordViewer() async {
    if (!mounted ||
        !_appIsResumed ||
        ModalRoute.of(context)?.isCurrent == false ||
        _viewerRequestPending) {
      return;
    }
    _viewerRequestPending = true;
    final slug = widget.product.slug;
    try {
      final count = await widget.api.recordProductViewer(slug, _viewerId);
      if (mounted &&
          widget.product.slug == slug &&
          _appIsResumed &&
          ModalRoute.of(context)?.isCurrent != false) {
        setState(() => _viewerCount = count);
      }
    } catch (error) {
      debugPrint('Viewer count unavailable: $error');
      if (mounted && widget.product.slug == slug) {
        setState(() => _viewerCount = null);
      }
    } finally {
      _viewerRequestPending = false;
      if (mounted && widget.product.slug != slug) unawaited(_recordViewer());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appIsResumed = state == AppLifecycleState.resumed;
    if (_appIsResumed) {
      unawaited(_recordViewer());
    } else if (mounted) {
      setState(() => _viewerCount = null);
    }
  }

  @override
  void didUpdateWidget(covariant StoreProductDetailsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.product.slug != widget.product.slug) {
      _viewerId = const Uuid().v4();
      _viewerCount = null;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => unawaited(_recordViewer()),
      );
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _viewerTimer?.cancel();
    super.dispose();
  }

  Future<void> _askProductQuestion() async {
    final uri = Uri.https('wa.me', '/923015740405', {
      'text': 'Hello, I have a question about ${widget.product.name}:',
    });
    try {
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
    } catch (error) {
      debugPrint('Product question link could not be opened: $error');
    }
    if (mounted) {
      setState(() => _error = 'Could not open WhatsApp. Please try again.');
    }
  }

  Future<void> _copyProductLink() async {
    try {
      await Clipboard.setData(
        ClipboardData(
          text: widget.api.assetUrl(
            '/product/${Uri.encodeComponent(widget.product.slug)}',
          ),
        ),
      );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Product link copied.')));
      }
    } catch (error) {
      debugPrint('Product link could not be copied: $error');
      if (mounted) {
        setState(
          () => _error = 'Could not copy the product link. Please try again.',
        );
      }
    }
  }

  Future<void> _confirmToricOrder() async {
    final link = widget.product.orderingPolicy?['whatsappUrl']?.toString();
    final uri = Uri.tryParse(link ?? '');
    if (uri == null || uri.scheme != 'https' || uri.host != 'wa.me') {
      setState(
        () => _error =
            'The WhatsApp contact link is unavailable. Please contact the store.',
      );
      return;
    }
    try {
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
    } catch (error) {
      debugPrint('Toric WhatsApp link could not be opened: $error');
    }
    if (mounted) {
      setState(() => _error = 'Could not open WhatsApp. Please try again.');
    }
  }

  @override
  void initState() {
    super.initState();
    _footerData = widget.api.getHomeData();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => unawaited(_recordViewer()),
    );
    _viewerTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => unawaited(_recordViewer()),
    );
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
    final selectedBasePrice = _variant?.price ?? product.price;
    final selectedPrice = _powerAdjustedPrice(selectedBasePrice);
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
            _money(selectedPrice, _variant?.currency ?? product.currency),
            style: const TextStyle(
              color: _navy,
              fontSize: 23,
              fontWeight: FontWeight.w900,
            ),
          ),
          if (product.requiresWhatsAppConfirmation) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _pale,
                border: Border.all(color: _blue),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'Toric lenses are ordered only after confirmation on WhatsApp. Full payment in advance is required. Discuss spherical power, cylinder and axis with the store.',
                style: TextStyle(
                  color: _ink,
                  height: 1.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
          if (product.description?.isNotEmpty == true) ...[
            const SizedBox(height: 16),
            Text(
              product.description!,
              style: const TextStyle(color: _ink, height: 1.5),
            ),
          ],
          if (!product.requiresWhatsAppConfirmation &&
              product.variants.isNotEmpty) ...[
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
          if (!product.requiresWhatsAppConfirmation &&
              product.availablePowerRanges.isNotEmpty) ...[
            const SizedBox(height: 18),
            const Text(
              'Choose your lenses',
              style: TextStyle(color: _ink, fontWeight: FontWeight.w800),
            ),
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Plain lenses'),
                  selected: _lensChoice == 'plain',
                  onSelected: (_) => setState(() {
                    _lensChoice = 'plain';
                    _leftPower = null;
                    _rightPower = null;
                    _error = null;
                  }),
                ),
                ChoiceChip(
                  label: const Text('Power lenses'),
                  selected: _lensChoice == 'power',
                  onSelected: (_) => setState(() {
                    _lensChoice = 'power';
                    _error = null;
                  }),
                ),
              ],
            ),
          ],
          if (!product.requiresWhatsAppConfirmation &&
              product.availablePowerRanges.isNotEmpty &&
              _lensChoice == 'power') ...[
            const SizedBox(height: 12),
            const Text(
              'Power selection · surcharge per eye',
              style: TextStyle(color: _ink, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _leftPower,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Left eye'),
              items: product.availablePowerOptions
                  .where(
                    (option) =>
                        product.availablePowerRanges.contains(option.value),
                  )
                  .map(
                    (option) => DropdownMenuItem(
                      value: option.value,
                      child: Text(
                        '${option.label} D · +Rs ${option.surcharge}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
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
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Right eye'),
              items: product.availablePowerOptions
                  .where(
                    (option) =>
                        product.availablePowerRanges.contains(option.value),
                  )
                  .map(
                    (option) => DropdownMenuItem(
                      value: option.value,
                      child: Text(
                        '${option.label} D · +Rs ${option.surcharge}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
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
          if (!available && !product.requiresWhatsAppConfirmation) ...[
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
              onPressed: product.requiresWhatsAppConfirmation
                  ? _confirmToricOrder
                  : available
                  ? _add
                  : null,
              icon: Icon(
                product.requiresWhatsAppConfirmation
                    ? Icons.chat_outlined
                    : Icons.shopping_bag_outlined,
              ),
              label: Text(
                product.requiresWhatsAppConfirmation
                    ? 'Confirm this order on WhatsApp'
                    : 'Add to bag',
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Divider(),
          if (_viewerCount != null)
            Text(
              '$_viewerCount ${_viewerCount == 1 ? 'viewing session' : 'viewing sessions'} in the last 2 minutes',
              style: const TextStyle(color: _ink),
            ),
          Wrap(
            spacing: 8,
            children: [
              if (widget.onCompare != null)
                TextButton.icon(
                  onPressed: () => widget.onCompare!(product),
                  icon: const Icon(Icons.compare_arrows),
                  label: const Text('Compare'),
                ),
              TextButton.icon(
                onPressed: _askProductQuestion,
                icon: const Icon(Icons.help_outline),
                label: const Text('Ask a question'),
              ),
              TextButton.icon(
                onPressed: _copyProductLink,
                icon: const Icon(Icons.share_outlined),
                label: const Text('Copy link'),
              ),
            ],
          ),
          _ProductReviews(
            key: ValueKey(product.slug),
            api: widget.api,
            slug: product.slug,
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

  int _powerSurcharge() {
    final byValue = {
      for (final option in widget.product.availablePowerOptions)
        option.value: moneyToCents(option.surcharge) ?? 0,
    };
    return (byValue[_leftPower] ?? 0) + (byValue[_rightPower] ?? 0);
  }

  String _powerAdjustedPrice(String basePrice) {
    final base = moneyToCents(basePrice);
    if (base == null) return basePrice;
    final total = base + _powerSurcharge();
    return '${total ~/ 100}.${(total % 100).toString().padLeft(2, '0')}';
  }

  void _add() {
    final product = widget.product;
    if (product.variants.isNotEmpty && _variant == null) {
      setState(() => _error = 'Choose a lens option to continue.');
      return;
    }
    if (product.availablePowerRanges.isNotEmpty &&
        (_lensChoice == null ||
            (_lensChoice == 'power' &&
                (_leftPower == null || _rightPower == null)))) {
      setState(
        () => _error = _lensChoice == null
            ? 'Choose plain or power lenses.'
            : 'Select a power range for both eyes.',
      );
      return;
    }
    widget.onAdd(
      CartLine(
        product: product,
        variant: _variant,
        leftPowerRange: _leftPower,
        rightPowerRange: _rightPower,
        quantity: 1,
        lensChoice: _lensChoice,
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
