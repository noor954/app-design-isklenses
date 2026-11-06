import { NextRequest, NextResponse } from 'next/server'
import { getChatbotKnowledge } from '@/lib/data/chatbot'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (rawQuery.length > 100) {
    return NextResponse.json({ error: 'Search query is too long.' }, { status: 400 })
  }

  try {
    return NextResponse.json(
      {
        data: await getChatbotKnowledge(rawQuery),
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (error) {
    console.error('[chatbot-knowledge-api] Knowledge request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Failed to fetch chatbot knowledge' }, { status: 500 })
  }
}
