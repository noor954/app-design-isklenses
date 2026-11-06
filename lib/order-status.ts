export function orderStatusDetails(status: string, paymentMethod: string | null) {
  switch (status) {
    case 'pending': return { label: 'Pending', transit: 'Not dispatched', description: 'The store has received your order and has not yet started processing it.' }
    case 'processing': return { label: 'Processing', transit: 'Not dispatched', description: 'The store is preparing your order.' }
    case 'shipped': return { label: 'Shipped', transit: 'Dispatched', description: 'The store has marked your order as shipped. Live courier tracking is not available here.' }
    case 'delivered': return { label: 'Delivered', transit: 'Delivered', description: 'The store has marked your order as delivered.' }
    case 'paid': return { label: 'Paid', transit: 'Not recorded', description: paymentMethod === 'cash_on_delivery' ? 'The store has marked this cash-on-delivery order as paid. Delivery progress is not recorded separately.' : 'The store has marked this order as paid. Delivery progress is not recorded separately.' }
    case 'cancelled': return { label: 'Cancelled', transit: 'Cancelled', description: 'The store has marked this order as cancelled.' }
    case 'refunded': return { label: 'Refunded', transit: 'Not recorded', description: 'The store has marked this order as refunded. Previous delivery progress is not recorded here.' }
    default: return { label: status, transit: 'Not recorded', description: 'Contact the store for the latest order information.' }
  }
}
