import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

const _sessionCookieName = 'isk-lenses-customer-session';
const _sessionCookieStorageKey = 'customer-session-cookie';
const _adminSessionCookieName = 'isk-lenses-admin-session';
const _adminSessionCookieStorageKey = 'admin-session-cookie';
const _uuid = Uuid();

Map<String, dynamic> _asMap(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

List<Map<String, dynamic>> _asList(Object? value) => value is List
    ? value.whereType<Map>().map(Map<String, dynamic>.from).toList()
    : <Map<String, dynamic>>[];

int _asInt(Object? value) => value is num ? value.toInt() : 0;

class StoreApiException implements Exception {
  const StoreApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class StoreApi {
  StoreApi({String? apiOrigin})
    : _storage = const FlutterSecureStorage(),
      _dio = Dio(
        BaseOptions(
          baseUrl: _normalizeOrigin(
            apiOrigin ??
                const String.fromEnvironment(
                  'ISK_API_ORIGIN',
                  defaultValue: 'https://www.isklenses.online',
                ),
          ),
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
          sendTimeout: const Duration(seconds: 20),
          headers: const {'Accept': 'application/json'},
        ),
      ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final cookie = await _storage.read(key: _sessionCookieStorageKey);
          if (cookie != null && cookie.isNotEmpty) {
            options.headers['Cookie'] = cookie;
          }
          handler.next(options);
        },
        onResponse: (response, handler) async {
          await _storeSessionCookie(response.headers);
          handler.next(response);
        },
      ),
    );
  }

  final Dio _dio;
  final FlutterSecureStorage _storage;

  String assetUrl(String path) => Uri.parse(
    _dio.options.baseUrl,
  ).resolve(path.startsWith('/') ? path.substring(1) : path).toString();

  static String _normalizeOrigin(String value) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null ||
        !uri.hasAuthority ||
        (uri.scheme != 'https' && uri.scheme != 'http') ||
        uri.path.isNotEmpty && uri.path != '/' ||
        uri.query.isNotEmpty ||
        uri.fragment.isNotEmpty) {
      throw ArgumentError.value(
        value,
        'ISK_API_ORIGIN',
        'Use an HTTP site origin without a path.',
      );
    }
    return uri.origin;
  }

  Future<void> _storeSessionCookie(Headers headers) async {
    final values = headers.map['set-cookie'];
    if (values == null) return;
    for (final value in values) {
      final cookie = value.split(';').first.trim();
      if (!cookie.startsWith('$_sessionCookieName=')) continue;
      if (cookie == '$_sessionCookieName=') {
        await clearSessionCookie();
      } else {
        await _storage.write(key: _sessionCookieStorageKey, value: cookie);
      }
    }
  }

  Future<void> clearSessionCookie() =>
      _storage.delete(key: _sessionCookieStorageKey);

  Future<Map<String, dynamic>> _getObject(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.get<Object?>(path, queryParameters: query);
      final body = response.data;
      if (body is! Map) {
        throw StoreApiException(
          body == null
              ? 'The store returned an empty response.'
              : 'The store returned an invalid response.',
          statusCode: response.statusCode,
        );
      }
      return Map<String, dynamic>.from(body);
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  Future<Map<String, dynamic>> _postObject(String path, Object body) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        path,
        data: body,
        options: Options(contentType: Headers.jsonContentType),
      );
      final responseBody = response.data;
      if (responseBody == null) {
        throw const StoreApiException('The store returned an empty response.');
      }
      return responseBody;
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  StoreApiException _toApiException(DioException error) {
    final body = error.response?.data;
    final message = body is Map && body['error'] is String
        ? body['error'] as String
        : switch (error.type) {
            DioExceptionType.connectionTimeout ||
            DioExceptionType.receiveTimeout ||
            DioExceptionType.sendTimeout =>
              'The store took too long to respond. Please try again.',
            DioExceptionType.connectionError =>
              'Could not connect to the store. Check your connection and try again.',
            _ => 'The request could not be completed. Please try again.',
          };
    return StoreApiException(message, statusCode: error.response?.statusCode);
  }

  Future<ProductPage> getProducts({
    int page = 1,
    String query = '',
    String? category,
    String? brand,
    String? shadeId,
    String? lensTypeId,
    String sort = 'newest',
  }) async {
    final body = await _getObject(
      '/api/products',
      query: {
        'page': page,
        'limit': 24,
        if (query.trim().isNotEmpty) 'q': query.trim(),
        if (category != null) 'category': category,
        if (brand != null) 'brand': brand,
        if (shadeId != null) 'shadeId': shadeId,
        if (lensTypeId != null) 'lensTypeId': lensTypeId,
        'sort': sort,
      },
    );
    final values = body['data'];
    if (values is! List) {
      throw const StoreApiException('The product response is invalid.');
    }
    final pagination = body['pagination'];
    final totalPages = pagination is Map && pagination['totalPages'] is num
        ? (pagination['totalPages'] as num).toInt()
        : page;
    return ProductPage(
      products: values
          .whereType<Map>()
          .map(
            (value) =>
                StoreProduct.fromJson(value, Uri.parse(_dio.options.baseUrl)),
          )
          .toList(growable: false),
      page: page,
      totalPages: totalPages,
    );
  }

  Future<({List<StoreProduct> items, bool hasMore})> getHomeProducts(
    String tab,
    int page,
  ) async {
    final body = await _getObject(
      '/api/storefront/home/products',
      query: {'tab': tab, 'page': page},
    );
    final data = body['data'];
    if (data is! Map || data['items'] is! List) {
      throw const StoreApiException('The home products response is invalid.');
    }
    final base = Uri.parse(_dio.options.baseUrl);
    return (
      items: (data['items'] as List)
          .whereType<Map>()
          .map((value) => StoreProduct.fromJson(value, base))
          .toList(growable: false),
      hasMore: data['hasMore'] == true,
    );
  }

  Future<StoreHomeData> getHomeData() async {
    final body = await _getObject('/api/storefront/home');
    final data = body['data'];
    if (data is! Map) {
      throw const StoreApiException('The storefront home response is invalid.');
    }
    return StoreHomeData.fromJson(
      Map<String, dynamic>.from(data),
      Uri.parse(_dio.options.baseUrl),
    );
  }

  Future<StoreProduct> getProduct(String slug) async {
    final body = await _getObject('/api/products/${Uri.encodeComponent(slug)}');
    final value = body['data'];
    if (value is! Map) {
      throw const StoreApiException('The product response is invalid.');
    }
    return StoreProduct.fromJson(
      Map<String, dynamic>.from(value),
      Uri.parse(_dio.options.baseUrl),
    );
  }

  Future<ShopperSession?> getSession() async {
    final body = await _getObject('/api/storefront/session');
    final customer = body['customer'];
    if (customer is! Map || customer['email'] is! String) {
      await clearSessionCookie();
      return null;
    }
    return ShopperSession(email: customer['email'] as String);
  }

  Future<ShopperSession> authenticate({
    required String action,
    required String email,
    required String password,
  }) async {
    final body = await _postObject('/api/storefront/session', {
      'action': action,
      'email': email.trim(),
      'password': password,
    });
    final customer = body['customer'];
    if (customer is! Map || customer['email'] is! String) {
      throw const StoreApiException('The account response is invalid.');
    }
    return ShopperSession(email: customer['email'] as String);
  }

  Future<void> logout() async {
    await _postObject('/api/storefront/session', {'action': 'logout'});
    await clearSessionCookie();
  }

  Future<List<ShopperOrder>> getOrders() async {
    final body = await _getObject('/api/storefront/orders');
    final values = body['data'];
    if (values is! List) {
      throw const StoreApiException('The order response is invalid.');
    }
    return values
        .whereType<Map>()
        .map(ShopperOrder.fromJson)
        .toList(growable: false);
  }

  Future<List<DeliveryRule>> getDeliveryRules() async {
    final body = await _getObject('/api/delivery-rules');
    final values = body['data'];
    if (values is! List) {
      throw const StoreApiException('Delivery pricing is unavailable.');
    }
    return values
        .whereType<Map>()
        .map(DeliveryRule.fromJson)
        .toList(growable: false);
  }

  Future<String> placeOrder({
    required String checkoutKey,
    required String email,
    required List<CartLine> items,
    required Map<String, String> shippingAddress,
    required String deliveryFee,
  }) async {
    final body = await _postObject('/api/orders', {
      'checkoutKey': checkoutKey,
      'email': email.trim(),
      'shippingAddress': shippingAddress,
      'quotedDeliveryFee': deliveryFee,
      'items': items
          .map(
            (line) => {
              'productId': line.product.id,
              'variantId': line.variant?.id,
              'leftPowerRange': line.leftPowerRange,
              'rightPowerRange': line.rightPowerRange,
              'quantity': line.quantity,
              'quotedUnitPrice': line.price,
              'quotedCurrency': line.currency,
            },
          )
          .toList(growable: false),
    });
    if (body['orderNumber'] == null) {
      throw const StoreApiException('The order confirmation was incomplete.');
    }
    return body['orderNumber'].toString();
  }

  Future<String> askChatbot(String message) async {
    final body = await _postObject('/api/chatbot', {'message': message.trim()});
    final data = body['data'];
    if (data is! Map || data['answer'] is! String) {
      throw const StoreApiException(
        'The assistant returned an invalid response.',
      );
    }
    return data['answer'] as String;
  }

  static String newCheckoutKey() => _uuid.v4();
}

