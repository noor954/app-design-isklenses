import { NextRequest, NextResponse } from 'next/server'
import { getProduct } from '@/lib/data/catalog'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    const product = await getProduct(slug)
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    return NextResponse.json(
      { data: product, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[products-api] Product request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Unable to load this product right now.' }, { status: 500 })
  }
}
