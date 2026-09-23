import 'package:dio/dio.dart';
import '../../../core/token_storage.dart';

class AuthRepository {
  final Dio dio;
  final TokenStorage tokenStorage;

  AuthRepository({required this.dio, required this.tokenStorage});

  Future<Map<String, dynamic>> login(String identifier, String password) async {
    try {
      final response = await dio.post('/auth/login', data: {
        'identifier': identifier,
        'password': password,
      });
      final body = response.data as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>;
      final token = data['token'] as String;
      await tokenStorage.saveToken(token);
      return data['user'] as Map<String, dynamic>;
    } on DioException catch (e) {
      final message = e.response?.data?['error']?['message'] ?? 'Login failed';
      throw Exception(message);
    }
  }
}
