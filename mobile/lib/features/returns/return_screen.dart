import 'package:flutter/material.dart';

import '../../core/app_services.dart';

class ReturnScreen extends StatefulWidget {
  final AppServices services;

  const ReturnScreen({super.key, required this.services});

  @override
  State<ReturnScreen> createState() => _ReturnScreenState();
}

class _ReturnScreenState extends State<ReturnScreen> {
  final _storeIdController = TextEditingController();

  bool _loading = false;
  bool _submitting = false;

  String? _errorMessage;
  String? _resultMessage;

  List<Map<String, dynamic>> _items = [];

  int? _selectedDroppingId;

  final Map<int, TextEditingController> _returnControllers = {};

  @override
  void dispose() {
    _storeIdController.dispose();

    for (final controller in _returnControllers.values) {
      controller.dispose();
    }

    super.dispose();
  }

  Future<void> _loadReturnableDroppings() async {
    FocusScope.of(context).unfocus();

    final storeId = int.tryParse(_storeIdController.text.trim());

    if (storeId == null || storeId <= 0) {
      setState(() {
        _errorMessage = 'Store ID tidak valid.';
        _resultMessage = null;
      });
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
      _resultMessage = null;
      _items = [];
      _selectedDroppingId = null;
    });

    try {
      final items = await widget.services.returnRepository
          .getReturnableDroppingItems(storeId: storeId);

      for (final controller in _returnControllers.values) {
        controller.dispose();
      }

      _returnControllers.clear();

      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (error) {
      setState(() {
        _loading = false;
        _errorMessage = 'Gagal mengambil dropping yang dapat diretur: $error';
      });
    }
  }

  void _selectDropping(int droppingId) {
    for (final controller in _returnControllers.values) {
      controller.dispose();
    }

    _returnControllers.clear();

    final selectedItems = _items.where(
      (item) => _toInt(item['dropping_id']) == droppingId,
    );

    for (final item in selectedItems) {
      final droppingItemId = _toInt(item['id']);

      if (droppingItemId != null) {
        _returnControllers[droppingItemId] = TextEditingController(text: '0');
      }
    }

    setState(() {
      _selectedDroppingId = droppingId;
      _errorMessage = null;
      _resultMessage = null;
    });
  }

  Future<void> _submitReturn() async {
    final storeId = int.tryParse(_storeIdController.text.trim());

    final droppingId = _selectedDroppingId;

    if (storeId == null || storeId <= 0) {
      setState(() {
        _errorMessage = 'Store ID tidak valid.';
      });
      return;
    }

    if (droppingId == null) {
      setState(() {
        _errorMessage = 'Pilih dropping terlebih dahulu.';
      });
      return;
    }

    final selectedItems = _items.where(
      (item) => _toInt(item['dropping_id']) == droppingId,
    );

    final returnItems = <Map<String, dynamic>>[];

    for (final item in selectedItems) {
      final droppingItemId = _toInt(item['id']);

      if (droppingItemId == null) {
        continue;
      }

      final droppedQuantity = _toInt(item['quantity']) ?? 0;

      final controller = _returnControllers[droppingItemId];

      final returnQuantity = int.tryParse(controller?.text.trim() ?? '0') ?? 0;

      if (returnQuantity < 0) {
        setState(() {
          _errorMessage = 'Jumlah retur tidak boleh negatif.';
        });
        return;
      }

      if (returnQuantity > droppedQuantity) {
        setState(() {
          _errorMessage =
              'Jumlah retur ${item['product_name'] ?? 'produk'} '
              'melebihi jumlah dropping ($droppedQuantity).';
        });
        return;
      }

      if (returnQuantity > 0) {
        returnItems.add({
          'dropping_item_id': droppingItemId,
          'quantity': returnQuantity,
        });
      }
    }

    if (returnItems.isEmpty) {
      setState(() {
        _errorMessage = 'Masukkan minimal satu jumlah retur lebih dari 0.';
      });
      return;
    }

    setState(() {
      _submitting = true;
      _errorMessage = null;
      _resultMessage = null;
    });

    try {
      final result = await widget.services.returnRepository.recordReturn({
        'store_id': storeId,
        'items': returnItems,
      });

      if (!mounted) return;

      setState(() {
        _submitting = false;
        _resultMessage = result['synced'] == true
            ? 'Return berhasil disimpan dan langsung tersinkron.'
            : 'Return disimpan offline dan akan disinkronkan nanti.';
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _submitting = false;
        _errorMessage = 'Gagal menyimpan return: $error';
      });
    }
  }

