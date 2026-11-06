import { NextResponse } from 'next/server'
import { getCategories } from '@/lib/data/catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const categories = await getCategories()
    return NextResponse.json(
      { data: categories },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[product-categories-api] Category request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Failed to fetch product categories' }, { status: 500 })
  }
}
