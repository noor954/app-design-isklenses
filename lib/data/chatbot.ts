import { and, desc, eq, ilike, or } from 'drizzle-orm'
import { storefrontFaqs } from '@/lib/data/storefront-faq'
import { db } from '@/lib/db'
import { storeCategories, storeProducts, storeSettings } from '@/lib/db/schema'

export type ChatbotSettings = {
  enabled: boolean
  welcomeMessage: string
}

export const DEFAULT_CHATBOT_SETTINGS: ChatbotSettings = {
  enabled: true,
  welcomeMessage: 'Hi! Ask me about products or store FAQs.',
}

export type ChatbotKnowledge = {
  faqs: Array<{ question: string; answer: string; source: string }>
  products: Array<{
    name: string
    brand: string | null
    category: string | null
    price: string
    currency: string
    diameterMm: string | null
    baseCurve: string | null
    waterContent: string | null
    wearDuration: string | null
    packContents: string | null
    powerType: string | null
    powerRange: string | null
    availablePowerRanges: string[]
    availability: 'in_stock' | 'out_of_stock'
    url: string
  }>
  guidance: string[]
}

export type ChatbotAnswer = {
  answer: string
  links: Array<{ label: string; href: string }>
}

const stopWords = new Set([
  'a', 'about', 'an', 'and', 'are', 'can', 'contact', 'do', 'for', 'from', 'have',
  'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our', 'please',
  'product', 'products', 'the', 'this', 'to', 'we', 'what', 'when', 'where', 'which',
  'who', 'with', 'you', 'your',
])

function tokens(value: string) {
  return value.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length > 1 && !stopWords.has(token)) ?? []
}

function canonical(token: string) {
  if (['ship', 'shipping', 'deliver', 'delivers', 'delivery'].includes(token)) return 'delivery'
  if (['pay', 'paid', 'payment', 'cod', 'cash'].includes(token)) return 'payment'
  if (['cost', 'cheap', 'affordable', 'price', 'prices'].includes(token)) return 'price'
  if (['buy', 'purchase', 'ordering', 'order'].includes(token)) return 'order'
  return token
}

function matchScore(queryTokens: string[], text: string) {
  const available = new Set(tokens(text).map(canonical))
  const matched = new Set(queryTokens.map(canonical).filter((token) => available.has(token)))
  return queryTokens.length ? matched.size / queryTokens.length : 0
}

export async function getChatbotSettings(): Promise<ChatbotSettings> {
  const [row] = await db.select({ value: storeSettings.value })
    .from(storeSettings)
    .where(eq(storeSettings.key, 'chatbot'))
    .limit(1)
  if (!row || typeof row.value !== 'object' || row.value === null || Array.isArray(row.value)) {
    return DEFAULT_CHATBOT_SETTINGS
  }
  const value = row.value as Record<string, unknown>
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_CHATBOT_SETTINGS.enabled,
    welcomeMessage: typeof value.welcomeMessage === 'string' && value.welcomeMessage.trim()
      ? value.welcomeMessage.trim().slice(0, 180)
      : DEFAULT_CHATBOT_SETTINGS.welcomeMessage,
  }
}

