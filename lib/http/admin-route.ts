import { NextResponse } from 'next/server'
import { adminApiError } from '@/lib/auth/admin-api'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { isSameOriginOrNativeRequest } from '@/lib/http/api-origin'

export function assertAdminOrigin(request: Request) {
  if (!isSameOriginOrNativeRequest(request)) {
    throw new AdminRequestError('Cross-origin admin writes are not allowed.', 403)
  }
}

export function assertOptionalBooleans(body: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    if (Object.hasOwn(body, field) && typeof body[field] !== 'boolean') {
      throw new AdminRequestError(`${field} must be true or false.`, 400)
    }
  }
}

export async function readAdminJson(request: Request): Promise<Record<string, unknown>> {
  assertAdminOrigin(request)
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') {
    throw new AdminRequestError('Send a JSON request body.', 415)
  }
  const rawLength = request.headers.get('content-length')
  if (rawLength && !/^\d+$/.test(rawLength)) {
    throw new AdminRequestError('The request body length is invalid.', 400)
  }
  if (rawLength && Number(rawLength) > 1_048_576) {
    throw new AdminRequestError('The request body is too large.', 413)
  }

  const reader = request.body?.getReader()
  if (!reader) throw new AdminRequestError('The JSON request body is empty.', 400)
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > 1_048_576) {
        await reader.cancel()
        throw new AdminRequestError('The request body is too large.', 413)
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof AdminRequestError) throw error
    throw new AdminRequestError('The JSON request body could not be read.', 400)
  }
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)))
  } catch {
    throw new AdminRequestError('The JSON request body is invalid.', 400)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminRequestError('Send a JSON object.', 400)
  }
  return value as Record<string, unknown>
}

export async function adminApiResponse<T>(operation: () => Promise<T>, status = 200) {
  try {
    const data = await operation()
    return NextResponse.json({ data: data ?? null }, { status, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return adminApiError(error)
  }
}

export function adminApiFailure(error: unknown) {
  return adminApiError(error)
}
