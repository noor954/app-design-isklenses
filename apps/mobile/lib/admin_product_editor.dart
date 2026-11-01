import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import 'isk_controls.dart';
import 'store_api.dart';

const _adminBlue = Color(0xff006f9b);

class AdminProductEditorScreen extends StatefulWidget {
  const AdminProductEditorScreen({
    required this.api,
    this.productId,
    super.key,
  });

  final AdminApi api;
  final String? productId;

  @override
  State<AdminProductEditorScreen> createState() =>
      _AdminProductEditorScreenState();
}

class _AdminProductEditorScreenState extends State<AdminProductEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  final _controllers = <String, TextEditingController>{
    for (final field in const [
      'name',
      'slug',
      'sku',
      'price',
      'compareAtPrice',
      'shortDescription',
      'description',
      'material',
      'wearDuration',
      'packContents',
      'powerType',
      'powerRange',
      'features',
      'usageInstructions',
      'seoTitle',
      'seoDescription',
    ])
      field: TextEditingController(),
  };

  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _brands = [];
  List<Map<String, dynamic>> _shades = [];
  List<Map<String, dynamic>> _types = [];
  List<Map<String, dynamic>> _variants = [];
  List<Map<String, dynamic>> _assets = [];
  List<Map<String, dynamic>> _allProducts = [];
  List<Map<String, dynamic>> _powerOptions = [];
  final Set<String> _categoryIds = {};
  final Set<String> _powerSelection = {};
  final Set<String> _relatedProductIds = {};
  String? _brandId;
  String? _shadeId;
  String? _typeId;
  String? _diameter;
  String? _baseCurve;
  String? _waterContent;
  String _status = 'active';
  String _currency = 'PKR';
  bool _uvProtection = false;
  bool _fdaApproved = false;
  bool _isFeatured = false;
  String? _createdProductId;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  String? get _currentProductId => widget.productId ?? _createdProductId;
  bool get _editing => _currentProductId != null;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final responses = await Future.wait([
        widget.api.get('/api/admin/categories'),
        widget.api.get('/api/admin/brands'),
        widget.api.get('/api/admin/lens-shades'),
        widget.api.get('/api/admin/lens-types'),
        if (_editing) widget.api.get('/api/admin/products/$_currentProductId'),
        if (_editing)
          widget.api.get('/api/admin/products/$_currentProductId/variants'),
        widget.api.get('/api/admin/content'),
        widget.api.get('/api/admin/products'),
      ]);
      _categories = _mapList(responses[0]['data']);
      _brands = _mapList(responses[1]['data']);
      _shades = _mapList(responses[2]['data']);
      _types = _mapList(responses[3]['data']);
      final settings = responses[responses.length - 2]['settings'];
      final powerOptions = settings is Map ? settings['power_options'] : null;
      _powerOptions = _mapList(powerOptions);
      _allProducts = _mapList(responses.last['data']);
      if (_editing) {
        final product = responses[4]['data'];
        if (product is! Map) {
          throw const StoreApiException('The product could not be loaded.');
        }
        _applyProduct(Map<String, dynamic>.from(product));
        _variants = _mapList(responses[5]['data']);
        _assets = _mapList(product['assets']);
        final related = product['relatedProductIds'];
        if (related is List) {
          _relatedProductIds.addAll(related.whereType<String>());
        }
      }
    } on StoreApiException catch (error) {
      _error = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static List<Map<String, dynamic>> _mapList(dynamic value) {
    if (value is! List) return [];
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: true);
  }

  void _applyProduct(Map<String, dynamic> product) {
    for (final key in _controllers.keys) {
      final value = product[key];
      if (value != null) {
        _controllers[key]!.text = key == 'features' && value is List
            ? value.join('\n')
            : value.toString();
      }
    }
    final categories = product['categoryIds'];
    if (categories is List) {
      _categoryIds.addAll(categories.whereType<String>());
    } else if (product['categoryId'] is String) {
      _categoryIds.add(product['categoryId'] as String);
    }
    final ranges = product['availablePowerRanges'];
    if (ranges is List) _powerSelection.addAll(ranges.whereType<String>());
    _brandId = product['brandId']?.toString();
    _shadeId = product['lensShadeId']?.toString();
    _typeId = product['lensTypeId']?.toString();
    _diameter = product['diameterMm']?.toString();
    _baseCurve = product['baseCurve']?.toString();
    _waterContent = product['waterContent']?.toString();
    _status = product['status']?.toString() ?? 'active';
    _currency = product['currency']?.toString() ?? 'PKR';
    _uvProtection = product['uvProtection'] == true;
    _fdaApproved = product['fdaApproved'] == true;
    _isFeatured = product['isFeatured'] == true;
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Required' : null;

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_categoryIds.isEmpty) {
      setState(() => _error = 'Choose at least one product category.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final values = <String, dynamic>{
      for (final key in _controllers.keys)
        if (key != 'features') key: _controllers[key]!.text.trim(),
      'features': _controllers['features']!.text
          .split('\n')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList(growable: false),
      'categoryIds': _categoryIds.toList(growable: false),
      'brandId': _brandId,
      'lensShadeId': _shadeId,
      'lensTypeId': _typeId,
      'diameterMm': _diameter,
      'baseCurve': _baseCurve,
      'waterContent': _waterContent,
      'availablePowerRanges': _powerOptions
          .map((option) => option['value']?.toString() ?? '')
          .where(_powerSelection.contains)
          .toList(growable: false),
      'status': _status,
      'currency': _currency,
      'uvProtection': _uvProtection,
      'fdaApproved': _fdaApproved,
      'isFeatured': _isFeatured,
    };
    try {
      String productId;
      if (_editing) {
        productId = _currentProductId!;
        await widget.api.put('/api/admin/products/$productId', values);
      } else {
        final response = await widget.api.post('/api/admin/products', values);
        final data = response['data'];
        if (data is! Map || data['id'] is! String) {
          throw const StoreApiException(
            'The product was saved but its identifier was not returned.',
          );
        }
        productId = data['id'] as String;
        if (mounted) setState(() => _createdProductId = productId);
      }
      await widget.api.put('/api/admin/products/$productId/relations', {
        'relatedIds': _relatedProductIds.toList(growable: false),
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
      appBar: AppBar(
        title: Text(_editing ? 'Edit product' : 'Create product'),
        actions: [
          TextButton(
            onPressed: _loading || _saving ? null : _save,
            child: _saving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  if (_error != null) _ErrorNotice(message: _error!),
                  _section('Product identity', [
                    _field('name', 'Product name', required: true),
                    _field('slug', 'URL slug'),
                    _field('sku', 'SKU'),
                    _dropdown<String>(
                      label: 'Status',
                      value: _status,
                      values: const ['active', 'draft', 'archived'],
                      onChanged: (value) => setState(() => _status = value!),
                    ),
                    _field('shortDescription', 'Short description'),
                    _field('description', 'Description', lines: 4),
                  ]),
                  _section('Pricing and availability', [
                    Row(
                      children: [
                        Expanded(
                          child: _field(
                            'price',
                            'Price',
                            required: true,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _field(
                            'compareAtPrice',
                            'Compare-at price',
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                          ),
                        ),
                      ],
                    ),
                    _dropdown<String>(
                      label: 'Currency',
                      value: _currency,
                      values: const ['PKR', 'USD', 'EUR', 'GBP'],
                      onChanged: (value) => setState(() => _currency = value!),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Featured product'),
                      value: _isFeatured,
                      onChanged: (value) => setState(() => _isFeatured = value),
                    ),
                  ]),
                  _section('Catalog placement', [
                    if (_categories.isEmpty)
                      const Text('No categories are available.')
                    else
                      ExpansionTile(
                        leading: const Icon(Icons.category_outlined),
                        title: const Text('Categories'),
                        subtitle: Text(
                          _categoryIds.isEmpty
                              ? 'Choose one or more categories'
                              : '${_categoryIds.length} selected',
                        ),
                        childrenPadding: const EdgeInsets.fromLTRB(
                          12,
                          0,
                          12,
                          12,
                        ),
                        children: [
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: _categories
                                .map((category) {
                                  final id = category['id']?.toString() ?? '';
                                  return FilterChip(
                                    label: Text(
                                      category['name']?.toString() ??
                                          'Category',
                                    ),
                                    selected: _categoryIds.contains(id),
                                    onSelected: id.isEmpty
                                        ? null
                                        : (selected) => setState(() {
                                            if (selected) {
                                              _categoryIds.add(id);
                                            } else {
                                              _categoryIds.remove(id);
                                            }
                                          }),
                                  );
                                })
                                .toList(growable: false),
                          ),
                        ],
                      ),
                    _recordDropdown('Brand', _brands, _brandId, (value) {
                      setState(() => _brandId = value);
                    }),
                    _recordDropdown('Lens shade', _shades, _shadeId, (value) {
                      setState(() => _shadeId = value);
                    }),
                    _recordDropdown('Lens type', _types, _typeId, (value) {
                      setState(() => _typeId = value);
                    }),
                  ]),
                  _section('Related products', [
                    const Text(
                      'Choose up to 24 products to recommend together.',
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton.icon(
                        onPressed: _chooseRelatedProducts,
                        icon: const Icon(Icons.add_link),
                        label: Text(
                          _relatedProductIds.isEmpty
                              ? 'Choose products'
                              : 'Edit ${_relatedProductIds.length} selected',
                        ),
                      ),
                    ),
                    if (_relatedProductIds.isNotEmpty)
                      Wrap(
                        spacing: 6,
                        children: _relatedProductIds
                            .map((id) {
                              final name = _allProducts
                                  .where((product) => product['id'] == id)
                                  .map((product) => product['name']?.toString())
                                  .firstOrNull;
                              return Chip(
                                label: Text(name ?? 'Product'),
                                onDeleted: () => setState(
                                  () => _relatedProductIds.remove(id),
                                ),
                              );
                            })
                            .toList(growable: false),
                      ),
                  ]),
                  _section('Lens specifications', [
                    Row(
                      children: [
                        Expanded(
                          child: _measurementDropdown(
                            label: 'Diameter (mm)',
                            value: _diameter,
                            options: _lensMeasurements,
                            onChanged: (value) =>
                                setState(() => _diameter = value),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _measurementDropdown(
                            label: 'Base curve (mm)',
                            value: _baseCurve,
                            options: _lensMeasurements,
                            onChanged: (value) =>
                                setState(() => _baseCurve = value),
                          ),
                        ),
                      ],
                    ),
                    _measurementDropdown(
                      label: 'Water content (%)',
                      value: _waterContent,
                      options: _waterContents,
                      onChanged: (value) =>
                          setState(() => _waterContent = value),
                    ),
                    _field('material', 'Material'),
                    _field('wearDuration', 'Wear duration'),
                    _field('packContents', 'Pack contents'),
                    _field('powerType', 'Power type'),
                    _field('powerRange', 'Power range'),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('UV protection'),
                      value: _uvProtection,
                      onChanged: (value) =>
                          setState(() => _uvProtection = value),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('FDA approved'),
                      value: _fdaApproved,
                      onChanged: (value) =>
                          setState(() => _fdaApproved = value),
                    ),
                    const Text('Power ranges shown to customers'),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: _powerOptions
                          .map((option) {
                            final range = option['value']?.toString() ?? '';
                            final label = option['label']?.toString() ?? range;
                            final surcharge = option['surcharge']?.toString() ?? '0';
                            final selected = _powerSelection.contains(range);
                            return FilterChip(
                              label: Text('$label · Rs $surcharge / eye'),
                              selected: selected,
                              onSelected: (value) => setState(() {
                                if (value) {
                                  _powerSelection.add(range);
                                } else {
                                  _powerSelection.remove(range);
                                }
                              }),
                            );
                          })
                          .toList(growable: false),
                    ),
                    _field('features', 'Features (one per line)', lines: 4),
                    _field('usageInstructions', 'Usage instructions', lines: 4),
                  ]),
                  _section('Search display', [
                    _field('seoTitle', 'SEO title'),
                    _field('seoDescription', 'SEO description', lines: 3),
                  ]),
                  if (_editing) _assetSection(),
                  if (_editing) _variantSection(),
                  if (_error != null) _ErrorNotice(message: _error!),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: Text(_saving ? 'Saving…' : 'Save product'),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _section(String title, List<Widget> children) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Card(
      color: Colors.white,
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: _adminBlue,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    ),
  );

  Widget _field(
    String key,
    String label, {
    bool required = false,
    int lines = 1,
    TextInputType? keyboardType,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: TextFormField(
      controller: _controllers[key],
      minLines: lines,
      maxLines: lines,
      keyboardType: keyboardType,
      validator: required ? _required : null,
      decoration: InputDecoration(labelText: label),
    ),
  );

  static final _lensMeasurements = List<String>.generate(
    121,
    (index) => (index / 10).toStringAsFixed(2),
    growable: false,
  );
  static final _waterContents = List<String>.generate(
    101,
    (index) => '$index%',
    growable: false,
  );

  Widget _measurementDropdown({
    required String label,
    required String? value,
    required List<String> options,
    required ValueChanged<String?> onChanged,
  }) {
    final selected = options.contains(value) ? value : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: IskDropdownField<String>(
        value: selected,
        validator: (value) =>
            value == null ? 'Select $label before saving.' : null,
        decoration: InputDecoration(labelText: label),
        items: options
            .map(
              (option) => DropdownMenuItem(value: option, child: Text(option)),
            )
            .toList(growable: false),
        onChanged: onChanged,
      ),
    );
  }

  Widget _dropdown<T>({
    required String label,
    required T value,
    required List<T> values,
    required ValueChanged<T?> onChanged,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: IskDropdownField<T>(
      value: value,
      decoration: InputDecoration(labelText: label),
      items: values
          .map(
            (item) =>
                DropdownMenuItem<T>(value: item, child: Text(item.toString())),
          )
          .toList(growable: false),
      onChanged: onChanged,
    ),
  );

  Widget _recordDropdown(
    String label,
    List<Map<String, dynamic>> records,
    String? value,
    ValueChanged<String?> onChanged,
  ) {
    final options = records
        .map(
          (item) =>
              (item['id']?.toString() ?? '', item['name']?.toString() ?? ''),
        )
        .where((item) => item.$1.isNotEmpty)
        .toList(growable: false);
    final selected = options.any((item) => item.$1 == value) ? value : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: IskDropdownField<String?>(
        value: selected,
        decoration: InputDecoration(labelText: label),
        items: [
          const DropdownMenuItem<String?>(value: null, child: Text('None')),
          ...options.map(
            (item) =>
                DropdownMenuItem<String?>(value: item.$1, child: Text(item.$2)),
          ),
        ],
        onChanged: onChanged,
      ),
    );
  }

  Widget _variantSection() => _section('Product variants', [
    Align(
      alignment: Alignment.centerRight,
      child: OutlinedButton.icon(
        onPressed: _saving ? null : () => _editVariant(),
        icon: const Icon(Icons.add),
        label: const Text('Add variant'),
      ),
    ),
    if (_variants.isEmpty)
      const Text('No variants configured.')
    else
      ..._variants.map((variant) {
        final id = variant['id']?.toString() ?? '';
        return ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(variant['name']?.toString() ?? 'Variant'),
          subtitle: Text(
            '${variant['sku'] ?? 'No SKU'} · ${variant['price'] ?? ''} ${variant['currency'] ?? ''} · stock ${variant['stockQuantity'] ?? 0}',
          ),
          trailing: PopupMenuButton<String>(
            onSelected: (action) {
              if (action == 'edit') _editVariant(variant);
              if (action == 'archive') _archiveVariant(id);
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'edit', child: Text('Edit variant')),
              PopupMenuItem(value: 'archive', child: Text('Archive variant')),
            ],
          ),
        );
      }),
  ]);

  Widget _assetSection() => _section('Product media', [
    const Text(
      'Upload JPG, PNG, WebP, or AVIF images and MP4/WebM video (4 MB max).',
    ),
    Align(
      alignment: Alignment.centerRight,
      child: OutlinedButton.icon(
        onPressed: _saving ? null : _uploadProductMedia,
        icon: const Icon(Icons.upload_file),
        label: const Text('Choose media'),
      ),
    ),
    if (_assets.isEmpty)
      const Text('No product media uploaded.')
    else
      ..._assets.asMap().entries.map((entry) {
        final index = entry.key;
        final asset = entry.value;
        final id = asset['id']?.toString() ?? '';
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(
            asset['mediaType'] == 'video'
                ? Icons.movie_outlined
                : Icons.image_outlined,
            color: _adminBlue,
          ),
          title: Text(
            asset['altText']?.toString().isNotEmpty == true
                ? asset['altText'].toString()
                : 'Product ${asset['mediaType'] ?? 'image'} ${index + 1}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: Text('Position ${index + 1}'),
          trailing: PopupMenuButton<String>(
            onSelected: (action) {
              if (action == 'up' || action == 'down') {
                _moveAsset(id, action);
              } else if (action == 'delete') {
                _deleteAsset(id);
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'up',
                enabled: index > 0,
                child: const Text('Move earlier'),
              ),
              PopupMenuItem(
                value: 'down',
                enabled: index < _assets.length - 1,
                child: const Text('Move later'),
              ),
              const PopupMenuItem(value: 'delete', child: Text('Delete media')),
            ],
          ),
        );
      }),
  ]);

  Future<void> _chooseRelatedProducts() async {
    final controller = TextEditingController();
    final candidates = _allProducts
        .where((product) => product['id'] != _currentProductId)
        .toList(growable: false);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, update) {
          final query = controller.text.trim().toLowerCase();
          final filtered = candidates
              .where(
                (product) =>
                    query.isEmpty ||
                    (product['name']?.toString().toLowerCase().contains(
                          query,
                        ) ??
                        false),
              )
              .toList(growable: false);
          return SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.78,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: TextField(
                    controller: controller,
                    onChanged: (_) => update(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Search products',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? const Center(child: Text('No matching products.'))
                      : ListView.builder(
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final product = filtered[index];
                            final id = product['id']?.toString() ?? '';
                            final selected = _relatedProductIds.contains(id);
                            return CheckboxListTile(
                              title: Text(
                                product['name']?.toString() ?? 'Product',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              value: selected,
                              onChanged: (value) {
                                if (value == true &&
                                    _relatedProductIds.length >= 24) {
                                  return;
                                }
                                setState(() {
                                  if (value == true) {
                                    _relatedProductIds.add(id);
                                  } else {
                                    _relatedProductIds.remove(id);
                                  }
                                });
                                update(() {});
                              },
                            );
                          },
                        ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text('Done (${_relatedProductIds.length})'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
    controller.dispose();
  }

  Future<void> _uploadProductMedia() async {
    final file = await ImagePicker().pickMedia();
    if (file == null || !mounted) return;
    final description = TextEditingController();
    final altText = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Describe this media'),
        content: TextField(
          controller: description,
          maxLength: 500,
          decoration: const InputDecoration(labelText: 'Alt text (optional)'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, description.text.trim()),
            child: const Text('Upload'),
          ),
        ],
      ),
    );
    description.dispose();
    if (altText == null || !mounted) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final response = await widget.api.uploadFile(
        '/api/admin/products/$_currentProductId/assets',
        file,
        altText: altText,
      );
      final data = response['data'];
      if (data is Map) _assets.add(Map<String, dynamic>.from(data));
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } on PlatformException catch (error) {
      if (mounted) {
        setState(() => _error = error.message ?? 'Media upload failed.');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _moveAsset(String id, String direction) async {
    try {
      await widget.api.patch('/api/admin/assets/$id', {'direction': direction});
      await _reloadProduct();
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _deleteAsset(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete product media?'),
        content: const Text(
          'This permanently removes the selected image or video.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await widget.api.delete('/api/admin/assets/$id');
      await _reloadProduct();
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _reloadProduct() async {
    final response = await widget.api.get(
      '/api/admin/products/$_currentProductId',
    );
    final product = response['data'];
    if (product is Map && mounted) {
      setState(() => _assets = _mapList(product['assets']));
    }
  }

  Future<void> _editVariant([Map<String, dynamic>? existing]) async {
    final fields = <String, TextEditingController>{
      for (final key in const [
        'name',
        'sku',
        'color',
        'powerDiopters',
        'baseCurve',
        'diameterMm',
        'packSize',
        'price',
        'currency',
        'stockQuantity',
      ])
        key: TextEditingController(
          text:
              existing?[key]?.toString() ??
              switch (key) {
                'currency' => _currency,
                'stockQuantity' => '0',
                _ => '',
              },
        ),
    };
    var active = existing?['isActive'] != false;
    final values = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  existing == null ? 'Add variant' : 'Edit variant',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                for (final field in fields.entries)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: TextField(
                      controller: field.value,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                        signed: true,
                      ),
                      decoration: InputDecoration(labelText: _label(field.key)),
                    ),
                  ),
                SwitchListTile(
                  title: const Text('Active'),
                  value: active,
                  onChanged: (value) => update(() => active = value),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, {
                    for (final entry in fields.entries)
                      entry.key: entry.value.text.trim(),
                    'stockQuantity':
                        int.tryParse(fields['stockQuantity']!.text) ?? -1,
                    'packSize': int.tryParse(fields['packSize']!.text),
                    'isActive': active,
                  }),
                  child: const Text('Save variant'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    for (final controller in fields.values) {
      controller.dispose();
    }
    if (values == null || !mounted) return;
    try {
      final path = '/api/admin/products/$_currentProductId/variants';
      if (existing == null) {
        await widget.api.post(path, values);
      } else {
        await widget.api.put('$path/${existing['id']}', values);
      }
      await _loadVariants();
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _archiveVariant(String id) async {
    try {
      await widget.api.delete(
        '/api/admin/products/$_currentProductId/variants/$id',
      );
      await _loadVariants();
    } on StoreApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _loadVariants() async {
    final response = await widget.api.get(
      '/api/admin/products/$_currentProductId/variants',
    );
    if (mounted) setState(() => _variants = _mapList(response['data']));
  }

  static String _label(String key) => switch (key) {
    'powerDiopters' => 'Power (diopters)',
    'baseCurve' => 'Base curve',
    'diameterMm' => 'Diameter (mm)',
    'packSize' => 'Pack size',
    'stockQuantity' => 'Stock quantity',
    _ => key[0].toUpperCase() + key.substring(1),
  };
}

class _ErrorNotice extends StatelessWidget {
  const _ErrorNotice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xfffff1f0),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(message, style: const TextStyle(color: Color(0xff9f1d2c))),
  );
}
