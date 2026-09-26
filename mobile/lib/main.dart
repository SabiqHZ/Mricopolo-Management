import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/app_services.dart';
import 'core/jwt_utils.dart';
import 'features/auth/auth_bloc.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';

void main() {
  runApp(MyApp(services: AppServices.create()));
}

class MyApp extends StatelessWidget {
  final AppServices services;
  const MyApp({super.key, required this.services});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Titip Jual',
      home: AppRoot(services: services),
    );
  }
}

/// Checks for an existing token on launch so a restart while offline lands
/// the user back in the app instead of stranding them on a login screen
/// they can't reach a server to satisfy.
class AppRoot extends StatefulWidget {
  final AppServices services;
  const AppRoot({super.key, required this.services});
  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  bool _checking = true;
  bool _hasValidToken = false;

  @override
  void initState() {
    super.initState();
    _checkToken();
  }

  Future<void> _checkToken() async {
    final token = await widget.services.tokenStorage.getToken();
    final valid = token != null && !isJwtExpired(token);

    // A present-but-expired token is worse than no token: it would pass this
    // check today and then fail on the very first API call inside Home.
    // Clear it now so a stale login never gets to feel like a working one.
    if (token != null && !valid) {
      await widget.services.tokenStorage.clearToken();
    }

    if (!mounted) return;
    setState(() {
      _hasValidToken = valid;
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_hasValidToken) return HomeScreen(services: widget.services);
    return BlocProvider(
      create: (_) => AuthBloc(widget.services.authRepository),
      child: LoginScreen(services: widget.services),
    );
  }
}