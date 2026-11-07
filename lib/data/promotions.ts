import 'server-only'

import { getCategories } from '@/lib/data/catalog'
import { getSettings } from '@/lib/data/site-content'
import { normalizePromotions, type Promotion } from '@/lib/promotions'

export type PromotionOffer = Promotion & {
  categories: Array<{ id: string; name: string }>
}

export async function getPromotionOffers(): Promise<PromotionOffer[]> {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()])
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
  return normalizePromotions(settings.deals)
    .filter((promotion) => promotion.enabled && promotion.categoryIds.every((id) => categoryNames.has(id)))
    .map((promotion) => ({
      ...promotion,
      categories: promotion.categoryIds.map((id) => ({ id, name: categoryNames.get(id)! })),
    }))
}
