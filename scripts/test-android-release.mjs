import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../lib/android-release.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { getAndroidRelease } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
const url = 'https://github.com/qaiserfccc/e-commerce-app-design/releases/download/android-latest/isklenses.apk'
const originalFetch = globalThis.fetch

test('only returns a completed release with the expected APK asset', async () => {
  try {
    const release = { draft: false, prerelease: false, published_at: '2026-01-01T00:00:00Z', assets: [{ name: 'isklenses.apk', state: 'uploaded', browser_download_url: url }] }
    globalThis.fetch = async () => new Response(JSON.stringify(release))
    assert.deepEqual(await getAndroidRelease(), { status: 'available', downloadUrl: url, publishedAt: release.published_at })
    release.assets[0].browser_download_url = 'https://example.com/isklenses.apk'
    assert.deepEqual(await getAndroidRelease(), { status: 'unavailable' })
    globalThis.fetch = async () => new Response(null, { status: 404 })
    assert.deepEqual(await getAndroidRelease(), { status: 'unavailable' })
    globalThis.fetch = async () => new Response(null, { status: 503 })
    assert.deepEqual(await getAndroidRelease(), { status: 'error' })
  } finally {
    globalThis.fetch = originalFetch
  }
})
