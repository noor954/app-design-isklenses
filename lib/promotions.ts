export type PromotionType = 'buy_get_free' | 'bundle_discount'

export type Promotion = {
  id: string
  name: string
  enabled: boolean
  type: PromotionType
  categoryIds: string[]
  buyQuantity: number
  freeQuantity: number
  discountPercent: number
  priority: number
}

export type PromotionLine = {
  quantity: number
  unitPriceCents: number
  categoryIds: string[]
}

export type PromotionResult = {
  promotion: Promotion
  discountCents: number
  freeUnitsByLine: number[]
  discountedUnitsByLine: number[]
  discountCentsByLine: number[]
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_PROMOTIONS = 30
const MAX_BUNDLE_QUANTITY = 100

export function normalizePromotions(value: unknown): Promotion[] {
  if (value === undefined || value === null) return []
  validatePromotions(value)
  return value.map((entry) => {
    const promotion = entry as Promotion
    return {
      ...promotion,
      categoryIds: [...promotion.categoryIds],
    }
  })
}

export function validatePromotions(value: unknown): asserts value is Promotion[] {
  if (!Array.isArray(value) || value.length > MAX_PROMOTIONS) {
    throw new Error(`Deals must be a list of no more than ${MAX_PROMOTIONS} offers.`)
  }
  const ids = new Set<string>()
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`Deal ${index + 1} must be an object.`)
    }
    const promotion = entry as Record<string, unknown>
    if (typeof promotion.id !== 'string' || !uuidPattern.test(promotion.id) || ids.has(promotion.id)) {
      throw new Error(`Deal ${index + 1} needs a unique valid ID.`)
    }
    ids.add(promotion.id)
    if (typeof promotion.name !== 'string' || !promotion.name.trim() || promotion.name.trim().length > 120) {
      throw new Error(`Deal ${index + 1} needs a name of at most 120 characters.`)
    }
    if (typeof promotion.enabled !== 'boolean') throw new Error(`Deal ${index + 1} must be enabled or disabled.`)
    if (promotion.type !== 'buy_get_free' && promotion.type !== 'bundle_discount') {
      throw new Error(`Deal ${index + 1} has an unsupported offer type.`)
    }
    if (
      !Array.isArray(promotion.categoryIds) ||
      promotion.categoryIds.length < 1 ||
      promotion.categoryIds.length > 10 ||
      !promotion.categoryIds.every((id) => typeof id === 'string' && uuidPattern.test(id)) ||
      new Set(promotion.categoryIds).size !== promotion.categoryIds.length
    ) {
      throw new Error(`Deal ${index + 1} must use 1–10 distinct lens categories.`)
    }
    if (
      !Number.isSafeInteger(promotion.buyQuantity) ||
      Number(promotion.buyQuantity) < 1 ||
      Number(promotion.buyQuantity) > MAX_BUNDLE_QUANTITY
    ) {
      throw new Error(`Deal ${index + 1} bundle quantity must be from 1 to ${MAX_BUNDLE_QUANTITY}.`)
    }
    if (promotion.type === 'buy_get_free') {
      if (
        !Number.isSafeInteger(promotion.freeQuantity) ||
        Number(promotion.freeQuantity) < 1 ||
        Number(promotion.freeQuantity) > MAX_BUNDLE_QUANTITY ||
        Number(promotion.buyQuantity) + Number(promotion.freeQuantity) > MAX_BUNDLE_QUANTITY
      ) {
        throw new Error(`Deal ${index + 1} free quantity must be at least 1 and fit within a ${MAX_BUNDLE_QUANTITY}-item bundle.`)
      }
      if (promotion.discountPercent !== 0) throw new Error(`Deal ${index + 1} must set percentage discount to 0 for a free-item offer.`)
      if (promotion.categoryIds.length > Number(promotion.buyQuantity) + Number(promotion.freeQuantity)) {
        throw new Error(`Deal ${index + 1} needs at least one item per selected category in each bundle.`)
      }
    } else {
      if (promotion.freeQuantity !== 0) throw new Error(`Deal ${index + 1} must set free quantity to 0 for a bundle discount.`)
      if (
        !Number.isSafeInteger(promotion.discountPercent) ||
        Number(promotion.discountPercent) < 1 ||
        Number(promotion.discountPercent) > 100
      ) {
        throw new Error(`Deal ${index + 1} discount must be a whole percentage from 1 to 100.`)
      }
      if (promotion.categoryIds.length > Number(promotion.buyQuantity)) {
        throw new Error(`Deal ${index + 1} needs at least one item per selected category in each bundle.`)
      }
    }
    if (!Number.isSafeInteger(promotion.priority) || Number(promotion.priority) < 0 || Number(promotion.priority) > 1000) {
      throw new Error(`Deal ${index + 1} priority must be a whole number from 0 to 1000.`)
    }
  }
}

