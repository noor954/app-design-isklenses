import { getRecentErrorLogs } from '@/app/actions/catalog-taxonomy'
import { adminApiResponse } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getRecentErrorLogs())
}
