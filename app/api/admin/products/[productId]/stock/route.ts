import { NextRequest } from 'next/server'
import { updateProductStock } from '@/app/actions/admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ productId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ productId }, body] = await Promise.all([params, readAdminJson(request)])
    if (typeof body.quantity !== 'number' || !Number.isSafeInteger(body.quantity) || body.quantity < 0) {
      throw new AdminRequestError('Stock quantity must be a non-negative whole number.', 400)
    }
    return adminApiResponse(() => updateProductStock(productId, body.quantity as number))
  } catch (error) {
    return adminApiFailure(error)
  }
}