class AdminSession {
  const AdminSession({required this.email, required this.role});

  final String email;
  final String role;

  factory AdminSession.fromJson(Map value) => AdminSession(
    email: value['email']?.toString() ?? '',
    role: value['role']?.toString() ?? 'staff',
  );
}

class AdminApi {
  AdminApi({String? apiOrigin})
    : _storage = const FlutterSecureStorage(),
      _dio = Dio(
        BaseOptions(
          baseUrl: StoreApi._normalizeOrigin(
            apiOrigin ??
                const String.fromEnvironment(
                  'ISK_API_ORIGIN',
                  defaultValue: 'https://www.isklenses.online',
                ),
          ),
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
          sendTimeout: const Duration(seconds: 20),
          headers: const {'Accept': 'application/json'},
        ),
      ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final cookie = await _storage.read(
            key: _adminSessionCookieStorageKey,
          );
          if (cookie != null && cookie.isNotEmpty) {
            options.headers['Cookie'] = cookie;
          }
          handler.next(options);
        },
        onResponse: (response, handler) async {
          await _storeSessionCookie(response.headers);
          handler.next(response);
        },
      ),
    );
  }

  final Dio _dio;
  final FlutterSecureStorage _storage;

  Future<void> _storeSessionCookie(Headers headers) async {
    final values = headers.map['set-cookie'];
    if (values == null) return;
    for (final value in values) {
      final cookie = value.split(';').first.trim();
      if (!cookie.startsWith('$_adminSessionCookieName=')) continue;
      if (cookie == '$_adminSessionCookieName=') {
        await clearSessionCookie();
      } else {
        await _storage.write(key: _adminSessionCookieStorageKey, value: cookie);
      }
    }
  }

  Future<void> clearSessionCookie() =>
      _storage.delete(key: _adminSessionCookieStorageKey);

  StoreApiException _toApiException(DioException error) {
    final body = error.response?.data;
    final message = body is Map && body['error'] is String
        ? body['error'] as String
        : switch (error.type) {
            DioExceptionType.connectionTimeout ||
            DioExceptionType.receiveTimeout ||
            DioExceptionType.sendTimeout =>
              'The store took too long to respond. Please try again.',
            DioExceptionType.connectionError =>
              'Could not connect to the store. Check your connection and try again.',
            _ => 'The admin request could not be completed. Please try again.',
          };
    return StoreApiException(message, statusCode: error.response?.statusCode);
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Object? data,
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.request<dynamic>(
        path,
        data: data,
        queryParameters: query,
        options: Options(
          method: method,
          contentType: data == null ? null : Headers.jsonContentType,
        ),
      );
      return response.data;
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final body = await _request('GET', path, query: query);
    if (body is! Map<String, dynamic>) {
      throw const StoreApiException('The admin response is invalid.');
    }
    return body;
  }

  Future<Map<String, dynamic>> post(String path, Object body) async {
    final value = await _request('POST', path, data: body);
    if (value is! Map<String, dynamic>) {
      throw const StoreApiException('The admin response is invalid.');
    }
    return value;
  }

  Future<Map<String, dynamic>> uploadFile(
    String path,
    XFile file, {
    String? altText,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        path,
        data: FormData.fromMap({
          'file': await MultipartFile.fromFile(file.path, filename: file.name),
          if (altText != null) 'altText': altText,
        }),
        options: Options(contentType: Headers.multipartFormDataContentType),
      );
      final body = response.data;
      if (body == null) {
        throw const StoreApiException('The upload response is invalid.');
      }
      return body;
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  Future<Map<String, dynamic>> put(String path, Object body) async {
    final value = await _request('PUT', path, data: body);
    if (value is! Map<String, dynamic>) {
      throw const StoreApiException('The admin response is invalid.');
    }
    return value;
  }

  Future<Map<String, dynamic>> patch(String path, Object body) async {
    final value = await _request('PATCH', path, data: body);
    if (value is! Map<String, dynamic>) {
      throw const StoreApiException('The admin response is invalid.');
    }
    return value;
  }

  Future<void> delete(String path) async {
    await _request('DELETE', path);
  }

  Future<AdminSession?> getSession() async {
    final body = await get('/api/admin/session');
    if (body['authenticated'] != true ||
        body['email'] is! String ||
        body['role'] is! String) {
      await clearSessionCookie();
      return null;
    }
    return AdminSession.fromJson(body);
  }

  Future<AdminSession> signIn({
    required String email,
    required String password,
  }) async {
    final body = await post('/api/admin/session', {
      'email': email.trim(),
      'password': password,
    });
    if (body['authenticated'] != true ||
        body['email'] is! String ||
        body['role'] is! String) {
      throw const StoreApiException('The admin sign-in response is invalid.');
    }
    return AdminSession.fromJson(body);
  }

  Future<void> signOut() async {
    await _request('DELETE', '/api/admin/session');
    await clearSessionCookie();
  }
}

