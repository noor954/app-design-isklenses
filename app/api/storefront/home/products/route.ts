import { NextResponse, type NextRequest } from 'next/server'
import { HOME_PRODUCT_TABS, getHomeProductsPage, type HomeProductTab } from '@/lib/data/catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tab = (url.searchParams.get('tab') ?? 'catalog') as HomeProductTab
  if (!HOME_PRODUCT_TABS.includes(tab)) {
    return NextResponse.json({ error: 'Unknown product tab.' }, { status: 404 })
  }
  try {
    const data = await getHomeProductsPage(tab, Number(url.searchParams.get('page') ?? '1'))
    return NextResponse.json(
      { data, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } },
    )
  } catch (error) {
    console.error('[storefront-home-products-api] Request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Homepage products are unavailable.' }, { status: 500 })
  }
}
