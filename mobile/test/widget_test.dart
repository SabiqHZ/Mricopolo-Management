import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:mobile/core/token_storage.dart';
import 'package:mobile/core/connectivity_checker.dart';
import 'package:mobile/core/app_services.dart';
import 'package:mobile/database/local_db.dart';
import 'package:mobile/database/sync_queue_repository.dart';
import 'package:mobile/database/sync_engine.dart';
import 'package:mobile/features/auth/auth_repository.dart';
import 'package:mobile/features/auth/auth_bloc.dart';
import 'package:mobile/features/auth/login_screen.dart';
import 'package:mobile/features/droppings/dropping_repository.dart';
import 'package:mobile/features/direct_orders/direct_order_repository.dart';

class _FakeTokenStorage implements TokenStorage {
  @override
  Future<void> saveToken(String token) async {}
  @override
  Future<String?> getToken() async => null;
  @override
  Future<void> clearToken() async {}
}

class _FakeConnectivity implements ConnectivityChecker {
  @override
  Future<bool> isOnline() async => true;
}

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
    LocalDb.setTestPath(inMemoryDatabasePath);
  });
  tearDown(() => LocalDb.resetForTest());

  testWidgets('Login screen renders username, password, and login button', (
    tester,
  ) async {
    final dio = Dio();
    final tokenStorage = _FakeTokenStorage();
    final connectivity = _FakeConnectivity();
    final syncQueue = SyncQueueRepository();

    final services = AppServices(
      tokenStorage: tokenStorage,
      dio: dio,
      connectivity: connectivity,
      syncQueue: syncQueue,
      syncEngine: SyncEngine(dio: dio, syncQueue: syncQueue),
      droppingRepository: DroppingRepository(
        dio: dio,
        connectivity: connectivity,
        syncQueue: syncQueue,
      ),
      authRepository: AuthRepository(dio: dio, tokenStorage: tokenStorage),
      directOrderRepository: DirectOrderRepository(
        dio: dio,
        connectivity: connectivity,
        syncQueue: syncQueue,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: BlocProvider(
          create: (_) => AuthBloc(services.authRepository),
          child: LoginScreen(services: services),
        ),
      ),
    );

    expect(find.text('Username or Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Login'), findsOneWidget);
  });
}
