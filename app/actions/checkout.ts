import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { invalidateCache } from '@/lib/cache'
import { db } from '@/lib/db'
import { getDeliveryFeeCents as deliveryFeeForSubtotal, moneyToCents, parseDeliveryRules } from '@/lib/delivery'
import {
  storeActivityEvents,
  storeCategories,
  storeProductCategories,
  storeCustomers,
  storeOrderItems,
  storeOrders,
  storeLensTypes,
  storeProductVariants,
  storeProducts,
  storeSettings,
} from '@/lib/db/schema'
import { CustomerAuthError, getCustomerSession, getOrderReceipt, type StoreCustomerSession } from '@/lib/auth/store-customer'
import { normalizeFreeGiftConfig, resolveGiftCategoryId } from '@/lib/free-gift'
import { FREE_GIFT_MINIMUM_SUBTOTAL_CENTS } from '@/lib/data/free-gift'
import { calculateBestPromotion, normalizePromotions } from '@/lib/promotions'
import { isToricLensType, TORIC_ORDER_NOTICE } from '@/lib/toric'
import {
  isPowerLensValue,
  isValidLensSelection,
  normalizePowerLensOptions,
  powerSurchargeCents,
  resolvePowerOptionValues,
} from '@/lib/power-lens-options'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const moneyPattern = /^(\d{1,10})(?:\.(\d{1,2}))?$/
const maxMoneyCents = 999_999_999_999

type CheckoutLineInput = {
  productId: string
  variantId: string | null
  leftPowerRange: string | null
  rightPowerRange: string | null
  lensChoice: 'plain' | 'power' | null
  quantity: number
  quotedUnitPrice: string
  quotedCurrency: string
}

type CheckoutDeliveryInput = { quotedDeliveryFee: string }

type ShippingInput = {
  firstName: string
  lastName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  province: string
  postalCode: string
}

export type ShippingAddress = ShippingInput & { country: 'Pakistan' }

export class CheckoutError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 409 | 429 | 503 = 400) {
    super(message)
    this.name = 'CheckoutError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown, field: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new CheckoutError(`${field} is required and must be at most ${maximum} characters.`)
  }
  return value.trim()
}

function optionalText(value: unknown, field: string, maximum: number) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return ''
  return requiredText(value, field, maximum)
}

function normalizeEmail(value: unknown) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null
  if (typeof value !== 'string') throw new CheckoutError('Enter a valid email address.')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CheckoutError('Enter a valid email address.')
  }
  return email
}

function parseMoneyCents(value: unknown, field: string) {
  if (typeof value !== 'string') throw new CheckoutError(`${field} is invalid.`)
  const match = moneyPattern.exec(value)
  if (!match) throw new CheckoutError(`${field} is invalid.`)
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > maxMoneyCents) throw new CheckoutError(`${field} is outside the supported range.`)
  return cents
}

function moneyString(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

function optionalPowerRange(value: unknown, eye: 'left' | 'right') {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !isPowerLensValue(value)) {
    throw new CheckoutError(`The ${eye}-eye power range is invalid.`)
  }
  return value
}