  int? _toInt(dynamic value) {
    if (value == null) {
      return null;
    }

    return int.tryParse(value.toString());
  }

  String _formatDroppedAt(dynamic value) {
    if (value == null) {
      return '-';
    }

    final parsed = DateTime.tryParse(value.toString());

    if (parsed == null) {
      return value.toString();
    }

    return '${parsed.day.toString().padLeft(2, '0')}/'
        '${parsed.month.toString().padLeft(2, '0')}/'
        '${parsed.year} '
        '${parsed.hour.toString().padLeft(2, '0')}:'
        '${parsed.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final droppingIds = <int>{};

    for (final item in _items) {
      final droppingId = _toInt(item['dropping_id']);

      if (droppingId != null) {
        droppingIds.add(droppingId);
      }
    }

    final selectedItems = _selectedDroppingId == null
        ? <Map<String, dynamic>>[]
        : _items
              .where(
                (item) => _toInt(item['dropping_id']) == _selectedDroppingId,
              )
              .toList();

    final selectedDropping = selectedItems.isEmpty ? null : selectedItems.first;

    return Scaffold(
      appBar: AppBar(title: const Text('New Return')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _storeIdController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Store ID',
                hintText: 'Contoh: 1',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _loadReturnableDroppings,
                child: Text(
                  _loading ? 'Loading...' : 'Load Returnable Droppings',
                ),
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
            ],
            if (_resultMessage != null) ...[
              const SizedBox(height: 12),
              Text(
                _resultMessage!,
                style: const TextStyle(color: Colors.green),
              ),
            ],
            const SizedBox(height: 20),
            if (_items.isNotEmpty) ...[
              const Text(
                'Dropping yang belum diretur',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              for (final droppingId in droppingIds)
                _DroppingCard(
                  droppingId: droppingId,
                  items: _items
                      .where(
                        (item) => _toInt(item['dropping_id']) == droppingId,
                      )
                      .toList(),
                  selected: _selectedDroppingId == droppingId,
                  formatDate: _formatDroppedAt,
                  onTap: () => _selectDropping(droppingId),
                ),
            ],
            if (_selectedDroppingId != null && selectedItems.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Return - Dropping #$_selectedDroppingId',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (selectedDropping?['dropped_at'] != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Tanggal dropping: '
                  '${_formatDroppedAt(selectedDropping?['dropped_at'])}',
                  style: const TextStyle(color: Colors.grey),
                ),
              ],
              const SizedBox(height: 12),
              ...selectedItems.map((item) {
                final droppingItemId = _toInt(item['id']);

                final droppedQuantity = _toInt(item['quantity']) ?? 0;

                final controller = _returnControllers[droppingItemId];

                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['product_name'] ??
                                    'Product ${item['product_id']}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text('Dropped: $droppedQuantity'),
                            ],
                          ),
                        ),
                        SizedBox(
                          width: 90,
                          child: TextField(
                            controller: controller,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Return',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: _submitting
                    ? const Center(child: CircularProgressIndicator())
                    : ElevatedButton(
                        onPressed: _submitReturn,
                        child: const Text('Save Return'),
                      ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DroppingCard extends StatelessWidget {
  final int droppingId;
  final List<Map<String, dynamic>> items;
  final bool selected;
  final String Function(dynamic) formatDate;
  final VoidCallback onTap;

  const _DroppingCard({
    required this.droppingId,
    required this.items,
    required this.selected,
    required this.formatDate,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final droppedAt = items.isNotEmpty ? items.first['dropped_at'] : null;

    return Card(
      color: selected ? Theme.of(context).colorScheme.primaryContainer : null,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Dropping #$droppingId',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text('Tanggal: ${formatDate(droppedAt)}'),
              const SizedBox(height: 8),
              ...items.map(
                (item) => Text(
                  '• ${item['product_name'] ?? 'Product ${item['product_id']}'}'
                  ' — ${item['quantity']} pcs',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
