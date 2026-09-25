import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/app_services.dart';

class ReturnScreen extends StatefulWidget {
  final AppServices services;

  const ReturnScreen({super.key, required this.services});

  @override
  State<ReturnScreen> createState() => _ReturnScreenState();
}

class _ReturnScreenState extends State<ReturnScreen> {
  bool _loadingStores = true;
  bool _loadingDroppings = false;
  bool _saving = false;

  String? _errorMessage;

  List<Map<String, dynamic>> _stores = [];
  List<Map<String, dynamic>> _returnableItems = [];

  int? _selectedStoreId;

  /// Key = dropping item ID
  /// Value = quantity to return
  final Map<int, int> _returnQuantities = {};

  @override
  void initState() {
    super.initState();
    _loadStores();
  }

  Future<void> _loadStores() async {
    setState(() {
      _loadingStores = true;
      _errorMessage = null;
    });

    try {
      final response = await widget.services.dio.get('/stores');

      final responseData = response.data;
      final rawData = responseData is Map
          ? (responseData['data'] ?? responseData)
          : responseData;

      if (rawData is! List) {
        throw Exception('Format data toko tidak valid.');
      }

      final stores = rawData
          .whereType<Map>()
          .map((store) => Map<String, dynamic>.from(store))
          .where((store) => store['id'] != null && store['name'] != null)
          .toList();

      if (!mounted) return;

      setState(() {
        _stores = stores;
        _loadingStores = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;

      setState(() {
        _loadingStores = false;
        _errorMessage = _dioErrorMessage(
          e,
          fallback: 'Gagal mengambil daftar warung.',
        );
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _loadingStores = false;
        _errorMessage = 'Gagal mengambil daftar warung: $e';
      });
    }
  }

  Future<void> _selectStore(int? storeId) async {
    setState(() {
      _selectedStoreId = storeId;
      _returnableItems = [];
      _returnQuantities.clear();
      _errorMessage = null;
    });

    if (storeId == null) {
      return;
    }

    await _loadReturnableDroppings(storeId);
  }

  Future<void> _loadReturnableDroppings(int storeId) async {
    setState(() {
      _loadingDroppings = true;
      _errorMessage = null;
    });

    try {
      final items = await widget.services.returnRepository
          .getReturnableDroppingItems(storeId: storeId);

      if (!mounted) return;

      setState(() {
        _returnableItems = items;
        _loadingDroppings = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _loadingDroppings = false;
        _errorMessage = 'Gagal mengambil dropping: $e';
      });
    }
  }

  void _increaseQuantity(Map<String, dynamic> item) {
    final itemId = _toInt(item['dropping_item_id']);

    if (itemId == null) {
      return;
    }

    final maxQuantity = _toInt(item['quantity']) ?? 0;
    final current = _returnQuantities[itemId] ?? 0;

    if (current >= maxQuantity) {
      return;
    }

    setState(() {
      _returnQuantities[itemId] = current + 1;
    });
  }

  void _decreaseQuantity(Map<String, dynamic> item) {
    final itemId = _toInt(item['dropping_item_id']);

    if (itemId == null) {
      return;
    }

    final current = _returnQuantities[itemId] ?? 0;

    if (current <= 0) {
      return;
    }

    setState(() {
      final next = current - 1;

      if (next == 0) {
        _returnQuantities.remove(itemId);
      } else {
        _returnQuantities[itemId] = next;
      }
    });
  }

  Future<void> _saveReturn() async {
    final storeId = _selectedStoreId;

    if (storeId == null) {
      _showMessage('Pilih warung terlebih dahulu.');
      return;
    }

    final selectedItems = _returnQuantities.entries
        .where((entry) => entry.value > 0)
        .map(
          (entry) => {'dropping_item_id': entry.key, 'quantity': entry.value},
        )
        .toList();

    if (selectedItems.isEmpty) {
      _showMessage('Masukkan minimal satu jumlah retur.');
      return;
    }

    setState(() {
      _saving = true;
      _errorMessage = null;
    });

    try {
      final result = await widget.services.returnRepository.recordReturn({
        'store_id': storeId,
        'items': selectedItems,
      });

      if (!mounted) return;

      final synced = result['synced'] == true;

      setState(() {
        _saving = false;
      });

      _returnQuantities.clear();

      await _loadReturnableDroppings(storeId);

      if (!mounted) return;

      _showMessage(
        synced
            ? 'Retur berhasil disimpan.'
            : 'Retur disimpan dan masuk antrean sinkronisasi.',
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _saving = false;
        _errorMessage = 'Gagal menyimpan retur: $e';
      });
    }
  }

  Map<int, List<Map<String, dynamic>>> _groupByDropping() {
    final grouped = <int, List<Map<String, dynamic>>>{};

    for (final item in _returnableItems) {
      final droppingId = _toInt(item['dropping_id']);

      if (droppingId == null) {
        continue;
      }

      grouped.putIfAbsent(droppingId, () => []).add(item);
    }

    return grouped;
  }

  int _totalReturnQuantity() {
    return _returnQuantities.values.fold(0, (sum, quantity) => sum + quantity);
  }

  String _storeName(int storeId) {
    final store = _stores.cast<Map<String, dynamic>?>().firstWhere(
      (item) => _toInt(item?['id']) == storeId,
      orElse: () => null,
    );

    return store?['name']?.toString() ?? 'Warung';
  }

  String _formatDate(dynamic value) {
    if (value == null) {
      return '-';
    }

    final parsed = DateTime.tryParse(value.toString());

    if (parsed == null) {
      return value.toString();
    }

    final local = parsed.toLocal();

    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}/'
        '${local.year} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  int? _toInt(dynamic value) {
    if (value == null) {
      return null;
    }

    if (value is int) {
      return value;
    }

    return int.tryParse(value.toString());
  }

