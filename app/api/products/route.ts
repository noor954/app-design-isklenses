import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, getCatalogPage } from '@/lib/data/catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const rawBrand = url.searchParams.get('brand')?.trim()
    const rawQuery = url.searchParams.get('q')?.trim()
    const rawShadeId = url.searchParams.get('shadeId')?.trim()
    const rawLensTypeId = url.searchParams.get('lensTypeId')?.trim()
    const rawSort = url.searchParams.get('sort')?.trim() || 'newest'
    const rawPage = url.searchParams.get('page')
    const rawLimit = url.searchParams.get('limit')
    if (category && category.length > 100) return NextResponse.json({ error: 'Category filter is too long.' }, { status: 400 })
    if (rawBrand && rawBrand.length > 100) return NextResponse.json({ error: 'Brand filter is too long.' }, { status: 400 })
    if (rawQuery && rawQuery.length > 100) return NextResponse.json({ error: 'Search query is too long.' }, { status: 400 })
    if (rawShadeId && rawShadeId.length > 100) return NextResponse.json({ error: 'Shade filter is too long.' }, { status: 400 })
    if (rawLensTypeId && rawLensTypeId.length > 100) return NextResponse.json({ error: 'Lens type filter is too long.' }, { status: 400 })
    if (!['newest', 'price_asc', 'price_desc', 'name_asc', 'featured'].includes(rawSort)) {
      return NextResponse.json({ error: 'Choose a supported sort order.' }, { status: 400 })
    }
    if ((rawPage !== null && !/^[1-9]\d*$/.test(rawPage)) || (rawLimit !== null && !/^[1-9]\d*$/.test(rawLimit))) {
      return NextResponse.json({ error: 'Page and limit must be positive integers.' }, { status: 400 })
    }
    if (!rawPage && rawLimit) return NextResponse.json({ error: 'Page is required when using limit.' }, { status: 400 })
    const page = rawPage ? Number(rawPage) : null
    const limit = rawLimit ? Number(rawLimit) : null
    if (page !== null && (!Number.isSafeInteger(page) || page > 100_000)) {
      return NextResponse.json({ error: 'Page is outside the supported range.' }, { status: 400 })
    }
    if (limit !== null && (!Number.isSafeInteger(limit) || limit > 100)) {
      return NextResponse.json({ error: 'Limit must be between 1 and 100.' }, { status: 400 })
    }
    const query = rawQuery

    if (page !== null) {
      const result = await getCatalogPage(
        category || null,
        query || null,
        rawBrand || null,
        page,
        limit ?? 24,
        rawShadeId || null,
        rawLensTypeId || null,
        rawSort as 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'featured',
      )
      return NextResponse.json(
        {
          data: result.data,
          pagination: {
            page: result.page,
            limit: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          },
          timestamp: new Date().toISOString(),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const enrichedProducts = await getCatalog(category || null, query || null, rawBrand || null)

    return NextResponse.json(
      {
        data: enrichedProducts,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (error) {
    console.error('[products-api] Catalog request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