function parseOrderInput(value: unknown) {
  if (!isRecord(value)) throw new CheckoutError('Order details are required.')
  if (typeof value.checkoutKey !== 'string' || !uuidPattern.test(value.checkoutKey)) {
    throw new CheckoutError('Refresh checkout and try again.')
  }
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 30) {
    throw new CheckoutError('Your bag must contain between 1 and 30 different items.')
  }
  const seen = new Set<string>()
  const items: CheckoutLineInput[] = value.items.map((entry) => {
    if (!isRecord(entry) || typeof entry.productId !== 'string' || !uuidPattern.test(entry.productId)) {
      throw new CheckoutError('A product in your bag is invalid. Remove it and try again.')
    }
    const variantId = entry.variantId === null ? null : entry.variantId
    if (variantId !== null && (typeof variantId !== 'string' || !uuidPattern.test(variantId))) {
      throw new CheckoutError('A product option in your bag is invalid.')
    }
    if (!Number.isSafeInteger(entry.quantity) || Number(entry.quantity) < 1 || Number(entry.quantity) > 100) {
      throw new CheckoutError('Each quantity must be a whole number from 1 to 100.')
    }
    const leftPowerRange = optionalPowerRange(entry.leftPowerRange, 'left')
    const rightPowerRange = optionalPowerRange(entry.rightPowerRange, 'right')
    const lensChoice = entry.lensChoice ?? null
    if (lensChoice !== null && lensChoice !== 'plain' && lensChoice !== 'power') {
      throw new CheckoutError('The selected lens choice is invalid.')
    }
    const key = `${entry.productId}:${variantId ?? 'standard'}:${leftPowerRange ?? ''}:${rightPowerRange ?? ''}`
    if (seen.has(key)) throw new CheckoutError('The bag contains a duplicate item. Review it and try again.')
    seen.add(key)
    if (typeof entry.quotedCurrency !== 'string' || !/^[A-Z]{3}$/.test(entry.quotedCurrency)) {
      throw new CheckoutError('A product currency is invalid.')
    }
    if (typeof entry.quotedUnitPrice !== 'string') throw new CheckoutError('A product price is invalid.')
    parseMoneyCents(entry.quotedUnitPrice, 'Product price')
    return {
      productId: entry.productId,
      variantId,
      leftPowerRange,
      rightPowerRange,
      lensChoice,
      quantity: Number(entry.quantity),
      quotedUnitPrice: entry.quotedUnitPrice,
      quotedCurrency: entry.quotedCurrency,
    }
  })

  const address = isRecord(value.shippingAddress) ? value.shippingAddress : {}
  const phone = requiredText(address.phone, 'Phone number', 30)
  const digitCount = phone.replace(/\D/g, '').length
  if (digitCount < 7 || digitCount > 15) throw new CheckoutError('Enter a phone number with 7 to 15 digits.')
  const shippingAddress: ShippingAddress = {
    firstName: requiredText(address.firstName, 'First name', 100),
    lastName: optionalText(address.lastName, 'Last name', 100),
    phone,
    addressLine1: requiredText(address.addressLine1, 'Street address', 250),
    addressLine2: optionalText(address.addressLine2, 'Address line 2', 250),
    city: requiredText(address.city, 'City', 100),
    province: optionalText(address.province, 'Province or territory', 100),
    postalCode: optionalText(address.postalCode, 'Postal code', 20),
    country: 'Pakistan',
  }
  return {
    checkoutKey: value.checkoutKey,
    email: value.email,
    shippingAddress,
    items,
    giftProductId: parseGiftProductId(value),
    delivery: parseDeliveryInput(value),
  }
}

function parseGiftProductId(value: Record<string, unknown>) {
  const giftProductId = value.giftProductId
  if (giftProductId === undefined || giftProductId === null) return null
  if (typeof giftProductId !== 'string' || !uuidPattern.test(giftProductId)) throw new CheckoutError('The selected free gift is invalid.')
  if (value.giftConfirmed !== true) throw new CheckoutError('Confirm your free gift choice before placing the order.')
  return giftProductId
}

function parseDeliveryInput(value: Record<string, unknown>): CheckoutDeliveryInput {
  const quotedDeliveryFee = value.quotedDeliveryFee
  if (typeof quotedDeliveryFee !== 'string' || moneyToCents(quotedDeliveryFee) === null) {
    throw new CheckoutError('The delivery price is invalid.')
  }
  return { quotedDeliveryFee }
}

function assertOrderOwner(order: { accountId: string | null }, session: StoreCustomerSession | null) {
  if ((order.accountId ?? null) !== (session?.customerId ?? null)) {
    throw new CheckoutError('This checkout attempt belongs to a different shopper. Start checkout again.', 409)
  }
}

function databaseErrorCode(error: unknown) {
  return isRecord(error) && typeof error.code === 'string' ? error.code : null
}

