import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:mocktail/mocktail.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:mobile/database/local_db.dart';
import 'package:mobile/database/sync_queue_repository.dart';
import 'package:mobile/database/sync_engine.dart';

class MockDio extends Mock implements Dio {}

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
    registerFallbackValue(RequestOptions(path: '/droppings'));
  });

  setUp(() => LocalDb.setTestPath(inMemoryDatabasePath));
  tearDown(() => LocalDb.resetForTest());

  test('syncs all pending items, marks them synced', () async {
    final queue = SyncQueueRepository();
    await queue.enqueue('dropping', {'store_id': 1, 'items': []});
    await queue.enqueue('dropping', {'store_id': 2, 'items': []});

    final dio = MockDio();
    when(() => dio.post(any(), data: any(named: 'data'))).thenAnswer(
          (_) async => Response(requestOptions: RequestOptions(path: '/droppings'), statusCode: 200, data: {}),
    );

    final result = await SyncEngine(dio: dio, syncQueue: queue).syncPending();

    expect(result.succeeded, 2);
    expect(result.failed, 0);
    expect((await queue.getByStatus('pending')).length, 0);
    expect((await queue.getByStatus('synced')).length, 2);
  });

  test('one failure is retried-later, not lost', () async {
    final queue = SyncQueueRepository();
    await queue.enqueue('dropping', {'store_id': 1, 'items': []});
    await queue.enqueue('dropping', {'store_id': 2, 'items': []});

    final dio = MockDio();
    var callCount = 0;
    when(() => dio.post(any(), data: any(named: 'data'))).thenAnswer((_) async {
      callCount++;
      if (callCount == 1) {
        throw DioException(requestOptions: RequestOptions(path: '/droppings'), type: DioExceptionType.connectionError);
      }
      return Response(requestOptions: RequestOptions(path: '/droppings'), statusCode: 200, data: {});
    });

    final result = await SyncEngine(dio: dio, syncQueue: queue).syncPending();

    expect(result.succeeded, 1);
    expect(result.failed, 1);
    final failed = await queue.getByStatus('failed');
    expect(failed.length, 1);
    expect(failed.first['retry_count'], 1);
  });
}