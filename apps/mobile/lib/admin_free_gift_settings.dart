import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'isk_controls.dart';
import 'store_api.dart';

const _autoCategory = '__auto_cosmetics__';
const _adminBlue = Color(0xff087ba5);

class AdminFreeGiftSettingsScreen extends StatefulWidget {
  const AdminFreeGiftSettingsScreen({required this.api, super.key});

  final AdminApi api;

  @override
  State<AdminFreeGiftSettingsScreen> createState() =>
      _AdminFreeGiftSettingsScreenState();
}

class _AdminFreeGiftSettingsScreenState
    extends State<AdminFreeGiftSettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _message = TextEditingController();
  final _badge = TextEditingController();
  final _minLensQuantity = TextEditingController();
  final _maxItems = TextEditingController();
  List<Map<String, dynamic>> _categories = [];
  String _categoryId = _autoCategory;
  bool _enabled = false;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _title.dispose();
    _message.dispose();
    _badge.dispose();
    _minLensQuantity.dispose();
    _maxItems.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        widget.api.get('/api/admin/categories'),
        widget.api.get('/api/admin/content'),
      ]);
      final categories = results[0]['data'];
      final content = results[1];
      final data = content['data'];
      final settings =
          content['settings'] ?? (data is Map ? data['settings'] : null);
      final rawOffer = settings is Map ? settings['free_gift'] : null;
      final offer = rawOffer is Map ? rawOffer : const <String, dynamic>{};
      final categoryId = offer['categoryId']?.toString();
      if (!mounted) return;
      setState(() {
        _categories = categories is List
            ? categories
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .where((item) => item['id']?.toString().isNotEmpty == true)
                  .toList(growable: false)
            : [];
        _categoryId =
            categoryId != null &&
                _categories.any(
                  (category) => category['id'].toString() == categoryId,
                )
            ? categoryId
            : _autoCategory;
        _enabled = offer['enabled'] == true;
        _title.text = offer['title']?.toString() ?? 'A free gift for you';
        _message.text = offer['message']?.toString() ?? '';
        _badge.text = offer['badge']?.toString() ?? 'FREE GIFT';
        _minLensQuantity.text = (offer['minLensQuantity'] ?? 1).toString();
        _maxItems.text = (offer['maxItems'] ?? 1).toString();
        _loading = false;
      });
    } on StoreApiException catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = error.message;
        });
      }
    }
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'This field is required.' : null;

  String? _positiveInteger(String? value) {
    final parsed = int.tryParse(value?.trim() ?? '');
    return parsed == null || parsed < 1
        ? 'Enter a whole number above zero.'
        : null;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.put('/api/admin/content/settings/free_gift', {
        'value': {
          'enabled': _enabled,
          'categoryId': _categoryId == _autoCategory ? null : _categoryId,
          'title': _title.text.trim(),
          'message': _message.text.trim(),
          'badge': _badge.text.trim(),
          'maxItems': int.parse(_maxItems.text.trim()),
          'minLensQuantity': int.parse(_minLensQuantity.text.trim()),
        },
      });
      if (mounted) Navigator.of(context).pop(true);
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Free gift settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    activeThumbColor: _adminBlue,
                    title: const Text('Enable free gift'),
                    subtitle: const Text(
                      'Eligible orders need the configured lens quantity and at least PKR 2,500 after discounts. Gifts cannot combine with lens deals.',
                    ),
                    value: _enabled,
                    onChanged: _saving
                        ? null
                        : (value) => setState(() => _enabled = value),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _title,
                    validator: _required,
                    decoration: const InputDecoration(labelText: 'Title'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _message,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(labelText: 'Message'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _badge,
                    validator: _required,
                    decoration: const InputDecoration(labelText: 'Badge'),
                  ),
                  const SizedBox(height: 12),
                  IskDropdownField<String>(
                    value: _categoryId,
                    decoration: const InputDecoration(
                      labelText: 'Gift category',
                      helperText:
                          'Choose Auto to resolve the Cosmetics category.',
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: _autoCategory,
                        child: Text('Auto: Cosmetics'),
                      ),
                      for (final category in _categories)
                        DropdownMenuItem(
                          value: category['id'].toString(),
                          child: Text(
                            category['name']?.toString() ?? 'Category',
                          ),
                        ),
                    ],
                    onChanged: _saving
                        ? null
                        : (value) {
                            if (value != null) {
                              setState(() => _categoryId = value);
                            }
                          },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _minLensQuantity,
                    validator: _positiveInteger,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(
                      labelText: 'Minimum lens units',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _maxItems,
                    validator: _positiveInteger,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(
                      labelText: 'Gift choices to show',
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Text(
                      _error!,
                      style: const TextStyle(color: Color(0xffb4233e)),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Save free gift settings'),
                  ),
                ],
              ),
            ),
      bottomNavigationBar: !_loading && _error != null && _categories.isEmpty
          ? SafeArea(
              child: TextButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            )
          : null,
    );
  }
}
