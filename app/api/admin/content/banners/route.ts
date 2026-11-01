import { NextRequest } from 'next/server'
import { saveBanner } from '@/app/actions/content'
import { adminApiFailure, adminApiResponse, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

export async function POST(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    assertOptionalBooleans(body, ['isActive'])
    return adminApiResponse(() => saveBanner(body as Parameters<typeof saveBanner>[0]), body.id ? 200 : 201)
  } catch (error) {
    return adminApiFailure(error)
  }
}
