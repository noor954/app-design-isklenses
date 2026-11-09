import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createD1Database } from '@/lib/db/d1'
import {
  storeMediaObjectChunks,
  storeMediaObjects,
} from '@/lib/db/schema.d1'
import { publicMediaUrl } from '@/lib/media-url.mjs'
import type { AnyD1Database } from 'drizzle-orm/d1'

const maxMediaBytes = 12_582_912
const chunkBytes = 1_000_000

function validPath(pathname: string) {
  if (
    typeof pathname !== 'string' ||
    pathname.length > 1024 ||
    pathname.startsWith('/') ||
    !/^[a-zA-Z0-9._/-]+$/.test(pathname) ||
    pathname.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('Media path is invalid.')
  }
  return pathname
}

function splitMedia(body: Uint8Array) {
  const chunks: Buffer[] = []
  for (let offset = 0; offset < body.byteLength; offset += chunkBytes) {
    chunks.push(Buffer.from(body.subarray(offset, Math.min(offset + chunkBytes, body.byteLength))))
  }
  return chunks
}

export async function uploadMediaToD1(
  binding: AnyD1Database,
  pathname: string,
  body: Uint8Array,
  contentType: string,
) {
  const key = validPath(pathname)
  if (!(body instanceof Uint8Array) || body.byteLength === 0 || body.byteLength > maxMediaBytes) {
    throw new Error('Media upload size is invalid.')
  }
  if (typeof contentType !== 'string' || !/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) {
    throw new Error('Media content type is invalid.')
  }

  const db = createD1Database(binding)
  const chunks = splitMedia(body)
  const digest = createHash('sha256').update(body).digest()
  const [removeOldChunks, upsertObject, addChunks] = [
    db.delete(storeMediaObjectChunks).where(eq(storeMediaObjectChunks.pathname, key)),
    db.insert(storeMediaObjects).values({
      pathname: key,
      contentType,
      byteLength: body.byteLength,
      digest,
    }).onConflictDoUpdate({
      target: storeMediaObjects.pathname,
      set: {
        contentType,
        byteLength: body.byteLength,
        digest,
        updatedAt: new Date(),
      },
    }),
    db.insert(storeMediaObjectChunks).values(
      chunks.map((content, chunkIndex) => ({ pathname: key, chunkIndex, content })),
    ),
  ] as const

  await db.batch([removeOldChunks, upsertObject, addChunks])
  return { pathname: key, url: publicMediaUrl(key) }
}

export async function deleteMediaFromD1(binding: AnyD1Database, pathname: string) {
  const db = createD1Database(binding)
  await db.delete(storeMediaObjects).where(eq(storeMediaObjects.pathname, validPath(pathname)))
}

export async function mediaObjectExistsInD1(binding: AnyD1Database, pathname: string) {
  const db = createD1Database(binding)
  const [object] = await db.select({ pathname: storeMediaObjects.pathname })
    .from(storeMediaObjects)
    .where(eq(storeMediaObjects.pathname, validPath(pathname)))
    .limit(1)
  return Boolean(object)
}

export async function readMediaFromD1(binding: AnyD1Database, pathname: string) {
  const key = validPath(pathname)
  const db = createD1Database(binding)
  const [object] = await db.select({
    contentType: storeMediaObjects.contentType,
    byteLength: storeMediaObjects.byteLength,
    digest: storeMediaObjects.digest,
  }).from(storeMediaObjects).where(eq(storeMediaObjects.pathname, key)).limit(1)

  if (!object) return null

  const chunks = await db.select({
    index: storeMediaObjectChunks.chunkIndex,
    content: storeMediaObjectChunks.content,
  }).from(storeMediaObjectChunks)
    .where(eq(storeMediaObjectChunks.pathname, key))
    .orderBy(storeMediaObjectChunks.chunkIndex)

  if (chunks.length === 0 || chunks.some((chunk, index) => chunk.index !== index)) {
    throw new Error('Stored media chunks are incomplete.')
  }

  const content = Buffer.concat(chunks.map((chunk) => chunk.content))
  const digest = createHash('sha256').update(content).digest()
  if (
    content.byteLength !== object.byteLength ||
    !digest.equals(object.digest)
  ) {
    throw new Error('Stored media failed integrity validation.')
  }

  return {
    content_type: object.contentType,
    byte_length: object.byteLength,
    content,
    etag: digest.toString('hex'),
  }
}
