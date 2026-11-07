export function redactErrorLogValue(value: string) {
  return value
    .replace(
      /\b(password|token|secret|authorization|cookie|api[-_ ]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1$2[REDACTED]',
    )
    .replace(/([?&][^\s&#=]+)=([^&#\s]*)/g, '$1=[REDACTED]')
}
