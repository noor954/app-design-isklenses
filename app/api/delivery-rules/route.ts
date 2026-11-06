import { NextResponse } from 'next/server'
import { getStorefrontDeliveryRules } from '@/lib/data/delivery'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(
      { data: await getStorefrontDeliveryRules() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[delivery-rules-api] Rules request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Failed to fetch delivery rules' }, { status: 500 })
  }
}
