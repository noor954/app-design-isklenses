import { NextRequest } from 'next/server'
import { getAdminLensShades, saveLensShade } from '@/app/actions/catalog-taxonomy'
import { adminApiFailure, adminApiResponse, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getAdminLensShades())
}

export async function POST(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    assertOptionalBooleans(body, ['isActive'])
    return adminApiResponse(() => saveLensShade(body as Parameters<typeof saveLensShade>[0]), 201)
  } catch (error) {
    return adminApiFailure(error)
  }
}