class ProductPage {
  const ProductPage({
    required this.products,
    required this.page,
    required this.totalPages,
  });

  final List<StoreProduct> products;
  final int page;
  final int totalPages;
}

class StoreHomeData {
  const StoreHomeData({
    required this.banners,
    required this.products,
    required this.categories,
    required this.brands,
    required this.shades,
    required this.lensTypes,
    required this.reviews,
    required this.chrome,
    required this.headings,
    required this.appearance,
    required this.configuration,
    required this.origin,
  });

  final List<StoreBanner> banners;
  final List<StoreProduct> products;
  final List<StoreCategory> categories;
  final List<StoreBrand> brands;
  final List<StoreShade> shades;
  final List<StoreLensType> lensTypes;
  final List<StoreReview> reviews;
  final StoreChrome chrome;
  final Map<String, dynamic> headings;
  final Map<String, dynamic> appearance;
  final Map<String, dynamic> configuration;
  final String origin;

  factory StoreHomeData.fromJson(Map<String, dynamic> value, Uri origin) {
    final content = _asMap(value['content']);
    return StoreHomeData(
      banners: _asList(content['banners'])
          .map((item) => StoreBanner.fromJson(item, origin))
          .toList(growable: false),
      products: _asList(value['products'])
          .map((item) => StoreProduct.fromJson(item, origin))
          .toList(growable: false),
      categories: _asList(value['categories'])
          .map((item) => StoreCategory.fromJson(item, origin))
          .toList(growable: false),
      brands: _asList(value['brands'])
          .map((item) => StoreBrand.fromJson(item, origin))
          .toList(growable: false),
      shades: _asList(value['shades'])
          .map((item) => StoreShade.fromJson(item, origin))
          .toList(growable: false),
      lensTypes: _asList(value['lensTypes'])
          .map((item) => StoreLensType.fromJson(item, origin))
          .toList(growable: false),
      reviews: _asList(
        value['reviews'],
      ).map(StoreReview.fromJson).toList(growable: false),
      chrome: StoreChrome.fromJson(_asMap(value['chrome'])),
      headings: _asMap(content['headings']),
      appearance: _asMap(content['appearance']),
      configuration: _asMap(content['configuration']),
      origin: origin.origin,
    );
  }
}

