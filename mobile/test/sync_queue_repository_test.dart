import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:mobile/database/local_db.dart';
import 'package:mobile/database/sync_queue_repository.dart';

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
    LocalDb.setTestPath(inMemoryDatabasePath); // avoids path_provider entirely in tests
  });

  tearDown(() async {
    await LocalDb.resetForTest();
  });

  test('enqueue, read pending, mark synced', () async {
    final repo = SyncQueueRepository();

    final clientId = await repo.enqueue('dropping', {
      'store_id': 1,
      'items': [{'product_id': 1, 'quantity': 5}],
    });

    var pending = await repo.getByStatus('pending');
    expect(pending.length, 1);
    expect(pending.first['client_id'], clientId);

    await repo.markSynced(pending.first['id'] as int);

    pending = await repo.getByStatus('pending');
    expect(pending.length, 0);
    expect((await repo.getByStatus('synced')).length, 1);
  });
}