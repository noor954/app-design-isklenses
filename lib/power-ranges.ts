const POWER_RANGE_MAX_CENTS = 1200

function formatPowerCents(value: number) {
  return (value / 100).toFixed(2)
}

function buildPowerRangeOptions() {
  const options: string[] = []
  let start = 0

  while (start <= POWER_RANGE_MAX_CENTS) {
    const end = Math.min(start === 0 ? 50 : start + 49, POWER_RANGE_MAX_CENTS)
    options.push(`${formatPowerCents(start)}-${formatPowerCents(end)}`)
    start = end + 1
  }

  return options
}

export const POWER_RANGE_OPTIONS = buildPowerRangeOptions()

export function isPowerRangeOption(value: string): boolean {
  return POWER_RANGE_OPTIONS.includes(value)
}