class StoreBanner {
  const StoreBanner({
    required this.id,
    required this.placement,
    required this.title,
    required this.body,
    required this.imageUrl,
    required this.href,
  });

  final String id;
  final String placement;
  final String title;
  final String? body;
  final String imageUrl;
  final String? href;

  factory StoreBanner.fromJson(Map value, Uri origin) => StoreBanner(
    id: value['id']?.toString() ?? '',
    placement: value['placement']?.toString() ?? 'hero',
    title: value['title']?.toString() ?? '',
    body: value['body']?.toString(),
    imageUrl:
        StoreProduct.mediaUrl(value['imageUrl']?.toString(), origin) ?? '',
    href: value['href']?.toString(),
  );
}

class StoreCategory {
  const StoreCategory({
    required this.id,
    required this.name,
    required this.slug,
    required this.path,
    required this.imageUrl,
    required this.productCount,
    required this.isActive,
    required this.showInMenu,
  });

  final String id;
  final String name;
  final String slug;
  final String path;
  final String? imageUrl;
  final int productCount;
  final bool isActive;
  final bool showInMenu;

  factory StoreCategory.fromJson(Map value, Uri origin) => StoreCategory(
    id: value['id']?.toString() ?? '',
    name: value['name']?.toString() ?? '',
    slug: value['slug']?.toString() ?? '',
    path: value['path']?.toString() ?? value['slug']?.toString() ?? '',
    imageUrl: StoreProduct.mediaUrl(
      value['imageUrl']?.toString() ?? value['fallbackImageUrl']?.toString(),
      origin,
    ),
    productCount: _asInt(value['productCount']),
    isActive: value['isActive'] != false,
    showInMenu: value['showInMenu'] != false,
  );
}

