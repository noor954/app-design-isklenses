import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'

const root = resolve(import.meta.dirname, '..')
const fixture = await mkdtemp(join(tmpdir(), 'isk-cache-test-'))
const database = `isk_cache_test_${process.pid}`
const dbUrl = `postgresql://localhost/${database}?host=/tmp`
let server
let db
let created = false

try {
  const create = spawnSync('createdb', [database], { encoding: 'utf8' })
  if (create.status !== 0) throw new Error(`Could not create temporary local database: ${create.stderr}`)
  created = true
  db = new pg.Pool({ connectionString: dbUrl })
  await db.query('CREATE TABLE public.store_products (id integer)')
  await db.query('CREATE TABLE public.store_media_objects (pathname text PRIMARY KEY, content_type text NOT NULL, byte_length integer NOT NULL, digest bytea NOT NULL, content bytea NOT NULL)')
  await mkdir(join(fixture, 'app/api/check'), { recursive: true })
  await mkdir(join(fixture, 'app/api/media/[...path]'), { recursive: true })
  await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir')
  await writeFile(join(fixture, 'package.json'), '{"private":true}')
  await writeFile(join(fixture, 'next.config.mjs'), `export default {
    experimental: { externalDir: true },
    typescript: { ignoreBuildErrors: true },
    webpack(config) { config.resolve.alias['@'] = ${JSON.stringify(root)}; return config }
  }\n`)
  await writeFile(join(fixture, 'app/api/media/[...path]/route.ts'), `
export { GET, HEAD } from ${JSON.stringify(join(root, 'app/api/media/[...path]/route'))}
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
`)
  await writeFile(join(fixture, 'app/api/check/route.ts'), `
import { cached, invalidateCache } from ${JSON.stringify(join(root, 'lib/cache'))}
import { pool } from ${JSON.stringify(join(root, 'lib/db'))}
export const dynamic = 'force-dynamic'
const state = globalThis as typeof globalThis & { cacheTest?: { value: number; loads: number } }
state.cacheTest ??= { value: 1, loads: 0 }
export async function GET(request: Request) {
  const namespace = new URL(request.url).searchParams.get('namespace') || 'test'
  return Response.json(await cached(namespace, 'value', 300, async () => {
    state.cacheTest!.loads++
    const products = await pool.query<{ id: number }>('SELECT id FROM public.store_products ORDER BY id')
    return { value: state.cacheTest!.value, loads: state.cacheTest!.loads, products: products.rows.map(row => row.id) }
  }))
}
export async function POST() {
  state.cacheTest!.value++
  invalidateCache('test')
  return Response.json({ ok: true })
}
`)
  const next = join(root, 'node_modules/next/dist/bin/next')
  const env = { ...process.env, DATABASE_URL: dbUrl, NEXT_TELEMETRY_DISABLED: '1' }
  const build = spawnSync(process.execPath, [next, 'build', fixture, '--webpack'], { env, encoding: 'utf8' })
  if (build.status !== 0) throw new Error(`Fixture build failed:\n${build.stdout}\n${build.stderr}`)

  const listener = createServer()
  await new Promise((resolveListen, reject) => {
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', resolveListen)
  })
  const port = listener.address().port
  await new Promise((resolveClose, reject) => listener.close((error) => error ? reject(error) : resolveClose()))
  server = spawn(process.execPath, [next, 'start', fixture, '-p', String(port)], { env, stdio: 'ignore' })
  const url = `http://127.0.0.1:${port}/api/check`
  let response
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Fixture server exited before becoming ready.')
    try {
      response = await fetch(url)
      break
    } catch {
      await delay(100)
    }
  }
  if (!response?.ok) throw new Error('Fixture server did not become ready.')
  assert.deepEqual(await response.json(), { value: 1, loads: 1, products: [] })
  assert.deepEqual(await (await fetch(url)).json(), { value: 1, loads: 1, products: [] })
  assert.deepEqual(await (await fetch(`${url}?namespace=other`)).json(), { value: 1, loads: 2, products: [] })
  assert.equal((await fetch(url, { method: 'POST' })).status, 200)
  assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 3, products: [] })
  assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 3, products: [] })
  assert.deepEqual(await (await fetch(`${url}?namespace=other`)).json(), { value: 1, loads: 2, products: [] })
  await db.query('INSERT INTO public.store_products VALUES (1)')
  assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 4, products: [1] })
  assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 4, products: [1] })
  const first = await db.connect()
  const second = await db.connect()
  try {
    await first.query('BEGIN')
    await first.query('INSERT INTO public.store_products VALUES (2)')
    await second.query('BEGIN')
    await second.query('INSERT INTO public.store_products VALUES (3)')
    await second.query('COMMIT')
    assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 5, products: [1, 3] })
    await first.query('COMMIT')
    assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 6, products: [1, 2, 3] })
    await first.query('BEGIN')
    await first.query('INSERT INTO public.store_products VALUES (4)')
    await first.query('ROLLBACK')
  } finally {
    first.release()
    second.release()
  }
  assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 7, products: [1, 2, 3] })
  await db.query('UPDATE public.store_products SET id = 3 WHERE id = 1')
  assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 8, products: [2, 3, 3] })
  await db.query('DELETE FROM public.store_products')
  assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 9, products: [] })
  await db.query('TRUNCATE public.store_products')
  assert.deepEqual(await (await fetch(url)).json(), { value: 2, loads: 10, products: [] })
  const mediaUrl = `http://127.0.0.1:${port}/api/media/test.png`
  const missing = await fetch(mediaUrl)
  assert.equal(missing.status, 404)
  assert.equal(missing.headers.get('cache-control'), 'no-store')
  const firstImage = Buffer.from('first image')
  await db.query('INSERT INTO public.store_media_objects VALUES ($1, $2, $3, $4, $5)', [
    'test.png', 'image/png', firstImage.length, createHash('sha256').update(firstImage).digest(), firstImage,
  ])
  const image = await fetch(mediaUrl)
  assert.equal(image.status, 200)
  assert.equal(await image.text(), 'first image')
  assert.equal(image.headers.get('cache-control'), 'public, no-cache, must-revalidate')
  const etag = image.headers.get('etag')
  assert.ok(etag)
  const unchanged = await fetch(mediaUrl, { headers: { 'If-None-Match': etag } })
  assert.equal(unchanged.status, 304)
  assert.equal(unchanged.headers.get('cache-control'), 'public, no-cache, must-revalidate')
  const secondImage = Buffer.from('second image')
  await db.query('UPDATE public.store_media_objects SET byte_length = $1, digest = $2, content = $3 WHERE pathname = $4', [
    secondImage.length, createHash('sha256').update(secondImage).digest(), secondImage, 'test.png',
  ])
  const changed = await fetch(mediaUrl, { headers: { 'If-None-Match': etag } })
  assert.equal(changed.status, 200)
  assert.equal(await changed.text(), 'second image')
  assert.notEqual(changed.headers.get('etag'), etag)
  const head = await fetch(mediaUrl, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('cache-control'), 'public, no-cache, must-revalidate')
  console.log('Cache integration passed: hits, invalidation, concurrent commits, rollback, direct writes and media revalidation.')
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM')
    await new Promise((resolveExit) => server.once('exit', resolveExit))
  }
  if (db) await db.end()
  if (created) {
    const drop = spawnSync('dropdb', [database], { encoding: 'utf8' })
    if (drop.status !== 0) console.error(`Could not remove temporary test database ${database}: ${drop.stderr}`)
  }
  await rm(fixture, { recursive: true, force: true })
}
