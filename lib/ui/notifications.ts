'use client'

export type NotificationLevel = 'error' | 'info' | 'warning'

export type AppNotification = {
  id: string
  level: NotificationLevel
  message: string
}

type ErrorReportContext = {
  phase?: 'operation' | 'runtime' | 'next-error-boundary'
  digest?: string
  componentStack?: string
  filename?: string
  line?: number
  column?: number
}

type ErrorWithDiagnostics = {
  digest?: unknown
  componentStack?: unknown
  cause?: unknown
  code?: unknown
  status?: unknown
  statusCode?: unknown
}

let notificationSequence = 0
const subscribers = new Set<(notification: AppNotification) => void>()
const pendingNotifications: AppNotification[] = []
const recentErrorReports = new Map<string, number>()

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    const diagnosticError = error as Error & ErrorWithDiagnostics
    return {
      name: error.name || 'Error',
      message: error.message || 'An error occurred without a message.',
      stack: error.stack ?? null,
      digest: typeof diagnosticError.digest === 'string' ? diagnosticError.digest : undefined,
      componentStack: typeof diagnosticError.componentStack === 'string' ? diagnosticError.componentStack : undefined,
      code: diagnosticError.code,
      status: diagnosticError.status,
      statusCode: diagnosticError.statusCode,
      cause: diagnosticError.cause,
    }
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: error || 'An empty error string was thrown.', stack: null, digest: undefined, componentStack: undefined, code: undefined, status: undefined, statusCode: undefined, cause: undefined }
  }
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    return {
      name: typeof value.name === 'string' ? value.name : 'NonErrorThrown',
      message: typeof value.message === 'string' ? value.message : 'A non-Error value was thrown.',
      stack: typeof value.stack === 'string' ? value.stack : null,
      digest: typeof value.digest === 'string' ? value.digest : undefined,
      componentStack: typeof value.componentStack === 'string' ? value.componentStack : undefined,
      code: value.code,
      status: value.status,
      statusCode: value.statusCode,
      cause: value.cause,
    }
  }
  return {
    name: 'NonErrorThrown',
    message: error === null ? 'A null value was thrown.' : `A ${typeof error} value was thrown.`,
    stack: null,
    digest: undefined,
    componentStack: undefined,
    code: undefined,
    status: undefined,
    statusCode: undefined,
    cause: undefined,
  }
}

function summarizeCause(error: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (error === undefined || error === null || depth >= 3) return undefined
  if (typeof error !== 'object') return String(error).slice(0, 1000)
  if (seen.has(error)) return '[Circular cause]'
  seen.add(error)

  const details = getErrorDetails(error)
  const cause = summarizeCause(details.cause, depth + 1, seen)
  return {
    name: details.name.slice(0, 200),
    message: details.message.slice(0, 1000),
    ...(cause === undefined ? {} : { cause }),
  }
}

function diagnosticScalar(value: unknown) {
  if (typeof value === 'string') return value.slice(0, 200)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  return undefined
}

