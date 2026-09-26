import 'package:dio/dio.dart';

/// Shared helpers for fetching simple id+name master data (stores, products)
/// to populate dropdowns. Mirrors the parsing already used by ReturnScreen's
/// store loader, extracted so DroppingScreen and DirectOrderScreen don't each
/// duplicate it.
Future<List<Map<String, dynamic>>> fetchStores(Dio dio) => _fetchNamedList(dio, '/stores');
Future<List<Map<String, dynamic>>> fetchProducts(Dio dio) => _fetchNamedList(dio, '/products');

Future<List<Map<String, dynamic>>> _fetchNamedList(Dio dio, String path) async {
  final response = await dio.get(path);
  final responseData = response.data;
  final rawData = responseData is Map ? (responseData['data'] ?? responseData) : responseData;
  if (rawData is! List) return [];
  return rawData
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .where((item) => item['id'] != null && item['name'] != null)
      .toList();
}

int? toInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  return int.tryParse(value.toString());
}
