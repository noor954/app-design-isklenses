type ProductImageData = {
  heroImageUrl: string | null
  assets?: {
    mediaType: 'image' | 'video'
    blobUrl: string | null
  }[]
}

import { isManagedMediaUrl } from '@/lib/media-url.mjs'

export function getProductImageSources(product: ProductImageData) {
  return [...new Set([
    isManagedMediaUrl(product.heroImageUrl) ? product.heroImageUrl : null,
    ...(product.assets ?? [])
      .filter((asset) => asset.mediaType === 'image')
      .map((asset) => isManagedMediaUrl(asset.blobUrl) ? asset.blobUrl : null),
  ].filter((source): source is string => Boolean(source)))]
}

export function getProductAlternateImageSource(product: ProductImageData) {
  const [primary, ...alternates] = getProductImageSources(product)
  return primary ? alternates[0] ?? null : null
}
