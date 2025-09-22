import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { stripe, formatAmountForStripe } from "@/lib/stripe"
import { checkoutSchema } from "@/lib/validators"
import { getCurrentUser, hasRole } from "@/lib/auth-helpers"
import { UserRole, type ApiResponse } from "@/lib/types"

// Declare runtime for Node.js-specific imports (Stripe)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser(supabase)

    const body = await request.json()
    const validation = checkoutSchema.safeParse(body)
    
    if (!validation.success) {
      const errors: Record<string, string> = {}
      validation.error.errors.forEach((error) => {
        errors[error.path.join('.')] = error.message
      })
      
      return NextResponse.json(
        { ok: false, message: "Invalid checkout data", errors },
        { status: 400 }
      )
    }

    const { items, shippingAddress, billingAddress } = validation.data
    console.log('[checkout] received items:', JSON.stringify(items))

    // Fetch product details and calculate total
    const productIds = items.map(item => item.productId)
    const query = supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('active', true)
      .eq('in_stock', true)
    
    const { data: products, error: productsError } = await query
    if (productsError) {
      console.error('[checkout] productsError:', productsError)
    }
    if (!products || products.length === 0) {
      console.warn('[checkout] No products found by IDs. Proceeding with client-provided items for dev/testing.')
    }

    // Calculate total and prepare line items
    let total = 0
    const lineItems: any[] = []
    const orderItems: any[] = []

    for (const item of items) {
      let product = products?.find((p: any) => p.id === item.productId) as any
      // In development, allow fallback to client-provided payload when product lookup fails
      if (!product) {
        const anyItem: any = item as any
        product = {
          id: anyItem.productId,
          title: anyItem.title || anyItem.name || 'Product',
          description: anyItem.description || '',
          price: typeof anyItem.price === 'number' ? anyItem.price : (typeof anyItem.effectivePrice === 'number' ? anyItem.effectivePrice : 0),
          images: anyItem.image ? [anyItem.image] : [],
          supplier_id: anyItem.supplierId,
          commission: anyItem.commission,
          stock_count: Number.isFinite(anyItem.stock_count) ? anyItem.stock_count : 999,
        } as any
        if (process.env.NODE_ENV === 'production') {
          console.error('[checkout] Missing product in DB in production:', item.productId)
          return NextResponse.json(
            { ok: false, message: `Product ${item.productId} not available` },
            { status: 400 }
          )
        }
      }

      if (typeof product.stock_count === 'number' && product.stock_count < item.quantity) {
        return NextResponse.json(
          { ok: false, message: `Insufficient stock for ${product.title}` },
          { status: 400 }
        )
      }

      const itemTotal = product.price * item.quantity
      total += itemTotal

      const imageArray = Array.isArray(product.images)
        ? product.images
        : (typeof product.images === 'string' ? [product.images] : [])
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.title || 'Product',
            description: product.description || '',
            images: imageArray.filter(Boolean).slice(0, 1),
          },
          unit_amount: formatAmountForStripe(Number(product.price) || 0),
        },
        quantity: item.quantity,
      })

      orderItems.push({
        productId: product.id,
        title: product.title,
        price: product.price,
        quantity: item.quantity,
        image: product.images[0] || '',
        supplierId: product.supplier_id,
        commission: product.commission,
      })
    }

    // Build influencer referral context (optional)
    let influencerIdForMetadata: string | undefined = undefined
    const explicitInfluencerIds = Array.from(new Set(items.map((i: any) => i.influencerId).filter(Boolean))) as string[]
    if (explicitInfluencerIds.length === 1) {
      influencerIdForMetadata = explicitInfluencerIds[0]
    } else if (!explicitInfluencerIds.length) {
      // Try to resolve by shopHandle if provided and consistent
      const shopHandles = Array.from(new Set(items.map((i: any) => i.shopHandle).filter(Boolean))) as string[]
      if (shopHandles.length === 1) {
        const { data: shop } = await supabase
          .from('shops')
          .select('influencer_id')
          .eq('handle', shopHandles[0])
          .maybeSingle() as { data: { influencer_id: string } | null }
        if (shop && (shop as any).influencer_id) {
          influencerIdForMetadata = (shop as any).influencer_id as string
        }
      }
      // Fallback: derive handle from Referer header if navigating from influencer shop
      if (!influencerIdForMetadata) {
        const referer = request.headers.get('referer') || ''
        const match = referer.match(/\/shop\/([^\/]+)/)
        const inferredHandle = match?.[1]
        if (inferredHandle) {
          const { data: shop2 } = await supabase
            .from('shops')
            .select('influencer_id')
            .eq('handle', inferredHandle)
            .maybeSingle() as { data: { influencer_id: string } | null }
          if (shop2 && (shop2 as any).influencer_id) {
            influencerIdForMetadata = (shop2 as any).influencer_id as string
          }
        }
      }
      // Fallback 2: infer influencer by product links if all items belong to same influencer
      if (!influencerIdForMetadata && productIds.length > 0) {
        const { data: links } = await supabase
          .from('influencer_shop_products')
          .select('influencer_id, product_id')
          .in('product_id', productIds)
        if (Array.isArray(links) && links.length > 0) {
          const set = new Set(links.map((l: any) => l.influencer_id).filter(Boolean))
          if (set.size === 1) {
            influencerIdForMetadata = Array.from(set)[0] as string
          }
        }
      }
    }

    // Build custom prices map for influencer sale price auditing
    const customPrices: Record<string, number> = {}
    for (const clientItem of items as any[]) {
      const effective = typeof clientItem.effectivePrice === 'number' ? clientItem.effectivePrice : undefined
      if (effective && effective >= 0) {
        customPrices[clientItem.productId] = Number(effective)
      }
    }

    // Server-side fallback: if influencer known but no client-provided effective prices, fetch from influencer_shop_products
    if (influencerIdForMetadata) {
      const missingIds = productIds.filter(pid => !(pid in customPrices))
      if (missingIds.length) {
        const { data: isp } = await supabase
          .from('influencer_shop_products')
          .select('product_id, sale_price')
          .eq('influencer_id', influencerIdForMetadata)
          .in('product_id', missingIds)
        if (Array.isArray(isp)) {
          for (const row of isp as any[]) {
            if (typeof row.sale_price === 'number' && row.sale_price >= 0) {
              customPrices[row.product_id] = Number(row.sale_price)
            }
          }
        }
      }
    }

    // Create Stripe Checkout Session
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    const sessionPayload: any = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      // Only include customer_email if available
      ...(user?.email ? { customer_email: user.email } : {}),
      metadata: {
        ...(user?.id ? { userId: user.id } : {}),
        orderData: JSON.stringify({
          items: orderItems,
          total,
          shippingAddress,
          billingAddress,
        }),
        // Optional influencer and pricing audit context (consumed by webhook)
        ...(influencerIdForMetadata ? { influencer_id: influencerIdForMetadata } : {}),
        ...(Object.keys(customPrices).length ? { custom_prices: JSON.stringify(customPrices) } : {}),
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'JP', 'KR'],
      },
    }
    console.log('[checkout] creating Stripe session with', {
      items: lineItems.length,
      hasInfluencer: Boolean(influencerIdForMetadata),
      origin,
    })
    const session = await stripe.checkout.sessions.create(sessionPayload)
    console.log('[checkout] session created:', session.id)

    return NextResponse.json({
      ok: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
      message: "Checkout session created successfully",
    } as ApiResponse)
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { ok: false, message: "Something went wrong during checkout" },
      { status: 500 }
    )
  }
}
