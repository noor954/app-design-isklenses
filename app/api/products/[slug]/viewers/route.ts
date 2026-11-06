import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { consumePublicRateLimit } from '@/lib/auth/public-rate-limit'
import { pool } from '@/lib/db'
import { isSameOriginOrNativeRequest } from '@/lib/http/api-origin'
import { JsonBodyError, readJsonBody } from '@/lib/http/json-body'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isSameOriginOrNativeRequest(request)) return NextResponse.json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 })
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!consumePublicRateLimit('product-viewers', ip, 120, 60_000)) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  try {
    const { slug } = await params
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    const body = await readJsonBody(request, 512)
    if (!body || typeof body !== 'object' || !('viewerId' in body) || typeof body.viewerId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.viewerId)) {
      return NextResponse.json({ error: 'A random version 4 viewerId is required.' }, { status: 400 })
    }
    const viewerHash = createHash('sha256').update(body.viewerId).digest('hex')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO store_product_viewers (product_id, viewer_hash, last_seen_at)
         SELECT id, $2, now() FROM store_products WHERE slug = $1 AND status = 'active'
         ON CONFLICT (product_id, viewer_hash) DO UPDATE SET last_seen_at = now()
         RETURNING product_id`,
        [slug, viewerHash],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
      }
      const count = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM store_product_viewers
         WHERE product_id = $1 AND last_seen_at > now() - interval '2 minutes'`,
        [result.rows[0].product_id],
      )
      await client.query(
        `DELETE FROM store_product_viewers WHERE ctid IN
         (SELECT ctid FROM store_product_viewers WHERE last_seen_at < now() - interval '2 minutes'
          ORDER BY last_seen_at LIMIT 200 FOR UPDATE SKIP LOCKED)`,
      )
      await client.query('COMMIT')
      return NextResponse.json({ data: { count: count.rows[0].count, windowSeconds: 120 } }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    if (error instanceof JsonBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[product-viewers-api] Request failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Viewer count is unavailable.' }, { status: 500 })
  }
}
