import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { invalidateCache } from '@/lib/cache'
import { db } from '@/lib/db'
import { getDeliveryFeeCents as deliveryFeeForSubtotal, moneyToCents, parseDeliveryRules } from '@/lib/delivery'
import {
  storeActivityEvents,
  storeCustomers,
  storeOrderItems,
  storeOrders,
  storeProductVariants,
  storeProducts,
  storeSettings,
} from '@/lib/db/schema'
import { CustomerAuthError, getCustomerSession, getOrderReceipt, type StoreCustomerSession } from '@/lib/auth/store-customer'
import { isPowerRangeOption } from '@/lib/power-ranges'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const moneyPattern = /^(\d{1,10})(?:\.(\d{1,2}))?$/
const maxMoneyCents = 999_999_999_999

type CheckoutLineInput = {
  productId: string
  variantId: string | null
  leftPowerRange: string | null
  rightPowerRange: string | null
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
  if (value === undefined || value === null || value === '') return ''
  return requiredText(value, field, maximum)
}

function normalizeEmail(value: unknown) {
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
  if (typeof value !== 'string' || !isPowerRangeOption(value)) {
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
    lastName: requiredText(address.lastName, 'Last name', 100),
    phone,
    addressLine1: requiredText(address.addressLine1, 'Street address', 250),
    addressLine2: optionalText(address.addressLine2, 'Address line 2', 250),
    city: requiredText(address.city, 'City', 100),
    province: requiredText(address.province, 'Province or territory', 100),
    postalCode: optionalText(address.postalCode, 'Postal code', 20),
    country: 'Pakistan',
  }
  return {
    checkoutKey: value.checkoutKey,
    email: value.email,
    shippingAddress,
    items,
    delivery: parseDeliveryInput(value),
  }
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

      let currency = ''
      let subtotalCents = 0
      const resolvedLines = input.items.map((item) => {
        const product = productById.get(item.productId)
        if (!product || product.status !== 'active') {
          throw new CheckoutError('A product in your bag is no longer available. Review the catalogue.', 409)
        }
        const variant = item.variantId ? variantById.get(item.variantId) : null
        if (item.variantId && (!variant || variant.productId !== product.id)) {
          throw new CheckoutError('A product option in your bag is no longer available. Review the catalogue.', 409)
        }
        if (!item.variantId && (activeVariantsByProduct.get(product.id)?.length ?? 0) > 0) {
          throw new CheckoutError('Choose an available listed option for each product.', 409)
        }
        const powerRanges = product.availablePowerRanges ?? []
        const hasPowerSelection = Boolean(item.leftPowerRange || item.rightPowerRange)
        if (powerRanges.length) {
          if (
            !item.leftPowerRange ||
            !item.rightPowerRange ||
            !powerRanges.includes(item.leftPowerRange) ||
            !powerRanges.includes(item.rightPowerRange)
          ) {
            throw new CheckoutError('Choose an available power range for each eye.', 409)
          }
        } else if (hasPowerSelection) {
          throw new CheckoutError('This product does not offer customer-selected power ranges.', 409)
        }
        const unitPrice = variant?.price ?? product.price
        const lineCurrency = variant?.currency ?? product.currency
        if (lineCurrency !== item.quotedCurrency || unitPrice !== item.quotedUnitPrice) {
          throw new CheckoutError('A price changed since you added it to your bag. Review the current price and try again.', 409)
        }
        if (!currency) currency = lineCurrency
        if (currency !== lineCurrency) throw new CheckoutError('Items in one order must use the same currency.')
        const unitPriceCents = parseMoneyCents(unitPrice, 'Product price')
        const lineTotalCents = unitPriceCents * item.quantity
        if (!Number.isSafeInteger(lineTotalCents) || subtotalCents > maxMoneyCents - lineTotalCents) {
          throw new CheckoutError('The order total is outside the supported range.')
        }
        subtotalCents += lineTotalCents
        const stockQuantity = variant?.stockQuantity ?? product.stockQuantity
        if (stockQuantity < item.quantity) {
          throw new CheckoutError(`${product.name}${variant ? ` — ${variant.name}` : ''} does not have enough stock for that quantity.`, 409)
        }
        return { item, product, variant, unitPrice, lineTotalCents }
      })

      for (const { item, product, variant } of resolvedLines) {
        if (variant) {
          await tx
            .update(storeProductVariants)
            .set({ stockQuantity: variant.stockQuantity - item.quantity, updatedAt: new Date() })
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
            .set({ stockQuantity: product.stockQuantity - item.quantity, updatedAt: new Date() })
            .where(eq(storeProducts.id, product.id))
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
          !customer?.passwordHash ||
          customer.sessionVersion !== session.sessionVersion ||
          customer.email.toLowerCase() !== session.email.toLowerCase()
        ) {
          throw new CustomerAuthError('Your account session expired. Sign in again before placing the order.', 401)
        }
        customerId = customer.id
      } else {
        const email = normalizeEmail(input.email)
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`)
        const [existing] = await tx
          .select({ id: storeCustomers.id })
          .from(storeCustomers)
          .where(sql`lower(${storeCustomers.email}) = ${email}`)
          .limit(1)
          .for('update')
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

      await tx.insert(storeOrderItems).values(resolvedLines.map(({ item, product, variant, unitPrice, lineTotalCents }) => ({
        orderId: order.id,
        productId: product.id,
        variantId: variant?.id ?? null,
        powerLeft: item.leftPowerRange,
        powerRight: item.rightPowerRange,
        inventoryReserved: true,
        productName: variant ? `${product.name} — ${variant.name}` : product.name,
        unitPrice,
        quantity: item.quantity,
        lineTotal: moneyString(lineTotalCents),
      })))
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
    })
    .from(storeOrders)
    .where(eq(storeOrders.id, receipt.orderId))
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
