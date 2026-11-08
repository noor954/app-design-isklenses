export function redactErrorLogValue(value: string) {
  return value
    .replace(
      /\b(password|token|secret|authorization|cookie|api[-_ ]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1$2[REDACTED]',
    )
    .replace(/([?&][^\s&#=]+)=([^&#\s]*)/g, '$1=[REDACTED]')
}

export function errorLogDetails(error: unknown) {
  if (!(error instanceof Error)) return { name: 'UnknownError', message: 'An unknown error occurred.' }
  const code = 'code' in error && (typeof error.code === 'string' || typeof error.code === 'number')
    ? error.code
    : undefined
  return {
    name: error.name,
    message: redactErrorLogValue(error.message || error.name),
    ...(code === undefined ? {} : { code }),
  }
}
