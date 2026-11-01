// Usage: node scripts/seed-catalog.mjs  (idempotent starter category tree + sample products; run with DATABASE_URL set)
import pg from 'pg'
import { normalizePostgresConnectionString } from '../lib/db/postgres-connection.mjs'

const tree = [
  ['Colored Lenses', 'colored-lenses', [
    ['Bella', 'bella', [['Rosewood Collection', 'rosewood-collection', []], ['Glow Collection', 'glow-collection', []]]],
    ['Freshlook', 'freshlook', []],
    ['Freshkon', 'freshkon', []],
    ['Luminous', 'luminous', []],
  ]],
  ['Transparent Lenses', 'transparent-lenses', [['Optiano', 'optiano', []], ['Us Vision', 'us-vision', []]]],
  ['New Arrivals', 'new-arrivals', []],
  ['Accessories', 'accessories', []],
]

const client = new pg.Client({
  connectionString: normalizePostgresConnectionString(
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ),
})
await client.connect()
const ids = {}
async function insert(nodes, parentId) {
  for (const [index, [name, slug, kids]] of nodes.entries()) {
    const { rows } = await client.query(
      `insert into store_categories (name, slug, parent_id, sort_order) values ($1,$2,$3,$4)
       on conflict (slug) do update set name = excluded.name returning id`,
      [name, slug, parentId, index],
    )
    ids[slug] = rows[0].id
    await insert(kids, rows[0].id)
  }
}
await insert(tree, null)

const products = [
  {
    name: 'Rosewood One Day Collection Bella', slug: 'rosewood-one-day-collection-bella', category: 'rosewood-collection', brand: 'Bella', sku: 'BELLA-RW-1D',
    short: 'Soft, natural-looking one day colored lenses in warm rosewood tones.', price: '2500', compare: '3000', diameter: '14.20', curve: '8.60', water: '38%',
    material: 'Hydrogel', wear: 'One day', pack: '10 lenses (5 pairs)', powerType: 'Zero power / Prescription', range: '0.00 to -8.00', uv: true, featured: true,
    colors: [['Rosewood Brown', '#8b5a3c'], ['Rosewood Grey', '#7a7f85'], ['Rosewood Hazel', '#a07c3b']],
    features: ['Natural 3-tone iris pattern', 'Daily disposable — no cleaning needed', 'UV protection', 'Comfortable all-day wear'],
    specs: [['Lens type', 'Soft contact lens'], ['Origin', 'Korea']],
    usage: 'Wash hands, place the lens on your fingertip, and apply to the eye. Discard after a single use.',
    desc: 'The Rosewood One Day collection by Bella brings subtle, warm color to your everyday look. Made from breathable hydrogel for comfort from morning to night.',
    variant: { name: 'Rosewood Brown · Zero power', color: 'Rosewood Brown', power: null, stock: 50 },
    review: ['Ayesha K.', 5, 'Looks so natural', 'Very comfortable and the color is gorgeous in daylight.'],
  },
  {
    name: 'Freshlook Colorblends Honey', slug: 'freshlook-colorblends-honey', category: 'freshlook', brand: 'Freshlook', sku: 'FL-CB-HONEY',
    short: 'Monthly colored lenses with a blended honey tone.', price: '3200', compare: null, diameter: '14.50', curve: '8.60', water: '55%',
    material: 'Phemfilcon A', wear: 'Monthly', pack: '2 lenses (1 pair)', powerType: 'Zero power / Prescription', range: '0.00 to -6.00', uv: false, featured: true,
    colors: [['Honey', '#c8923a']], features: ['Three-in-one color blend', 'Monthly replacement'], specs: [],
    usage: 'Clean and store in fresh solution after each wear.', desc: 'A classic monthly colored lens for a bright, natural enhancement.',
    variant: { name: 'Honey · Zero power', color: 'Honey', power: null, stock: 30 },
    review: null,
  },
  {
    name: 'Optiano Clear Monthly', slug: 'optiano-clear-monthly', category: 'optiano', brand: 'Optiano', sku: 'OPT-CLR-M',
    short: 'Clear monthly lenses for everyday vision correction.', price: '1800', compare: null, diameter: '14.20', curve: '8.60', water: '42%',
    material: 'Hydrogel', wear: 'Monthly', pack: '2 lenses (1 pair)', powerType: 'Prescription', range: '-0.50 to -10.00', uv: true, featured: false,
    colors: [], features: ['High oxygen permeability', 'UV protection'], specs: [], usage: null, desc: 'Reliable clear lenses for all-day comfort.',
    variant: { name: 'Clear · -2.00', color: null, power: '-2.00', stock: 40 },
    review: null,
  },
]

for (const item of products) {
  const { rows } = await client.query(
    `insert into store_products (name, slug, category_id, brand, sku, short_description, description, price, compare_at_price, status, stock_quantity,
       colors, diameter_mm, base_curve, water_content, material, wear_duration, pack_contents, power_type, power_range, uv_protection, features, specs,
       usage_instructions, is_featured)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',0,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     on conflict (slug) do nothing returning id`,
    [item.name, item.slug, ids[item.category], item.brand, item.sku, item.short, item.desc, item.price, item.compare,
      JSON.stringify(item.colors.map(([name, hex]) => ({ name, hex }))), item.diameter, item.curve, item.water, item.material, item.wear, item.pack,
      item.powerType, item.range, item.uv, JSON.stringify(item.features), JSON.stringify(item.specs.map(([label, value]) => ({ label, value }))), item.usage, item.featured],
  )
  if (!rows[0]) continue
  const id = rows[0].id
  await client.query(
    `insert into store_product_variants (product_id, name, color, power_diopters, base_curve, diameter_mm, pack_size, price, currency, stock_quantity, is_active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'PKR',$9,true)`,
    [id, item.variant.name, item.variant.color, item.variant.power, item.curve, item.diameter, 2, item.price, item.variant.stock],
  )
  await client.query('update store_products set stock_quantity = $2 where id = $1', [id, item.variant.stock])
  if (item.review) {
    await client.query(`insert into store_product_reviews (product_id, author, rating, title, body, is_approved) values ($1,$2,$3,$4,$5,true)`, [id, ...item.review])
  }
}
await client.end()
console.log('catalog seeded:', Object.keys(ids).length, 'categories')
