import { NextResponse } from 'next/server'
import { AdminAuthError } from '@/lib/auth/admin'
import { logApplicationError } from '@/lib/errors/log-error'
import { errorLogDetails } from '@/lib/errors/redact'
import { AdminRequestError } from '@/lib/http/admin-request-error'

export async function adminApiError(error: unknown) {
  if (error instanceof AdminRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
  }
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
  }
  if (error instanceof Error && error.constructor === Error && !('code' in error)) {
    return NextResponse.json(
      { error: error.message || 'The admin request is invalid.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  console.error('[admin-api] Request failed', errorLogDetails(error))
  try {
    await logApplicationError({
      source: 'admin-api',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'An unknown admin API error occurred.',
      stack: error instanceof Error ? error.stack : null,
    })
  } catch (logError) {
    console.error('[admin-api] Could not persist error log', logError instanceof Error ? logError.name : 'UnknownError')
  }
  return NextResponse.json(
    { error: 'The admin request could not be completed.' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  )
}