  String _dioErrorMessage(DioException error, {required String fallback}) {
    final data = error.response?.data;

    if (data is Map<String, dynamic>) {
      final apiError = data['error'];

      if (apiError is Map<String, dynamic> && apiError['message'] != null) {
        return apiError['message'].toString();
      }

      if (data['message'] != null) {
        return data['message'].toString();
      }
    }

    return fallback;
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _groupByDropping();
    final totalReturn = _totalReturnQuantity();

    return Scaffold(
      appBar: AppBar(title: const Text('Catat Retur')),
      body: _loadingStores
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                if (_selectedStoreId == null) {
                  await _loadStores();
                } else {
                  await _loadReturnableDroppings(_selectedStoreId!);
                }
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Pilih warung',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                    initialValue: _selectedStoreId,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      hintText: 'Pilih warung tujuan retur',
                      prefixIcon: Icon(Icons.store),
                    ),
                    items: _stores.map((store) {
                      final id = _toInt(store['id']);

                      return DropdownMenuItem<int>(
                        value: id,
                        child: Text(store['name']?.toString() ?? 'Tanpa nama'),
                      );
                    }).toList(),
                    onChanged: _saving ? null : _selectStore,
                  ),
                  const SizedBox(height: 20),
                  if (_selectedStoreId != null)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const CircleAvatar(child: Icon(Icons.storefront)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Warung dipilih',
                                    style: TextStyle(fontSize: 12),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _storeName(_selectedStoreId!),
                                    style: const TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.errorContainer,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.error_outline),
                          const SizedBox(width: 8),
                          Expanded(child: Text(_errorMessage!)),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  if (_selectedStoreId == null)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          Icon(Icons.assignment_return_outlined, size: 64),
                          SizedBox(height: 12),
                          Text(
                            'Pilih warung untuk melihat barang yang '
                            'masih dapat diretur.',
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else if (_loadingDroppings)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (grouped.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 64),
                          SizedBox(height: 12),
                          Text(
                            'Tidak ada barang yang dapat diretur '
                            'untuk warung ini.',
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else ...[
                    const Text(
                      'Dropping yang tersedia',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${grouped.length} dropping memiliki '
                      'barang yang dapat diretur.',
                    ),
                    const SizedBox(height: 12),
                    ...grouped.entries.map(
                      (entry) => _buildDroppingCard(
                        droppingId: entry.key,
                        items: entry.value,
                      ),
                    ),
                  ],
                  const SizedBox(height: 100),
                ],
              ),
            ),
      bottomNavigationBar:
          _selectedStoreId != null && !_loadingDroppings && grouped.isNotEmpty
          ? SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
                decoration: BoxDecoration(
                  color: Theme.of(context).scaffoldBackgroundColor,
                  boxShadow: const [
                    BoxShadow(blurRadius: 8, color: Colors.black12),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Total retur',
                            style: TextStyle(fontSize: 12),
                          ),
                          Text(
                            '$totalReturn item',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      onPressed: _saving || totalReturn == 0
                          ? null
                          : _saveReturn,
                      icon: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save),
                      label: Text(_saving ? 'Menyimpan...' : 'Simpan Retur'),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildDroppingCard({
    required int droppingId,
    required List<Map<String, dynamic>> items,
  }) {
    final droppingDate = items.isNotEmpty ? items.first['dropped_at'] : null;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        initiallyExpanded: false,
        leading: const CircleAvatar(child: Icon(Icons.inventory)),
        title: Text(
          'Dropping #$droppingId',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          'Tanggal: ${_formatDate(droppingDate)}\n'
          '${items.length} produk dapat diretur',
        ),
        children: [const Divider(height: 1), ...items.map(_buildReturnItem)],
      ),
    );
  }

  Widget _buildReturnItem(Map<String, dynamic> item) {
    final itemId = _toInt(item['dropping_item_id']);

    if (itemId == null) {
      return const SizedBox.shrink();
    }

    final droppedQuantity = _toInt(item['quantity']) ?? 0;
    final selectedQuantity = _returnQuantities[itemId] ?? 0;
    final productName = item['product_name']?.toString() ?? 'Produk';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  productName,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  'Tersedia untuk retur: $droppedQuantity',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: selectedQuantity > 0 && !_saving
                ? () => _decreaseQuantity(item)
                : null,
            icon: const Icon(Icons.remove_circle_outline),
          ),
          SizedBox(
            width: 36,
            child: Text(
              '$selectedQuantity',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
          IconButton(
            onPressed: selectedQuantity < droppedQuantity && !_saving
                ? () => _increaseQuantity(item)
                : null,
            icon: const Icon(Icons.add_circle_outline),
          ),
        ],
      ),
    );
  }
}
