import { NextRequest } from 'next/server'
import { resetSystemUserPassword, setSystemUserActive } from '@/app/actions/admin'
import { AdminRequestError } from '@/lib/http/admin-request-error'
import { adminApiFailure, adminApiResponse, readAdminJson } from '@/lib/http/admin-route'

type RouteContext = { params: Promise<{ userId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const [{ userId }, body] = await Promise.all([params, readAdminJson(request)])
    if (typeof body.isActive === 'boolean') {
      return adminApiResponse(() => setSystemUserActive(userId, body.isActive as boolean))
    }
    if (typeof body.newPassword === 'string') {
      return adminApiResponse(() => resetSystemUserPassword(userId, body.newPassword as string))
    }
    throw new AdminRequestError('Provide an active status or a new password.', 400)
  } catch (error) {
    return adminApiFailure(error)
  }
}