class StoreBrand {
  const StoreBrand({
    required this.id,
    required this.name,
    required this.slug,
    required this.imageUrl,
    required this.productCount,
  });

  final String id;
  final String name;
  final String slug;
  final String? imageUrl;
  final int productCount;

  factory StoreBrand.fromJson(Map value, Uri origin) => StoreBrand(
    id: value['id']?.toString() ?? '',
    name: value['name']?.toString() ?? '',
    slug: value['slug']?.toString() ?? '',
    imageUrl: StoreProduct.mediaUrl(
      value['logoUrl']?.toString() ?? value['fallbackImageUrl']?.toString(),
      origin,
    ),
    productCount: _asInt(value['productCount']),
  );
}

class StoreShade {
  const StoreShade({
    required this.id,
    required this.name,
    required this.hex,
    required this.imageUrl,
    required this.productCount,
  });

  final String id;
  final String name;
  final String? hex;
  final String? imageUrl;
  final int productCount;

  factory StoreShade.fromJson(Map value, Uri origin) => StoreShade(
    id: value['id']?.toString() ?? '',
    name: value['name']?.toString() ?? '',
    hex: value['hex']?.toString(),
    imageUrl: StoreProduct.mediaUrl(
      value['imageUrl']?.toString() ?? value['fallbackImageUrl']?.toString(),
      origin,
    ),
    productCount: _asInt(value['productCount']),
  );
}

class StoreLensType {
  const StoreLensType({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.productCount,
  });

  final String id;
  final String name;
  final String? imageUrl;
  final int productCount;

  factory StoreLensType.fromJson(Map value, Uri origin) => StoreLensType(
    id: value['id']?.toString() ?? '',
    name: value['name']?.toString() ?? '',
    imageUrl: StoreProduct.mediaUrl(
      value['fallbackImageUrl']?.toString(),
      origin,
    ),
    productCount: _asInt(value['productCount']),
  );
}

class StoreReview {
  const StoreReview({
    required this.author,
    required this.title,
    required this.body,
    required this.rating,
  });

  final String author;
  final String? title;
  final String body;
  final int rating;

  factory StoreReview.fromJson(Map value) => StoreReview(
    author: value['author']?.toString() ?? 'Customer',
    title: value['title']?.toString(),
    body: value['body']?.toString() ?? '',
    rating: _asInt(value['rating']),
  );
}

class StoreChrome {
  const StoreChrome({required this.contact, required this.footer});

  final Map<String, dynamic> contact;
  final Map<String, dynamic> footer;

  factory StoreChrome.fromJson(Map value) => StoreChrome(
    contact: _asMap(value['contact']),
    footer: _asMap(value['footer']),
  );
}

class StoreBrowseFilter {
  const StoreBrowseFilter({
    this.query = '',
    this.category,
    this.brand,
    this.shadeId,
    this.lensTypeId,
    this.sort = 'newest',
  });

  final String query;
  final String? category;
  final String? brand;
  final String? shadeId;
  final String? lensTypeId;
  final String sort;
}

