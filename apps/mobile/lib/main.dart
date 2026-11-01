import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import 'admin_product_editor.dart';
import 'isk_controls.dart';
import 'store_api.dart';
import 'storefront_screens.dart';

const _navy = Color(0xff033473);
const _paleBlue = Color(0xffeef4fc);
const _controlBlue = Color(0xff006f9b);
const _controlLine = Color(0xffb8d4e0);
const _controlFill = Color(0xffe8f6fb);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const IskLensesApp());
}

class IskLensesApp extends StatefulWidget {
  const IskLensesApp({this.api, this.adminApi, super.key});

  final StoreApi? api;
  final AdminApi? adminApi;

  @override
  State<IskLensesApp> createState() => _IskLensesAppState();
}

class _IskLensesAppState extends State<IskLensesApp> {
  late final StoreApi _api;
  late final AdminApi _adminApi;
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final _catalogKey = GlobalKey<_CatalogScreenState>();
  final List<CartLine> _cart = [];
  final List<StoreProduct> _comparison = [];
  ShopperSession? _session;
  var _tab = 0;
  StoreBrowseFilter _browseFilter = const StoreBrowseFilter();

  @override
  void initState() {
    super.initState();
    _api = widget.api ?? StoreApi();
    _adminApi = widget.adminApi ?? AdminApi();
    _loadSession();
  }

  Future<void> _loadSession() async {
    try {
      final session = await _api.getSession();
      if (mounted) setState(() => _session = session);
    } on StoreApiException {
      // The public catalog remains available when the account API is offline.
    }
  }

  void _addToCart(CartLine line) {
    setState(() {
      final index = _cart.indexWhere((item) => item.key == line.key);
      if (index < 0) {
        _cart.add(line);
      } else {
        _cart[index] = _cart[index].withQuantity(
          _cart[index].quantity + line.quantity,
        );
      }
    });
  }

  void _updateCart(CartLine line, int quantity) {
    setState(() {
      final index = _cart.indexWhere((item) => item.key == line.key);
      if (index < 0) return;
      if (quantity <= 0) {
        _cart.removeAt(index);
      } else {
        _cart[index] = line.withQuantity(quantity);
      }
    });
  }

  void _clearCart() => setState(_cart.clear);

  void _browse(StoreBrowseFilter filter) {
    setState(() {
      _browseFilter = filter;
      _tab = 1;
    });
  }

