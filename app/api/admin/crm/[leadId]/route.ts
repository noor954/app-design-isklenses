import { NextRequest } from 'next/server'
import { updateCrmLead } from '@/app/actions/admin'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ leadId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ leadId }, body] = await Promise.all([params, readAdminJson(request)])
    return adminApiResponse(() => updateCrmLead(leadId, body))
  } catch (error) {
    return adminApiFailure(error)
  }
}
