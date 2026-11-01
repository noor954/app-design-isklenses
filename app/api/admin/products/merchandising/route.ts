import { NextRequest } from 'next/server'
import { getMerchandisingProducts, setProductMerchandising, type MerchandisingKind } from '@/app/actions/catalog-admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getMerchandisingProducts())
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    if (!Array.isArray(body.ids) || !['featured', 'new_arrival', 'on_sale'].includes(String(body.kind)) || typeof body.selected !== 'boolean') {
      throw new AdminRequestError('Choose products, a merchandising section, and whether to enable it.', 400)
    }
    return adminApiResponse(() => setProductMerchandising(
      body.ids as string[],
      body.kind as MerchandisingKind,
      body.selected as boolean,
    ))
  } catch (error) {
    return adminApiFailure(error)
  }
}
