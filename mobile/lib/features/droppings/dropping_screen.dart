import 'package:flutter/material.dart';
import '../../core/app_services.dart';

// ASSUMPTION: bare-bones numeric-ID entry for store/product — a live picker
// needs connectivity we can't assume in offline field use. A proper
// store/product picker (cached master data) is a later UI polish pass, not
// required to prove the offline/sync mechanics this checkpoint tests.
class DroppingScreen extends StatefulWidget {
  final AppServices services;
  const DroppingScreen({super.key, required this.services});

  @override
  State<DroppingScreen> createState() => _DroppingScreenState();
}

class _DroppingScreenState extends State<DroppingScreen> {
  final _storeIdController = TextEditingController();
  final _productIdController = TextEditingController();
  final _quantityController = TextEditingController();
  bool _submitting = false;
  String? _resultMessage;

  Future<void> _submit() async {
    setState(() { _submitting = true; _resultMessage = null; });
    final data = {
      'store_id': int.tryParse(_storeIdController.text),
      'items': [{
        'product_id': int.tryParse(_productIdController.text),
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
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(controller: _storeIdController, decoration: const InputDecoration(labelText: 'Store ID'), keyboardType: TextInputType.number),
            TextField(controller: _productIdController, decoration: const InputDecoration(labelText: 'Product ID'), keyboardType: TextInputType.number),
            TextField(controller: _quantityController, decoration: const InputDecoration(labelText: 'Quantity'), keyboardType: TextInputType.number),
            const SizedBox(height: 16),
            _submitting ? const CircularProgressIndicator() : ElevatedButton(onPressed: _submit, child: const Text('Save Dropping')),
            if (_resultMessage != null) Padding(padding: const EdgeInsets.only(top: 16), child: Text(_resultMessage!)),
          ],
        ),
      ),
    );
  }
}