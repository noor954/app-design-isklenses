// Deletes database-backed media referenced by products (run only before wiping products).
import pg from 'pg'
import { normalizePostgresConnectionString } from '../lib/db/postgres-connection.mjs'

const client = new pg.Client({
  connectionString: normalizePostgresConnectionString(
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ),
})
await client.connect()
const { rows } = await client.query(
  `select blob_pathname as pathname from store_product_assets
   union select substring(hero_image_url from '^/api/media/(.*)$')
     from store_products where hero_image_url like '/api/media/%'`,
)
const pathnames = rows.map((row) => row.pathname).filter(Boolean)
const deleted = pathnames.length
  ? await client.query('delete from store_media_objects where pathname = any($1::text[])', [pathnames])
  : { rowCount: 0 }
console.log('deleted media objects:', deleted.rowCount)
await client.end()