class StoreProduct {
  const StoreProduct({
    required this.id,
    required this.name,
    required this.slug,
    required this.price,
    required this.currency,
    required this.stockQuantity,
    required this.imageUrl,
    required this.images,
    required this.availablePowerRanges,
    required this.availablePowerOptions,
    required this.variants,
    required this.description,
    required this.brand,
    required this.category,
    required this.shade,
    required this.lensType,
    required this.compareAtPrice,
    required this.diameterMm,
    required this.baseCurve,
    required this.waterContent,
    required this.material,
    required this.wearDuration,
    required this.packContents,
    required this.powerRange,
    required this.features,
    required this.specs,
    required this.isFeatured,
    required this.isNewArrival,
    required this.isOnSale,
    required this.ratingAvg,
    required this.ratingCount,
  });

  final String id;
  final String name;
  final String slug;
  final String price;
  final String currency;
  final int stockQuantity;
  final String? imageUrl;
  final List<String> images;
  final List<String> availablePowerRanges;
  final List<PowerLensOption> availablePowerOptions;
  final List<ProductVariant> variants;
  final String? description;
  final String? brand;
  final String? category;
  final Map<String, dynamic>? shade;
  final Map<String, dynamic>? lensType;
  final String? compareAtPrice;
  final String? diameterMm;
  final String? baseCurve;
  final String? waterContent;
  final String? material;
  final String? wearDuration;
  final String? packContents;
  final String? powerRange;
  final List<String> features;
  final List<Map<String, dynamic>> specs;
  final bool isFeatured;
  final bool isNewArrival;
  final bool isOnSale;
  final double? ratingAvg;
  final int ratingCount;

  factory StoreProduct.fromJson(Map value, Uri apiOrigin) {
    final ranges = value['availablePowerRanges'];
    final powerOptions = value['availablePowerOptions'];
    final variants = value['variants'];
    final assets = _asList(value['assets']);
    final imageUrls = assets
        .where((asset) => asset['mediaType'] != 'video')
        .map(
          (asset) =>
              StoreProduct.mediaUrl(asset['blobUrl']?.toString(), apiOrigin),
        )
        .whereType<String>()
        .toList(growable: false);
    final hero = StoreProduct.mediaUrl(
      value['heroImageUrl']?.toString(),
      apiOrigin,
    );
    final shade = value['lensShade'];
    final lensType = value['lensType'];
    final specs = _asList(value['specs']);
    final features = value['features'];
    final avgRating = value['ratingAvg'];
    return StoreProduct(
      id: value['id']?.toString() ?? '',
      name: value['name']?.toString() ?? 'Contact lenses',
      slug: value['slug']?.toString() ?? '',
      price: value['price']?.toString() ?? '0',
      currency: value['currency']?.toString() ?? 'PKR',
      stockQuantity: value['stockQuantity'] is num
          ? (value['stockQuantity'] as num).toInt()
          : 0,
      imageUrl: hero ?? (imageUrls.isEmpty ? null : imageUrls.first),
      images: [
        if (hero != null) hero,
        ...imageUrls.where((image) => image != hero),
      ],
      availablePowerRanges: ranges is List
          ? ranges.whereType<String>().toList(growable: false)
          : const [],
      availablePowerOptions: powerOptions is List
          ? powerOptions
                .whereType<Map>()
                .map(PowerLensOption.fromJson)
                .toList(growable: false)
          : const [],
      variants: variants is List
          ? variants
                .whereType<Map>()
                .map(ProductVariant.fromJson)
                .toList(growable: false)
          : const [],
      description: value['description']?.toString(),
      brand: value['brand']?.toString(),
      category: value['category']?.toString(),
      shade: shade is Map ? Map<String, dynamic>.from(shade) : null,
      lensType: lensType is Map ? Map<String, dynamic>.from(lensType) : null,
      compareAtPrice: value['compareAtPrice']?.toString(),
      diameterMm: value['diameterMm']?.toString(),
      baseCurve: value['baseCurve']?.toString(),
      waterContent: value['waterContent']?.toString(),
      material: value['material']?.toString(),
      wearDuration: value['wearDuration']?.toString(),
      packContents: value['packContents']?.toString(),
      powerRange: value['powerRange']?.toString(),
      features: features is List
          ? features.map((item) => item.toString()).toList(growable: false)
          : const [],
      specs: specs.map((item) => Map<String, dynamic>.from(item)).toList(),
      isFeatured: value['isFeatured'] == true,
      isNewArrival: value['isNewArrival'] == true,
      isOnSale: value['isOnSale'] == true,
      ratingAvg: avgRating is num ? avgRating.toDouble() : null,
      ratingCount: _asInt(value['ratingCount']),
    );
  }

