// Usage: SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed-admin.mjs  (creates/updates an owner admin in the DB)
import { randomBytes, scryptSync } from 'node:crypto'
import pg from 'pg'
import { normalizePostgresConnectionString } from '../lib/db/postgres-connection.mjs'

const email = process.env.SEED_EMAIL?.trim().toLowerCase()
const password = process.env.SEED_PASSWORD
if (!email || !password) throw new Error('SEED_EMAIL and SEED_PASSWORD are required')
const salt = randomBytes(16)
const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
const hash = `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`
const client = new pg.Client({
  connectionString: normalizePostgresConnectionString(
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ),
})
await client.connect()
await client.query(
  `insert into store_admin_users (email, password_hash, role) values ($1,$2,'owner')
   on conflict (lower(email)) do update set password_hash=excluded.password_hash, role='owner', is_active=true, session_version=store_admin_users.session_version+1, updated_at=now()`,
  [email, hash],
)
await client.end()
console.log('admin ready:', email)
