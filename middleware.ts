import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function middleware(req: NextRequest) {
  // First, refresh the session
  const res = await updateSession(req)

  // Now, create a client to check auth state for the rest of the logic
  const supabase = createServerSupabaseClient(req)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/shop',
    '/cart',
    '/checkout',
    '/demo', // Add demo routes as public
    '/terms',
    '/privacy',
    '/sign-in',
    '/sign-up',
    '/reset',
    '/update-password',
    '/auth/auth-code-error',
    '/influencers', // Add influencers page as public
    '/brands', // Add brands page as public
    '/admin/login', // Admin login page is public
  ]

  // API routes that don't require authentication
  const publicApiRoutes = [
    '/api/auth/sign-in',
    '/api/auth/sign-up',
    '/api/auth/reset',
    '/api/auth/callback',
    '/api/products', // Public product listing
    '/api/shop', // Public influencer shop data for SSR
    '/api/debug', // Local diagnostic endpoints
    '/api/checkout', // Allow checkout endpoint to return JSON (route enforces auth/roles itself)
    '/api/webhooks/stripe', // Stripe webhooks must be publicly accessible (secured by signature)
  ]

  const { pathname } = req.nextUrl

  // Allow public routes by checking if the path starts with any of them
  if (
    publicRoutes.some((path) => pathname === path || (path !== '/' && pathname.startsWith(path))) ||
    publicApiRoutes.some((path) => pathname === path || (path !== '/' && pathname.startsWith(path)))
  ) {
    return res
  }

  // Redirect to sign-in if no session
  if (!session) {
    const redirectUrl = new URL('/sign-in', req.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Get user role from the 'users' table with proper type inference
  const query = supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()
  
  const { data: user, error } = await query

  if (error || !user) {
    // This case might happen if a user is deleted but their session persists.
    // Clear session by redirecting to sign-in.
    const redirectUrl = new URL('/sign-in', req.url)
    redirectUrl.searchParams.set('error', 'User not found')
    return NextResponse.redirect(redirectUrl)
  }

  // Role-based access control
  const userRole = (user as any).role

  // Admin route protection
  if (pathname.startsWith('/admin/') && pathname !== '/admin/login') {
    if (userRole !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login?error=Unauthorized access', req.url))
    }
  }

  // Dashboard route protection
  if (pathname.startsWith('/dashboard/')) {
    const dashboardRole = pathname.split('/')[2] // e.g., 'supplier', 'influencer', 'admin'

    // Admins can access any dashboard. Other users can only access their own.
    if (userRole !== 'admin' && userRole !== dashboardRole) {
      // Redirect non-admin users to their correct dashboard or home if they are a customer.
      const redirectPath = userRole === 'customer' ? '/' : `/dashboard/${userRole}`
      return NextResponse.redirect(new URL(redirectPath, req.url))
    }
  }

  // API route protection
  if (pathname.startsWith('/api/')) {
    // Admin-only API routes
    if (pathname.startsWith('/api/admin/') && userRole !== 'admin') {
      return new NextResponse(JSON.stringify({ message: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    // Supplier-only API routes (for write operations)
    if (pathname.startsWith('/api/products/') && req.method !== 'GET' && !['supplier', 'admin'].includes(userRole)) {
      return new NextResponse(JSON.stringify({ message: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    // Influencer-only API routes (for write operations)
    if (pathname.startsWith('/api/shops/') && req.method !== 'GET' && !['influencer', 'admin'].includes(userRole)) {
      return new NextResponse(JSON.stringify({ message: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (e.g., .svg, .png, .jpg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
