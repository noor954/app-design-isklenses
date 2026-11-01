import { NextRequest, NextResponse } from 'next/server'
import { createProduct, type AdminProductInput } from '@/app/actions/catalog-admin'
import { getAllProductAssets, getAllProductVariants } from '@/app/actions/admin'
import { getAdminProducts as getAllProducts } from '@/app/actions/catalog-admin'
import { adminApiError } from '@/lib/auth/admin-api'
import { adminApiFailure, adminApiResponse, assertOptionalBooleans, readAdminJson } from '@/lib/http/admin-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [products, assets, variants] = await Promise.all([
      getAllProducts(),
      getAllProductAssets(),
      getAllProductVariants(),
    ])
    const byProduct = new Map<string, typeof assets>()
    for (const asset of assets) {
      const productAssets = byProduct.get(asset.productId) ?? []
      productAssets.push(asset)
      byProduct.set(asset.productId, productAssets)
    }

    const variantsByProduct = new Map<string, typeof variants>()
    for (const variant of variants) {
      const productVariants = variantsByProduct.get(variant.productId) ?? []
      productVariants.push(variant)
      variantsByProduct.set(variant.productId, productVariants)
    }
    return NextResponse.json(
      {
        data: products.map((product) => ({
          ...product,
          assets: byProduct.get(product.id) ?? [],
          variants: variantsByProduct.get(product.id) ?? [],
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return adminApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readAdminJson(request)
    assertOptionalBooleans(body, ['uvProtection', 'fdaApproved', 'isFeatured'])
    return adminApiResponse(() => createProduct(body as AdminProductInput), 201)
  } catch (error) {
    return adminApiFailure(error)
  }
}
