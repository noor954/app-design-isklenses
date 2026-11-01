import 'package:flutter/material.dart';

const _controlBlue = Color(0xff006f9b);
const _controlInk = Color(0xff15384d);

class IskDropdownField<T> extends StatelessWidget {
  const IskDropdownField({
    required this.value,
    required this.decoration,
    required this.items,
    required this.onChanged,
    this.validator,
    super.key,
  });

  final T? value;
  final InputDecoration decoration;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;
  final FormFieldValidator<T>? validator;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      decoration: decoration,
      items: items,
      onChanged: onChanged,
      validator: validator,
      isExpanded: true,
      dropdownColor: Colors.white,
      borderRadius: BorderRadius.circular(12),
      menuMaxHeight: 420,
      iconEnabledColor: _controlBlue,
      style: const TextStyle(color: _controlInk),
    );
  }
}
