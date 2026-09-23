import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:mocktail/mocktail.dart';
import 'package:mobile/core/token_storage.dart';
import 'package:mobile/features/auth/auth_repository.dart';

class MockDio extends Mock implements Dio {}

class FakeTokenStorage implements TokenStorage {
  String? _token;
  @override
  Future<void> saveToken(String token) async => _token = token;
  @override
  Future<String?> getToken() async => _token;
  @override
  Future<void> clearToken() async => _token = null;
}

void main() {
  late MockDio dio;
  late FakeTokenStorage storage;
  late AuthRepository repo;

  setUp(() {
    dio = MockDio();
    storage = FakeTokenStorage();
    repo = AuthRepository(dio: dio, tokenStorage: storage);
  });

  test('successful login saves token and returns user', () async {
    when(() => dio.post('/auth/login', data: any(named: 'data'))).thenAnswer(
          (_) async => Response(
        requestOptions: RequestOptions(path: '/auth/login'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'token': 'fake.jwt.token',
            'user': {'id': 1, 'username': 'b'},
          },
          'message': 'Login successful',
        },
      ),
    );

    final user = await repo.login('b', 'password');

    expect(user['username'], 'b');
    expect(await storage.getToken(), 'fake.jwt.token');
  });

  test('failed login throws server error message, no token saved', () async {
    when(() => dio.post('/auth/login', data: any(named: 'data'))).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/auth/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 401,
          data: {
            'success': false,
            'error': {'code': 'INVALID_CREDENTIALS', 'message': 'Invalid username/email or password'},
          },
        ),
      ),
    );

    expect(
          () => repo.login('b', 'wrong'),
      throwsA(predicate((e) => e.toString().contains('Invalid username/email or password'))),
    );
    expect(await storage.getToken(), isNull);
  });
}