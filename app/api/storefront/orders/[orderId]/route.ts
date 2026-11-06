import { NextResponse } from 'next/server'
import { getOrderDetail } from '@/app/actions/checkout'
import { getCustomerSession, getOrderReceipt } from '@/lib/auth/store-customer'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const { orderId } = await params
    const [session, receipt] = await Promise.all([getCustomerSession(), getOrderReceipt()])
    const id = orderId === 'receipt' ? receipt?.orderId : orderId
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Order not found or unavailable.' }, { status: 404, headers })
    }
    if (!session && receipt?.orderId !== id) {
      return NextResponse.json({ error: 'Order not found or unavailable.' }, { status: 404, headers })
    }
    const order = await getOrderDetail(id)
    if (!order || (receipt?.orderId !== id && order.accountId !== session?.customerId)) {
      return NextResponse.json({ error: 'Order not found or unavailable.' }, { status: 404, headers })
    }
    const { accountId: _accountId, ...detail } = order
    return NextResponse.json({ data: detail }, { headers })
  } catch (error) {
    console.error('[order-detail] Request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Order details are temporarily unavailable.' }, { status: 500, headers })
  }
}
