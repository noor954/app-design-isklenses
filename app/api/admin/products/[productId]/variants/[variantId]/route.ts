import { NextRequest } from 'next/server'
import { archiveProductVariant, updateProductVariant } from '@/app/actions/admin'
import { adminApiFailure, adminApiResponse, assertAdminOrigin, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ productId: string; variantId: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ productId, variantId }, body] = await Promise.all([params, readAdminJson(request)])
    return adminApiResponse(() => updateProductVariant(
      productId,
      variantId,
      body as Parameters<typeof updateProductVariant>[2],
    ))
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { productId, variantId } = await params
    assertAdminOrigin(request)
    return adminApiResponse(() => archiveProductVariant(productId, variantId))
  } catch (error) {
    return adminApiFailure(error)
  }
}
