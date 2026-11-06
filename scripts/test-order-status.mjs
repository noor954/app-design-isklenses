import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../lib/order-status.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { orderStatusDetails } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

test('only recorded fulfillment statuses assert delivery', () => {
  for (const [status, transit] of Object.entries({
    pending: 'Not dispatched',
    processing: 'Not dispatched',
    shipped: 'Dispatched',
    delivered: 'Delivered',
    paid: 'Not recorded',
    refunded: 'Not recorded',
    cancelled: 'Cancelled',
    unknown: 'Not recorded',
  })) {
    assert.equal(orderStatusDetails(status, 'cash_on_delivery').transit, transit)
    assert.equal(orderStatusDetails(status, null).transit, transit)
  }
})
