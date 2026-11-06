import { NextResponse } from 'next/server'
import {
  getCategories,
  getHomeCatalog,
  getStorefrontBrands,
  getStorefrontLensTypes,
  getStorefrontReviews,
  getStorefrontShades,
} from '@/lib/data/catalog'
import { getHomeContent, getSiteChrome } from '@/lib/data/site-content'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [content, chrome, products, categories, brands, shades, lensTypes, reviews] =
      await Promise.all([
        getHomeContent(),
        getSiteChrome(),
        getHomeCatalog(),
        getCategories(),
        getStorefrontBrands(),
        getStorefrontShades(),
        getStorefrontLensTypes(),
        getStorefrontReviews(),
      ])

    return NextResponse.json(
      {
        data: {
          content,
          chrome,
          products,
          categories,
          brands,
          shades,
          lensTypes,
          reviews,
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error(
      '[storefront-home-api] Home content request failed',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return NextResponse.json(
      { error: 'Storefront home content is unavailable.' },
      { status: 500 },
    )
  }
}
