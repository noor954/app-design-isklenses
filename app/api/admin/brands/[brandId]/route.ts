import { NextRequest } from 'next/server'
import { deleteBrand, saveBrand } from '@/app/actions/catalog-taxonomy'
import { adminApiFailure, adminApiResponse, assertAdminOrigin, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ brandId: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ brandId }, body] = await Promise.all([params, readAdminJson(request)])
    assertOptionalBooleans(body, ['isActive'])
    return adminApiResponse(() => saveBrand({ ...body, id: brandId } as Parameters<typeof saveBrand>[0]))
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { brandId } = await params
    assertAdminOrigin(request)
    return adminApiResponse(() => deleteBrand(brandId))
  } catch (error) {
    return adminApiFailure(error)
  }
}
