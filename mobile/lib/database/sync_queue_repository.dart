import 'dart:convert';
import 'package:uuid/uuid.dart';
import 'local_db.dart';

class SyncQueueRepository {
  final _uuid = const Uuid();

  Future<String> enqueue(String entityType, Map<String, dynamic> payload) async {
    final db = await LocalDb.instance;
    final clientId = _uuid.v4();
    final payloadWithClientId = {...payload, 'client_id': clientId};

    await db.insert('sync_queue', {
      'client_id': clientId,
      'entity_type': entityType,
      'payload': jsonEncode(payloadWithClientId),
      'status': 'pending',
      'retry_count': 0,
      'created_at': DateTime.now().toIso8601String(),
    });
    return clientId;
  }

  Future<List<Map<String, dynamic>>> getByStatus(String status) async {
    final db = await LocalDb.instance;
    return db.query('sync_queue', where: 'status = ?', whereArgs: [status], orderBy: 'created_at ASC');
  }

  Future<void> markSyncing(int id) async {
    final db = await LocalDb.instance;
    await db.update('sync_queue', {'status': 'syncing'}, where: 'id = ?', whereArgs: [id]);
  }

  Future<void> markSynced(int id) async {
    final db = await LocalDb.instance;
    await db.update('sync_queue',
        {'status': 'synced', 'synced_at': DateTime.now().toIso8601String()},
        where: 'id = ?', whereArgs: [id]);
  }

  Future<void> markFailed(int id, String error) async {
    final db = await LocalDb.instance;
    await db.rawUpdate(
      'UPDATE sync_queue SET status = ?, retry_count = retry_count + 1, last_error = ? WHERE id = ?',
      ['failed', error, id],
    );
  }
}