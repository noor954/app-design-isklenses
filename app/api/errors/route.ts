import { NextRequest, NextResponse } from 'next/server'
import { logApplicationError } from '@/lib/errors/log-error'
import { consumePublicRateLimit } from '@/lib/auth/public-rate-limit'
import { isSameOriginOrNativeRequest } from '@/lib/http/api-origin'

const maxRequestBytes = 16 * 1024

export async function POST(request: NextRequest) {
  if (!isSameOriginOrNativeRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!consumePublicRateLimit('error-log', clientIp, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many error reports.' }, { status: 429 })
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Expected a JSON error report.' }, { status: 415 })
  }
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > maxRequestBytes) return NextResponse.json({ error: 'Error report is too large.' }, { status: 413 })

  let input: unknown
  try {
    const body = await request.text()
    if (new TextEncoder().encode(body).byteLength > maxRequestBytes) {
      return NextResponse.json({ error: 'Error report is too large.' }, { status: 413 })
    }
    input = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid error report.' }, { status: 400 })
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Invalid error report.' }, { status: 400 })
  }
  const report = input as Record<string, unknown>
  if (typeof report.message !== 'string' || !report.message.trim()) {
    return NextResponse.json({ error: 'Error message is required.' }, { status: 400 })
  }
  const source = typeof report.source === 'string' ? report.source : 'browser'
  const errorName = typeof report.errorName === 'string' ? report.errorName : 'Error'
  const stack = typeof report.stack === 'string' ? report.stack : null
  try {
    await logApplicationError({ source, errorName, message: report.message, stack })
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[error-log] Could not persist browser error', error)
    return NextResponse.json({ error: 'Error report could not be recorded.' }, { status: 500 })
  }
}
