import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { consumePublicRateLimit } from '@/lib/auth/public-rate-limit'
import { invalidateCache } from '@/lib/cache'
import { getApprovedReviews, getProduct, getProductPageSettings } from '@/lib/data/catalog'
import { db } from '@/lib/db'
import { storeProductReviews, storeProducts } from '@/lib/db/schema'
import { isSameOriginOrNativeRequest } from '@/lib/http/api-origin'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const product = await getProduct(slug)
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    return NextResponse.json(
      { data: await getApprovedReviews(product.id) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[product-reviews-api] Review request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Unable to load reviews right now.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!isSameOriginOrNativeRequest(request)) return NextResponse.json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 })
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!consumePublicRateLimit('review', ip, 5, 60 * 60 * 1000)) return NextResponse.json({ error: 'Too many reviews. Try again later.' }, { status: 429 })
    const { slug } = await params
    const settings = await getProductPageSettings()
    if (!settings.reviews.enabled || !settings.reviews.allowSubmission) return NextResponse.json({ error: 'Reviews are closed.' }, { status: 403 })
    const body = (await request.json()) as Record<string, unknown>
    const author = typeof body.author === 'string' ? body.author.trim() : ''
    const text = typeof body.body === 'string' ? body.body.trim() : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const rating = Number(body.rating)
    if (!author || author.length > 80 || !text || text.length > 2000 || title.length > 120 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Enter your name, a 1–5 rating and a review.' }, { status: 400 })
    }
    const [product] = await db.select({ id: storeProducts.id }).from(storeProducts).where(eq(storeProducts.slug, slug)).limit(1)
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    await db.insert(storeProductReviews).values({ productId: product.id, author, rating, title: title || null, body: text, isApproved: settings.reviews.autoApprove })
    if (settings.reviews.autoApprove) invalidateCache('catalog')
    return NextResponse.json({ ok: true, pending: !settings.reviews.autoApprove }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Review could not be saved.' }, { status: 500 })
  }
}
