import { NextResponse, type NextRequest } from 'next/server'
import { getHomeSectionPage, isHomeSectionKey } from '@/lib/data/home-sections'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params
  if (!isHomeSectionKey(section)) {
    return NextResponse.json({ error: 'Unknown homepage section.' }, { status: 404 })
  }
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page') ?? '1')
  const query = (url.searchParams.get('q') ?? '').slice(0, 80)
  try {
    const data = await getHomeSectionPage(section, { page, query })
    return NextResponse.json(
      { data, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[storefront-home-sections-api] Request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Homepage section is unavailable.' }, { status: 500 })
  }
}
