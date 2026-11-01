import { getContentAdmin } from '@/app/actions/content'
import { adminApiResponse } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return adminApiResponse(() => getContentAdmin())
}
