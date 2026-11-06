import { getOrderConfirmation } from '@/app/actions/checkout'
import { OrderDetailView } from '@/components/storefront/order-detail-view'

export const dynamic = 'force-dynamic'

export default async function CheckoutConfirmationPage() {
  return <OrderDetailView order={await getOrderConfirmation()} />
}
