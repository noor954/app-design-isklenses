import { NextRequest } from 'next/server'
import { createAdminReview, getAdminReviews } from '@/app/actions/catalog-admin'
import { adminApiFailure, adminApiResponse, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getAdminReviews())
}

export async function POST(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    assertOptionalBooleans(body, ['isApproved'])
    return adminApiResponse(() => createAdminReview(body as Parameters<typeof createAdminReview>[0]), 201)
  } catch (error) {
    return adminApiFailure(error)
  }
}
