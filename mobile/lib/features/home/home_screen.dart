import 'package:flutter/material.dart';
import '../../core/app_services.dart';
import '../droppings/dropping_screen.dart';

class HomeScreen extends StatefulWidget {
  final AppServices services;
  const HomeScreen({super.key, required this.services});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _pendingCount = 0;
  bool _syncing = false;
  String? _lastSyncMessage;

  @override
  void initState() {
    super.initState();
    _refreshPendingCount();
  }

  Future<void> _refreshPendingCount() async {
    final pending = await widget.services.syncQueue.getByStatus('pending');
    setState(() => _pendingCount = pending.length);
  }

  Future<void> _syncNow() async {
    setState(() => _syncing = true);
    final result = await widget.services.syncEngine.syncPending();
    await _refreshPendingCount();
    setState(() {
      _syncing = false;
      _lastSyncMessage = 'Synced ${result.succeeded}/${result.total} (failed: ${result.failed})';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Titip Jual')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Pending sync: $_pendingCount', style: const TextStyle(fontSize: 16)),
            if (_lastSyncMessage != null) Text(_lastSyncMessage!),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _syncing ? null : _syncNow, child: Text(_syncing ? 'Syncing...' : 'Sync Now')),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => DroppingScreen(services: widget.services)));
                _refreshPendingCount();
              },
              child: const Text('New Dropping'),
            ),
          ],
        ),
      ),
    );
  }
}