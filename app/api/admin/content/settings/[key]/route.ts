import { NextRequest } from 'next/server'
import { saveSetting } from '@/app/actions/content'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ key: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ key }, body] = await Promise.all([params, readAdminJson(request)])
    if (!Object.hasOwn(body, 'value')) throw new AdminRequestError('Setting value is required.', 400)
    return adminApiResponse(() => saveSetting(key, body.value))
  } catch (error) {
    return adminApiFailure(error)
  }
}
