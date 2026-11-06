export const TORIC_ORDER_NOTICE = 'Toric lenses are ordered only after confirmation on WhatsApp. Full payment in advance is required.'

export function isToricLensType(name: string | null | undefined) {
  return name?.trim().toLowerCase() === 'toric'
}

export function toricWhatsAppUrl(productName: string) {
  const message = `Hello, I would like to confirm a Toric lens order for ${productName}. Please advise about prescription requirements, availability and advance payment.`
  return `https://wa.me/923015740405?text=${encodeURIComponent(message)}`
}
