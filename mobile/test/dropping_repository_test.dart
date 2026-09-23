import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:mocktail/mocktail.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:mobile/core/connectivity_checker.dart';
import 'package:mobile/database/local_db.dart';
import 'package:mobile/database/sync_queue_repository.dart';
import 'package:mobile/features/droppings/dropping_repository.dart';

class MockDio extends Mock implements Dio {}
class FakeConnectivity implements ConnectivityChecker {
  final bool online;
  FakeConnectivity(this.online);
  @override
  Future<bool> isOnline() async => online;
}

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
    LocalDb.setTestPath(inMemoryDatabasePath);
    registerFallbackValue(RequestOptions(path: '/droppings'));
  });
  tearDown(() => LocalDb.resetForTest());

  final testData = {'store_id': 1, 'items': [{'product_id': 1, 'quantity': 5}]};

  test('online + successful POST syncs immediately, nothing queued', () async {
    final dio = MockDio();
    when(() => dio.post('/droppings', data: any(named: 'data'))).thenAnswer(
          (_) async => Response(requestOptions: RequestOptions(path: '/droppings'), statusCode: 200, data: {'success': true}),
    );
    final repo = DroppingRepository(dio: dio, connectivity: FakeConnectivity(true), syncQueue: SyncQueueRepository());

    final result = await repo.recordDropping(testData);

    expect(result['synced'], true);
    expect((await SyncQueueRepository().getByStatus('pending')).length, 0);
  });

  test('offline queues the dropping instead of posting', () async {
    final dio = MockDio();
    final repo = DroppingRepository(dio: dio, connectivity: FakeConnectivity(false), syncQueue: SyncQueueRepository());

    final result = await repo.recordDropping(testData);

    expect(result['synced'], false);
    verifyNever(() => dio.post(any(), data: any(named: 'data')));
    expect((await SyncQueueRepository().getByStatus('pending')).length, 1);
  });

  test('online but request fails falls back to queue', () async {
    final dio = MockDio();
    when(() => dio.post('/droppings', data: any(named: 'data'))).thenThrow(
      DioException(requestOptions: RequestOptions(path: '/droppings'), type: DioExceptionType.connectionError),
    );
    final repo = DroppingRepository(dio: dio, connectivity: FakeConnectivity(true), syncQueue: SyncQueueRepository());

    final result = await repo.recordDropping(testData);

    expect(result['synced'], false);
    expect((await SyncQueueRepository().getByStatus('pending')).length, 1);
  });
}