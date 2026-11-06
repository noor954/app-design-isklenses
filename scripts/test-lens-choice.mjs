import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../lib/power-lens-options.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { isValidLensSelection, priceWithPowerSurcharge } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

test('plain requires explicit choice and no eye values; legacy power choices remain valid', () => {
  const options = ['-0.50', '-1.00']
  assert.equal(isValidLensSelection(options, 'plain', null, null), true)
  assert.equal(isValidLensSelection(options, null, null, null), false)
  assert.equal(isValidLensSelection(options, 'plain', '-0.50', null), false)
  assert.equal(isValidLensSelection(options, 'power', '-0.50', null), false)
  assert.equal(isValidLensSelection(options, 'power', '-0.50', '-1.00'), true)
  assert.equal(isValidLensSelection(options, null, '-0.50', '-1.00'), true)
  assert.equal(isValidLensSelection(options, 'power', '-0.50', '-2.00'), false)
  assert.equal(isValidLensSelection([], null, null, null), true)
  assert.equal(isValidLensSelection([], 'plain', null, null), false)
})

test('plain has no surcharge and power adds both eye prices', () => {
  const options = [{ value: '-0.50', label: '-0.50', surcharge: '150.00' }]
  assert.equal(priceWithPowerSurcharge('1000.00', options, null, null), '1000.00')
  assert.equal(priceWithPowerSurcharge('1000.00', options, '-0.50', '-0.50'), '1300.00')
})
