import { NextRequest } from 'next/server'
import { deleteReview, setReviewApproval } from '@/app/actions/catalog-admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, assertAdminOrigin, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ reviewId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ reviewId }, body] = await Promise.all([params, readAdminJson(request)])
    if (typeof body.approved !== 'boolean') {
      throw new AdminRequestError('Review approval must be enabled or disabled.', 400)
    }
    return adminApiResponse(() => setReviewApproval(reviewId, body.approved as boolean))
  } catch (error) {
    return adminApiFailure(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { reviewId } = await params
    assertAdminOrigin(request)
    return adminApiResponse(() => deleteReview(reviewId))
  } catch (error) {
    return adminApiFailure(error)
  }
}