  void _openCart() {
    Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => CartScreen(
          api: _api,
          cart: _cart,
          onChange: _updateCart,
          onCheckoutComplete: _clearCart,
          customerEmail: _session?.email,
        ),
      ),
    );
  }

  Future<void> _openProduct(StoreProduct product) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => StoreProductDetailsScreen(
          api: _api,
          product: product,
          onAdd: _addToCart,
          onPage: _openStorePage,
        ),
      ),
    );
  }

  void _compareProduct(StoreProduct product) {
    final existing = _comparison.indexWhere((item) => item.id == product.id);
    if (existing >= 0) {
      setState(() => _comparison.removeAt(existing));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${product.name} removed from comparison')),
      );
      return;
    }
    if (_comparison.length >= 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Compare up to three products at once.')),
      );
      return;
    }
    setState(() => _comparison.add(product));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${product.name} added to comparison')),
    );
  }

  void _openStorePage(String path) {
    _scaffoldKey.currentState?.closeDrawer();
    final uri = Uri.tryParse(path);
    if (uri != null && (uri.path == '/shop' || uri.path == '/products')) {
      _browse(
        StoreBrowseFilter(
          query: uri.queryParameters['q'] ?? '',
          brand: uri.queryParameters['brand'],
        ),
      );
      return;
    }
    if (uri != null && uri.path.startsWith('/product-category/')) {
      final category = uri.path
          .substring('/product-category/'.length)
          .split('/')
          .where((part) => part.isNotEmpty)
          .lastOrNull;
      if (category != null) {
        _browse(StoreBrowseFilter(category: category));
      }
      return;
    }
    if (uri != null && uri.path.startsWith('/product/')) {
      final slug = uri.path.substring('/product/'.length);
      _api.getProduct(slug).then(_openProduct).catchError((Object error) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(error.toString())));
        }
      });
      return;
    }
    if (path == '/') {
      setState(() => _tab = 0);
    } else if (path == '/shop' || path == '/products') {
      _browse(const StoreBrowseFilter());
    } else if (path == '/cart') {
      _openCart();
    } else if (path == '/my-account') {
      setState(() => _tab = 4);
    } else if (path == '/compare') {
      setState(() => _tab = 2);
    } else if (path == '/admin') {
      Navigator.of(context).push<void>(
        MaterialPageRoute(builder: (_) => AdminWorkspaceScreen(api: _adminApi)),
      );
    } else if (path == '/brands' ||
        path == '/product-category' ||
        path == '/blogs') {
      Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => StoreDirectoryScreen(
            api: _api,
            path: path,
            onBrowse: _browse,
            onProduct: _openProduct,
            onCompare: _compareProduct,
          ),
        ),
      );
    } else {
      openStoreInformation(context, api: _api, path: path);
    }
  }

  Widget _tabContent() => IndexedStack(
    index: _tab,
    children: [
      StorefrontHomeScreen(
        api: _api,
        onBrowse: _browse,
        onProduct: _openProduct,
        onCompare: _compareProduct,
        onPage: _openStorePage,
      ),
      CatalogScreen(
        key: _catalogKey,
        api: _api,
        onAdd: _addToCart,
        onProduct: _openProduct,
        onCompare: _compareProduct,
        filter: _browseFilter,
        onPage: _openStorePage,
      ),
      StoreComparisonScreen(
        api: _api,
        products: _comparison,
        onRemove: (product) => setState(
          () => _comparison.removeWhere((item) => item.id == product.id),
        ),
        onAdd: _openProduct,
        onProduct: _openProduct,
        onPage: _openStorePage,
      ),
      AssistantScreen(api: _api),
      AccountScreen(
        api: _api,
        adminApi: _adminApi,
        session: _session,
        onSessionChanged: (value) => setState(() => _session = value),
      ),
    ],
  );

  Widget _pageDrawer() => Drawer(
    child: SafeArea(
      child: ListView(
        padding: const EdgeInsets.symmetric(vertical: 10),
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 12, 20, 18),
            child: Text(
              'ISK Lenses',
              style: TextStyle(
                color: _navy,
                fontSize: 24,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          _drawerItem(Icons.home_outlined, 'Home', '/'),
          _drawerItem(Icons.storefront_outlined, 'Shop all', '/shop'),
          _drawerItem(
            Icons.category_outlined,
            'Categories',
            '/product-category',
          ),
          _drawerItem(Icons.sell_outlined, 'Brands', '/brands'),
          ListTile(
            leading: const Icon(Icons.compare_arrows_rounded),
            title: const Text('Compare lenses'),
            onTap: () {
              _scaffoldKey.currentState?.closeDrawer();
              setState(() => _tab = 2);
            },
          ),
          const Divider(height: 24),
          _drawerItem(Icons.article_outlined, 'Blogs', '/blogs'),
          _drawerItem(
            Icons.help_outline_rounded,
            'Frequently asked questions',
            '/faq',
          ),
          _drawerItem(
            Icons.contact_support_outlined,
            'Contact us',
            '/contact-us',
          ),
          _drawerItem(
            Icons.local_shipping_outlined,
            'Shipping & returns',
            '/shipping-returns',
          ),
          _drawerItem(
            Icons.privacy_tip_outlined,
            'Privacy policy',
            '/privacy-policy',
          ),
          _drawerItem(
            Icons.description_outlined,
            'Terms & conditions',
            '/terms-conditions',
          ),
          const Divider(height: 24),
          _drawerItem(Icons.shopping_bag_outlined, 'Your bag', '/cart'),
          _drawerItem(
            Icons.person_outline_rounded,
            'My account',
            '/my-account',
          ),
          _drawerItem(
            Icons.admin_panel_settings_outlined,
            'Admin workspace',
            '/admin',
          ),
        ],
      ),
    ),
  );

  Widget _drawerItem(IconData icon, String label, String path) => ListTile(
    leading: Icon(icon),
    title: Text(label),
    onTap: () => _openStorePage(path),
  );

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ISK Lenses',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        canvasColor: Colors.white,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _controlBlue,
          primary: _controlBlue,
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xfff8faff),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: _navy,
          centerTitle: false,
          elevation: 0,
          scrolledUnderElevation: 1,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 15,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _controlLine),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _controlLine),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _controlBlue, width: 2),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xffb4233e)),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xffb4233e), width: 2),
          ),
        ),
        dropdownMenuTheme: DropdownMenuThemeData(
          textStyle: const TextStyle(color: Color(0xff15384d)),
          menuStyle: MenuStyle(
            backgroundColor: const WidgetStatePropertyAll(Colors.white),
            elevation: const WidgetStatePropertyAll(8),
            shape: WidgetStatePropertyAll(
              RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: _controlLine),
              ),
            ),
          ),
        ),
        checkboxTheme: CheckboxThemeData(
          fillColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? _controlBlue
                : Colors.white,
          ),
          side: const BorderSide(color: _controlLine, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
        ),
        radioTheme: RadioThemeData(
          fillColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? _controlBlue
                : const Color(0xff7893a2),
          ),
        ),
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? Colors.white
                : const Color(0xfff7fcff),
          ),
          trackColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? _controlBlue
                : _controlFill,
          ),
          trackOutlineColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? _controlBlue
                : _controlLine,
          ),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: Colors.white,
          selectedColor: _controlFill,
          checkmarkColor: _controlBlue,
          labelStyle: const TextStyle(color: Color(0xff15384d)),
          side: const BorderSide(color: _controlLine),
          showCheckmark: true,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        popupMenuTheme: PopupMenuThemeData(
          color: Colors.white,
          elevation: 8,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: _controlLine),
          ),
        ),
        listTileTheme: const ListTileThemeData(
          iconColor: _controlBlue,
          textColor: Color(0xff15384d),
        ),
        expansionTileTheme: const ExpansionTileThemeData(
          collapsedBackgroundColor: _controlFill,
          backgroundColor: _controlFill,
          collapsedShape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
            side: BorderSide(color: _controlLine),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
            side: BorderSide(color: _controlLine),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: _controlBlue,
            foregroundColor: Colors.white,
            shape: const StadiumBorder(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: _controlBlue,
            side: const BorderSide(color: _controlLine),
            shape: const StadiumBorder(),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          ),
        ),
      ),
      home: Builder(
        builder: (context) {
          final wide = MediaQuery.sizeOf(context).width >= 900;
          final destinations = [
            const NavigationRailDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: Text('Home'),
            ),
            const NavigationRailDestination(
              icon: Icon(Icons.storefront_outlined),
              selectedIcon: Icon(Icons.storefront),
              label: Text('Shop'),
            ),
            NavigationRailDestination(
              icon: Badge(
                isLabelVisible: _comparison.isNotEmpty,
                label: Text('${_comparison.length}'),
                child: const Icon(Icons.compare_arrows_rounded),
              ),
              selectedIcon: const Icon(Icons.compare_arrows_rounded),
              label: const Text('Compare'),
            ),
            const NavigationRailDestination(
              icon: Icon(Icons.chat_bubble_outline),
              selectedIcon: Icon(Icons.chat_bubble),
              label: Text('Help'),
            ),
            NavigationRailDestination(
              icon: Icon(
                _session == null ? Icons.person_outline : Icons.person,
              ),
              selectedIcon: const Icon(Icons.person),
              label: const Text('Account'),
            ),
          ];
          return Scaffold(
            key: _scaffoldKey,
            drawer: _pageDrawer(),
            appBar: AppBar(
              title: Text(
                _tab == 0
                    ? 'ISK Lenses'
                    : ['Home', 'Shop', 'Compare', 'Help', 'Account'][_tab],
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              actions: [
                IconButton(
                  onPressed: _openCart,
                  tooltip: 'Open your bag',
                  icon: Badge(
                    isLabelVisible: _cart.isNotEmpty,
                    label: Text(
                      '${_cart.fold<int>(0, (total, item) => total + item.quantity)}',
                    ),
                    child: const Icon(Icons.shopping_bag_outlined),
                  ),
                ),
                const SizedBox(width: 8),
              ],
            ),
            body: wide
                ? Row(
                    children: [
                      NavigationRail(
                        selectedIndex: _tab,
                        onDestinationSelected: (value) =>
                            setState(() => _tab = value),
                        extended: MediaQuery.sizeOf(context).width >= 1200,
                        labelType: MediaQuery.sizeOf(context).width >= 1200
                            ? null
                            : NavigationRailLabelType.all,
                        destinations: destinations,
                      ),
                      const VerticalDivider(width: 1),
                      Expanded(child: _tabContent()),
                    ],
                  )
                : _tabContent(),
            bottomNavigationBar: wide
                ? null
                : NavigationBar(
                    selectedIndex: _tab,
                    onDestinationSelected: (value) =>
                        setState(() => _tab = value),
                    destinations: [
                      const NavigationDestination(
                        icon: Icon(Icons.home_outlined),
                        selectedIcon: Icon(Icons.home_rounded),
                        label: 'Home',
                      ),
                      const NavigationDestination(
                        icon: Icon(Icons.storefront_outlined),
                        selectedIcon: Icon(Icons.storefront),
                        label: 'Shop',
                      ),
                      NavigationDestination(
                        icon: Badge(
                          isLabelVisible: _comparison.isNotEmpty,
                          label: Text('${_comparison.length}'),
                          child: const Icon(Icons.compare_arrows_rounded),
                        ),
                        selectedIcon: const Icon(Icons.compare_arrows_rounded),
                        label: 'Compare',
                      ),
                      const NavigationDestination(
                        icon: Icon(Icons.chat_bubble_outline),
                        selectedIcon: Icon(Icons.chat_bubble),
                        label: 'Help',
                      ),
                      NavigationDestination(
                        icon: Icon(
                          _session == null
                              ? Icons.person_outline
                              : Icons.person,
                        ),
                        label: 'Account',
                      ),
                    ],
                  ),
          );
        },
      ),
    );
  }
}

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({
    required this.api,
    required this.onAdd,
    required this.onProduct,
    required this.onCompare,
    required this.filter,
    required this.onPage,
    super.key,
  });

  final StoreApi api;
  final ValueChanged<CartLine> onAdd;
  final ValueChanged<StoreProduct> onProduct;
  final ValueChanged<StoreProduct> onCompare;
  final StoreBrowseFilter filter;
  final ValueChanged<String> onPage;

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  final List<StoreProduct> _products = [];
  late Future<StoreHomeData> _footerData;
  Timer? _searchDebounce;
  String? _error;
  var _page = 1;
  var _totalPages = 1;
  var _loading = false;
  var _requestToken = 0;
  var _query = '';
  String? _category;
  String? _brand;
  String? _shadeId;
  String? _lensTypeId;
  String _sort = 'newest';

  @override
  void initState() {
    super.initState();
    _footerData = widget.api.getHomeData();
    _applyFilterValues(widget.filter);
    _scrollController.addListener(_onScroll);
    _load(reset: true);
  }

  @override
  void didUpdateWidget(covariant CatalogScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.filter != oldWidget.filter) {
      _applyFilterValues(widget.filter);
      _load(reset: true);
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.extentAfter < 500 &&
        !_loading &&
        _page < _totalPages) {
      _load();
    }
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading && !reset) return;
    final requestToken = ++_requestToken;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _page = 1;
        _totalPages = 1;
        _products.clear();
      }
    });
    try {
      final result = await widget.api.getProducts(
        page: reset ? 1 : _page + 1,
        query: _query,
        category: _category,
        brand: _brand,
        shadeId: _shadeId,
        lensTypeId: _lensTypeId,
        sort: _sort,
      );
      if (!mounted || requestToken != _requestToken) return;
      setState(() {
        _products.addAll(result.products);
        _page = result.page;
        _totalPages = result.totalPages;
      });
    } on StoreApiException catch (error) {
      if (mounted && requestToken == _requestToken) {
        setState(() => _error = error.message);
      }
    } finally {
      if (mounted && requestToken == _requestToken) {
        setState(() => _loading = false);
      }
    }
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      _query = value.trim();
      _load(reset: true);
    });
  }

  void _applyFilterValues(StoreBrowseFilter filter) {
    _query = filter.query;
    _category = filter.category;
    _brand = filter.brand;
    _shadeId = filter.shadeId;
    _lensTypeId = filter.lensTypeId;
    _sort = filter.sort;
    _searchController.text = filter.query;
  }

  void applyFilter(StoreBrowseFilter filter) {
    _searchDebounce?.cancel();
    _applyFilterValues(filter);
    _load(reset: true);
  }

  Future<void> _openFilters() async {
    try {
      final home = await _footerData;
      if (!mounted) return;
      final selected = await showModalBottomSheet<StoreBrowseFilter>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (context) => _CatalogFilterSheet(
          data: home,
          initial: StoreBrowseFilter(
            query: _query,
            category: _category,
            brand: _brand,
            shadeId: _shadeId,
            lensTypeId: _lensTypeId,
            sort: _sort,
          ),
        ),
      );
      if (selected == null || !mounted) return;
      applyFilter(selected);
    } on StoreApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 1100
        ? 4
        : width >= 700
        ? 3
        : 2;
    final activeFilters = [
      if (_category != null) 'Category',
      if (_brand != null) 'Brand',
      if (_shadeId != null) 'Shade',
      if (_lensTypeId != null) 'Lens type',
    ];
    return Scaffold(
      backgroundColor: const Color(0xfff8faff),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      controller: _searchController,
                      onChanged: _onSearchChanged,
                      textInputAction: TextInputAction.search,
                      decoration: const InputDecoration(
                        hintText: 'Search lenses or brands',
                        prefixIcon: Icon(Icons.search),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        OutlinedButton.icon(
                          onPressed: _openFilters,
                          icon: const Icon(Icons.tune_rounded),
                          label: Text(
                            activeFilters.isEmpty
                                ? 'Filter'
                                : 'Filter (${activeFilters.length})',
                          ),
                        ),
                        PopupMenuButton<String>(
                          initialValue: _sort,
                          onSelected: (value) => applyFilter(
                            StoreBrowseFilter(
                              query: _query,
                              category: _category,
                              brand: _brand,
                              shadeId: _shadeId,
                              lensTypeId: _lensTypeId,
                              sort: value,
                            ),
                          ),
                          itemBuilder: (_) => const [
                            PopupMenuItem(
                              value: 'newest',
                              child: Text('Newest'),
                            ),
                            PopupMenuItem(
                              value: 'featured',
                              child: Text('Featured'),
                            ),
                            PopupMenuItem(
                              value: 'price_asc',
                              child: Text('Price: low to high'),
                            ),
                            PopupMenuItem(
                              value: 'price_desc',
                              child: Text('Price: high to low'),
                            ),
                            PopupMenuItem(
                              value: 'name_asc',
                              child: Text('Name: A to Z'),
                            ),
                          ],
                          child: OutlinedButton.icon(
                            onPressed: null,
                            icon: const Icon(Icons.sort_rounded),
                            label: const Text('Sort'),
                          ),
                        ),
                        if (activeFilters.isNotEmpty)
                          TextButton(
                            onPressed: () => applyFilter(
                              StoreBrowseFilter(query: _query, sort: _sort),
                            ),
                            child: const Text('Clear filters'),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _query.isEmpty ? 'Shop contact lenses' : 'Search results',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: _navy,
                      ),
                    ),
                    if (activeFilters.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          activeFilters.join(' · '),
                          style: const TextStyle(color: Colors.black54),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (_error != null && _products.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _ErrorPanel(
                  message: _error!,
                  onRetry: () => _load(reset: true),
                ),
              )
            else if (_products.isEmpty && _loading)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_products.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: Text('No active products were found.')),
              )
            else ...[
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                sliver: SliverGrid.builder(
                  itemCount: _products.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    mainAxisExtent: width >= 700 ? 330 : 306,
                  ),
                  itemBuilder: (context, index) => _ProductCard(
                    product: _products[index],
                    onTap: () => widget.onProduct(_products[index]),
                    onCompare: () => widget.onCompare(_products[index]),
                  ),
                ),
              ),
              if (_loading)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
              if (_error != null)
                SliverToBoxAdapter(
                  child: _ErrorPanel(message: _error!, onRetry: () => _load()),
                ),
            ],
            SliverToBoxAdapter(
              child: FutureBuilder<StoreHomeData>(
                future: _footerData,
                builder: (context, snapshot) => snapshot.hasData
                    ? StoreSiteFooter(
                        data: snapshot.data!,
                        onPage: widget.onPage,
                      )
                    : const SizedBox(height: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.product,
    required this.onTap,
    required this.onCompare,
  });

  final StoreProduct product;
  final VoidCallback onTap;
  final VoidCallback onCompare;

  @override
  Widget build(BuildContext context) {
    return StoreProductCard(
      product: product,
      onTap: onTap,
      onCompare: onCompare,
    );
  }
}

