import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../lib/toric.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { isToricLensType, toricWhatsAppUrl } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

test('only the Toric lens type requires the Toric workflow', () => {
  assert.equal(isToricLensType(' Toric '), true)
  assert.equal(isToricLensType('TORIC'), true)
  assert.equal(isToricLensType('Non-toric'), false)
  assert.equal(Boolean(isToricLensType(null)), false)
})

test('WhatsApp inquiry identifies the product without creating an order', () => {
  const url = new URL(toricWhatsAppUrl('Blue & Grey'))
  assert.equal(url.origin, 'https://wa.me')
  assert.equal(url.pathname, '/923015740405')
  assert.match(url.searchParams.get('text'), /Blue & Grey/)
  assert.match(url.searchParams.get('text'), /advance payment/)
})
