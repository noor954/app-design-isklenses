import { getOrderStats } from '@/app/actions/admin'
import { adminApiResponse } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getOrderStats())
}
