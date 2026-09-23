import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'token_storage.dart';

class SecureTokenStorage implements TokenStorage {
  final _storage = const FlutterSecureStorage();
  static const _key = 'jwt_token';

  @override
  Future<void> saveToken(String token) => _storage.write(key: _key, value: token);
  @override
  Future<String?> getToken() => _storage.read(key: _key);
  @override
  Future<void> clearToken() => _storage.delete(key: _key);
}