import 'server-only'
import { loadAuthSecret, peekAuthSecret } from '@/lib/auth/secret'

import { createHash, createHmac, hkdfSync, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { storeCustomers } from '@/lib/db/schema'

const COOKIE_NAME = 'isk-lenses-customer-session'
const RECEIPT_COOKIE_NAME = 'isk-lenses-order-receipt'
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60
const RECEIPT_DURATION_SECONDS = 90 * 24 * 60 * 60
const PASSWORD_HASH_SCHEME = 'scrypt'
const DUMMY_PASSWORD_HASH = `scrypt$16384$8$1$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CustomerSessionPayload = {
  customerId: string
  email: string
  expiresAt: number
  sessionVersion: number
  purpose: 'customer-session'
}

type OrderReceiptPayload = {
  orderId: string
  expiresAt: number
  purpose: 'order-receipt'
}

export type StoreCustomerSession = {
  customerId: string
  email: string
  sessionVersion: number
}

export class CustomerAuthError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 409 | 429 | 503) {
    super(message)
    this.name = 'CustomerAuthError'
  }
}

function getSigningKey() {
  return Buffer.from(hkdfSync('sha256', peekAuthSecret(), 'isk-lenses', 'customer-session-and-receipt-v1', 32))
}

export async function ensureCustomerSessionSigningConfigured() {
  try {
    await loadAuthSecret()
  } catch {
    throw new CustomerAuthError('Customer account signing is not configured.', 503)
  }
}

function sign(payload: string) {
  return createHmac('sha256', getSigningKey()).update(payload).digest('base64url')
}

function constantTimeEqual(left: string, right: string) {
  return timingSafeEqual(
    createHash('sha256').update(left).digest(),
    createHash('sha256').update(right).digest(),
  )
}

function encodeSignedPayload(payload: CustomerSessionPayload | OrderReceiptPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

function parseSignedPayload<T extends CustomerSessionPayload | OrderReceiptPayload>(token: string): T | null {
  if (token.length > 2048) return null
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return null
  const encoded = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  if (!constantTimeEqual(signature, sign(encoded))) return null
  try {
    const value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T
    if (typeof value.expiresAt !== 'number' || value.expiresAt <= Math.floor(Date.now() / 1000)) return null
    return value
  } catch {
    return null
  }
}

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error)
      else resolve(key as Buffer)
    })
  })
}

export async function hashCustomerPassword(password: string) {
  if (password.length < 12 || password.length > 128) {
    throw new CustomerAuthError('Password must be between 12 and 128 characters.', 400)
  }
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt)
  return `${PASSWORD_HASH_SCHEME}$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`
}

async function verifyPassword(password: string, passwordHash: string | null) {
  const [scheme, n, r, p, encodedSalt, encodedKey] = (passwordHash ?? DUMMY_PASSWORD_HASH).split('$')
  if (scheme !== PASSWORD_HASH_SCHEME || n !== '16384' || r !== '8' || p !== '1' || !encodedSalt || !encodedKey) return false
  const salt = Buffer.from(encodedSalt, 'base64url')
  const expected = Buffer.from(encodedKey, 'base64url')
  if (salt.length !== 16 || expected.length !== 64) return false
  const actual = await deriveKey(password, salt)
  return timingSafeEqual(actual, expected) && passwordHash !== null
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

export async function registerStoreCustomer(emailValue: unknown, passwordValue: unknown) {
  const email = normalizeEmail(emailValue)
  if (!email) throw new CustomerAuthError('Enter a valid email address.', 400)
  if (typeof passwordValue !== 'string') throw new CustomerAuthError('Enter a valid password.', 400)
  const passwordHash = await hashCustomerPassword(passwordValue)
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`)
    const [existing] = await tx
      .select({ id: storeCustomers.id })
      .from(storeCustomers)
      .where(sql`lower(${storeCustomers.email}) = ${email}`)
      .limit(1)
      .for('update')
    if (existing) throw new CustomerAuthError('An account cannot be created for this email. Sign in or continue as a guest.', 409)
    const [customer] = await tx
      .insert(storeCustomers)
      .values({ email, passwordHash, sessionVersion: 1 })
      .returning({ id: storeCustomers.id, email: storeCustomers.email, sessionVersion: storeCustomers.sessionVersion })
    if (!customer) throw new Error('The customer account was not created.')
    return { customerId: customer.id, email: customer.email, sessionVersion: customer.sessionVersion }
  })
}

export async function verifyStoreCustomerCredentials(emailValue: unknown, passwordValue: unknown) {
  const email = normalizeEmail(emailValue)
  if (typeof passwordValue !== 'string' || passwordValue.length > 128) return null
  const [customer] = email
    ? await db
        .select({
          id: storeCustomers.id,
          email: storeCustomers.email,
          passwordHash: storeCustomers.passwordHash,
          sessionVersion: storeCustomers.sessionVersion,
        })
        .from(storeCustomers)
        .where(sql`lower(${storeCustomers.email}) = ${email}`)
        .limit(1)
    : []
  if (!(await verifyPassword(passwordValue, customer?.passwordHash ?? null)) || !customer) return null
  return { customerId: customer.id, email: customer.email, sessionVersion: customer.sessionVersion }
}

export async function createCustomerSession(customer: StoreCustomerSession) {
  await loadAuthSecret()
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
  const token = encodeSignedPayload({
    customerId: customer.customerId,
    email: customer.email,
    sessionVersion: customer.sessionVersion,
    expiresAt,
    purpose: 'customer-session',
  })
  ;(await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  })
}

export async function clearCustomerSession() {
  ;(await cookies()).delete(COOKIE_NAME)
}

export async function getCustomerSession(): Promise<StoreCustomerSession | null> {
  await loadAuthSecret()
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null
  const session = parseSignedPayload<CustomerSessionPayload>(token)
  if (
    !session ||
    session.purpose !== 'customer-session' ||
    !uuidPattern.test(session.customerId) ||
    typeof session.email !== 'string' ||
    !Number.isSafeInteger(session.sessionVersion) ||
    session.sessionVersion < 1
  ) return null
  const [customer] = await db
    .select({
      email: storeCustomers.email,
      sessionVersion: storeCustomers.sessionVersion,
      passwordHash: storeCustomers.passwordHash,
    })
    .from(storeCustomers)
    .where(eq(storeCustomers.id, session.customerId))
    .limit(1)
  if (
    !customer?.passwordHash ||
    customer.sessionVersion !== session.sessionVersion ||
    !constantTimeEqual(customer.email.toLowerCase(), session.email.toLowerCase())
  ) return null
  return { customerId: session.customerId, email: customer.email, sessionVersion: customer.sessionVersion }
}

export async function setOrderReceipt(orderId: string) {
  await loadAuthSecret()
  if (!uuidPattern.test(orderId)) throw new Error('Order ID is invalid.')
  const expiresAt = Math.floor(Date.now() / 1000) + RECEIPT_DURATION_SECONDS
  const token = encodeSignedPayload({ orderId, expiresAt, purpose: 'order-receipt' })
  ;(await cookies()).set(RECEIPT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: RECEIPT_DURATION_SECONDS,
  })
}

export async function getOrderReceipt() {
  await loadAuthSecret()
  const token = (await cookies()).get(RECEIPT_COOKIE_NAME)?.value
  if (!token) return null
  const receipt = parseSignedPayload<OrderReceiptPayload>(token)
  if (!receipt || receipt.purpose !== 'order-receipt' || !uuidPattern.test(receipt.orderId)) return null
  return { orderId: receipt.orderId }
}
