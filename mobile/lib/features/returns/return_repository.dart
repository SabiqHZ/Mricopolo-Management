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

    final body = response.data as Map<String, dynamic>;

    if (body['success'] != true) {
      throw Exception(body['message'] ?? 'Failed to load droppings');
    }

    final data = body['data'];

    if (data is! List) {
      return [];
    }

    return data.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<Map<String, dynamic>?> getDroppingDetail(int droppingId) async {
    final response = await dio.get('/droppings/$droppingId');

    final body = response.data as Map<String, dynamic>;

    if (body['success'] != true) {
      return null;
    }

    final data = body['data'];

    if (data is! Map) {
      return null;
    }

    return Map<String, dynamic>.from(data);
  }

  Future<List<Map<String, dynamic>>> getReturns({required int storeId}) async {
    final response = await dio.get(
      '/returns',
      queryParameters: {'store_id': storeId},
    );

    final body = response.data as Map<String, dynamic>;

    if (body['success'] != true) {
      throw Exception(body['message'] ?? 'Failed to load returns');
    }

    final data = body['data'];

    if (data is! List) {
      return [];
    }

    return data.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<Map<String, dynamic>?> getReturnDetail(int returnId) async {
    final response = await dio.get('/returns/$returnId');

    final body = response.data as Map<String, dynamic>;

    if (body['success'] != true) {
      return null;
    }

    final data = body['data'];

    if (data is! Map) {
      return null;
    }

    return Map<String, dynamic>.from(data);
  }

  Future<List<Map<String, dynamic>>> getReturnableDroppingItems({
    required int storeId,
  }) async {
    final droppings = await getDroppings(storeId: storeId);

    final returns = await getReturns(storeId: storeId);

    final returnedDroppingItemIds = <int>{};

    for (final returnHeader in returns) {
      final returnId = returnHeader['id'];

      if (returnId == null) {
        continue;
      }

      final detail = await getReturnDetail(int.parse(returnId.toString()));

      if (detail == null) {
        continue;
      }

      final items = detail['items'];

      if (items is! List) {
        continue;
      }

      for (final item in items) {
        if (item is! Map) {
          continue;
        }

        final droppingItemId = item['dropping_item_id'];

        if (droppingItemId != null) {
          returnedDroppingItemIds.add(int.parse(droppingItemId.toString()));
        }
      }
    }

    final result = <Map<String, dynamic>>[];

    for (final dropping in droppings) {
      final droppingId = dropping['id'];

      if (droppingId == null) {
        continue;
      }

      final detail = await getDroppingDetail(int.parse(droppingId.toString()));

      if (detail == null) {
        continue;
      }

      final items = detail['items'];

      if (items is! List) {
        continue;
      }

      for (final item in items) {
        if (item is! Map) {
          continue;
        }

        final droppingItemId = item['id'];

        if (droppingItemId == null) {
          continue;
        }

        final parsedDroppingItemId = int.parse(droppingItemId.toString());

        if (returnedDroppingItemIds.contains(parsedDroppingItemId)) {
          continue;
        }

        result.add({
          ...Map<String, dynamic>.from(item),
          'dropping_id': detail['id'],
          'dropped_at': detail['dropped_at'],
          'store_id': detail['store_id'],
        });
      }
    }

    return result;
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
}
