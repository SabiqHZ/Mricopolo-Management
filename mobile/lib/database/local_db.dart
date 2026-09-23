import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path_provider/path_provider.dart';

class LocalDb {
  static Database? _db;
  static String? _testPath; // set only in tests, bypasses path_provider

  static void setTestPath(String path) {
    _testPath = path;
  }

  static Future<Database> get instance async {
    if (_db != null) return _db!;
    _db = await _init();
    return _db!;
  }

  static Future<Database> _init() async {
    final path = _testPath ?? await _resolveDefaultPath();
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT UNIQUE NOT NULL,
            entity_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            created_at TEXT NOT NULL,
            synced_at TEXT
          )
        ''');
      },
    );
  }

  static Future<String> _resolveDefaultPath() async {
    final dir = await getApplicationDocumentsDirectory();
    return join(dir.path, 'titip_jual.db');
  }

  /// Test-only: closes and clears the cached instance so each test starts fresh.
  static Future<void> resetForTest() async {
    if (_db != null) {
      await _db!.close();
      _db = null;
    }
  }
}