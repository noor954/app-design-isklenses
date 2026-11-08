import { NextResponse } from 'next/server'
import { getPromotionOffers } from '@/lib/data/promotions'
import { errorLogDetails } from '@/lib/errors/redact'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getPromotionOffers()
    return NextResponse.json(
      { data: { promotions: data }, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[storefront-deals-api] Request failed', errorLogDetails(error))
    return NextResponse.json({ error: 'Promotional offers are unavailable.' }, { status: 500 })
  }
}
