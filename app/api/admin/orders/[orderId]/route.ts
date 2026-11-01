import { NextRequest } from 'next/server'
import { updateOrderDeliveryFee, updateOrderStatus } from '@/app/actions/admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ orderId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ orderId }, body] = await Promise.all([params, readAdminJson(request)])
    if (typeof body.status === 'string') {
      return adminApiResponse(() => updateOrderStatus(orderId, body.status as string))
    }
    if (typeof body.deliveryFee === 'string') {
      return adminApiResponse(() => updateOrderDeliveryFee(orderId, body.deliveryFee as string))
    }
    throw new AdminRequestError('Provide an order status or confirmed delivery fee.', 400)
  } catch (error) {
    return adminApiFailure(error)
  }
}
