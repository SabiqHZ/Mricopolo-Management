import 'package:flutter/material.dart';

import '../../core/app_services.dart';
import '../direct_orders/direct_order_screen.dart';
import '../droppings/dropping_screen.dart';
import '../returns/return_screen.dart';

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

    if (!mounted) return;

    setState(() {
      _pendingCount = pending.length;
    });
  }

  Future<void> _syncNow() async {
    if (_syncing) return;

    setState(() {
      _syncing = true;
      _lastSyncMessage = null;
    });

    try {
      final result = await widget.services.syncEngine.syncPending();

      await _refreshPendingCount();

      if (!mounted) return;

      setState(() {
        _lastSyncMessage =
            'Berhasil ${result.succeeded} dari ${result.total} '
            'transaksi. Gagal: ${result.failed}.';
        _syncing = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _syncing = false;
        _lastSyncMessage = 'Sinkronisasi gagal: $e';
      });
    }
  }

  Future<void> _openDropping() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DroppingScreen(services: widget.services),
      ),
    );

    await _refreshPendingCount();
  }

  Future<void> _openReturn() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ReturnScreen(services: widget.services),
      ),
    );

    await _refreshPendingCount();
  }

  Future<void> _openDirectOrder() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DirectOrderScreen(services: widget.services),
      ),
    );

    await _refreshPendingCount();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Titip Jual'), centerTitle: false),
      body: RefreshIndicator(
        onRefresh: _refreshPendingCount,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Text(
              'Operasional Hari Ini',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Kelola dropping, retur, dan pesanan langsung '
              'dari satu tempat.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.textTheme.bodySmall?.color,
              ),
            ),

            const SizedBox(height: 20),

            _buildSyncCard(theme),

            const SizedBox(height: 24),

            Text(
              'Transaksi',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),

            _buildActionCard(
              context: context,
              icon: Icons.local_shipping_outlined,
              title: 'Dropping Baru',
              description: 'Catat produk yang dititipkan ke warung.',
              buttonLabel: 'New Dropping',
              onPressed: _openDropping,
            ),

            const SizedBox(height: 12),

            _buildActionCard(
              context: context,
              icon: Icons.assignment_return_outlined,
              title: 'Retur Barang',
              description: 'Catat sisa produk yang dikembalikan dari warung.',
              buttonLabel: 'New Return',
              onPressed: _openReturn,
            ),

            const SizedBox(height: 12),

            _buildActionCard(
              context: context,
              icon: Icons.shopping_bag_outlined,
              title: 'Pesanan Langsung',
              description: 'Catat pesanan pelanggan di luar konsinyasi.',
              buttonLabel: 'New Direct Order',
              onPressed: _openDirectOrder,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSyncCard(ThemeData theme) {
    final hasPending = _pendingCount > 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  child: Icon(
                    hasPending
                        ? Icons.sync_problem_outlined
                        : Icons.cloud_done_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sinkronisasi Data',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        hasPending
                            ? '$_pendingCount transaksi menunggu '
                                  'sinkronisasi.'
                            : 'Semua transaksi sudah tersinkron.',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            ),

            if (_lastSyncMessage != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  _lastSyncMessage!,
                  style: theme.textTheme.bodySmall,
                ),
              ),
            ],

            const SizedBox(height: 14),

            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _syncing ? null : _syncNow,
                icon: _syncing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.sync),
                label: Text(_syncing ? 'Menyinkronkan...' : 'Sync Now'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionCard({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String description,
    required String buttonLabel,
    required VoidCallback onPressed,
  }) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(radius: 24, child: Icon(icon, size: 25)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(description, style: theme.textTheme.bodyMedium),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: onPressed,
                      icon: Icon(icon),
                      label: Text(buttonLabel),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
