import type { Instrumentation } from 'next'
import { redactErrorLogValue } from '@/lib/errors/redact'

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    const value = error as Error & { digest?: unknown; cause?: unknown }
    return {
      name: error.name || 'Error',
      message: error.message || 'The server threw an error without a message.',
      stack: error.stack ?? null,
      digest: typeof value.digest === 'string' ? value.digest : undefined,
      cause: value.cause,
    }
  }
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    return {
      name: typeof value.name === 'string' ? value.name : 'NonErrorThrown',
      message: typeof value.message === 'string' ? value.message : 'The server threw a non-Error value.',
      stack: typeof value.stack === 'string' ? value.stack : null,
      digest: typeof value.digest === 'string' ? value.digest : undefined,
      cause: value.cause,
    }
  }
  return {
    name: 'NonErrorThrown',
    message: error === null ? 'The server threw null.' : `The server threw a ${typeof error} value.`,
    stack: null,
    digest: undefined,
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
    ...(details.stack ? { stack: details.stack.slice(0, 3000) } : {}),
    ...(cause === undefined ? {} : { cause }),
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const details = getErrorDetails(error)
  const requestPath = request.path.split(/[?#]/, 1)[0].slice(0, 1000)
  const route = context.routePath || requestPath || 'unknown'
  const metadata = {
    digest: details.digest,
    method: request.method,
    requestPath,
    routePath: context.routePath,
    routerKind: context.routerKind,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
    cause: summarizeCause(details.cause),
  }
  const stack = [
    `[server request context]\n${JSON.stringify(metadata, null, 2)}`,
    details.stack,
  ].filter(Boolean).join('\n\n')
  const safeMetadata = JSON.parse(redactErrorLogValue(JSON.stringify(metadata))) as typeof metadata
  const log = {
    source: route,
    errorName: redactErrorLogValue(details.name).slice(0, 200),
    message: redactErrorLogValue(details.message).slice(0, 4000),
    digest: details.digest,
    stack: redactErrorLogValue(stack).slice(0, 12000),
  }

  console.error('[next-request-error] Unhandled server request error', {
    ...log,
    metadata: safeMetadata,
  })

  if (process.env.NEXT_RUNTIME === 'edge') return

  try {
    const { logApplicationError } = await import('@/lib/errors/log-error')
    await logApplicationError({
      source: log.source,
      errorName: log.errorName,
      message: log.message,
      stack: log.stack,
    })
  } catch (loggingError) {
    const loggingErrorDetails = getErrorDetails(loggingError)
    console.error('[next-request-error] Could not persist server error', {
      name: loggingErrorDetails.name,
      message: redactErrorLogValue(loggingErrorDetails.message),
      stack: loggingErrorDetails.stack
        ? redactErrorLogValue(loggingErrorDetails.stack).slice(0, 4000)
        : null,
      originalDigest: details.digest,
    })
  }
}
