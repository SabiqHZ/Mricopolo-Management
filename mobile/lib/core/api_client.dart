import 'package:dio/dio.dart';
import 'token_storage.dart';

class ApiClient {
  final Dio dio;
  final TokenStorage tokenStorage;

  ApiClient({required this.tokenStorage, String? baseUrl})
      : dio = Dio(BaseOptions(baseUrl: baseUrl ?? _defaultBaseUrl())) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await tokenStorage.getToken();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
    ));
  }

// Assumes `adb reverse tcp:4000 tcp:4000` has been run — tunnels the
// device's localhost:4000 to the host machine's localhost:4000 over USB.
// If you switch to WiFi later, replace this with your machine's LAN IP instead.
  static String _defaultBaseUrl() => 'http://localhost:4000';
}