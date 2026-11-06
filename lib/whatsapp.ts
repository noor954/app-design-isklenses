export const WHATSAPP_SUPPORT_URL = 'https://wa.me/923015740405?text=Hello%2C%20I%20have%20a%20question%20about%20ISK%20Lenses.'

export function asksForWhatsApp(message: string) {
  return /\bwhat\s*['’]?\s*s\s*app\b/i.test(message)
}
