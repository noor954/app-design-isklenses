#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { normalizePostgresConnectionString } from '../lib/db/postgres-connection.mjs'
import { assertMediaStorageConfigured, getMediaPublicUrl, mediaObjectExists, uploadMedia } from '../lib/server/media-storage.mjs'

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required.')
assertMediaStorageConfigured()

const migration = await readFile(new URL('../db/migrations/0007_storefront_content.sql', import.meta.url), 'utf8')
const seedBanners = new Map()
const bannerPattern = /^\s+\('([^']+)', '((?:[^']|'')*)', (?:NULL|'(?:[^']|'')*'), '(https:\/\/[^']+)', (?:NULL|'(?:[^']|'')*'), (\d+)\),?$/gm
for (const match of migration.matchAll(bannerPattern)) {
  const [, placement, title, sourceUrl, sortOrder] = match
  seedBanners.set(`${placement}:${sortOrder}`, { title: title.replaceAll("''", "'"), sourceUrl })
}
const footerLogoSource = migration.match(/\('footer', '.*?"logo":"(https:\/\/[^"]+)"/)?.[1]

function safeSourceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' ||
        !['eyelenses.pk', 'www.eyelenses.pk', 'isklenses.com', 'www.isklenses.com'].includes(url.hostname) ||
        url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

function getImageType(bytes, header) {
  const type = header.split(';', 1)[0].trim().toLowerCase()
  if (type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return type
  if (type === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return type
  if (type === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return type
  if (type === 'image/avif' && bytes.toString('ascii', 4, 8) === 'ftyp' &&
      ['avif', 'avis'].includes(bytes.toString('ascii', 8, 12))) return type
  if (type === 'image/gif' && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return type
  throw new Error('The saved source URL did not return a supported image.')
}

async function downloadImage(value) {
  const sourceUrl = safeSourceUrl(value)
  if (!sourceUrl) throw new Error('The source URL is outside the approved ISK image hosts.')
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(25_000),
    headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif', 'User-Agent': 'ISK-Lenses-Media-Restore/1.0' },
  })
  if (!response.ok) throw new Error(`The source image returned HTTP ${response.status}.`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('image/')) throw new Error('The source did not return an image.')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 1 || bytes.length > 12 * 1024 * 1024) throw new Error('The image is empty or larger than 12 MB.')
  return { bytes, contentType: getImageType(bytes, contentType) }
}

async function storeSourceImage(sourceUrl) {
  const pathname = `content/legacy-${createHash('sha256').update(sourceUrl).digest('hex')}`
  if (!await mediaObjectExists(pathname)) {
    const image = await downloadImage(sourceUrl)
    await uploadMedia(pathname, image.bytes, image.contentType)
  }
  return getMediaPublicUrl(pathname)
}

const pool = new pg.Pool({
  connectionString: normalizePostgresConnectionString(databaseUrl),
  max: 2,
  connectionTimeoutMillis: 10_000,
})
const failures = []
let restoredBanners = 0
let restoredFooter = 0

try {
  const { rows: banners } = await pool.query(
    `SELECT id, placement, title, sort_order, image_url
     FROM public.store_banners
     ORDER BY placement, sort_order`,
  )
  for (const banner of banners) {
    if (!banner.image_url?.includes('blob.vercel-storage.com')) continue
    const seed = seedBanners.get(`${banner.placement}:${banner.sort_order}`)
    if (!seed || seed.title !== banner.title) {
      failures.push(`banner ${banner.id}: no matching original source image in the content migration`)
      continue
    }
    try {
      const imageUrl = await storeSourceImage(seed.sourceUrl)
      await pool.query(
        'UPDATE public.store_banners SET image_url = $1, blob_pathname = $2, updated_at = now() WHERE id = $3',
        [imageUrl, imageUrl.slice('/api/media/'.length), banner.id],
      )
      restoredBanners += 1
    } catch (error) {
      failures.push(`banner ${banner.id}: ${error instanceof Error ? error.message : 'unknown failure'}`)
    }
  }

  if (footerLogoSource) {
    try {
      const { rows } = await pool.query(
        `SELECT value FROM public.store_settings WHERE key = 'footer'`,
      )
      const footer = rows[0]?.value
      if (footer?.logo?.includes('blob.vercel-storage.com')) {
        footer.logo = await storeSourceImage(footerLogoSource)
        await pool.query(
          `UPDATE public.store_settings SET value = $1::jsonb, updated_at = now() WHERE key = 'footer'`,
          [JSON.stringify(footer)],
        )
        restoredFooter = 1
      }
    } catch (error) {
      failures.push(`footer logo: ${error instanceof Error ? error.message : 'unknown failure'}`)
    }
  }
} finally {
  await pool.end()
}

console.log(JSON.stringify({ restoredBanners, restoredFooter, failed: failures.length, failures: failures.slice(0, 30) }, null, 2))
if (failures.length) process.exitCode = 1
