import { NextRequest } from 'next/server'
import { getAdminBrands, saveBrand } from '@/app/actions/catalog-taxonomy'
import { adminApiFailure, adminApiResponse, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getAdminBrands())
}

export async function POST(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    assertOptionalBooleans(body, ['isActive'])
    return adminApiResponse(() => saveBrand(body as Parameters<typeof saveBrand>[0]), 201)
  } catch (error) {
    return adminApiFailure(error)
  }
}