class _CatalogFilterSheet extends StatefulWidget {
  const _CatalogFilterSheet({required this.data, required this.initial});

  final StoreHomeData data;
  final StoreBrowseFilter initial;

  @override
  State<_CatalogFilterSheet> createState() => _CatalogFilterSheetState();
}

class _CatalogFilterSheetState extends State<_CatalogFilterSheet> {
  late String? _category = widget.initial.category;
  late String? _brand = widget.initial.brand;
  late String? _shadeId = widget.initial.shadeId;
  late String? _lensTypeId = widget.initial.lensTypeId;
  late String _sort = widget.initial.sort;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      10,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 20,
    ),
    child: SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Filter and sort',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: _navy,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          _filterDropdown(
            label: 'Category',
            value: _category,
            options: widget.data.categories
                .where((item) => item.isActive && item.productCount > 0)
                .map((item) => (item.slug, item.name))
                .toList(),
            onChanged: (value) => setState(() => _category = value),
          ),
          const SizedBox(height: 12),
          _filterDropdown(
            label: 'Brand',
            value: _brand,
            options: widget.data.brands
                .where((item) => item.productCount > 0)
                .map((item) => (item.slug, item.name))
                .toList(),
            onChanged: (value) => setState(() => _brand = value),
          ),
          const SizedBox(height: 12),
          _filterDropdown(
            label: 'Shade',
            value: _shadeId,
            options: widget.data.shades
                .where((item) => item.productCount > 0)
                .map((item) => (item.id, item.name))
                .toList(),
            onChanged: (value) => setState(() => _shadeId = value),
          ),
          const SizedBox(height: 12),
          _filterDropdown(
            label: 'Lens type',
            value: _lensTypeId,
            options: widget.data.lensTypes
                .where((item) => item.productCount > 0)
                .map((item) => (item.id, item.name))
                .toList(),
            onChanged: (value) => setState(() => _lensTypeId = value),
          ),
          const SizedBox(height: 12),
          _filterDropdown(
            label: 'Sort by',
            value: _sort,
            options: const [
              ('newest', 'Newest'),
              ('featured', 'Featured'),
              ('price_asc', 'Price: low to high'),
              ('price_desc', 'Price: high to low'),
              ('name_asc', 'Name: A to Z'),
            ],
            onChanged: (value) => setState(() => _sort = value ?? 'newest'),
            allowEmpty: false,
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              TextButton(
                onPressed: () => setState(() {
                  _category = null;
                  _brand = null;
                  _shadeId = null;
                  _lensTypeId = null;
                  _sort = 'newest';
                }),
                child: const Text('Clear all'),
              ),
              const Spacer(),
              FilledButton(
                onPressed: () => Navigator.pop(
                  context,
                  StoreBrowseFilter(
                    query: widget.initial.query,
                    category: _category,
                    brand: _brand,
                    shadeId: _shadeId,
                    lensTypeId: _lensTypeId,
                    sort: _sort,
                  ),
                ),
                child: const Text('Show products'),
              ),
            ],
          ),
        ],
      ),
    ),
  );

  Widget _filterDropdown({
    required String label,
    required String? value,
    required List<(String, String)> options,
    required ValueChanged<String?> onChanged,
    bool allowEmpty = true,
  }) {
    final exists = options.any((item) => item.$1 == value);
    return DropdownButtonFormField<String>(
      initialValue: exists ? value : null,
      decoration: InputDecoration(labelText: label),
      items: [
        if (allowEmpty)
          const DropdownMenuItem<String>(value: null, child: Text('Any')),
        for (final (option, title) in options)
          DropdownMenuItem(value: option, child: Text(title)),
      ],
      onChanged: onChanged,
    );
  }
}

class ProductSheet extends StatefulWidget {
  const ProductSheet({required this.product, super.key});
  final StoreProduct product;

  @override
  State<ProductSheet> createState() => _ProductSheetState();
}

