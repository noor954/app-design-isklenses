import { NextRequest } from 'next/server'
import { deleteCategory, updateCategory, type CategoryInput } from '@/app/actions/catalog-admin'
import { adminApiFailure, adminApiResponse, assertAdminOrigin, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ categoryId: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ categoryId }, body] = await Promise.all([params, readAdminJson(request)])
    assertOptionalBooleans(body, ['isActive', 'showInMenu'])
    return adminApiResponse(() => updateCategory(categoryId, body as CategoryInput))
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { categoryId } = await params
    assertAdminOrigin(request)
    return adminApiResponse(() => deleteCategory(categoryId))
  } catch (error) {
    return adminApiFailure(error)
  }
}