async function submitCodOrderImpl(value: unknown) {
  const input = parseOrderInput(value)
  const session = await getCustomerSession()

  const [prior] = await db
    .select({
      id: storeOrders.id,
      orderNumber: storeOrders.orderNumber,
      accountId: storeOrders.accountId,
      total: storeOrders.total,
      currency: storeOrders.currency,
    })
    .from(storeOrders)
    .where(eq(storeOrders.checkoutKey, input.checkoutKey))
    .limit(1)
  if (prior) {
    assertOrderOwner(prior, session)
    return { ...prior, reused: true }
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))].sort()
  try {
    return await db.transaction(async (tx) => {
      const products = await tx
        .select()
        .from(storeProducts)
        .where(inArray(storeProducts.id, productIds))
        .orderBy(storeProducts.id)
        .for('update')
      const variants = await tx
        .select()
        .from(storeProductVariants)
        .where(and(inArray(storeProductVariants.productId, productIds), eq(storeProductVariants.isActive, true)))
        .orderBy(storeProductVariants.id)
        .for('update')
      const productById = new Map(products.map((product) => [product.id, product]))
      const lensTypes = await tx.select({ id: storeLensTypes.id, name: storeLensTypes.name }).from(storeLensTypes)
      const toricTypeIds = new Set(lensTypes.filter((type) => isToricLensType(type.name)).map((type) => type.id))
      const variantById = new Map(variants.map((variant) => [variant.id, variant]))
      const activeVariantsByProduct = new Map<string, typeof variants>()
      for (const variant of variants) {
        const list = activeVariantsByProduct.get(variant.productId) ?? []
        list.push(variant)
        activeVariantsByProduct.set(variant.productId, list)
      }

      const [duplicate] = await tx
        .select({
          id: storeOrders.id,
          orderNumber: storeOrders.orderNumber,
          accountId: storeOrders.accountId,
          total: storeOrders.total,
          currency: storeOrders.currency,
        })
        .from(storeOrders)
        .where(eq(storeOrders.checkoutKey, input.checkoutKey))
        .limit(1)
      if (duplicate) {
        assertOrderOwner(duplicate, session)
        return { ...duplicate, reused: true }
      }

      const [powerOptionsSetting] = await tx
        .select({ value: storeSettings.value })
        .from(storeSettings)
        .where(eq(storeSettings.key, 'power_options'))
        .limit(1)
      const powerOptions = normalizePowerLensOptions(powerOptionsSetting?.value)
      let currency = ''
      let subtotalCents = 0
      const resolvedLines = input.items.map((item) => {
        const product = productById.get(item.productId)
        if (!product || product.status !== 'active') {
          throw new CheckoutError('A product in your bag is no longer available. Review the catalogue.', 409)
        }
        if (product.lensTypeId && toricTypeIds.has(product.lensTypeId)) {
          throw new CheckoutError(TORIC_ORDER_NOTICE, 409)
        }
        const variant = item.variantId ? variantById.get(item.variantId) ?? null : null
        if (item.variantId && (!variant || variant.productId !== product.id)) {
          throw new CheckoutError('A product option in your bag is no longer available. Review the catalogue.', 409)
        }
        if (!item.variantId && (activeVariantsByProduct.get(product.id)?.length ?? 0) > 0) {
          throw new CheckoutError('Choose an available listed option for each product.', 409)
        }
        const powerRanges = resolvePowerOptionValues(product.availablePowerRanges, powerOptions)
        if (!isValidLensSelection(powerRanges, item.lensChoice, item.leftPowerRange, item.rightPowerRange)) {
          throw new CheckoutError('Choose plain lenses or an available power for each eye.', 409)
        }
        const basePrice = variant?.price ?? product.price
        const surchargeCents = powerSurchargeCents(powerOptions, item.leftPowerRange, item.rightPowerRange)
        if (surchargeCents === null) {
          throw new CheckoutError('A selected power option is no longer available. Review your bag and try again.', 409)
        }
        const unitPriceCents = parseMoneyCents(basePrice, 'Product price') + surchargeCents
        if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents > maxMoneyCents) {
          throw new CheckoutError('The selected lens price is outside the supported range.')
        }
        const unitPrice = moneyString(unitPriceCents)
        const lineCurrency = variant?.currency ?? product.currency
        if (lineCurrency !== item.quotedCurrency || unitPriceCents !== parseMoneyCents(item.quotedUnitPrice, 'Product price')) {
          throw new CheckoutError('A price changed since you added it to your bag. Review the current price and try again.', 409)
        }
        if (!currency) currency = lineCurrency
        if (currency !== lineCurrency) throw new CheckoutError('Items in one order must use the same currency.')
        const lineTotalCents = unitPriceCents * item.quantity
        if (!Number.isSafeInteger(lineTotalCents) || subtotalCents > maxMoneyCents - lineTotalCents) {
          throw new CheckoutError('The order total is outside the supported range.')
        }
        subtotalCents += lineTotalCents
        const stockQuantity = variant?.stockQuantity ?? product.stockQuantity
        if (stockQuantity < item.quantity) {
          throw new CheckoutError(`${product.name}${variant ? ` — ${variant.name}` : ''} does not have enough stock for that quantity.`, 409)
        }
        return { item, product, variant, unitPrice, unitPriceCents, lineTotalCents }
      })
      const [dealsSetting] = await tx
        .select({ value: storeSettings.value })
        .from(storeSettings)
        .where(eq(storeSettings.key, 'deals'))
        .limit(1)
      const promotions = normalizePromotions(dealsSetting?.value)
      const categories = await tx
        .select({ id: storeCategories.id, name: storeCategories.name, slug: storeCategories.slug })
        .from(storeCategories)
        .where(eq(storeCategories.isActive, true))
      const activeCategoryIds = new Set(categories.map((category) => category.id))
      const lineProductIds = [...new Set(resolvedLines.map((line) => line.product.id))]
      const categoryMemberships = activeCategoryIds.size
        ? await tx
            .select({ productId: storeProductCategories.productId, categoryId: storeProductCategories.categoryId })
            .from(storeProductCategories)
            .where(and(
              inArray(storeProductCategories.categoryId, [...activeCategoryIds]),
              inArray(storeProductCategories.productId, lineProductIds),
            ))
        : []
      const categoryIdsByProduct = new Map<string, Set<string>>()
      for (const { product } of resolvedLines) {
        const ids = categoryIdsByProduct.get(product.id) ?? new Set<string>()
        if (product.categoryId && activeCategoryIds.has(product.categoryId)) ids.add(product.categoryId)
        categoryIdsByProduct.set(product.id, ids)
      }
      for (const membership of categoryMemberships) {
        categoryIdsByProduct.get(membership.productId)?.add(membership.categoryId)
      }
      const promotionResult = calculateBestPromotion(
        resolvedLines.map(({ item, product, unitPriceCents }) => ({
          quantity: item.quantity,
          unitPriceCents,
          categoryIds: [...(categoryIdsByProduct.get(product.id) ?? [])],
        })),
        promotions,
      )
      if (promotionResult) subtotalCents -= promotionResult.discountCents
      const reservations = new Map<string, { product: typeof products[number]; variant: (typeof variants)[number] | null; quantity: number }>()
      for (const { item, product, variant } of resolvedLines) {
        const key = variant ? `variant:${variant.id}` : `product:${product.id}`
        const reservation = reservations.get(key) ?? { product, variant, quantity: 0 }
        reservation.quantity += item.quantity
        if (reservation.quantity > (variant?.stockQuantity ?? product.stockQuantity)) {
          throw new CheckoutError(`${product.name}${variant ? ` — ${variant.name}` : ''} does not have enough stock for that quantity.`, 409)
        }
        reservations.set(key, reservation)
      }

      let giftLine: { product: typeof products[number]; variant: (typeof variants)[number] | null } | null = null
      if (input.giftProductId) {
        if (promotionResult) {
          throw new CheckoutError('A lens deal is applied to this order. A separate free gift cannot be added.', 409)
        }
        if (subtotalCents < FREE_GIFT_MINIMUM_SUBTOTAL_CENTS) {
          throw new CheckoutError('A free gift is available only when the discounted merchandise subtotal is at least PKR 2,500.', 409)
        }
        const [giftSetting] = await tx.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.key, 'free_gift')).limit(1)
        const giftConfig = normalizeFreeGiftConfig(giftSetting?.value)
        if (!giftConfig.enabled) throw new CheckoutError('The free gift offer is no longer available. Review your order and try again.', 409)
        const giftCategoryId = resolveGiftCategoryId(giftConfig, categories)
        if (!giftCategoryId) throw new CheckoutError('The free gift offer is no longer available. Review your order and try again.', 409)
        const productIds = [...new Set([...resolvedLines.map((line) => line.product.id), input.giftProductId])]
        const memberships = await tx
          .select({ productId: storeProductCategories.productId })
          .from(storeProductCategories)
          .where(and(eq(storeProductCategories.categoryId, giftCategoryId), inArray(storeProductCategories.productId, productIds)))
        const inGiftCategory = new Set(memberships.map((row) => row.productId))
        const isGift = (candidate: { id: string; categoryId: string | null }) => candidate.categoryId === giftCategoryId || inGiftCategory.has(candidate.id)
        const lensQuantity = resolvedLines.reduce((sum, line) => sum + (isGift(line.product) ? 0 : line.item.quantity), 0)
        if (lensQuantity < giftConfig.minLensQuantity) {
          throw new CheckoutError('The free gift needs a lens in your order. Review your order and try again.', 409)
        }
        const [giftProduct] = await tx.select().from(storeProducts).where(eq(storeProducts.id, input.giftProductId)).for('update')
        if (!giftProduct || giftProduct.status !== 'active' || !isGift(giftProduct)) {
          throw new CheckoutError('The selected free gift is no longer available. Choose another gift.', 409)
        }
        if (giftProduct.lensTypeId && toricTypeIds.has(giftProduct.lensTypeId)) {
          throw new CheckoutError(TORIC_ORDER_NOTICE, 409)
        }
        const giftVariants = await tx
          .select()
          .from(storeProductVariants)
          .where(and(eq(storeProductVariants.productId, giftProduct.id), eq(storeProductVariants.isActive, true)))
          .orderBy(storeProductVariants.id)
          .for('update')
        const giftVariant = giftVariants.find((entry) => entry.stockQuantity > 0) ?? null
        if (giftVariants.length && !giftVariant) throw new CheckoutError('The selected free gift is out of stock. Choose another gift.', 409)
        const alreadyReserved = resolvedLines
          .filter((line) => line.product.id === giftProduct.id && (line.variant?.id ?? null) === (giftVariant?.id ?? null))
          .reduce((sum, line) => sum + line.item.quantity, 0)
        const giftStock = (giftVariant?.stockQuantity ?? giftProduct.stockQuantity) - alreadyReserved
        if (giftStock < 1) throw new CheckoutError('The selected free gift is out of stock. Choose another gift.', 409)
        giftLine = { product: giftProduct, variant: giftVariant }
      }

      for (const { quantity, product, variant } of reservations.values()) {
        if (variant) {
          await tx
            .update(storeProductVariants)
            .set({ stockQuantity: variant.stockQuantity - quantity, updatedAt: new Date() })
            .where(eq(storeProductVariants.id, variant.id))
          const remaining = await tx
            .select({ stockQuantity: storeProductVariants.stockQuantity })
            .from(storeProductVariants)
            .where(and(eq(storeProductVariants.productId, product.id), eq(storeProductVariants.isActive, true)))
          const totalStock = remaining.reduce((sum, entry) => sum + entry.stockQuantity, 0)
          if (!Number.isSafeInteger(totalStock) || totalStock > 2_147_483_647) {
            throw new CheckoutError('The available inventory is outside the supported range.')
          }
          await tx.update(storeProducts).set({ stockQuantity: totalStock, updatedAt: new Date() }).where(eq(storeProducts.id, product.id))
        } else {
          await tx
            .update(storeProducts)
            .set({ stockQuantity: product.stockQuantity - quantity, updatedAt: new Date() })
            .where(eq(storeProducts.id, product.id))
        }
      }

      if (giftLine) {
        const { product: giftProduct, variant: giftVariant } = giftLine
        if (giftVariant) {
          const [current] = await tx.select({ stockQuantity: storeProductVariants.stockQuantity }).from(storeProductVariants).where(eq(storeProductVariants.id, giftVariant.id))
          await tx.update(storeProductVariants).set({ stockQuantity: (current?.stockQuantity ?? giftVariant.stockQuantity) - 1, updatedAt: new Date() }).where(eq(storeProductVariants.id, giftVariant.id))
          const remaining = await tx
            .select({ stockQuantity: storeProductVariants.stockQuantity })
            .from(storeProductVariants)
            .where(and(eq(storeProductVariants.productId, giftProduct.id), eq(storeProductVariants.isActive, true)))
          await tx.update(storeProducts).set({ stockQuantity: remaining.reduce((sum, entry) => sum + entry.stockQuantity, 0), updatedAt: new Date() }).where(eq(storeProducts.id, giftProduct.id))
        } else {
          const [current] = await tx.select({ stockQuantity: storeProducts.stockQuantity }).from(storeProducts).where(eq(storeProducts.id, giftProduct.id))
          await tx.update(storeProducts).set({ stockQuantity: (current?.stockQuantity ?? giftProduct.stockQuantity) - 1, updatedAt: new Date() }).where(eq(storeProducts.id, giftProduct.id))
        }
      }

      let customerId: string
      if (session) {
        const [customer] = await tx
          .select({
            id: storeCustomers.id,
            email: storeCustomers.email,
            passwordHash: storeCustomers.passwordHash,
            sessionVersion: storeCustomers.sessionVersion,
          })
          .from(storeCustomers)
          .where(eq(storeCustomers.id, session.customerId))
          .limit(1)
          .for('update')
        if (
          !customer?.passwordHash || !customer.email ||
          customer.sessionVersion !== session.sessionVersion ||
          customer.email.toLowerCase() !== session.email.toLowerCase()
        ) {
          throw new CustomerAuthError('Your account session expired. Sign in again before placing the order.', 401)
        }
        customerId = customer.id
      } else {
        const email = normalizeEmail(input.email)
        if (email) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`)
        const [existing] = email ? await tx
          .select({ id: storeCustomers.id })
          .from(storeCustomers)
          .where(sql`lower(${storeCustomers.email}) = ${email}`)
          .limit(1)
          .for('update') : []
        if (existing) {
          customerId = existing.id
        } else {
          const [customer] = await tx
            .insert(storeCustomers)
            .values({
              email,
              firstName: input.shippingAddress.firstName,
              lastName: input.shippingAddress.lastName,
              phone: input.shippingAddress.phone,
            })
            .returning({ id: storeCustomers.id })
          if (!customer) throw new Error('The customer record was not created.')
          customerId = customer.id
        }
      }

      const [deliveryRow] = await tx
        .select({ value: storeSettings.value })
        .from(storeSettings)
        .where(eq(storeSettings.key, 'delivery_rules'))
        .limit(1)
      const deliveryRules = parseDeliveryRules(deliveryRow?.value ?? [])
      const shippingCents = deliveryFeeForSubtotal(deliveryRules, subtotalCents)
      if (shippingCents === null) {
        throw new CheckoutError('Delivery pricing is not configured for this order total. Please contact the store.', 503)
      }
      if (shippingCents !== moneyToCents(input.delivery.quotedDeliveryFee)) {
        throw new CheckoutError('The delivery price changed. Review your order total and try again.', 409)
      }
      if (subtotalCents > maxMoneyCents - shippingCents) throw new CheckoutError('The order total is outside the supported range.')
      const [order] = await tx
        .insert(storeOrders)
        .values({
          customerId,
          accountId: session?.customerId ?? null,
          checkoutKey: input.checkoutKey,
          status: 'pending',
          paymentMethod: 'cash_on_delivery',
          shippingFeeConfirmed: true,
          subtotal: moneyString(subtotalCents),
          shippingTotal: moneyString(shippingCents),
          taxTotal: '0.00',
          total: moneyString(subtotalCents + shippingCents),
          currency,
          shippingAddress: input.shippingAddress,
        })
        .returning({
          id: storeOrders.id,
          orderNumber: storeOrders.orderNumber,
          accountId: storeOrders.accountId,
          total: storeOrders.total,
          currency: storeOrders.currency,
        })
      if (!order) throw new Error('The order was not created.')

      const dealItemName = promotionResult?.promotion.name
      const paidItems = resolvedLines.flatMap(({ item, product, variant, unitPrice, unitPriceCents }, index) => {
        const freeQuantity = promotionResult?.freeUnitsByLine[index] ?? 0
        const discountedQuantity = promotionResult?.discountedUnitsByLine[index] ?? 0
        const regularQuantity = item.quantity - freeQuantity - discountedQuantity
        const name = variant ? `${product.name} — ${variant.name}` : product.name
        const common = {
          orderId: order.id,
          productId: product.id,
          variantId: variant?.id ?? null,
          powerLeft: item.lensChoice === 'plain' ? 'plain' : item.leftPowerRange,
          powerRight: item.lensChoice === 'plain' ? 'plain' : item.rightPowerRange,
          inventoryReserved: true,
        }
        return [
          ...(regularQuantity ? [{
            ...common,
            productName: name,
            unitPrice,
            quantity: regularQuantity,
            lineTotal: moneyString(unitPriceCents * regularQuantity),
          }] : []),
          ...(discountedQuantity && promotionResult?.promotion.type === 'bundle_discount' ? [{
            ...common,
            productName: `${name} (${promotionResult.promotion.discountPercent}% deal: ${dealItemName})`,
            unitPrice: moneyString(unitPriceCents - Math.round(unitPriceCents * promotionResult.promotion.discountPercent / 100)),
            quantity: discountedQuantity,
            lineTotal: moneyString((unitPriceCents - Math.round(unitPriceCents * promotionResult.promotion.discountPercent / 100)) * discountedQuantity),
          }] : []),
          ...(freeQuantity && dealItemName ? [{
            ...common,
            productName: `${name} (Free deal: ${dealItemName})`,
            unitPrice: '0.00',
            quantity: freeQuantity,
            lineTotal: '0.00',
          }] : []),
        ]
      })
      await tx.insert(storeOrderItems).values(paidItems.concat(giftLine ? [{
        orderId: order.id,
        productId: giftLine.product.id,
        variantId: giftLine.variant?.id ?? null,
        powerLeft: null,
        powerRight: null,
        inventoryReserved: true,
        productName: `${giftLine.variant ? `${giftLine.product.name} — ${giftLine.variant.name}` : giftLine.product.name} (Free gift)`,
        unitPrice: '0.00',
        quantity: 1,
        lineTotal: '0.00',
      }] : [])) 
      await tx.insert(storeActivityEvents).values({
        entityType: 'order',
        entityId: order.id,
        eventType: 'created',
        payload: { paymentMethod: 'cash_on_delivery', itemCount: resolvedLines.length, account: Boolean(session) },
      })
      return { ...order, reused: false }
    })
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      const [existing] = await db
        .select({
          id: storeOrders.id,
          orderNumber: storeOrders.orderNumber,
          accountId: storeOrders.accountId,
          total: storeOrders.total,
          currency: storeOrders.currency,
        })
        .from(storeOrders)
        .where(eq(storeOrders.checkoutKey, input.checkoutKey))
        .limit(1)
      if (existing) {
        assertOrderOwner(existing, session)
        return { ...existing, reused: true }
      }
    }
    throw error
  }
}

export async function getOrderConfirmation() {
  const receipt = await getOrderReceipt()
  if (!receipt) return null
  return getOrderDetail(receipt.orderId)
}

export async function getOrderDetail(orderId: string) {
  const [order] = await db
    .select({
      id: storeOrders.id,
      orderNumber: storeOrders.orderNumber,
      status: storeOrders.status,
      paymentMethod: storeOrders.paymentMethod,
      shippingFeeConfirmed: storeOrders.shippingFeeConfirmed,
      subtotal: storeOrders.subtotal,
      shippingTotal: storeOrders.shippingTotal,
      taxTotal: storeOrders.taxTotal,
      total: storeOrders.total,
      currency: storeOrders.currency,
      shippingAddress: storeOrders.shippingAddress,
      accountId: storeOrders.accountId,
      createdAt: storeOrders.createdAt,
      updatedAt: storeOrders.updatedAt,
    })
    .from(storeOrders)
    .where(eq(storeOrders.id, orderId))
    .limit(1)
  if (!order) return null
  const items = await db
    .select({
      productName: storeOrderItems.productName,
      powerLeft: storeOrderItems.powerLeft,
      powerRight: storeOrderItems.powerRight,
      unitPrice: storeOrderItems.unitPrice,
      quantity: storeOrderItems.quantity,
      lineTotal: storeOrderItems.lineTotal,
    })
    .from(storeOrderItems)
    .where(eq(storeOrderItems.orderId, order.id))
  return { ...order, items }
}

export async function submitCodOrder(...args: Parameters<typeof submitCodOrderImpl>) {
  const result = await submitCodOrderImpl(...args)
  await invalidateCache('catalog')
  return result
}
