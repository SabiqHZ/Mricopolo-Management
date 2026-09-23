import 'package:dio/dio.dart';
import 'token_storage.dart';
import 'secure_token_storage.dart';
import 'api_client.dart';
import 'connectivity_checker.dart';
import 'real_connectivity_checker.dart';
import '../database/sync_queue_repository.dart';
import '../database/sync_engine.dart';
import '../features/droppings/dropping_repository.dart';
import '../features/auth/auth_repository.dart';

class AppServices {
  final TokenStorage tokenStorage;
  final Dio dio;
  final ConnectivityChecker connectivity;
  final SyncQueueRepository syncQueue;
  final SyncEngine syncEngine;
  final DroppingRepository droppingRepository;
  final AuthRepository authRepository;

  AppServices({
    required this.tokenStorage, required this.dio, required this.connectivity,
    required this.syncQueue, required this.syncEngine,
    required this.droppingRepository, required this.authRepository,
  });

  factory AppServices.create() {
    final tokenStorage = SecureTokenStorage();
    final apiClient = ApiClient(tokenStorage: tokenStorage);
    final connectivity = RealConnectivityChecker();
    final syncQueue = SyncQueueRepository();
    return AppServices(
      tokenStorage: tokenStorage,
      dio: apiClient.dio,
      connectivity: connectivity,
      syncQueue: syncQueue,
      syncEngine: SyncEngine(dio: apiClient.dio, syncQueue: syncQueue),
      droppingRepository: DroppingRepository(dio: apiClient.dio, connectivity: connectivity, syncQueue: syncQueue),
      authRepository: AuthRepository(dio: apiClient.dio, tokenStorage: tokenStorage),
    );
  }
}