import type { Product } from '@/lib/hooks/use-storefront-data'
import type { ProductCategory } from '@/lib/hooks/use-storefront-categories'

export const STORE_NAME = 'ISK Lenses'

export function formatPrice(value: string | number, currency: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${currency} ${value}`
  try {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(0)}`
  }
}

export function lowestPrice(product: Product) {
  const variants = product.variants ?? []
  if (!variants.length) return { price: product.price, currency: product.currency, hasOptions: false }
  const lowest = variants.reduce((best, variant) => (Number(variant.price) < Number(best.price) ? variant : best))
  return { price: lowest.price, currency: lowest.currency, hasOptions: true }
}

export function isAvailable(product: Product) {
  return product.variants?.length
    ? product.variants.some((variant) => variant.stockQuantity > 0)
    : product.stockQuantity > 0
}

export function categoryHref(category: Pick<ProductCategory, 'path'>) {
  return `/product-category/${category.path}`
}

/** Children keyed by parent id ('root' for top level); menu-hidden categories are skipped. */
export function categoryTree(categories: ProductCategory[]) {
  const children = new Map<string, ProductCategory[]>()
  for (const category of categories) {
    if (!category.isActive || !category.showInMenu) continue
    const key = category.parentId ?? 'root'
    children.set(key, [...(children.get(key) ?? []), { ...category, name: titleCase(category.name) }])
  }
  return children
}

export function titleCase(value: string) {
  return value.trim().toLocaleLowerCase().replace(
    /(^|[^\p{L}\p{M}'’])(\p{L})/gu,
    (_match, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase()}`,
  )
}
