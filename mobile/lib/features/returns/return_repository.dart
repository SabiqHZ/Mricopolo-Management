import 'package:dio/dio.dart';

import '../../core/connectivity_checker.dart';
import '../../database/sync_queue_repository.dart';

class ReturnRepository {
  final Dio dio;
  final ConnectivityChecker connectivity;
  final SyncQueueRepository syncQueue;

  ReturnRepository({
    required this.dio,
    required this.connectivity,
    required this.syncQueue,
  });

  Future<List<Map<String, dynamic>>> getDroppings({
    required int storeId,
  }) async {
    final response = await dio.get(
      '/droppings',
      queryParameters: {'store_id': storeId},
    );

    return _extractList(response.data);
  }

  Future<Map<String, dynamic>?> getDroppingDetail(int droppingId) async {
    final response = await dio.get('/droppings/$droppingId');

    return _extractMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getReturns({required int storeId}) async {
    final response = await dio.get(
      '/returns',
      queryParameters: {'store_id': storeId},
    );

    return _extractList(response.data);
  }

  Future<Map<String, dynamic>?> getReturnDetail(int returnId) async {
    final response = await dio.get('/returns/$returnId');

    return _extractMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getReturnableDroppingItems({
    required int storeId,
  }) async {
    final droppings = await getDroppings(storeId: storeId);
    final returns = await getReturns(storeId: storeId);

    final returnedDroppingItemIds = <int>{};

    for (final returnHeader in returns) {
      final returnId = _toInt(returnHeader['id']);

      if (returnId == null) {
        continue;
      }

      final detail = await getReturnDetail(returnId);

      if (detail == null) {
        continue;
      }

      final rawItems = _extractItems(detail);

      for (final rawItem in rawItems) {
        final item = _toMap(rawItem);

        if (item == null) {
          continue;
        }

        final droppingItemId = _extractDroppingItemId(item);

        if (droppingItemId != null) {
          returnedDroppingItemIds.add(droppingItemId);
        }
      }
    }

    final result = <Map<String, dynamic>>[];

    for (final dropping in droppings) {
      final droppingId = _toInt(dropping['id']);

      if (droppingId == null) {
        continue;
      }

      final detail = await getDroppingDetail(droppingId);

      if (detail == null) {
        continue;
      }

      final rawItems = _extractItems(detail);

      for (final rawItem in rawItems) {
        final item = _toMap(rawItem);

        if (item == null) {
          continue;
        }

        final droppingItemId = _extractDroppingItemId(item);

        if (droppingItemId == null) {
          continue;
        }

        if (returnedDroppingItemIds.contains(droppingItemId)) {
          continue;
        }

        final productName = _extractProductName(item);
        final quantity = _extractQuantity(item);

        result.add({
          ...item,
          'dropping_item_id': droppingItemId,
          'dropping_id': droppingId,
          'product_name': productName,
          'quantity': quantity,
          'dropped_at':
              item['dropped_at'] ??
              detail['dropped_at'] ??
              dropping['dropped_at'],
          'store_id':
              item['store_id'] ??
              detail['store_id'] ??
              dropping['store_id'] ??
              storeId,
        });
      }
    }

    return result;
  }

  List<dynamic> _extractItems(dynamic data) {
    if (data is List) {
      return data;
    }

    if (data is! Map) {
      return const [];
    }

    final map = Map<String, dynamic>.from(data);

    final directCandidates = [
      map['items'],
      map['dropping_items'],
      map['return_items'],
    ];

    for (final candidate in directCandidates) {
      if (candidate is List) {
        return candidate;
      }
    }

    final nestedData = map['data'];

    if (nestedData is Map) {
      final nestedMap = Map<String, dynamic>.from(nestedData);

      final nestedCandidates = [
        nestedMap['items'],
        nestedMap['dropping_items'],
        nestedMap['return_items'],
      ];

      for (final candidate in nestedCandidates) {
        if (candidate is List) {
          return candidate;
        }
      }
    }

    return const [];
  }

  Map<String, dynamic>? _toMap(dynamic value) {
    if (value is! Map) {
      return null;
    }

    return Map<String, dynamic>.from(value);
  }

  int? _extractDroppingItemId(Map<String, dynamic> item) {
    final directCandidates = [
      item['dropping_item_id'],
      item['droppingItemId'],
      item['id'],
    ];

    for (final candidate in directCandidates) {
      final id = _toInt(candidate);

      if (id != null) {
        return id;
      }
    }

    final nestedDroppingItem = item['dropping_item'];

    if (nestedDroppingItem is Map) {
      final nestedMap = Map<String, dynamic>.from(nestedDroppingItem);

      final id = _toInt(nestedMap['id'] ?? nestedMap['dropping_item_id']);

      if (id != null) {
        return id;
      }
    }

    return null;
  }

  String _extractProductName(Map<String, dynamic> item) {
    final directCandidates = [
      item['product_name'],
      item['productName'],
      item['name'],
    ];

    for (final candidate in directCandidates) {
      if (candidate != null && candidate.toString().trim().isNotEmpty) {
        return candidate.toString();
      }
    }

    final product = item['product'];

    if (product is Map) {
      final productMap = Map<String, dynamic>.from(product);

      final name =
          productMap['name'] ??
          productMap['product_name'] ??
          productMap['productName'];

      if (name != null && name.toString().trim().isNotEmpty) {
        return name.toString();
      }
    }

    return 'Produk';
  }

  int _extractQuantity(Map<String, dynamic> item) {
    final candidates = [
      item['quantity'],
      item['dropped_quantity'],
      item['droppedQuantity'],
    ];

    for (final candidate in candidates) {
      final quantity = _toInt(candidate);

      if (quantity != null) {
        return quantity;
      }
    }

    return 0;
  }

  Future<Map<String, dynamic>> recordReturn(Map<String, dynamic> data) async {
    final online = await connectivity.isOnline();

    if (online) {
      try {
        final response = await dio.post('/returns', data: data);

        return {'synced': true, 'data': response.data};
      } on DioException {
        final clientId = await syncQueue.enqueue('return', data);

        return {'synced': false, 'client_id': clientId};
      }
    }

    final clientId = await syncQueue.enqueue('return', data);

    return {'synced': false, 'client_id': clientId};
  }

  List<Map<String, dynamic>> _extractList(dynamic responseData) {
    dynamic rawData = responseData;

    if (responseData is Map) {
      rawData = responseData['data'] ?? responseData;
    }

    if (rawData is! List) {
      throw Exception('Format response list tidak valid.');
    }

    return rawData
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Map<String, dynamic>? _extractMap(dynamic responseData) {
    dynamic rawData = responseData;

    if (responseData is Map) {
      rawData = responseData['data'] ?? responseData;
    }

    if (rawData is! Map) {
      return null;
    }

    return Map<String, dynamic>.from(rawData);
  }

  int? _toInt(dynamic value) {
    if (value == null) {
      return null;
    }

    if (value is int) {
      return value;
    }

    return int.tryParse(value.toString());
  }
}
