import 'package:flutter/material.dart';
import '../../core/app_services.dart';
import '../../core/master_data.dart';

// NOTE: store/product are now name-based dropdowns fetched from /stores and
// /products, replacing the old bare-bones numeric-ID entry. Trade-off: this
// screen now needs connectivity to load the pickers before it can even be
// used, whereas the old text-field version could be filled in fully offline.
// If Admin/Kurir regularly records droppings with no signal, the master data
// should be cached locally (e.g. synced into SQLite) instead of fetched live
// — flag this if that's a real scenario, it's a separate checkpoint.
class DroppingScreen extends StatefulWidget {
  final AppServices services;
  const DroppingScreen({super.key, required this.services});

  @override
  State<DroppingScreen> createState() => _DroppingScreenState();
}

class _DroppingScreenState extends State<DroppingScreen> {
  final _quantityController = TextEditingController();
  List<Map<String, dynamic>> _stores = [];
  List<Map<String, dynamic>> _products = [];
  int? _selectedStoreId;
  int? _selectedProductId;
  bool _loadingMasterData = true;
  bool _submitting = false;
  String? _resultMessage;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadMasterData();
  }

  Future<void> _loadMasterData() async {
    setState(() { _loadingMasterData = true; _errorMessage = null; });
    try {
      final results = await Future.wait([
        fetchStores(widget.services.dio),
        fetchProducts(widget.services.dio),
      ]);
      setState(() {
        _stores = results[0];
        _products = results[1];
        _loadingMasterData = false;
      });
    } catch (e) {
      setState(() {
        _loadingMasterData = false;
        _errorMessage = 'Gagal memuat daftar warung/produk: $e';
      });
    }
  }

  Future<void> _submit() async {
    setState(() { _submitting = true; _resultMessage = null; });
    final data = {
      'store_id': _selectedStoreId,
      'items': [{
        'product_id': _selectedProductId,
        'quantity': int.tryParse(_quantityController.text),
      }],
    };
    final result = await widget.services.droppingRepository.recordDropping(data);
    setState(() {
      _submitting = false;
      _resultMessage = result['synced'] == true
          ? 'Synced immediately.'
          : 'Saved offline — will sync later (client_id: ${result['client_id']}).';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New Dropping')),
      body: _loadingMasterData
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if (_errorMessage != null) ...[
                    Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    TextButton(onPressed: _loadMasterData, child: const Text('Retry')),
                    const SizedBox(height: 12),
                  ],
                  DropdownButtonFormField<int>(
                    initialValue: _selectedStoreId,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      labelText: 'Store',
                      prefixIcon: Icon(Icons.store),
                    ),
                    items: _stores.map((store) => DropdownMenuItem<int>(
                      value: toInt(store['id']),
                      child: Text(store['name'].toString()),
                    )).toList(),
                    onChanged: (value) => setState(() => _selectedStoreId = value),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<int>(
                    initialValue: _selectedProductId,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      labelText: 'Product',
                      prefixIcon: Icon(Icons.inventory_2),
                    ),
                    items: _products.map((product) => DropdownMenuItem<int>(
                      value: toInt(product['id']),
                      child: Text(product['name'].toString()),
                    )).toList(),
                    onChanged: (value) => setState(() => _selectedProductId = value),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _quantityController,
                    decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Quantity'),
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 16),
                  _submitting
                      ? const CircularProgressIndicator()
                      : ElevatedButton(
                          onPressed: (_selectedStoreId != null && _selectedProductId != null) ? _submit : null,
                          child: const Text('Save Dropping'),
                        ),
                  if (_resultMessage != null) Padding(padding: const EdgeInsets.only(top: 16), child: Text(_resultMessage!)),
                ],
              ),
            ),
    );
  }
}
