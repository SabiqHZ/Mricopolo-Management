import 'package:dio/dio.dart';
import '../../core/connectivity_checker.dart';
import '../../database/sync_queue_repository.dart';

class DirectOrderRepository {
  final Dio dio;
  final ConnectivityChecker connectivity;
  final SyncQueueRepository syncQueue;

  DirectOrderRepository({required this.dio, required this.connectivity, required this.syncQueue});

  /// Returns {synced: true, data: ...} if posted immediately, or
  /// {synced: false, client_id: ...} if queued for later sync.
  Future<Map<String, dynamic>> recordOrder(Map<String, dynamic> data) async {
    final online = await connectivity.isOnline();
    if (online) {
      try {
        final response = await dio.post('/direct-orders', data: data);
        return {'synced': true, 'data': response.data};
      } on DioException {
        // Connectivity check passed but the request still failed (e.g. backend
        // unreachable, weak signal) — fall back to the queue rather than lose the input.
        final clientId = await syncQueue.enqueue('direct_order', data);
        return {'synced': false, 'client_id': clientId};
      }
    } else {
      final clientId = await syncQueue.enqueue('direct_order', data);
      return {'synced': false, 'client_id': clientId};
    }
  }
}
