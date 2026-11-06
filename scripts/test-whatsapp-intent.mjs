import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../lib/whatsapp.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { asksForWhatsApp, WHATSAPP_SUPPORT_URL } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

test('recognizes WhatsApp requests without matching unrelated words', () => {
  for (const message of ['Connect on WhatsApp', 'whats app please', "what's app number", 'WHATSAPP']) {
    assert.equal(asksForWhatsApp(message), true, message)
  }
  for (const message of ['what is your app?', 'shipping rates', 'notwhatsapp']) {
    assert.equal(asksForWhatsApp(message), false, message)
  }
  assert.equal(new URL(WHATSAPP_SUPPORT_URL).hostname, 'wa.me')
  assert.equal(new URL(WHATSAPP_SUPPORT_URL).pathname, '/923015740405')
})
