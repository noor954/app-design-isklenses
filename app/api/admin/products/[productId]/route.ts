import { NextRequest, NextResponse } from 'next/server'
import { deleteProduct, getAdminProduct, updateProduct, type AdminProductInput } from '@/app/actions/catalog-admin'
import { adminApiFailure, adminApiResponse, assertAdminOrigin, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ productId: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { productId } = await params
    const product = await getAdminProduct(productId)
    return product
      ? adminApiResponse(async () => product)
      : NextResponse.json({ error: 'Product not found.' }, { status: 404 })
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ productId }, body] = await Promise.all([params, readAdminJson(request)])
    assertOptionalBooleans(body, ['uvProtection', 'fdaApproved', 'isFeatured'])
    return adminApiResponse(() => updateProduct(productId, body as AdminProductInput))
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { productId } = await params
    assertAdminOrigin(request)
    return adminApiResponse(() => deleteProduct(productId))
  } catch (error) {
    return adminApiFailure(error)
  }
}
