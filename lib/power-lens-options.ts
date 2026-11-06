export type PowerLensOption = {
  value: string
  label: string
  surcharge: string
}

function formatDiopter(value: number) {
  return value.toFixed(2)
}

function buildDefaultOptions(): PowerLensOption[] {
  const options: PowerLensOption[] = [
    { value: '0.00', label: '0.00 - Plain', surcharge: '0.00' },
  ]
  for (let quarterDiopters = 1; quarterDiopters <= 56; quarterDiopters += 1) {
    const value = -quarterDiopters / 4
    options.push({
      value: formatDiopter(value),
      label: formatDiopter(value),
      surcharge: '150.00',
    })
  }
  return options
}

export const DEFAULT_POWER_LENS_OPTIONS = buildDefaultOptions()

/** Standard values (0.00 to -14.00 in 0.25 steps) missing from a configured list. */
export function missingStandardPowerOptions(existing: readonly PowerLensOption[]): PowerLensOption[] {
  const present = new Set(existing.map((option) => option.value))
  return DEFAULT_POWER_LENS_OPTIONS.filter((option) => !present.has(option.value))
}

const powerValuePattern = /^-?(?:0|[1-9]\d{0,2})\.\d{2}$/
const moneyPattern = /^\d{1,10}(?:\.\d{1,2})?$/

export function isPowerLensValue(value: string) {
  return powerValuePattern.test(value)
}

export function isValidLensSelection(
  available: readonly string[],
  choice: 'plain' | 'power' | null,
  left: string | null,
  right: string | null,
) {
  if (choice === 'plain') return left === null && right === null && available.length > 0
  if (choice === 'power' || left !== null || right !== null) {
    return left !== null && right !== null && available.includes(left) && available.includes(right)
  }
  return available.length === 0
}

export function normalizePowerLensOptions(value: unknown): PowerLensOption[] {
  if (value === undefined || value === null) return DEFAULT_POWER_LENS_OPTIONS
  if (!Array.isArray(value)) return DEFAULT_POWER_LENS_OPTIONS
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return []
    const option = entry as Record<string, unknown>
    if (
      typeof option.value !== 'string' ||
      typeof option.label !== 'string' ||
      typeof option.surcharge !== 'string' ||
      !powerValuePattern.test(option.value) ||
      !option.label.trim() ||
      !moneyPattern.test(option.surcharge)
    ) return []
    return [{
      value: option.value,
      label: option.label.trim(),
      surcharge: Number(option.surcharge).toFixed(2),
    }]
  })
}

export function validatePowerLensOptions(value: unknown): asserts value is PowerLensOption[] {
  if (!Array.isArray(value) || value.length > 200) {
    throw new Error('Power lens options must be a list of no more than 200 choices.')
  }
  const values = new Set<string>()
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('Each power lens option must include a value, label, and surcharge.')
    }
    const option = entry as Record<string, unknown>
    if (
      typeof option.value !== 'string' ||
      !powerValuePattern.test(option.value) ||
      typeof option.label !== 'string' ||
      !option.label.trim() ||
      option.label.trim().length > 80 ||
      typeof option.surcharge !== 'string' ||
      !moneyPattern.test(option.surcharge)
    ) {
      throw new Error('Enter a valid diopter value, label, and non-negative surcharge for every power option.')
    }
    if (values.has(option.value)) throw new Error(`The power value ${option.value} is listed more than once.`)
    const surcharge = Number(option.surcharge)
    if (!Number.isFinite(surcharge) || surcharge > 1_000_000_000) {
      throw new Error('A power option surcharge is outside the supported range.')
    }
    values.add(option.value)
  }
}

export function resolvePowerOptionValues(
  configuredValues: readonly string[] | null | undefined,
  options: readonly PowerLensOption[],
) {
  const available = new Set(options.map((option) => option.value))
  const resolved = new Set<string>()
  for (const configuredValue of configuredValues ?? []) {
    if (available.has(configuredValue)) {
      resolved.add(configuredValue)
      continue
    }
    const legacyRange = /^(0|[1-9]\d{0,2})\.(\d{2})-(0|[1-9]\d{0,2})\.(\d{2})$/.exec(configuredValue)
    if (!legacyRange) continue
    const start = Number(`${legacyRange[1]}.${legacyRange[2]}`)
    const end = Number(`${legacyRange[3]}.${legacyRange[4]}`)
    for (const option of options) {
      if (Math.abs(Number(option.value)) >= start && Math.abs(Number(option.value)) <= end) {
        resolved.add(option.value)
      }
    }
  }
  return options.filter((option) => resolved.has(option.value)).map((option) => option.value)
}

export function powerSurchargeCents(
  options: readonly PowerLensOption[] | null | undefined,
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
) {
  const byValue = new Map((options ?? []).map((option) => [option.value, option.surcharge]))
  const parseCents = (value: string | null | undefined) => {
    if (!value) return 0
    const surcharge = byValue.get(value)
    if (!surcharge) return null
    const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(surcharge)
    if (!match) return null
    return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  }
  const left = parseCents(leftValue)
  const right = parseCents(rightValue)
  if (left === null || right === null) return null
  return left + right
}

export function priceWithPowerSurcharge(
  basePrice: string,
  options: readonly PowerLensOption[] | null | undefined,
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
) {
  const baseMatch = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(basePrice)
  const surchargeCents = powerSurchargeCents(options, leftValue, rightValue)
  if (!baseMatch || surchargeCents === null) return null
  const baseCents = Number(baseMatch[1]) * 100 + Number((baseMatch[2] ?? '').padEnd(2, '0'))
  const total = baseCents + surchargeCents
  if (!Number.isSafeInteger(total) || total > 999_999_999_999) return null
  return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, '0')}`
}
