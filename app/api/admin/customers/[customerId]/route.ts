import { NextRequest } from 'next/server'
import { updateCustomer } from '@/app/actions/admin'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ customerId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ customerId }, body] = await Promise.all([params, readAdminJson(request)])
    return adminApiResponse(() => updateCustomer(customerId, body))
  } catch (error) {
    return adminApiFailure(error)
  }
}
