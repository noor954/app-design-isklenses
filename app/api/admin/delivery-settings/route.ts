import { NextRequest } from 'next/server'
import { getDeliverySettings, saveDeliverySettings } from '@/app/actions/admin'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getDeliverySettings())
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    return adminApiResponse(() => saveDeliverySettings(body as Parameters<typeof saveDeliverySettings>[0]))
  } catch (error) {
    return adminApiFailure(error)
  }
}
