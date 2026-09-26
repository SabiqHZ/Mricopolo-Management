import 'dart:convert';

/// Returns true if [token] is a JWT whose `exp` claim is in the past, or if
/// the token can't be parsed at all. This does NOT verify the signature —
/// that's the server's job on every request regardless. It's purely a
/// client-side UX check so the app doesn't route a user to a screen backed
/// by a token that's already guaranteed to fail on the first API call.
bool isJwtExpired(String token) {
  try {
    final parts = token.split('.');
    if (parts.length != 3) return true;

    final normalizedPayload = base64Url.normalize(parts[1]);
    final decoded = utf8.decode(base64Url.decode(normalizedPayload));
    final claims = jsonDecode(decoded) as Map<String, dynamic>;

    final exp = claims['exp'];
    if (exp is! int) return true;

    final expiry = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
    return DateTime.now().isAfter(expiry);
  } catch (_) {
    // Any parse failure is treated as expired — fail closed, not open.
    return true;
  }
}
