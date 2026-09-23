import 'dart:convert';
import 'package:dio/dio.dart';
import 'sync_queue_repository.dart';
import 'package:flutter/foundation.dart';

class SyncResult {
  final int succeeded;
  final int failed;
  final int total;
  SyncResult({required this.succeeded, required this.failed, required this.total});
}

class SyncEngine {
  final Dio dio;
  final SyncQueueRepository syncQueue;

  // Extend this map when Returns/Direct Orders get offline repositories later —
  // the engine itself needs no changes.
  static const _endpoints = {
    'dropping': '/droppings',
    'return': '/returns',
    'direct_order': '/direct-orders',
  };

  SyncEngine({required this.dio, required this.syncQueue});

  Future<SyncResult> syncPending() async {
    final pending = await syncQueue.getByStatus('pending');
    int succeeded = 0, failed = 0;

    for (final row in pending) {
      final id = row['id'] as int;
      final entityType = row['entity_type'] as String;
      final payload = jsonDecode(row['payload'] as String) as Map<String, dynamic>;
      final endpoint = _endpoints[entityType];

      if (endpoint == null) {
        await syncQueue.markFailed(id, 'Unknown entity_type: $entityType');
        failed++;
        continue;
      }

      await syncQueue.markSyncing(id);
      try {
        await dio.post(endpoint, data: payload);
        await syncQueue.markSynced(id);
        succeeded++;
      } catch (e) {
        debugPrint('SYNC FAILED for id=$id: $e');
        await syncQueue.markFailed(id, e.toString());
        failed++;
      }
    }

    return SyncResult(succeeded: succeeded, failed: failed, total: pending.length);
  }
}