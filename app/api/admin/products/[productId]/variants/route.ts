import { NextRequest } from 'next/server'
import { createProductVariant, getProductVariants } from '@/app/actions/admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ productId: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { productId } = await params
    return adminApiResponse(() => getProductVariants(productId))
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ productId }, body] = await Promise.all([params, readAdminJson(request)])
    if (typeof body.name !== 'string' || typeof body.price !== 'string' || typeof body.stockQuantity !== 'number') {
      throw new AdminRequestError('Variant name, price, and stock quantity are required.', 400)
    }
    return adminApiResponse(() => createProductVariant(productId, body as Parameters<typeof createProductVariant>[1]), 201)
  } catch (error) {
    return adminApiFailure(error)
  }
}