class _ProductSheetState extends State<ProductSheet> {
  ProductVariant? _variant;
  String? _leftPower;
  String? _rightPower;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final variants = product.variants
        .where((variant) => variant.stockQuantity > 0)
        .toList();
    final available = product.stockQuantity > 0 || variants.isNotEmpty;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.black26,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              product.name,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: _navy,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _money(
                _variant?.price ?? product.price,
                _variant?.currency ?? product.currency,
              ),
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
            if (product.variants.isNotEmpty) ...[
              const SizedBox(height: 18),
              IskDropdownField<String>(
                value: _variant?.id,
                decoration: const InputDecoration(
                  labelText: 'Lens option',
                  hintText: 'Choose an option',
                ),
                items: variants
                    .map(
                      (variant) => DropdownMenuItem(
                        value: variant.id,
                        child: Text(variant.name),
                      ),
                    )
                    .toList(),
                onChanged: (id) => setState(() {
                  _variant = null;
                  for (final option in variants) {
                    if (option.id == id) _variant = option;
                  }
                  _error = null;
                }),
              ),
            ],
            if (product.availablePowerRanges.isNotEmpty) ...[
              const SizedBox(height: 18),
              const Text(
                'Select a power range for each eye',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              _PowerDropdown(
                label: 'Left eye',
                value: _leftPower,
                options: product.availablePowerRanges,
                onChanged: (value) => setState(() {
                  _leftPower = value;
                  _error = null;
                }),
              ),
              const SizedBox(height: 10),
              _PowerDropdown(
                label: 'Right eye',
                value: _rightPower,
                options: product.availablePowerRanges,
                onChanged: (value) => setState(() {
                  _rightPower = value;
                  _error = null;
                }),
              ),
            ],
            if (!available) ...[
              const SizedBox(height: 14),
              const Text(
                'Currently out of stock',
                style: TextStyle(color: Colors.red),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: available ? _add : null,
                child: const Text('Add to bag'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _add() {
    if (widget.product.variants.isNotEmpty && _variant == null) {
      setState(() => _error = 'Choose a lens option to continue.');
      return;
    }
    if (widget.product.availablePowerRanges.isNotEmpty &&
        (_leftPower == null || _rightPower == null)) {
      setState(() => _error = 'Select a power range for both eyes.');
      return;
    }
    Navigator.of(context).pop(
      CartLine(
        product: widget.product,
        variant: _variant,
        leftPowerRange: _leftPower,
        rightPowerRange: _rightPower,
        quantity: 1,
      ),
    );
  }
}

class _PowerDropdown extends StatelessWidget {
  const _PowerDropdown({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final List<String> options;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return IskDropdownField<String>(
      value: value,
      decoration: InputDecoration(
        labelText: label,
        hintText: 'Select power range',
      ),
      items: options
          .map((option) => DropdownMenuItem(value: option, child: Text(option)))
          .toList(),
      onChanged: onChanged,
    );
  }
}

class CartScreen extends StatelessWidget {
  const CartScreen({
    required this.api,
    required this.cart,
    required this.onChange,
    required this.onCheckoutComplete,
    required this.customerEmail,
    super.key,
  });

  final StoreApi api;
  final List<CartLine> cart;
  final void Function(CartLine, int) onChange;
  final VoidCallback onCheckoutComplete;
  final String? customerEmail;

  @override
  Widget build(BuildContext context) {
    final subtotalCents = _cartSubtotal(cart);
    return Scaffold(
      appBar: AppBar(title: const Text('Your bag')),
      body: cart.isEmpty
          ? const Center(
              child: Text(
                'Your bag is empty. Explore the shop to find your lenses.',
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final line in cart)
                  Card(
                    color: Colors.white,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Container(
                            width: 68,
                            height: 68,
                            clipBehavior: Clip.antiAlias,
                            decoration: BoxDecoration(
                              color: _paleBlue,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: line.product.imageUrl == null
                                ? const Icon(
                                    Icons.visibility_outlined,
                                    color: _navy,
                                  )
                                : Image.network(
                                    line.product.imageUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => const Icon(
                                      Icons.visibility_outlined,
                                      color: _navy,
                                    ),
                                  ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  line.product.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                if (line.variant != null)
                                  Text(
                                    line.variant!.name,
                                    style: const TextStyle(
                                      color: Colors.black54,
                                    ),
                                  ),
                                if (line.leftPowerRange != null)
                                  Text(
                                    'L ${line.leftPowerRange} · R ${line.rightPowerRange}',
                                    style: const TextStyle(
                                      color: Colors.black54,
                                    ),
                                  ),
                                Text(
                                  _money(line.price, line.currency),
                                  style: const TextStyle(
                                    color: _navy,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () => onChange(line, line.quantity - 1),
                            icon: const Icon(Icons.remove_circle_outline),
                          ),
                          Text(
                            '${line.quantity}',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          IconButton(
                            onPressed: () => onChange(line, line.quantity + 1),
                            icon: const Icon(Icons.add_circle_outline),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 10),
                _SummaryRow(
                  label: 'Subtotal',
                  value: _money(_amount(subtotalCents), 'PKR'),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () async {
                    final result = await Navigator.of(context).push<String>(
                      MaterialPageRoute(
                        builder: (_) => CheckoutScreen(
                          api: api,
                          cart: List.unmodifiable(cart),
                          initialEmail: customerEmail,
                        ),
                      ),
                    );
                    if (result == null || !context.mounted) return;
                    onCheckoutComplete();
                    showDialog<void>(
                      context: context,
                      builder: (context) => AlertDialog(
                        icon: const Icon(
                          Icons.check_circle,
                          color: Colors.green,
                          size: 42,
                        ),
                        title: const Text('Order placed'),
                        content: Text(
                          'Your order number is $result. We’ll contact you to confirm delivery.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Done'),
                          ),
                        ],
                      ),
                    );
                  },
                  child: const Text('Continue to checkout'),
                ),
              ],
            ),
    );
  }
}

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({
    required this.api,
    required this.cart,
    required this.initialEmail,
    super.key,
  });

  final StoreApi api;
  final List<CartLine> cart;
  final String? initialEmail;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _checkoutKey = StoreApi.newCheckoutKey();
  late final _email = TextEditingController(text: widget.initialEmail ?? '');
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _phone = TextEditingController();
  final _address1 = TextEditingController();
  final _address2 = TextEditingController();
  final _city = TextEditingController();
  final _province = TextEditingController();
  final _postal = TextEditingController();
  List<DeliveryRule>? _rules;
  String? _error;
  var _loadingRules = true;
  var _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadRules();
  }

  @override
  void dispose() {
    for (final controller in [
      _email,
      _first,
      _last,
      _phone,
      _address1,
      _address2,
      _city,
      _province,
      _postal,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadRules() async {
    try {
      final rules = await widget.api.getDeliveryRules();
      if (mounted) {
        setState(() {
          _rules = rules;
          _loadingRules = false;
        });
      }
    } on StoreApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
          _loadingRules = false;
        });
      }
    }
  }

  int get _subtotalCents => _cartSubtotal(widget.cart);

  int? get _deliveryCents {
    final rules = _rules;
    if (rules == null) return null;
    for (final rule in rules) {
      final min = _cents(rule.minSubtotal);
      final max = rule.maxSubtotal == null ? null : _cents(rule.maxSubtotal!);
      if (min != null &&
          _subtotalCents >= min &&
          (max == null || _subtotalCents <= max)) {
        return _cents(rule.fee);
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final deliveryCents = _deliveryCents;
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Delivery details',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: _navy,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 14),
            _field(
              _email,
              'Email',
              keyboardType: TextInputType.emailAddress,
              validator: _validateEmail,
            ),
            _field(_first, 'First name', validator: _required),
            _field(_last, 'Last name', validator: _required),
            _field(
              _phone,
              'Phone number',
              keyboardType: TextInputType.phone,
              validator: _validatePhone,
            ),
            _field(_address1, 'Street address', validator: _required),
            _field(_address2, 'Apartment, suite, etc. (optional)'),
            _field(_city, 'City', validator: _required),
            _field(_province, 'Province or territory', validator: _required),
            _field(_postal, 'Postal code (optional)'),
            const SizedBox(height: 8),
            Card(
              color: _paleBlue,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _SummaryRow(
                      label: 'Subtotal',
                      value: _money(_amount(_subtotalCents), 'PKR'),
                    ),
                    const SizedBox(height: 8),
                    _SummaryRow(
                      label: 'Delivery',
                      value: _loadingRules
                          ? 'Loading…'
                          : deliveryCents == null
                          ? 'Unavailable'
                          : _money(_amount(deliveryCents), 'PKR'),
                    ),
                    const Divider(height: 22),
                    _SummaryRow(
                      label: 'Payment',
                      value: 'Cash on delivery',
                      bold: true,
                    ),
                    if (deliveryCents != null) ...[
                      const SizedBox(height: 8),
                      _SummaryRow(
                        label: 'Estimated total',
                        value: _money(
                          _amount(_subtotalCents + deliveryCents),
                          'PKR',
                        ),
                        bold: true,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _submitting || _loadingRules || deliveryCents == null
                  ? null
                  : _submit,
              child: _submitting
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Place cash-on-delivery order'),
            ),
            const SizedBox(height: 10),
            const Text(
              'The store verifies current prices, stock, and delivery fees before accepting your order.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        textCapitalization: keyboardType == TextInputType.emailAddress
            ? TextCapitalization.none
            : TextCapitalization.words,
        validator: validator,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'This field is required.' : null;

  String? _validateEmail(String? value) {
    if (value == null ||
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value.trim())) {
      return 'Enter a valid email address.';
    }
    return null;
  }

  String? _validatePhone(String? value) {
    final digits = value?.replaceAll(RegExp(r'\D'), '') ?? '';
    return digits.length < 7 || digits.length > 15
        ? 'Enter a valid phone number.'
        : null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final delivery = _deliveryCents;
    if (delivery == null) {
      setState(
        () => _error =
            'Delivery pricing is not configured for this order total. Contact the store.',
      );
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final orderNumber = await widget.api.placeOrder(
        checkoutKey: _checkoutKey,
        email: _email.text,
        items: widget.cart,
        shippingAddress: {
          'firstName': _first.text.trim(),
          'lastName': _last.text.trim(),
          'phone': _phone.text.trim(),
          'addressLine1': _address1.text.trim(),
          'addressLine2': _address2.text.trim(),
          'city': _city.text.trim(),
          'province': _province.text.trim(),
          'postalCode': _postal.text.trim(),
        },
        deliveryFee: _amount(delivery),
      );
      if (mounted) Navigator.of(context).pop(orderNumber);
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({required this.api, super.key});
  final StoreApi api;

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<(String, bool)> _messages = [
    (
      'Hi! Ask me about products or store FAQs. Some replies may use an AI service; don’t share personal, order, payment, or health details. I can’t advise on lens fitting or eye health.',
      false,
    ),
  ];
  var _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final message = _controller.text.trim();
    if (message.isEmpty || _sending) return;
    _controller.clear();
    setState(() {
      _messages.add((message, true));
      _sending = true;
    });
    try {
      final answer = await widget.api.askChatbot(message);
      if (mounted) setState(() => _messages.add((answer, false)));
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _messages.add((error.message, false)));
    } finally {
      if (mounted) {
        setState(() => _sending = false);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollController.hasClients) {
            _scrollController.animateTo(
              _scrollController.position.maxScrollExtent,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOut,
            );
          }
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final (text, isUser) = _messages[index];
                return Align(
                  alignment: isUser
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 320),
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(13),
                    decoration: BoxDecoration(
                      color: isUser ? _navy : _paleBlue,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      text,
                      style: TextStyle(
                        color: isUser ? Colors.white : Colors.black87,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      maxLength: 200,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: 'Ask about the store',
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _sending ? null : _send,
                    icon: const Icon(Icons.send),
                    tooltip: 'Send',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AccountScreen extends StatefulWidget {
  const AccountScreen({
    required this.api,
    required this.adminApi,
    required this.session,
    required this.onSessionChanged,
    super.key,
  });

  final StoreApi api;
  final AdminApi adminApi;
  final ShopperSession? session;
  final ValueChanged<ShopperSession?> onSessionChanged;

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  List<ShopperOrder>? _orders;
  String? _error;
  var _register = false;
  var _busy = false;

  @override
  void didUpdateWidget(covariant AccountScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.session?.email != oldWidget.session?.email) {
      _orders = null;
      if (widget.session != null) _loadOrders();
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.session != null) _loadOrders();
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    try {
      final orders = await widget.api.getOrders();
      if (mounted) setState(() => _orders = orders);
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _authenticate() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await widget.api.authenticate(
        action: _register ? 'register' : 'login',
        email: _email.text,
        password: _password.text,
      );
      widget.onSessionChanged(session);
      _password.clear();
      await _loadOrders();
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logout() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.logout();
      widget.onSessionChanged(null);
      setState(() => _orders = null);
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openAdminWorkspace() => Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => AdminWorkspaceScreen(api: widget.adminApi),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    return Scaffold(
      body: session == null
          ? ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Icon(
                  Icons.account_circle_outlined,
                  size: 56,
                  color: _navy,
                ),
                const SizedBox(height: 12),
                Text(
                  _register ? 'Create your account' : 'Sign in',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: _navy,
                  ),
                ),
                const SizedBox(height: 18),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password'),
                ),
                if (_register)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Use at least 12 characters. Keep your password private.',
                      style: TextStyle(color: Colors.black54),
                    ),
                  ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _busy ? null : _authenticate,
                  child: _busy
                      ? const CircularProgressIndicator()
                      : Text(_register ? 'Create account' : 'Sign in'),
                ),
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                          _register = !_register;
                          _error = null;
                        }),
                  child: Text(
                    _register
                        ? 'Already have an account? Sign in'
                        : 'New here? Create an account',
                  ),
                ),
                const Divider(height: 32),
                OutlinedButton.icon(
                  onPressed: _openAdminWorkspace,
                  icon: const Icon(Icons.admin_panel_settings_outlined),
                  label: const Text('Admin workspace'),
                ),
              ],
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  color: _paleBlue,
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: _navy,
                      child: Icon(Icons.person, color: Colors.white),
                    ),
                    title: Text(
                      session.email,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: const Text('Signed in'),
                    trailing: IconButton(
                      onPressed: _busy ? null : _logout,
                      icon: const Icon(Icons.logout),
                      tooltip: 'Sign out',
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Recent orders',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: _navy,
                  ),
                ),
                const SizedBox(height: 8),
                if (_error != null)
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                if (_orders == null && _error == null)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(),
                    ),
                  ),
                if (_orders != null && _orders!.isEmpty)
                  const Text('No orders yet.'),
                for (final order in _orders ?? [])
                  Card(
                    color: Colors.white,
                    child: ListTile(
                      leading: const Icon(Icons.receipt_long, color: _navy),
                      title: Text('Order #${order.orderNumber}'),
                      subtitle: Text(order.status.replaceAll('_', ' ')),
                      trailing: Text(
                        _money(order.total, order.currency),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _openAdminWorkspace,
                  icon: const Icon(Icons.admin_panel_settings_outlined),
                  label: const Text('Admin workspace'),
                ),
              ],
            ),
    );
  }
}

class AdminWorkspaceScreen extends StatefulWidget {
  const AdminWorkspaceScreen({required this.api, super.key});

  final AdminApi api;

  @override
  State<AdminWorkspaceScreen> createState() => _AdminWorkspaceScreenState();
}

class _AdminWorkspaceScreenState extends State<AdminWorkspaceScreen> {
  static const _modules = <String, String>{
    'Overview': '/api/admin/metrics',
    'Products': '/api/admin/products',
    'Merchandising': '/api/admin/products/merchandising',
    'Orders': '/api/admin/orders',
    'Categories': '/api/admin/categories',
    'Brands': '/api/admin/brands',
    'Lens shades': '/api/admin/lens-shades',
    'Lens types': '/api/admin/lens-types',
    'Reviews': '/api/admin/reviews',
    'Customers': '/api/admin/customers',
    'CRM': '/api/admin/crm',
    'Storefront content': '/api/admin/content',
    'Product page': '/api/admin/product-page-settings',
    'Delivery': '/api/admin/delivery-settings',
    'Chatbot': '/api/chatbot/settings',
    'System users': '/api/admin/system-users',
    'Error logs': '/api/admin/error-logs',
    'Activity': '/api/admin/activity',
  };

  final _email = TextEditingController();
  final _password = TextEditingController();
  AdminSession? _session;
  String _module = 'Overview';
  List<Map<String, dynamic>> _records = [];
  String? _error;
  var _loading = true;
  var _busy = false;

  bool get _canManage => _session?.role != 'staff';
  bool get _isOwner => _session?.role == 'owner';

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _restoreSession() async {
    try {
      final session = await widget.api.getSession();
      if (!mounted) return;
      setState(() {
        _session = session;
        _loading = false;
        _error = null;
      });
      if (session != null) await _loadModule();
    } on StoreApiException catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = error.message;
        });
      }
    }
  }

