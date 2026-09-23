abstract class AuthEvent {}

class LoginRequested extends AuthEvent {
  final String identifier;
  final String password;
  LoginRequested(this.identifier, this.password);
}