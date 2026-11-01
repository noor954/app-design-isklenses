import { NextRequest } from 'next/server'
import { setProductRelations } from '@/app/actions/catalog-admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ productId: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ productId }, body] = await Promise.all([params, readAdminJson(request)])
    if (!Array.isArray(body.relatedIds) || !body.relatedIds.every((id) => typeof id === 'string')) {
      throw new AdminRequestError('Related products must be a list of product IDs.', 400)
    }
    return adminApiResponse(() => setProductRelations(productId, body.relatedIds as string[]))
  } catch (error) {
    return adminApiFailure(error)
  }
}
