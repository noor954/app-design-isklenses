import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../lib/android-release.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { getAndroidRelease } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
const url = 'https://www.isklenses.online/isklenses.apk'

test('returns the directly hosted signed APK download', async () => {
  assert.deepEqual(await getAndroidRelease(), {
    status: 'available',
    downloadUrl: url,
    publishedAt: null,
  })
})
