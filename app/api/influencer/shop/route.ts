import { createServerSupabaseClient } from "@/lib/supabase/server"
import { ensureTypedClient } from "@/lib/supabase/types"
import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser, hasRole } from "@/lib/auth-helpers"
import { UserRole } from "@/lib/types"
import { z } from "zod"

const addProductSchema = z.object({
  productId: z.string().uuid(),
  customTitle: z.string().optional(),
  salePrice: z.number().min(0).optional()
})

export interface InfluencerShopData {
  shopProducts: Array<{
    id: string
    productId: string
    title: string
    customTitle?: string
    basePrice: number
    salePrice: number
    commission: number
    expectedCommission: number
    image: string
    category: string
    region: string[]
    supplier: string
    inStock: boolean
    stockCount: number
    published: boolean
    order: number
  }>
  availableProducts: Array<{
    id: string
    title: string
    basePrice: number
    commission: number
    image: string
    category: string
    region: string[]
    supplier: string
    inStock: boolean
    stockCount: number
  }>
}

export async function GET(request: NextRequest) {
  try {
    const supabase = ensureTypedClient(await createServerSupabaseClient())
    
    // Get current user and check permissions
    const user = await getCurrentUser(supabase)
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      )
    }

    if (!hasRole(user, [UserRole.INFLUENCER])) {
      return NextResponse.json(
        { ok: false, error: "Influencer access required" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const region = searchParams.get('region')
    const supplier = searchParams.get('supplier')
    const search = searchParams.get('search')

    // Fetch current influencer's shop and its products array (string[] of product IDs or objects)
    const { data: shop, error: shopFetchError } = await supabase
      .from('shops')
      .select('*')
      .eq('influencer_id', user.id)
      .maybeSingle()

    if (shopFetchError) {
      console.error('Shop fetch error:', shopFetchError)
      return NextResponse.json(
        { ok: false, error: "Failed to fetch shop" },
        { status: 500 }
      )
    }

    // Get available products for adding to shop
    let availableQuery = supabase
      .from('products')
      .select(`
        id,
        title,
        price,
        commission,
        images,
        category,
        region,
        stock_count,
        in_stock
      `)
      .eq('active', true)
      .or('in_stock.eq.true,stock_count.gt.0')

    // Apply filters
    if (category && category !== 'all') {
      availableQuery = availableQuery.eq('category', category)
    }
    if (region && region !== 'all') {
      availableQuery = availableQuery.contains('region', [region])
    }
    if (search) {
      availableQuery = availableQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: availableProducts, error: availableError } = await availableQuery
      .limit(50)

    if (availableError) {
      console.error('Available products fetch error:', availableError)
      return NextResponse.json(
        { ok: false, error: "Failed to fetch available products" },
        { status: 500 }
      )
    }

    // Resolve products in the shop: supports either string[] of ids or JSON array of objects
    type ProductOverride = { product_id: string; custom_title?: string; sale_price?: number; published?: boolean }
    let shopProductIds: string[] = []
    const overridesById: Record<string, { custom_title?: string; sale_price?: number; published?: boolean }> = {}

    if (shop?.products && Array.isArray(shop.products)) {
      const first = shop.products[0] as unknown
      if (typeof first === 'string') {
        shopProductIds = shop.products as string[]
      } else if (first && typeof first === 'object') {
        const arr = shop.products as ProductOverride[]
        shopProductIds = arr.map(p => p.product_id)
        for (const p of arr) {
          overridesById[p.product_id] = {
            custom_title: p.custom_title,
            sale_price: p.sale_price,
            published: p.published,
          }
        }
      }
    }

    let detailedShopProducts: any[] = []
    if (shopProductIds.length > 0) {
      const { data: productsInShop, error: productsInShopError } = await supabase
        .from('products')
        .select(`id, title, price, commission, images, category, region, stock_count, in_stock`)
        .in('id', shopProductIds)

      if (productsInShopError) {
        console.error('Products in shop fetch error:', productsInShopError)
      } else {
        detailedShopProducts = productsInShop || []
      }
    }

    const formattedShopProducts = detailedShopProducts.map((prod: any) => {
      const ov = overridesById[prod.id] || {}
      const salePrice = ov.sale_price ?? prod.price
      const published = ov.published ?? true
      return {
        id: prod.id,
        productId: prod.id,
        title: prod.title,
        customTitle: ov.custom_title,
        basePrice: prod.price,
        salePrice,
        commission: prod.commission,
        expectedCommission: (salePrice * prod.commission) / 100,
        image: prod.images?.[0] || '/placeholder-product.png',
        category: prod.category,
        region: prod.region,
        supplier: 'Unknown Supplier',
        inStock: prod.in_stock,
        stockCount: prod.stock_count,
        published,
        order: 0,
      }
    })

    // Format available products (exclude already added ones)
    const addedProductIds = new Set(formattedShopProducts.map(p => p.productId))
    const formattedAvailableProducts = availableProducts
      ?.filter((product: any) => !addedProductIds.has(product.id))
      .map((product: any) => ({
        id: product.id,
        title: product.title,
        basePrice: product.price,
        commission: product.commission,
        image: product.images?.[0] || '/placeholder-product.png',
        category: product.category,
        region: product.region,
        supplier: 'Unknown Supplier',
        inStock: product.in_stock,
        stockCount: product.stock_count
      })) || []

    return NextResponse.json({
      ok: true,
      data: {
        shopProducts: formattedShopProducts,
        availableProducts: formattedAvailableProducts
      }
    })
  } catch (error) {
    console.error('Influencer shop error:', error)
    return NextResponse.json(
      { ok: false, error: "Something went wrong" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = ensureTypedClient(await createServerSupabaseClient())
    
    const user = await getCurrentUser(supabase)
    if (!user || !hasRole(user, [UserRole.INFLUENCER])) {
      return NextResponse.json(
        { ok: false, error: "Influencer access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { productId, customTitle, salePrice } = addProductSchema.parse(body)

    // Validate product exists and is active
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, title, price, commission')
      .eq('id', productId)
      .eq('active', true)
      .maybeSingle()

    if (productError || !product) {
      return NextResponse.json(
        { ok: false, error: "Product not found or inactive" },
        { status: 404 }
      )
    }

    // Fetch current shop products
    const { data: shop } = await supabase
      .from('shops')
      .select('products')
      .eq('influencer_id', user.id)
      .maybeSingle()

    type ProductOverride = { product_id: string; custom_title?: string; sale_price?: number; published?: boolean }
    let newProducts: Array<string | ProductOverride> = []
    if (shop?.products && Array.isArray(shop.products)) {
      if (typeof shop.products[0] === 'string') {
        const ids = shop.products as string[]
        if (ids.includes(productId)) {
          return NextResponse.json(
            { ok: false, error: "Product already in your shop" },
            { status: 409 }
          )
        }
        newProducts = [...ids, productId]
      } else {
        // JSON objects array
        const arr = shop.products as ProductOverride[]
        if (arr.some(p => p.product_id === productId)) {
          return NextResponse.json(
            { ok: false, error: "Product already in your shop" },
            { status: 409 }
          )
        }
        newProducts = [
          ...arr,
          { product_id: productId, custom_title: customTitle, sale_price: salePrice ?? product.price, published: true }
        ]
      }
    } else {
      // No products yet
      newProducts = [{ product_id: productId, custom_title: customTitle, sale_price: salePrice ?? product.price, published: true }]
    }

    const { error: updateError } = await supabase
      .from('shops')
      .update({ products: newProducts, updated_at: new Date().toISOString() })
      .eq('influencer_id', user.id)

    if (updateError) {
      console.error('Shop products update error:', updateError)
      return NextResponse.json(
        { ok: false, error: "Failed to add product to shop" },
        { status: 500 }
      )
    }

    console.log(`🛍️ [AUDIT] Influencer ${user.id} added product ${productId} to shop`)

    return NextResponse.json({
      ok: true,
      data: { product_id: productId },
      message: "Product added to your shop successfully"
    })
  } catch (error) {
    console.error('Add to shop error:', error)
    return NextResponse.json(
      { ok: false, error: "Something went wrong" },
      { status: 500 }
    )
  }
}
