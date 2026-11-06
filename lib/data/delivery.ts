import 'server-only'

import { getSettings } from '@/lib/data/site-content'
import { parseDeliveryRules } from '@/lib/delivery'

export async function getStorefrontDeliveryRules() {
  const settings = await getSettings()
  return parseDeliveryRules(settings.delivery_rules ?? [])
}
