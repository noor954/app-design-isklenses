export function redactErrorLogValue(value: string) {
  return value
    .replace(
      /\b(password|token|secret|authorization|cookie|api[-_ ]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1$2[REDACTED]',
    )
    .replace(/(\bparams:\s*)[^\r\n]*/gi, '$1[REDACTED]')
    .replace(/([?&][^\s&#=]+)=([^&#\s]*)/g, '$1=[REDACTED]')
}

function summarizeError(error: unknown, depth = 0, seen = new WeakSet<object>()): Record<string, unknown> {
  if (!(error instanceof Error)) return { name: 'UnknownError', message: 'An unknown error occurred.' }
  if (seen.has(error)) return { name: error.name, message: '[Circular error cause]' }
  seen.add(error)

  const code = 'code' in error && (typeof error.code === 'string' || typeof error.code === 'number')
    ? error.code
    : undefined
  const cause = depth < 3 && 'cause' in error && error.cause !== undefined
    ? summarizeError(error.cause, depth + 1, seen)
    : undefined
  return {
    name: error.name,
    message: redactErrorLogValue(error.message || error.name),
    ...(code === undefined ? {} : { code }),
    ...(cause === undefined ? {} : { cause }),
  }
}

export function errorLogDetails(error: unknown) {
  return summarizeError(error)
}