export async function getChatbotKnowledge(query: string): Promise<ChatbotKnowledge> {
  const searchTerms = query.toLowerCase().split(/\s+/).filter((term) => term.length >= 2).slice(0, 5)
  const searchConditions = searchTerms.flatMap((term) => {
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`
    return [
      ilike(storeProducts.name, pattern),
      ilike(storeProducts.brand, pattern),
      ilike(storeCategories.name, pattern),
    ]
  })
  const products = searchTerms.length
    ? await db
        .select({
          name: storeProducts.name,
          slug: storeProducts.slug,
          brand: storeProducts.brand,
          category: storeCategories.name,
          price: storeProducts.price,
          currency: storeProducts.currency,
          inStock: storeProducts.stockQuantity,
          diameterMm: storeProducts.diameterMm,
          baseCurve: storeProducts.baseCurve,
          waterContent: storeProducts.waterContent,
          wearDuration: storeProducts.wearDuration,
          packContents: storeProducts.packContents,
          powerType: storeProducts.powerType,
          powerRange: storeProducts.powerRange,
          availablePowerRanges: storeProducts.availablePowerRanges,
        })
        .from(storeProducts)
        .leftJoin(storeCategories, eq(storeCategories.id, storeProducts.categoryId))
        .where(and(eq(storeProducts.status, 'active'), or(...searchConditions)))
        .orderBy(desc(storeProducts.isFeatured), desc(storeProducts.createdAt))
        .limit(8)
    : []

  return {
    faqs: storefrontFaqs.map(({ question, answer }) => ({ question, answer, source: '/faq' })),
    products: products.map(({ inStock, slug, ...product }) => ({
      ...product,
      availability: inStock > 0 ? 'in_stock' : 'out_of_stock',
      url: `/product/${encodeURIComponent(slug)}`,
    })),
    guidance: [
      'Use only facts included in this response; do not invent product attributes, prices, stock, delivery charges, or order status.',
      'For contact-lens fitting or eye-health advice, direct the shopper to an eye-care professional.',
      'This endpoint contains public storefront information only and cannot look up customer accounts or orders.',
    ],
  }
}

export async function answerChatbotMessage(message: string): Promise<ChatbotAnswer> {
  const normalized = message.toLowerCase()
  if (/\b(eye pain|red eye|redness|irritat|infection|allerg|symptom|prescription|fitting|fit me|medical advice|eye health)\b/.test(normalized)) {
    return {
      answer: 'I can help with store information, but I can’t advise on lens fitting, prescriptions, or eye symptoms. Please speak with an eye-care professional.',
      links: [{ label: 'Contact the store', href: '/contact-us' }],
    }
  }
  if (/\b(order status|track my|tracking|my order|where is my order)\b/.test(normalized)) {
    return {
      answer: 'I can’t access order or account details in this chat. Please contact the store directly for help with an order.',
      links: [{ label: 'Contact the store', href: '/contact-us' }],
    }
  }

  const queryTokens = tokens(message)
  const knowledge = await getChatbotKnowledge(message)
  const bestFaq = knowledge.faqs
    .map((faq) => ({ faq, score: matchScore(queryTokens, `${faq.question} ${faq.answer}`) }))
    .sort((left, right) => right.score - left.score)[0]
  const bestProducts = knowledge.products
    .map((product) => ({
      product,
      score: matchScore(queryTokens, `${product.name} ${product.brand ?? ''} ${product.category ?? ''}`),
    }))
    .filter((match) => match.score >= 0.4)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)

  if (bestProducts.length && bestProducts[0].score >= 0.4 && bestProducts[0].score > (bestFaq?.score ?? 0)) {
    return {
      answer: `These published listings best match your question: ${bestProducts.map(({ product }) => `${product.name} (${product.currency} ${product.price})`).join('; ')}. Check each listing for its details and availability.`,
      links: bestProducts.map(({ product }) => ({ label: product.name, href: product.url })),
    }
  }
  if (bestFaq && bestFaq.score >= 0.25) {
    return { answer: bestFaq.faq.answer, links: [{ label: 'Read the FAQ', href: bestFaq.faq.source }] }
  }
  if (bestProducts.length) {
    return {
      answer: `I found these listings that may help. Please open a listing to check its current details and availability.`,
      links: bestProducts.map(({ product }) => ({ label: product.name, href: product.url })),
    }
  }
  return {
    answer: 'I couldn’t find a confirmed answer in the store information. Try asking about a product, price, delivery, or payment, or contact the store.',
    links: [{ label: 'Browse products', href: '/shop' }, { label: 'Contact the store', href: '/contact-us' }],
  }
}