function describeReactProductionError(message: string, digest?: string) {
  const match = message.match(/Minified React error #(\d+)/)
  if (!match) return null
  const code = Number(match[1])
  const original = `Original production message: ${message}`
  if (code === 441) {
    return `Server Component rendering failed (React #441). ${digest ? `Match server error logs using digest ${digest}.` : 'The server request error log contains the underlying exception when available.'} ${original}`
  }
  if (code === 418) {
    return `React hydration failed because server-rendered markup differed from the client render. Check browser-only branches, nondeterministic values, locale formatting, changing external data, invalid HTML nesting, and extensions. ${original}`
  }
  if ([419, 422, 423, 424, 425].includes(code)) {
    return `React recovered from a server-rendering or hydration error by switching some or all of the UI to client rendering. Inspect the preceding server logs and render inputs. ${original}`
  }
  return `React reported production error code ${code}. The original details and component trace are preserved below. ${original}`
}

function sanitizeFilename(filename: string | undefined) {
  if (!filename) return undefined
  try {
    const url = new URL(filename, window.location.href)
    return `${url.origin}${url.pathname}`
  } catch {
    return filename.split(/[?#]/, 1)[0].slice(0, 1000)
  }
}

function buildDiagnosticStack(
  stack: string | null,
  context: ErrorReportContext,
  errorComponentStack?: string,
  cause?: unknown,
  errorDetails?: { code: unknown; status: unknown; statusCode: unknown },
  digest?: string,
) {
  if (typeof window === 'undefined') return stack
  const diagnostics = {
    phase: context.phase ?? 'operation',
    route: window.location.pathname,
    reportedAt: new Date().toISOString(),
    digest,
    userAgent: navigator.userAgent,
    language: navigator.language,
    online: navigator.onLine,
    filename: sanitizeFilename(context.filename),
    line: context.line,
    column: context.column,
    componentStack: (context.componentStack ?? errorComponentStack)?.slice(0, 3000),
    code: diagnosticScalar(errorDetails?.code),
    status: diagnosticScalar(errorDetails?.status),
    statusCode: diagnosticScalar(errorDetails?.statusCode),
    cause: summarizeCause(cause),
  }
  const runtimeContext = `[client diagnostic context]\n${JSON.stringify(diagnostics, null, 2)}`
  return [runtimeContext, stack].filter(Boolean).join('\n\n').slice(0, 7000)
}

export function notify(level: NotificationLevel, message: string) {
  if (!message.trim()) return
  const notification: AppNotification = {
    id: `${Date.now()}-${++notificationSequence}`,
    level,
    message: message.trim(),
  }
  if (subscribers.size) subscribers.forEach((subscriber) => subscriber(notification))
  else pendingNotifications.push(notification)
}

export function subscribeNotifications(subscriber: (notification: AppNotification) => void) {
  subscribers.add(subscriber)
  pendingNotifications.splice(0).forEach(subscriber)
  return () => subscribers.delete(subscriber)
}

export function reportError(error: unknown, fallback = 'Something went wrong. Please try again.', context: ErrorReportContext = {}) {
  const details = getErrorDetails(error)
  const reactProductionCode = Number(details.message.match(/Minified React error #(\d+)/)?.[1]) || null
  const reactMessage = describeReactProductionError(details.message, context.digest ?? details.digest)
  const errorName = reactProductionCode === 441
    ? 'ReactServerComponentError'
    : reactProductionCode ? 'ReactProductionError' : details.name
  const message = (reactMessage ?? (details.message.trim() ? details.message : fallback)).slice(0, 3000)
  const userMessage = reactMessage ? fallback : message
  const source = (typeof window !== 'undefined' ? window.location.pathname : 'browser').slice(0, 1000)
  const digest = context.digest ?? details.digest
  const cause = summarizeCause(details.cause)
  const stack = buildDiagnosticStack(details.stack, context, details.componentStack, details.cause, details, digest)
  const dedupeKey = `${source}\n${errorName}\n${digest ?? message}`
  const now = Date.now()
  for (const [key, reportedAt] of recentErrorReports) {
    if (now - reportedAt > 30_000) recentErrorReports.delete(key)
  }
  const duplicate = recentErrorReports.has(dedupeKey)
  recentErrorReports.set(dedupeKey, now)
  while (recentErrorReports.size > 100) {
    const oldestKey = recentErrorReports.keys().next().value
    if (oldestKey === undefined) break
    recentErrorReports.delete(oldestKey)
  }
  if (!duplicate) {
    console.error('[client-error] Unhandled application error', {
      source,
      phase: context.phase ?? 'operation',
      errorName,
      message,
      digest,
      stack,
      cause,
    })
  }
  if (typeof window !== 'undefined' && !duplicate) {
    let reportMessage = message
    let reportStack = stack ?? ''
    const createBody = () => JSON.stringify({
      source,
      errorName: errorName.slice(0, 200),
      message: reportMessage,
      stack: reportStack || undefined,
    })
    let body = createBody()
    while (new TextEncoder().encode(body).byteLength > 15_000 && (reportStack || reportMessage.length > 1)) {
      if (reportStack) reportStack = reportStack.slice(0, Math.floor(reportStack.length / 2))
      else reportMessage = reportMessage.slice(0, Math.floor(reportMessage.length / 2))
      body = createBody()
    }
    void fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).then((response) => {
      if (!response.ok) {
        console.error('[client-error] Central error report was rejected', {
          source,
          status: response.status,
          statusText: response.statusText,
        })
      }
    }).catch((logError: unknown) => {
      const logDetails = getErrorDetails(logError)
      console.error('[client-error] Central error report could not be delivered', {
        source,
        errorName: logDetails.name,
        message: logDetails.message,
        stack: logDetails.stack,
      })
    })
  }
  notify('error', userMessage)
  return userMessage
}
