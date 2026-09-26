import 'package:flutter/material.dart';
import '../../core/app_services.dart';
import '../../core/master_data.dart';

// ASSUMPTION: still a single item per order (multi-item form remains a later
// UI polish pass) — only the product picker below has been upgraded from raw
// numeric-ID entry to a name-based dropdown. No store field here since Direct
// Orders aren't tied to a warung.
// NOTE: same trade-off as DroppingScreen — this screen now needs connectivity
// to load the product list before it can be used, unlike the old text-field
// version. See DroppingScreen's note if offline master data caching is needed.
class DirectOrderScreen extends StatefulWidget {
  final AppServices services;
  const DirectOrderScreen({super.key, required this.services});

  @override
  State<DirectOrderScreen> createState() => _DirectOrderScreenState();
}

class _DirectOrderScreenState extends State<DirectOrderScreen> {
  final _customerNameController = TextEditingController();
  final _quantityController = TextEditingController();
  final _depositController = TextEditingController();
  List<Map<String, dynamic>> _products = [];
  int? _selectedProductId;
  DateTime? _pickupDate;
  bool _loadingProducts = true;
  bool _submitting = false;
  String? _resultMessage;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    setState(() { _loadingProducts = true; _errorMessage = null; });
    try {
      final products = await fetchProducts(widget.services.dio);
      setState(() {
        _products = products;
        _loadingProducts = false;
      });
    } catch (e) {
      setState(() {
        _loadingProducts = false;
        _errorMessage = 'Gagal memuat daftar produk: $e';
      });
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _pickupDate = picked);
  }

  Future<void> _submit() async {
    setState(() { _submitting = true; _resultMessage = null; });
    final data = {
      'customer_name': _customerNameController.text,
      'pickup_delivery_date': _pickupDate?.toIso8601String().split('T').first,
      'deposit_amount': _depositController.text.isEmpty ? 0 : num.tryParse(_depositController.text),
      'items': [{
        'product_id': _selectedProductId,
        'quantity': int.tryParse(_quantityController.text),
      }],
    };
    final result = await widget.services.directOrderRepository.recordOrder(data);
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
      appBar: AppBar(title: const Text('New Direct Order')),
      body: _loadingProducts
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if (_errorMessage != null) ...[
                    Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    TextButton(onPressed: _loadProducts, child: const Text('Retry')),
                    const SizedBox(height: 12),
                  ],
                  TextField(
                    controller: _customerNameController,
                    decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Customer Name'),
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
                  TextField(
                    controller: _depositController,
                    decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Deposit (optional)'),
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: _pickDate,
                      child: Text(_pickupDate == null
                          ? 'Pick pickup/delivery date'
                          : 'Pickup/delivery: ${_pickupDate!.toIso8601String().split('T').first}'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _submitting
                      ? const CircularProgressIndicator()
                      : ElevatedButton(
                          onPressed: _selectedProductId != null ? _submit : null,
                          child: const Text('Save Order'),
                        ),
                  if (_resultMessage != null) Padding(padding: const EdgeInsets.only(top: 16), child: Text(_resultMessage!)),
                ],
              ),
            ),
    );
  }
}
