import { NextRequest } from 'next/server'
import { addProductsToCategory } from '@/app/actions/catalog-admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

export async function POST(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    if (!Array.isArray(body.ids) || typeof body.categoryId !== 'string') {
      throw new AdminRequestError('Choose products and a category.', 400)
    }
    return adminApiResponse(() => addProductsToCategory(body.ids as string[], body.categoryId as string))
  } catch (error) {
    return adminApiFailure(error)
  }
}
