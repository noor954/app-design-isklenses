import { NextResponse } from 'next/server'
import { getCatalogRealtimeUrl, sealPublicCatalogVersion } from '@/lib/realtime/catalog'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const url = getCatalogRealtimeUrl()
  if (!url || !process.env.NEON_REALTIME_SECRET || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Catalog live updates are not configured.' }, { status: 503, headers: noStore })
  }

  try {
    const query = await sealPublicCatalogVersion()
    if (!query) return NextResponse.json({ error: 'Catalog live updates are not configured.' }, { status: 503, headers: noStore })
    return NextResponse.json({ url, query }, { headers: noStore })
  } catch (error) {
    console.error('[catalog-realtime] Could not seal public catalog query', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Catalog live updates are temporarily unavailable.' }, { status: 500, headers: noStore })
  }
}
