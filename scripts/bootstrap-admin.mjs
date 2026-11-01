#!/usr/bin/env node

import { randomBytes, scryptSync } from 'node:crypto'
import { Pool } from 'pg'
import { normalizePostgresConnectionString } from '../lib/db/postgres-connection.mjs'

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env

if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD are required.')
  process.exit(1)
}

const email = ADMIN_EMAIL.trim().toLowerCase()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  console.error('ADMIN_EMAIL must be a valid email address.')
  process.exit(1)
}
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length > 256) {
  console.error('ADMIN_PASSWORD is required.')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = scryptSync(ADMIN_PASSWORD, salt, 64, {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
})
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`
const pool = new Pool({
  connectionString: normalizePostgresConnectionString(DATABASE_URL),
})

try {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(731824615)')
    const { rows } = await client.query(
      "SELECT count(*)::int AS total FROM store_admin_users WHERE role = 'owner' AND is_active = true",
    )
    if (rows[0].total > 0) {
      await client.query('ROLLBACK')
      console.log('An active owner already exists; no account was created.')
    } else {
      await client.query(
        `INSERT INTO store_admin_users (email, password_hash, role)
         VALUES ($1, $2, 'owner')`,
        [email, passwordHash],
      )
      await client.query('COMMIT')
      console.log('Initial owner account created.')
    }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') {
      throw new Error('That email is already assigned to a system user; no owner was created.')
    }
    throw error
  } finally {
    client.release()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to provision the initial owner account.')
  process.exitCode = 1
} finally {
  await pool.end()
}