  Future<void> _signIn() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await widget.api.signIn(
        email: _email.text,
        password: _password.text,
      );
      if (!mounted) return;
      setState(() {
        _session = session;
        _password.clear();
      });
      await _loadModule();
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signOut() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.signOut();
      if (!mounted) return;
      setState(() {
        _session = null;
        _records = [];
      });
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editProfile() async {
    final email = TextEditingController(text: _session?.email ?? '');
    final password = TextEditingController();
    final values = await showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Update administrator profile',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            TextField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: password,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'New password (optional)',
                helperText: 'Leave blank to keep your current password.',
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => Navigator.pop(context, {
                'email': email.text.trim(),
                if (password.text.isNotEmpty) 'password': password.text,
              }),
              child: const Text('Save and sign in again'),
            ),
          ],
        ),
      ),
    );
    email.dispose();
    password.dispose();
    if (values == null || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.put('/api/admin/profile', values);
      await widget.api.clearSessionCookie();
      if (mounted) {
        setState(() {
          _session = null;
          _records = [];
        });
      }
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _loadModule() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await widget.api.get(_modules[_module]!);
      final data = response['data'];
      final records = <Map<String, dynamic>>[];
      if (data is List) {
        records.addAll(
          data.whereType<Map>().map((item) => Map<String, dynamic>.from(item)),
        );
      } else if (data is Map) {
        final values = Map<String, dynamic>.from(data);
        for (final entry in values.entries) {
          if (entry.value is List) {
            for (final item in entry.value as List) {
              if (item is Map) {
                records.add({
                  '_section': entry.key,
                  ...Map<String, dynamic>.from(item),
                });
              }
            }
          } else {
            records.add({'name': entry.key, 'value': entry.value});
          }
        }
      } else if (data != null) {
        records.add({'value': data});
      }
      if (mounted) setState(() => _records = records);
    } on StoreApiException catch (error) {
      if (mounted) {
        setState(() {
          _records = [];
          _error = error.message;
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _text(Map<String, dynamic> item, String key, [String fallback = '']) {
    final value = item[key];
    return value == null ? fallback : value.toString();
  }

  String _recordTitle(Map<String, dynamic> item) {
    for (final key in [
      'name',
      'fullName',
      'orderNumber',
      'email',
      'title',
      'author',
      'id',
    ]) {
      final value = _text(item, key);
      if (value.isNotEmpty) return value;
    }
    return 'Record';
  }

  String _recordSubtitle(Map<String, dynamic> item) {
    final fields = <String>[];
    for (final key in [
      'status',
      'slug',
      'sku',
      'price',
      'stockQuantity',
      'email',
    ]) {
      final value = _text(item, key);
      if (value.isNotEmpty && value != _recordTitle(item)) {
        fields.add('$key: $value');
      }
    }
    return fields.join(' · ');
  }

  Future<void> _editStock(Map<String, dynamic> item) async {
    final productId = _text(item, 'id');
    final controller = TextEditingController(
      text: _text(item, 'stockQuantity', '0'),
    );
    final value = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Update stock'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Units on hand'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final quantity = int.tryParse(controller.text.trim());
              if (quantity != null && quantity >= 0) {
                Navigator.pop(context, quantity);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value == null || !mounted) return;
    await _mutate(
      () => widget.api.patch('/api/admin/products/$productId/stock', {
        'quantity': value,
      }),
    );
  }

  Future<void> _openProductEditor([String? productId]) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            AdminProductEditorScreen(api: widget.api, productId: productId),
      ),
    );
    if (changed == true && mounted) await _loadModule();
  }

  Future<void> _mutate(Future<Object?> Function() operation) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await operation();
      await _loadModule();
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deleteRecord(Map<String, dynamic> item) async {
    final id = _text(item, 'id');
    final path = switch (_module) {
      'Categories' => '/api/admin/categories/$id',
      'Brands' => '/api/admin/brands/$id',
      'Lens shades' => '/api/admin/lens-shades/$id',
      'Lens types' => '/api/admin/lens-types/$id',
      'Reviews' => '/api/admin/reviews/$id',
      _ => null,
    };
    if (path == null || id.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this record?'),
        content: Text(_recordTitle(item)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await _mutate(() => widget.api.delete(path));
    }
  }

  Widget? _recordAction(Map<String, dynamic> item) {
    final id = _text(item, 'id');
    if (!_canManage || id.isEmpty) return null;
    if (_module == 'Products') {
      return IconButton(
        tooltip: 'Update stock',
        icon: const Icon(Icons.inventory_2_outlined, color: _navy),
        onPressed: _busy ? null : () => _editStock(item),
      );
    }
    if (_module == 'Merchandising') {
      return PopupMenuButton<String>(
        tooltip: 'Change merchandising',
        onSelected: (kind) => _mutate(
          () => widget.api.patch('/api/admin/products/merchandising', {
            'ids': [id],
            'kind': kind,
            'selected':
                item[switch (kind) {
                  'featured' => 'isFeatured',
                  'new_arrival' => 'isNewArrival',
                  _ => 'isOnSale',
                }] !=
                true,
          }),
        ),
        itemBuilder: (context) => const [
          PopupMenuItem(value: 'featured', child: Text('Toggle featured')),
          PopupMenuItem(
            value: 'new_arrival',
            child: Text('Toggle new arrival'),
          ),
          PopupMenuItem(value: 'on_sale', child: Text('Toggle on sale')),
        ],
        icon: const Icon(Icons.more_vert),
      );
    }
    if (_module == 'Orders') {
      return PopupMenuButton<String>(
        tooltip: 'Change order status',
        onSelected: (status) => _mutate(
          () => widget.api.patch('/api/admin/orders/$id', {'status': status}),
        ),
        itemBuilder: (context) => const [
          PopupMenuItem(value: 'processing', child: Text('Processing')),
          PopupMenuItem(value: 'shipped', child: Text('Shipped')),
          PopupMenuItem(value: 'delivered', child: Text('Delivered')),
          PopupMenuItem(value: 'cancelled', child: Text('Cancelled')),
          PopupMenuItem(value: 'refunded', child: Text('Refunded')),
        ],
        icon: const Icon(Icons.more_vert),
      );
    }
    if (_module == 'Reviews') {
      final approved = item['isApproved'] == true;
      return PopupMenuButton<String>(
        tooltip: 'Review actions',
        onSelected: (action) {
          if (action == 'approval') {
            _mutate(
              () => widget.api.patch('/api/admin/reviews/$id', {
                'approved': !approved,
              }),
            );
          } else if (action == 'delete') {
            _deleteRecord(item);
          }
        },
        itemBuilder: (context) => [
          PopupMenuItem(
            value: 'approval',
            child: Text(approved ? 'Reject review' : 'Approve review'),
          ),
          const PopupMenuItem(value: 'delete', child: Text('Delete review')),
        ],
        icon: Icon(
          approved ? Icons.check_circle_outline : Icons.more_vert,
          color: _navy,
        ),
      );
    }
    if (_module == 'CRM') {
      return PopupMenuButton<String>(
        tooltip: 'Update lead status',
        onSelected: (action) {
          if (action == 'notes') {
            _editCrmLead(item);
          } else {
            _mutate(
              () => widget.api.patch('/api/admin/crm/$id', {'status': action}),
            );
          }
        },
        itemBuilder: (context) => [
          const PopupMenuItem(value: 'notes', child: Text('Edit notes')),
          PopupMenuItem(value: 'new', child: Text('New')),
          PopupMenuItem(value: 'contacted', child: Text('Contacted')),
          PopupMenuItem(value: 'qualified', child: Text('Qualified')),
          PopupMenuItem(value: 'converted', child: Text('Converted')),
          PopupMenuItem(value: 'lost', child: Text('Lost')),
        ],
        icon: const Icon(Icons.more_vert),
      );
    }
    if (_module == 'Categories') {
      final visible = item['showInMenu'] == true;
      return PopupMenuButton<String>(
        tooltip: 'Category actions',
        onSelected: (action) {
          if (action == 'edit') {
            _editTaxonomyRecord(item);
          } else if (action == 'delete') {
            _deleteRecord(item);
          } else if (action == 'visibility') {
            _mutate(
              () => widget.api.patch('/api/admin/categories', {
                'ids': [id],
                'showInMenu': !visible,
              }),
            );
          }
        },
        itemBuilder: (context) => [
          const PopupMenuItem(value: 'edit', child: Text('Edit category')),
          PopupMenuItem(
            value: 'visibility',
            child: Text(
              visible ? 'Hide from store menu' : 'Show in store menu',
            ),
          ),
          const PopupMenuItem(value: 'delete', child: Text('Delete')),
        ],
        icon: const Icon(Icons.more_vert),
      );
    }
    if (_module == 'Customers') {
      return IconButton(
        tooltip: 'Edit customer',
        icon: const Icon(Icons.edit_outlined, color: _navy),
        onPressed: _busy ? null : () => _editCustomer(item),
      );
    }
    if (_module == 'System users' && _isOwner) {
      return PopupMenuButton<String>(
        tooltip: 'System user actions',
        onSelected: (action) {
          if (action == 'active') {
            _mutate(
              () => widget.api.patch('/api/admin/system-users/$id', {
                'isActive': item['isActive'] != true,
              }),
            );
          } else if (action == 'password') {
            _resetSystemPassword(id);
          }
        },
        itemBuilder: (context) => [
          PopupMenuItem(
            value: 'active',
            child: Text(item['isActive'] == true ? 'Deactivate' : 'Activate'),
          ),
          const PopupMenuItem(value: 'password', child: Text('Reset password')),
        ],
        icon: const Icon(Icons.more_vert),
      );
    }
    if (_module == 'Storefront content') {
      final section = _text(item, '_section');
      if (section == 'banners' || section == 'reviews') {
        return PopupMenuButton<String>(
          tooltip: 'Edit content',
          onSelected: (action) {
            if (action == 'edit') _editContentRecord(item, section);
            if (action == 'delete') _deleteContentRecord(item, section);
          },
          itemBuilder: (context) => const [
            PopupMenuItem(value: 'edit', child: Text('Edit')),
            PopupMenuItem(value: 'delete', child: Text('Delete')),
          ],
          icon: const Icon(Icons.more_vert),
        );
      }
    }
    if ([
      'Categories',
      'Brands',
      'Lens shades',
      'Lens types',
      'Reviews',
    ].contains(_module)) {
      return PopupMenuButton<String>(
        tooltip: 'Record actions',
        onSelected: (action) {
          if (action == 'edit') _editTaxonomyRecord(item);
          if (action == 'delete') _deleteRecord(item);
        },
        itemBuilder: (context) => const [
          PopupMenuItem(value: 'edit', child: Text('Edit')),
          PopupMenuItem(value: 'delete', child: Text('Delete')),
        ],
        icon: const Icon(Icons.more_vert),
      );
    }
    return null;
  }

  Future<void> _createRecord() async {
    if (_module == 'Products') {
      await _openProductEditor();
      return;
    }
    if (_module == 'Storefront content') {
      await _editContentRecord(const {}, 'banners');
      return;
    }
    if (_module == 'Reviews') {
      await _createProductReview();
      return;
    }
    final fields = switch (_module) {
      'Categories' => const ['name', 'slug'],
      'Brands' => const ['name'],
      'Lens shades' => const ['name', 'hex'],
      'Lens types' => const ['name'],
      'CRM' => const ['fullName', 'email', 'phone'],
      'System users' => const ['email', 'password', 'role'],
      _ => const <String>[],
    };
    if (fields.isEmpty) return;
    final controllers = {
      for (final field in fields) field: TextEditingController(),
    };
    final values = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Add ${_module.toLowerCase()} record'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final field in fields)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: field == 'role'
                      ? IskDropdownField<String>(
                          value: 'staff',
                          decoration: const InputDecoration(labelText: 'Role'),
                          items: const [
                            DropdownMenuItem(
                              value: 'staff',
                              child: Text('Staff'),
                            ),
                            DropdownMenuItem(
                              value: 'admin',
                              child: Text('Admin'),
                            ),
                          ],
                          onChanged: (value) {
                            controllers[field]!.text = value ?? 'staff';
                          },
                        )
                      : TextField(
                          controller: controllers[field],
                          obscureText: field == 'password',
                          keyboardType: field == 'email'
                              ? TextInputType.emailAddress
                              : field == 'phone'
                              ? TextInputType.phone
                              : TextInputType.text,
                          decoration: InputDecoration(
                            labelText: field == 'hex'
                                ? 'Color (for example #3399ff)'
                                : field,
                          ),
                        ),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, {
              for (final field in fields)
                field: controllers[field]!.text.trim(),
            }),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    for (final controller in controllers.values) {
      controller.dispose();
    }
    if (values == null || !mounted) return;
    final path = _modules[_module]!;
    final payload = Map<String, dynamic>.from(values);
    if (_module == 'System users') {
      payload['role'] = payload['role']!.isEmpty ? 'staff' : payload['role'];
    }
    await _mutate(() => widget.api.post(path, payload));
  }

  Future<void> _createProductReview() async {
    List<Map<String, dynamic>> products;
    try {
      final response = await widget.api.get('/api/admin/products');
      products = (response['data'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false);
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
      return;
    }
    if (!mounted || products.isEmpty) {
      if (mounted) {
        setState(() => _error = 'Create a product before its review.');
      }
      return;
    }
    final author = TextEditingController();
    final title = TextEditingController();
    final body = TextEditingController();
    String? productId = products.first['id']?.toString();
    var rating = 5;
    final values = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Add product review',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                IskDropdownField<String>(
                  value: productId,
                  decoration: const InputDecoration(labelText: 'Product'),
                  items: products
                      .map(
                        (product) => DropdownMenuItem(
                          value: product['id']?.toString(),
                          child: Text(
                            product['name']?.toString() ?? 'Product',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (value) => update(() => productId = value),
                ),
                TextField(
                  controller: author,
                  decoration: const InputDecoration(labelText: 'Reviewer'),
                ),
                TextField(
                  controller: title,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                TextField(
                  controller: body,
                  minLines: 3,
                  maxLines: 6,
                  decoration: const InputDecoration(labelText: 'Review'),
                ),
                IskDropdownField<int>(
                  value: rating,
                  decoration: const InputDecoration(labelText: 'Rating'),
                  items: [1, 2, 3, 4, 5]
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text('$value / 5'),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (value) => update(() => rating = value ?? rating),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => Navigator.pop(context, {
                    'productId': productId,
                    'author': author.text.trim(),
                    'title': title.text.trim(),
                    'body': body.text.trim(),
                    'rating': rating,
                    'isApproved': false,
                  }),
                  child: const Text('Save as pending'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    author.dispose();
    title.dispose();
    body.dispose();
    if (values == null || !mounted) return;
    await _mutate(() => widget.api.post('/api/admin/reviews', values));
  }

  Future<void> _editCustomer(Map<String, dynamic> item) async {
    final id = _text(item, 'id');
    if (id.isEmpty) return;
    final first = TextEditingController(text: _text(item, 'firstName'));
    final last = TextEditingController(text: _text(item, 'lastName'));
    final phone = TextEditingController(text: _text(item, 'phone'));
    var marketing = item['marketingOptIn'] == true;
    final values = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Edit customer',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              TextField(
                controller: first,
                decoration: const InputDecoration(labelText: 'First name'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: last,
                decoration: const InputDecoration(labelText: 'Last name'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone'),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Marketing emails'),
                value: marketing,
                onChanged: (value) => update(() => marketing = value),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, {
                  'firstName': first.text.trim(),
                  'lastName': last.text.trim(),
                  'phone': phone.text.trim(),
                  'marketingOptIn': marketing,
                }),
                child: const Text('Save customer'),
              ),
            ],
          ),
        ),
      ),
    );
    first.dispose();
    last.dispose();
    phone.dispose();
    if (values == null || !mounted) return;
    await _mutate(() => widget.api.patch('/api/admin/customers/$id', values));
  }

  Future<void> _resetSystemPassword(String id) async {
    final password = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reset password'),
        content: TextField(
          controller: password,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'New password',
            helperText: 'Use at least 12 characters.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (password.text.length >= 12) {
                Navigator.pop(context, password.text);
              }
            },
            child: const Text('Reset'),
          ),
        ],
      ),
    );
    password.dispose();
    if (value == null || !mounted) return;
    await _mutate(
      () => widget.api.patch('/api/admin/system-users/$id', {
        'newPassword': value,
      }),
    );
  }

  Future<void> _editCrmLead(Map<String, dynamic> item) async {
    final id = _text(item, 'id');
    if (id.isEmpty) return;
    final notes = TextEditingController(text: _text(item, 'notes'));
    final followUp = TextEditingController(
      text: _text(item, 'followUpAt').split('T').first,
    );
    final values = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Edit CRM follow-up',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            TextField(
              controller: notes,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(labelText: 'Notes'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: followUp,
              keyboardType: TextInputType.datetime,
              decoration: const InputDecoration(
                labelText: 'Follow-up date',
                hintText: 'YYYY-MM-DD or blank to clear',
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => Navigator.pop(context, {
                'notes': notes.text.trim(),
                'followUpAt': followUp.text.trim().isEmpty
                    ? null
                    : followUp.text.trim(),
              }),
              child: const Text('Save lead'),
            ),
          ],
        ),
      ),
    );
    notes.dispose();
    followUp.dispose();
    if (values == null || !mounted) return;
    await _mutate(() => widget.api.patch('/api/admin/crm/$id', values));
  }

  Future<void> _editContentRecord(
    Map<String, dynamic> item,
    String section,
  ) async {
    final isReview = section == 'reviews';
    const bannerPlacements = [
      'hero',
      'promo',
      'brand',
      'category',
      'service',
      'new_arrival',
      'feature',
      'why_choose',
    ];
    final fields = isReview
        ? const ['author', 'body', 'sortOrder']
        : const ['placement', 'title', 'body', 'imageUrl', 'href', 'sortOrder'];
    final controllers = {
      for (final field in fields)
        field: TextEditingController(
          text: _text(
            item,
            field,
            field == 'placement'
                ? 'hero'
                : field == 'sortOrder'
                ? '0'
                : '',
          ),
        ),
    };
    String? blobPathname = item['blobPathname']?.toString();
    String? uploadError;
    var uploading = false;
    var active = item['isActive'] != false;
    final values = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${item['id'] == null ? 'Add' : 'Edit'} ${isReview ? 'testimonial' : 'banner'}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                for (final field in fields)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: field == 'placement'
                        ? IskDropdownField<String>(
                            value:
                                bannerPlacements.contains(
                                  controllers[field]!.text,
                                )
                                ? controllers[field]!.text
                                : 'hero',
                            decoration: const InputDecoration(
                              labelText: 'Placement',
                            ),
                            items: bannerPlacements
                                .map(
                                  (placement) => DropdownMenuItem(
                                    value: placement,
                                    child: Text(placement.replaceAll('_', ' ')),
                                  ),
                                )
                                .toList(growable: false),
                            onChanged: (value) {
                              if (value != null) {
                                controllers[field]!.text = value;
                              }
                            },
                          )
                        : TextField(
                            controller: controllers[field],
                            keyboardType: field == 'sortOrder'
                                ? TextInputType.number
                                : TextInputType.text,
                            maxLines: field == 'body' ? 3 : 1,
                            decoration: InputDecoration(labelText: field),
                          ),
                  ),
                if (!isReview)
                  OutlinedButton.icon(
                    onPressed: uploading
                        ? null
                        : () async {
                            final file = await ImagePicker().pickImage(
                              source: ImageSource.gallery,
                            );
                            if (file == null || !context.mounted) return;
                            update(() {
                              uploading = true;
                              uploadError = null;
                            });
                            try {
                              final response = await widget.api.uploadFile(
                                '/api/admin/content/upload',
                                file,
                              );
                              final data = response['data'];
                              if (data is! Map ||
                                  data['url'] is! String ||
                                  data['pathname'] is! String) {
                                throw const StoreApiException(
                                  'The image upload response is invalid.',
                                );
                              }
                              update(() {
                                controllers['imageUrl']!.text =
                                    data['url'] as String;
                                blobPathname = data['pathname'] as String;
                              });
                            } on StoreApiException catch (error) {
                              update(() => uploadError = error.message);
                            } on PlatformException catch (error) {
                              update(
                                () => uploadError =
                                    error.message ?? 'Image upload failed.',
                              );
                            } finally {
                              update(() => uploading = false);
                            }
                          },
                    icon: uploading
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.photo_library_outlined),
                    label: const Text('Choose banner image'),
                  ),
                if (uploadError != null)
                  Text(uploadError!, style: const TextStyle(color: Colors.red)),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Visible in storefront'),
                  value: active,
                  onChanged: (value) => update(() => active = value),
                ),
                FilledButton(
                  onPressed: () {
                    final payload = <String, dynamic>{
                      for (final field in fields)
                        field: field == 'sortOrder'
                            ? int.tryParse(controllers[field]!.text) ?? 0
                            : controllers[field]!.text.trim(),
                      'isActive': active,
                      if (!isReview) 'blobPathname': blobPathname,
                      if (item['id'] != null) 'id': item['id'],
                    };
                    Navigator.pop(context, payload);
                  },
                  child: const Text('Save'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    for (final controller in controllers.values) {
      controller.dispose();
    }
    if (values == null || !mounted) return;
    final path = isReview
        ? '/api/admin/content/reviews'
        : '/api/admin/content/banners';
    await _mutate(() => widget.api.post(path, values));
  }

  Future<void> _editTaxonomyRecord(Map<String, dynamic> item) async {
    final id = _text(item, 'id');
    final fields = switch (_module) {
      'Categories' => const [
        'name',
        'slug',
        'parentId',
        'description',
        'imageUrl',
        'sortOrder',
        'seoTitle',
        'seoDescription',
      ],
      'Brands' => const ['name', 'logoUrl'],
      'Lens shades' => const ['name', 'hex'],
      'Lens types' => const ['name'],
      _ => const <String>[],
    };
    if (id.isEmpty || fields.isEmpty) return;
    final controllers = {
      for (final field in fields)
        field: TextEditingController(text: _text(item, field)),
    };
    var active = item['isActive'] != false;
    var showInMenu = item['showInMenu'] != false;
    final values = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Edit ${_module.toLowerCase()}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                for (final field in fields)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: TextField(
                      controller: controllers[field],
                      keyboardType: field == 'sortOrder'
                          ? TextInputType.number
                          : TextInputType.text,
                      maxLines:
                          const [
                            'description',
                            'seoDescription',
                          ].contains(field)
                          ? 3
                          : 1,
                      decoration: InputDecoration(labelText: field),
                    ),
                  ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Active'),
                  value: active,
                  onChanged: (value) => update(() => active = value),
                ),
                if (_module == 'Categories')
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Show in store menu'),
                    value: showInMenu,
                    onChanged: (value) => update(() => showInMenu = value),
                  ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, {
                    for (final field in fields)
                      field: field == 'sortOrder'
                          ? int.tryParse(controllers[field]!.text) ?? 0
                          : controllers[field]!.text.trim(),
                    'isActive': active,
                    if (_module == 'Categories') 'showInMenu': showInMenu,
                  }),
                  child: const Text('Save'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    for (final controller in controllers.values) {
      controller.dispose();
    }
    if (values == null || !mounted) return;
    final path = switch (_module) {
      'Categories' => '/api/admin/categories/$id',
      'Brands' => '/api/admin/brands/$id',
      'Lens shades' => '/api/admin/lens-shades/$id',
      'Lens types' => '/api/admin/lens-types/$id',
      _ => '',
    };
    await _mutate(() => widget.api.put(path, values));
  }

  Future<void> _deleteContentRecord(
    Map<String, dynamic> item,
    String section,
  ) async {
    final id = _text(item, 'id');
    if (id.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete storefront content?'),
        content: Text(_recordTitle(item)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final route = section == 'reviews' ? 'reviews' : 'banners';
    await _mutate(() => widget.api.delete('/api/admin/content/$route/$id'));
  }

  Future<void> _editSettingsJson({
    required String title,
    required String endpoint,
    required dynamic initialValue,
    required String help,
    bool wrapValue = true,
  }) async {
    final controller = TextEditingController(
      text: const JsonEncoder.withIndent('  ').convert(initialValue),
    );
    String? parseError;
    final value = await showDialog<Object?>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: Text(title),
          content: SizedBox(
            width: 560,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(help),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    minLines: 5,
                    maxLines: 14,
                    decoration: InputDecoration(
                      labelText: 'JSON value',
                      errorText: parseError,
                      alignLabelWithHint: true,
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                try {
                  Navigator.pop(context, jsonDecode(controller.text));
                } on FormatException {
                  update(() => parseError = 'Enter valid JSON.');
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (value == null || !mounted) return;
    final payload = wrapValue ? {'value': value} : value;
    if (payload is! Map) {
      setState(() => _error = 'Settings must be a JSON object.');
      return;
    }
    await _mutate(
      () => widget.api.put(endpoint, Map<String, dynamic>.from(payload)),
    );
  }

  Future<void> _editDelivery() async {
    Map<String, dynamic> data;
    try {
      final response = await widget.api.get('/api/admin/delivery-settings');
      final value = response['data'];
      if (value is! Map) {
        throw const StoreApiException('Delivery settings are invalid.');
      }
      data = Map<String, dynamic>.from(value);
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
      return;
    }
    if (!mounted) return;
    final fee = TextEditingController(text: data['deliveryFee']?.toString());
    final threshold = TextEditingController(
      text: data['freeShippingThreshold']?.toString(),
    );
    final values = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delivery pricing'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: fee,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'Delivery fee'),
            ),
            TextField(
              controller: threshold,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Free delivery threshold',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, {
              'deliveryFee': fee.text.trim(),
              'freeShippingThreshold': threshold.text.trim(),
            }),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    fee.dispose();
    threshold.dispose();
    if (values == null || !mounted) return;
    await _mutate(() => widget.api.put('/api/admin/delivery-settings', values));
  }

  Future<void> _openSettingsEditor() async {
    if (_module == 'Delivery') {
      await _editDelivery();
      return;
    }
    if (_module == 'Product page') {
      try {
        final response = await widget.api.get(
          '/api/admin/product-page-settings',
        );
        if (!mounted || response['data'] == null) return;
        await _editSettingsJson(
          title: 'Product-page settings',
          endpoint: '/api/admin/product-page-settings',
          initialValue: response['data'],
          wrapValue: false,
          help:
              'Edit the sections and review controls as JSON. The server validates supported section sources and limits.',
        );
      } on StoreApiException catch (error) {
        if (mounted) setState(() => _error = error.message);
      }
      return;
    }
    if (_module == 'Chatbot') {
      await _editChatbotSettings();
      return;
    }
    if (_module == 'Storefront content') {
      try {
        final response = await widget.api.get('/api/admin/content');
        final data = response['data'];
        if (data is! Map || !mounted) return;
        final settings = data['settings'];
        if (settings is! Map) return;
        final key = await showModalBottomSheet<String>(
          context: context,
          builder: (context) => SafeArea(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final entry in settings.entries)
                  ListTile(
                    title: Text(entry.key.toString()),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.pop(context, entry.key.toString()),
                  ),
              ],
            ),
          ),
        );
        if (key == null || !mounted) return;
        await _editSettingsJson(
          title: 'Edit $key',
          endpoint: '/api/admin/content/settings/${Uri.encodeComponent(key)}',
          initialValue: settings[key],
          help:
              'Edit this storefront setting as JSON. The server accepts only known settings and validates their shape.',
        );
      } on StoreApiException catch (error) {
        if (mounted) setState(() => _error = error.message);
      }
    }
  }

  Future<void> _editChatbotSettings() async {
    try {
      final response = await widget.api.get('/api/chatbot/settings');
      final data = response['data'];
      if (data is! Map || !mounted) return;
      final welcome = TextEditingController(
        text: data['welcomeMessage']?.toString() ?? '',
      );
      var enabled = data['enabled'] == true;
      final values = await showDialog<Map<String, dynamic>>(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, update) => AlertDialog(
            title: const Text('Store assistant settings'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Enable store assistant'),
                  value: enabled,
                  onChanged: (value) => update(() => enabled = value),
                ),
                TextField(
                  controller: welcome,
                  maxLength: 180,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Welcome message',
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, {
                  'enabled': enabled,
                  'welcomeMessage': welcome.text.trim(),
                }),
                child: const Text('Save'),
              ),
            ],
          ),
        ),
      );
      welcome.dispose();
      if (values == null || !mounted) return;
      await _mutate(() => widget.api.put('/api/chatbot/settings', values));
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin workspace'),
        actions: [
          if (session != null && _isOwner)
            IconButton(
              tooltip: 'Edit administrator profile',
              onPressed: _busy ? null : _editProfile,
              icon: const Icon(Icons.manage_accounts_outlined),
            ),
          if (session != null)
            IconButton(
              tooltip: 'Sign out',
              onPressed: _busy ? null : _signOut,
              icon: const Icon(Icons.logout),
            ),
        ],
      ),
      body: _loading && session == null
          ? const Center(child: CircularProgressIndicator())
          : session == null
          ? ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Icon(
                  Icons.admin_panel_settings_outlined,
                  size: 52,
                  color: _navy,
                ),
                const SizedBox(height: 12),
                Text(
                  'Admin sign in',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: _navy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Use your existing store administrator account. Access is checked by the server.',
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: true,
                  onSubmitted: (_) => _signIn(),
                  decoration: const InputDecoration(labelText: 'Password'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _busy ? null : _signIn,
                  child: _busy
                      ? const CircularProgressIndicator()
                      : const Text('Sign in securely'),
                ),
              ],
            )
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session.email,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        '${session.role.toUpperCase()} access',
                        style: const TextStyle(
                          color: _navy,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: IskDropdownField<String>(
                              value: _module,
                              decoration: const InputDecoration(
                                labelText: 'Admin area',
                              ),
                              items: _modules.keys
                                  .where(
                                    (name) =>
                                        name != 'System users' || _isOwner,
                                  )
                                  .map(
                                    (name) => DropdownMenuItem(
                                      value: name,
                                      child: Text(name),
                                    ),
                                  )
                                  .toList(),
                              onChanged: _busy
                                  ? null
                                  : (value) {
                                      if (value == null) return;
                                      setState(() {
                                        _module = value;
                                        _records = [];
                                      });
                                      _loadModule();
                                    },
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filledTonal(
                            tooltip: 'Refresh',
                            onPressed: _busy ? null : _loadModule,
                            icon: const Icon(Icons.refresh),
                          ),
                          if ([
                            'Delivery',
                            'Product page',
                            'Storefront content',
                            'Chatbot',
                          ].contains(_module))
                            IconButton.filledTonal(
                              tooltip: 'Edit settings',
                              onPressed: _busy || !_canManage
                                  ? null
                                  : _openSettingsEditor,
                              icon: const Icon(Icons.tune),
                            ),
                          if (_module == 'Storefront content')
                            IconButton.filledTonal(
                              tooltip: 'Add testimonial',
                              onPressed: _busy || !_canManage
                                  ? null
                                  : () =>
                                        _editContentRecord(const {}, 'reviews'),
                              icon: const Icon(Icons.rate_review_outlined),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (_error != null)
                  MaterialBanner(
                    content: Text(_error!),
                    leading: const Icon(Icons.error_outline, color: Colors.red),
                    actions: [
                      TextButton(
                        onPressed: _loadModule,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                Expanded(
                  child: _loading
                      ? const Center(child: CircularProgressIndicator())
                      : _records.isEmpty
                      ? const Center(child: Text('No records to show.'))
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                          itemCount: _records.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 4),
                          itemBuilder: (context, index) {
                            final item = _records[index];
                            final subtitle = _recordSubtitle(item);
                            return Card(
                              color: Colors.white,
                              child: ListTile(
                                title: Text(
                                  _recordTitle(item),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                subtitle: subtitle.isEmpty
                                    ? null
                                    : Text(
                                        subtitle,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                trailing: _recordAction(item),
                                onTap: _module == 'Products' && _canManage
                                    ? () =>
                                          _openProductEditor(_text(item, 'id'))
                                    : null,
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
      floatingActionButton:
          session != null &&
              _canManage &&
              [
                'Products',
                'Categories',
                'Brands',
                'Lens shades',
                'Lens types',
                'Reviews',
                'CRM',
                'System users',
                'Storefront content',
              ].contains(_module) &&
              (_module != 'System users' || _isOwner)
          ? FloatingActionButton.extended(
              onPressed: _busy ? null : _createRecord,
              icon: const Icon(Icons.add),
              label: Text(
                _module == 'Products'
                    ? 'Add product'
                    : _module == 'Storefront content'
                    ? 'Add banner'
                    : 'Add',
              ),
            )
          : null,
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 42, color: _navy),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.bold = false,
  });

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: style),
        Text(value, style: style),
      ],
    );
  }
}

String _money(String value, String currency) {
  final amount = double.tryParse(value);
  if (amount == null) return '$currency $value';
  return '$currency ${amount.toStringAsFixed(amount == amount.roundToDouble() ? 0 : 2)}';
}

String _amount(int cents) =>
    '${cents ~/ 100}.${(cents % 100).toString().padLeft(2, '0')}';

int? _cents(String value) {
  final amount = double.tryParse(value);
  if (amount == null || !amount.isFinite || amount < 0) return null;
  return (amount * 100).round();
}

int _cartSubtotal(List<CartLine> lines) {
  return lines.fold<int>(0, (total, line) {
    final unitCents = _cents(line.price) ?? 0;
    return total + unitCents * line.quantity;
  });
}
