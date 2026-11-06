import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../lib/storefront/product-image-sources.ts', import.meta.url), 'utf8')
const mediaModule = new URL('../lib/media-url.mjs', import.meta.url).href
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
  .replace('@/lib/media-url.mjs', mediaModule)
const { getProductAlternateImageSource } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

test('chooses the first distinct managed image after the primary', () => {
  const primary = '/api/media/products/first.webp'
  const alternate = '/api/media/products/second.webp'
  assert.equal(getProductAlternateImageSource({
    heroImageUrl: primary,
    assets: [
      { mediaType: 'image', blobUrl: null },
      { mediaType: 'image', blobUrl: primary },
      { mediaType: 'video', blobUrl: '/api/media/products/video.mp4' },
      { mediaType: 'image', blobUrl: alternate },
    ],
  }), alternate)
})

test('keeps the original image when no distinct managed alternative exists', () => {
  assert.equal(getProductAlternateImageSource({
    heroImageUrl: '/api/media/products/first.webp',
    assets: [
      { mediaType: 'image', blobUrl: '/api/media/products/first.webp' },
      { mediaType: 'image', blobUrl: 'https://example.com/image.jpg' },
    ],
  }), null)
  assert.equal(getProductAlternateImageSource({ heroImageUrl: null }), null)
})
