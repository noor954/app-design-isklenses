import { NextRequest } from 'next/server'
import {
  bulkUpdateCategoryVisibility,
  createCategory,
  getAdminCategories,
  type CategoryInput,
} from '@/app/actions/catalog-admin'
import { adminApiFailure, adminApiResponse, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getAdminCategories())
}

export async function POST(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    assertOptionalBooleans(body, ['isActive', 'showInMenu'])
    return adminApiResponse(() => createCategory(body as CategoryInput), 201)
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    return adminApiResponse(() => bulkUpdateCategoryVisibility(body.ids, {
      isActive: body.isActive,
      showInMenu: body.showInMenu,
    }))
  } catch (error) {
    return adminApiFailure(error)
  }
}
