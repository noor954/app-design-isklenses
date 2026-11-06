'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { StorefrontProductImage, getProductImageSources } from '@/components/storefront/product-image'
import { getProductAlternateImageSource } from '@/lib/storefront/product-image-sources'
import type { Product } from '@/lib/hooks/use-storefront-data'

export function ProductHoverImage({
  product,
  className,
  imageClassName,
  children,
}: {
  product: Product
  className: string
  imageClassName: string
  children?: ReactNode
}) {
  const [requested, setRequested] = useState(false)
  const alternate = getProductAlternateImageSource(product)

  return (
    <Link
      href={`/product/${product.slug}`}
      aria-label={`View ${product.name}`}
      className={`group/photo relative block overflow-hidden ${className}`}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') setRequested(true)
      }}
      onFocus={() => setRequested(true)}
    >
      <StorefrontProductImage
        sources={getProductImageSources(product)}
        alt={product.name}
        fdaApproved={product.fdaApproved}
        className={imageClassName}
        imageClassName="size-full object-contain"
        fallback={<div role="img" aria-label={`No product image is available for ${product.name}`} className="product-placeholder size-full" />}
      />
      {alternate && requested && <AlternateImage key={alternate} src={alternate} />}
      {children}
    </Link>
  )
}

function AlternateImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={`pointer-events-none absolute inset-0 size-full bg-[#e8f6fb] object-contain opacity-0 transition-opacity duration-200 motion-reduce:transition-none ${loaded ? 'group-hover/photo:opacity-100 group-focus-visible/photo:opacity-100' : ''}`}
    />
  )
}
