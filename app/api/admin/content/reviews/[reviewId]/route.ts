import { NextRequest } from 'next/server'
import { deleteReview } from '@/app/actions/content'
import { adminApiFailure, adminApiResponse, assertAdminOrigin } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ reviewId: string }> }

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { reviewId } = await params
    assertAdminOrigin(request)
    return adminApiResponse(() => deleteReview(reviewId))
  } catch (error) {
    return adminApiFailure(error)
  }
}
