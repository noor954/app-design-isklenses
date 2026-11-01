import { NextRequest, NextResponse } from 'next/server'
import { createCrmLead, getCrmLeads } from '@/app/actions/admin'
import { adminApiError } from '@/lib/auth/admin-api'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const rawOffset = url.searchParams.get('offset') ?? '0'
    const query = url.searchParams.get('q') ?? ''
    const status = url.searchParams.get('status') ?? ''
    if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(Number(rawOffset)) || Number(rawOffset) > 1_000_000) {
      return NextResponse.json({ error: 'Lead page is invalid.' }, { status: 400 })
    }

    if (query.length > 100) return NextResponse.json({ error: 'Lead search is too long.' }, { status: 400 })
    if (status.length > 32) return NextResponse.json({ error: 'Lead status filter is invalid.' }, { status: 400 })
    const result = await getCrmLeads(50, Number(rawOffset), query, status)
    return NextResponse.json({ data: result.items, total: result.total, metaSetup: result.metaSetup }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return adminApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    return adminApiResponse(() => createCrmLead(body as Parameters<typeof createCrmLead>[0]), 201)
  } catch (error) {
    return adminApiFailure(error)
  }
}
