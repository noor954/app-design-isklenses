import { NextRequest } from 'next/server'
import { createSystemUser, getSystemUsers } from '@/app/actions/admin'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getSystemUsers())
}

export async function POST(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    return adminApiResponse(() => createSystemUser(body as Parameters<typeof createSystemUser>[0]), 201)
  } catch (error) {
    return adminApiFailure(error)
  }
}
