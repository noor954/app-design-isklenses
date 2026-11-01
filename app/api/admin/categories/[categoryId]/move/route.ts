import { NextRequest } from 'next/server'
import { moveCategory } from '@/app/actions/catalog-admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ categoryId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ categoryId }, body] = await Promise.all([params, readAdminJson(request)])
    if (body.direction !== 'up' && body.direction !== 'down') {
      throw new AdminRequestError('Category direction is invalid.', 400)
    }
    return adminApiResponse(() => moveCategory(categoryId, body.direction as 'up' | 'down'))
  } catch (error) {
    return adminApiFailure(error)
  }
}
