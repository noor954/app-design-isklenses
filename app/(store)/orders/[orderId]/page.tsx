import { notFound } from 'next/navigation'
import { getOrderDetail } from '@/app/actions/checkout'
import { OrderDetailView } from '@/components/storefront/order-detail-view'
import { getCustomerSession, getOrderReceipt } from '@/lib/auth/store-customer'

export const dynamic = 'force-dynamic'

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) notFound()
  const [session, receipt] = await Promise.all([getCustomerSession(), getOrderReceipt()])
  if (!session && receipt?.orderId !== orderId) notFound()
  const order = await getOrderDetail(orderId)
  if (!order || (receipt?.orderId !== orderId && order.accountId !== session?.customerId)) notFound()
  return <OrderDetailView order={order} />
}
