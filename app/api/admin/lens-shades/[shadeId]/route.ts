import { NextRequest } from 'next/server'
import { deleteLensShade, saveLensShade } from '@/app/actions/catalog-taxonomy'
import { adminApiFailure, adminApiResponse, assertAdminOrigin, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ shadeId: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ shadeId }, body] = await Promise.all([params, readAdminJson(request)])
    assertOptionalBooleans(body, ['isActive'])
    return adminApiResponse(() => saveLensShade({ ...body, id: shadeId } as Parameters<typeof saveLensShade>[0]))
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { shadeId } = await params
    assertAdminOrigin(request)
    return adminApiResponse(() => deleteLensShade(shadeId))
  } catch (error) {
    return adminApiFailure(error)
  }
}
