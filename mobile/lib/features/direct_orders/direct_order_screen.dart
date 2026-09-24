import 'package:flutter/material.dart';

import '../../core/app_services.dart';

// ASSUMPTION: bare-bones numeric product-ID entry and a single item per order,
// mirroring DroppingScreen's minimalism — a proper product picker and a
// multi-item form are a later UI polish pass, not required to prove the
// offline/sync mechanics this checkpoint tests. List/detail/payment for
// Direct Orders already exist on the web dashboard; not duplicated here.
class DirectOrderScreen extends StatefulWidget {
  final AppServices services;
  const DirectOrderScreen({super.key, required this.services});

  @override
  State<DirectOrderScreen> createState() => _DirectOrderScreenState();
}

class _DirectOrderScreenState extends State<DirectOrderScreen> {
  final _customerNameController = TextEditingController();
  final _productIdController = TextEditingController();
  final _quantityController = TextEditingController();
  final _depositController = TextEditingController();
  DateTime? _pickupDate;
  bool _submitting = false;
  String? _resultMessage;

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
    setState(() {
      _submitting = true;
      _resultMessage = null;
    });
    final data = {
      'customer_name': _customerNameController.text,
      'pickup_delivery_date': _pickupDate?.toIso8601String().split('T').first,
      'deposit_amount': _depositController.text.isEmpty
          ? 0
          : num.tryParse(_depositController.text),
      'items': [
        {
          'product_id': int.tryParse(_productIdController.text),
          'quantity': int.tryParse(_quantityController.text),
        },
      ],
    };
    final result = await widget.services.directOrderRepository.recordOrder(
      data,
    );
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
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _customerNameController,
              decoration: const InputDecoration(labelText: 'Customer Name'),
            ),
            TextField(
              controller: _productIdController,
              decoration: const InputDecoration(labelText: 'Product ID'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: _quantityController,
              decoration: const InputDecoration(labelText: 'Quantity'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: _depositController,
              decoration: const InputDecoration(
                labelText: 'Deposit (optional)',
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: _pickDate,
                child: Text(
                  _pickupDate == null
                      ? 'Pick pickup/delivery date'
                      : 'Pickup/delivery: ${_pickupDate!.toIso8601String().split('T').first}',
                ),
              ),
            ),
            const SizedBox(height: 16),
            _submitting
                ? const CircularProgressIndicator()
                : ElevatedButton(
                    onPressed: _submit,
                    child: const Text('Save Order'),
                  ),
            if (_resultMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(_resultMessage!),
              ),
          ],
        ),
      ),
    );
  }
}
