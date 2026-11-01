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
                  defaultValue: 'https://isklenses.com',
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
    return uri
        .replace(path: '', query: '', fragment: '')
        .toString()
        .replaceFirst(RegExp(r'/$'), '');
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
      final response = await _dio.get<Map<String, dynamic>>(
        path,
        queryParameters: query,
      );
      final body = response.data;
      if (body == null) {
        throw const StoreApiException('The store returned an empty response.');
      }
      return body;
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

  Future<ProductPage> getProducts({int page = 1, String query = ''}) async {
    final body = await _getObject(
      '/api/products',
      query: {
        'page': page,
        'limit': 24,
        if (query.trim().isNotEmpty) 'q': query.trim(),
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
                  defaultValue: 'https://isklenses.com',
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

class StoreProduct {
  const StoreProduct({
    required this.id,
    required this.name,
    required this.slug,
    required this.price,
    required this.currency,
    required this.stockQuantity,
    required this.imageUrl,
    required this.availablePowerRanges,
    required this.variants,
  });

  final String id;
  final String name;
  final String slug;
  final String price;
  final String currency;
  final int stockQuantity;
  final String? imageUrl;
  final List<String> availablePowerRanges;
  final List<ProductVariant> variants;

  factory StoreProduct.fromJson(Map value, Uri apiOrigin) {
    final ranges = value['availablePowerRanges'];
    final variants = value['variants'];
    return StoreProduct(
      id: value['id']?.toString() ?? '',
      name: value['name']?.toString() ?? 'Contact lenses',
      slug: value['slug']?.toString() ?? '',
      price: value['price']?.toString() ?? '0',
      currency: value['currency']?.toString() ?? 'PKR',
      stockQuantity: value['stockQuantity'] is num
          ? (value['stockQuantity'] as num).toInt()
          : 0,
      imageUrl: _mediaUrl(value['heroImageUrl']?.toString(), apiOrigin),
      availablePowerRanges: ranges is List
          ? ranges.whereType<String>().toList(growable: false)
          : const [],
      variants: variants is List
          ? variants
                .whereType<Map>()
                .map(ProductVariant.fromJson)
                .toList(growable: false)
          : const [],
    );
  }

  static String? _mediaUrl(String? value, Uri apiOrigin) {
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

  String get price => variant?.price ?? product.price;
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