type Unit = { lineIndex: number; priceCents: number; categoryIds: string[]; ordinal: number }

function calculatePromotion(promotion: Promotion, lines: PromotionLine[]): PromotionResult | null {
  if (!promotion.enabled || !promotion.categoryIds.length) return null
  const bundleSize = promotion.type === 'buy_get_free'
    ? promotion.buyQuantity + promotion.freeQuantity
    : promotion.buyQuantity
  const units: Unit[] = []
  for (const [lineIndex, line] of lines.entries()) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || !Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0) continue
    const categories = [...new Set(line.categoryIds)]
    if (!categories.some((id) => promotion.categoryIds.includes(id))) continue
    for (let ordinal = 0; ordinal < line.quantity; ordinal += 1) {
      units.push({ lineIndex, priceCents: line.unitPriceCents, categoryIds: categories, ordinal })
    }
  }
  if (units.length < bundleSize) return null

  units.sort((left, right) => left.priceCents - right.priceCents || left.lineIndex - right.lineIndex || left.ordinal - right.ordinal)
  const available = units.map(() => true)
  const categoryUnits = new Map<string, number[]>()
  for (const categoryId of promotion.categoryIds) categoryUnits.set(categoryId, [])
  units.forEach((unit, index) => {
    for (const categoryId of unit.categoryIds) categoryUnits.get(categoryId)?.push(index)
  })
  const categoryCursors = new Map(promotion.categoryIds.map((id) => [id, 0]))
  const freeUnitsByLine = lines.map(() => 0)
  const discountedUnitsByLine = lines.map(() => 0)
  const discountCentsByLine = lines.map(() => 0)
  let discountCents = 0
  let allUnitsCursor = 0

  while (true) {
    const selected = new Set<number>()
    for (const categoryId of promotion.categoryIds) {
      const candidates = categoryUnits.get(categoryId) ?? []
      let cursor = categoryCursors.get(categoryId) ?? 0
      while (cursor < candidates.length && (!available[candidates[cursor]] || selected.has(candidates[cursor]))) cursor += 1
      categoryCursors.set(categoryId, cursor + 1)
      if (cursor >= candidates.length) return discountCents > 0
        ? { promotion, discountCents, freeUnitsByLine, discountedUnitsByLine, discountCentsByLine }
        : null
      selected.add(candidates[cursor])
    }

    while (selected.size < bundleSize) {
      while (allUnitsCursor < units.length && (!available[allUnitsCursor] || selected.has(allUnitsCursor))) allUnitsCursor += 1
      if (allUnitsCursor >= units.length) return discountCents > 0
        ? { promotion, discountCents, freeUnitsByLine, discountedUnitsByLine, discountCentsByLine }
        : null
      selected.add(allUnitsCursor)
      allUnitsCursor += 1
    }

    const group = [...selected]
    for (const unitIndex of group) available[unitIndex] = false
    if (promotion.type === 'buy_get_free') {
      group
        .sort((left, right) => units[left].priceCents - units[right].priceCents || units[left].lineIndex - units[right].lineIndex || units[left].ordinal - units[right].ordinal)
        .slice(0, promotion.freeQuantity)
        .forEach((unitIndex) => {
          const unit = units[unitIndex]
          freeUnitsByLine[unit.lineIndex] += 1
          discountCentsByLine[unit.lineIndex] += unit.priceCents
          discountCents += unit.priceCents
        })
    } else {
      for (const unitIndex of group) {
        const unit = units[unitIndex]
        const unitDiscount = Math.round(unit.priceCents * promotion.discountPercent / 100)
        discountedUnitsByLine[unit.lineIndex] += 1
        discountCentsByLine[unit.lineIndex] += unitDiscount
        discountCents += unitDiscount
      }
    }
  }
}

export function calculateBestPromotion(lines: PromotionLine[], promotions: Promotion[]): PromotionResult | null {
  const candidates = promotions
    .map((promotion) => calculatePromotion(promotion, lines))
    .filter((result): result is PromotionResult => result !== null && result.discountCents > 0)
  candidates.sort((left, right) =>
    right.discountCents - left.discountCents ||
    right.promotion.priority - left.promotion.priority ||
    left.promotion.id.localeCompare(right.promotion.id),
  )
  return candidates[0] ?? null
}
