import { NextRequest } from 'next/server'
import { bulkUpdateProductPrices, type BulkPriceMode } from '@/app/actions/catalog-admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    if (!Array.isArray(body.ids) || typeof body.mode !== 'string' || typeof body.value !== 'string') {
      throw new AdminRequestError('Choose products, an update mode and a value.', 400)
    }
    return adminApiResponse(() => bulkUpdateProductPrices(
      body.ids as string[],
      body.mode as BulkPriceMode,
      body.value as string,
      body.includeCompareAt !== false,
    ))
  } catch (error) {
    return adminApiFailure(error)
  }
}
