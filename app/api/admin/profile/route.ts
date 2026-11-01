import { NextRequest } from 'next/server'
import { updateOwnSystemUserCredentials } from '@/app/actions/admin'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

export async function PUT(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    return adminApiResponse(() => updateOwnSystemUserCredentials(body as Parameters<typeof updateOwnSystemUserCredentials>[0]))
  } catch (error) {
    return adminApiFailure(error)
  }
}
