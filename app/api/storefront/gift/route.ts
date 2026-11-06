import { NextResponse } from 'next/server'
import { getFreeGiftOffer } from '@/lib/data/free-gift'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getFreeGiftOffer()
    return NextResponse.json(
      { data, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[storefront-gift-api] Request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'The free gift offer is unavailable.' }, { status: 500 })
  }
}
