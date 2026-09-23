import 'package:connectivity_plus/connectivity_plus.dart';
import 'connectivity_checker.dart';

class RealConnectivityChecker implements ConnectivityChecker {
  @override
  Future<bool> isOnline() async {
    final result = await Connectivity().checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }
}