import { NextRequest } from 'next/server'
import { deleteLensType, saveLensType } from '@/app/actions/catalog-taxonomy'
import { adminApiFailure, adminApiResponse, assertAdminOrigin, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ lensTypeId: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ lensTypeId }, body] = await Promise.all([params, readAdminJson(request)])
    assertOptionalBooleans(body, ['isActive'])
    return adminApiResponse(() => saveLensType({ ...body, id: lensTypeId } as Parameters<typeof saveLensType>[0]))
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { lensTypeId } = await params
    assertAdminOrigin(request)
    return adminApiResponse(() => deleteLensType(lensTypeId))
  } catch (error) {
    return adminApiFailure(error)
  }
}
