import { NextRequest } from 'next/server'
import { deleteBanner } from '@/app/actions/content'
import { adminApiFailure, adminApiResponse, assertAdminOrigin } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ bannerId: string }> }

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { bannerId } = await params
    assertAdminOrigin(request)
    return adminApiResponse(() => deleteBanner(bannerId))
  } catch (error) {
    return adminApiFailure(error)
  }
}