  static String? mediaUrl(String? value, Uri apiOrigin) {
    if (value == null || value.isEmpty) return null;
    final uri = Uri.tryParse(value);
    if (uri == null) return null;
    if (uri.hasScheme) return uri.toString();
    return apiOrigin.resolveUri(uri).toString();
  }
}

class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.name,
    required this.price,
    required this.currency,
    required this.stockQuantity,
  });

  final String id;
  final String name;
  final String price;
  final String currency;
  final int stockQuantity;

  factory ProductVariant.fromJson(Map value) => ProductVariant(
    id: value['id']?.toString() ?? '',
    name: value['name']?.toString() ?? 'Standard',
    price: value['price']?.toString() ?? '0',
    currency: value['currency']?.toString() ?? 'PKR',
    stockQuantity: value['stockQuantity'] is num
        ? (value['stockQuantity'] as num).toInt()
        : 0,
  );
}

class PowerLensOption {
  const PowerLensOption({
    required this.value,
    required this.label,
    required this.surcharge,
  });

  final String value;
  final String label;
  final String surcharge;

  factory PowerLensOption.fromJson(Map value) => PowerLensOption(
    value: value['value']?.toString() ?? '',
    label: value['label']?.toString() ?? value['value']?.toString() ?? '',
    surcharge: value['surcharge']?.toString() ?? '0.00',
  );
}

class CartLine {
  const CartLine({
    required this.product,
    required this.variant,
    required this.leftPowerRange,
    required this.rightPowerRange,
    required this.quantity,
  });

  final StoreProduct product;
  final ProductVariant? variant;
  final String? leftPowerRange;
  final String? rightPowerRange;
  final int quantity;

  String get price {
    final basePrice = variant?.price ?? product.price;
    final baseCents = moneyToCents(basePrice);
    final optionByValue = {
      for (final option in product.availablePowerOptions)
        option.value: moneyToCents(option.surcharge),
    };
    final left = leftPowerRange == null ? 0 : optionByValue[leftPowerRange];
    final right = rightPowerRange == null ? 0 : optionByValue[rightPowerRange];
    if (baseCents == null || left == null || right == null) return basePrice;
    final total = baseCents + left + right;
    return '${total ~/ 100}.${(total % 100).toString().padLeft(2, '0')}';
  }

  String get currency => variant?.currency ?? product.currency;
  String get key =>
      jsonEncode([product.id, variant?.id, leftPowerRange, rightPowerRange]);

  CartLine withQuantity(int value) => CartLine(
    product: product,
    variant: variant,
    leftPowerRange: leftPowerRange,
    rightPowerRange: rightPowerRange,
    quantity: value,
  );
}

int? moneyToCents(String value) {
  final match = RegExp(r'^(\d{1,10})(?:\.(\d{1,2}))?$').firstMatch(value);
  if (match == null) return null;
  final whole = int.tryParse(match.group(1)!);
  final fraction = int.tryParse((match.group(2) ?? '').padRight(2, '0'));
  if (whole == null || fraction == null) return null;
  return whole * 100 + fraction;
}

class ShopperSession {
  const ShopperSession({required this.email});
  final String email;
}

class ShopperOrder {
  const ShopperOrder({
    required this.orderNumber,
    required this.status,
    required this.total,
    required this.currency,
  });

  final String orderNumber;
  final String status;
  final String total;
  final String currency;

  factory ShopperOrder.fromJson(Map value) => ShopperOrder(
    orderNumber: value['orderNumber']?.toString() ?? '',
    status: value['status']?.toString() ?? 'pending',
    total: value['total']?.toString() ?? '0',
    currency: value['currency']?.toString() ?? 'PKR',
  );
}

class DeliveryRule {
  const DeliveryRule({
    required this.minSubtotal,
    required this.maxSubtotal,
    required this.fee,
  });

  final String minSubtotal;
  final String? maxSubtotal;
  final String fee;

  factory DeliveryRule.fromJson(Map value) => DeliveryRule(
    minSubtotal: value['minSubtotal']?.toString() ?? '0',
    maxSubtotal: value['maxSubtotal']?.toString(),
    fee: value['fee']?.toString() ?? '0',
  );
}
