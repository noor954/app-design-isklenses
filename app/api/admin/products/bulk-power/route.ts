import { NextRequest } from 'next/server'
import { bulkUpdateProductPowerOptions, type BulkPowerMode } from '@/app/actions/catalog-admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    if (!Array.isArray(body.ids) || !Array.isArray(body.values) || typeof body.mode !== 'string') {
      throw new AdminRequestError('Choose products, power values and an update mode.', 400)
    }
    return adminApiResponse(() => bulkUpdateProductPowerOptions(
      body.ids as string[],
      body.values as string[],
      body.mode as BulkPowerMode,
    ))
  } catch (error) {
    return adminApiFailure(error)
  }
}
