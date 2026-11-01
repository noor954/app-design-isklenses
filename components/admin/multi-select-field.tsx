type MultiSelectOption = {
  value: string
  label: string
}

export function MultiSelectField({
  name,
  options,
  selected,
  placeholder,
  label,
  onChange,
}: {
  name: string
  options: MultiSelectOption[]
  selected: string[]
  placeholder: string
  label: string
  onChange: (value: string, checked: boolean) => void
}) {
  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label)
  const summary = selectedLabels.length
    ? `${selectedLabels.slice(0, 2).join(', ')}${selectedLabels.length > 2 ? ` +${selectedLabels.length - 2}` : ''}`
    : placeholder

  return (
    <details className="isk-multi-select">
      <summary aria-label={`${label}: ${selectedLabels.length ? `${selectedLabels.length} selected` : placeholder}`}>
        <span className={selectedLabels.length ? 'isk-multi-select-summary' : 'isk-multi-select-summary is-placeholder'}>{summary}</span>
        <span className="isk-multi-select-count">{selectedLabels.length}</span>
      </summary>
      <div className="isk-multi-select-menu" role="group" aria-label={label}>
        {options.map((option) => (
          <label key={option.value} className="isk-multi-select-option">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={selected.includes(option.value)}
              onChange={(event) => onChange(option.value, event.target.checked)}
            />
            <span>{option.label}</span>
          </label>
        ))}
        {options.length === 0 && <p className="px-3 py-2 text-sm text-[#526b7b]">No options available.</p>}
      </div>
    </details>
  )
}
