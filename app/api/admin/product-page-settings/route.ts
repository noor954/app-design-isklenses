import { NextRequest } from 'next/server'
import { getAdminProductPageSettings, saveProductPageSettings } from '@/app/actions/catalog-admin'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getAdminProductPageSettings())
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    return adminApiResponse(() => saveProductPageSettings(body as Parameters<typeof saveProductPageSettings>[0]))
  } catch (error) {
    return adminApiFailure(error)
  }
}
