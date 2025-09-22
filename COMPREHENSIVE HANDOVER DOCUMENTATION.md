# 📋 COMPREHENSIVE HANDOVER DOCUMENTATION PROMPT

This is the single source of truth to understand, run, debug, and migrate the vo-onelink-google Next.js e-commerce platform to Replit. It consolidates system architecture, current functionality vs. gaps, database schema, commerce/checkout/commission flows, environment configuration, and prioritized issues with actionable next steps.

Contents
- [1. Executive Summary](#1-executive-summary)
- [2. System Architecture Overview](#2-system-architecture-overview)
- [3. Database Schema & Data Structure](#3-database-schema--data-structure)
- [4. Route Analysis & File Structure](#4-route-analysis--file-structure)
- [5. Commerce & Payment System](#5-commerce--payment-system)
- [6. User Management & Authentication](#6-user-management--authentication)
- [7. Current Issues & Debugging](#7-current-issues--debugging)
- [8. Environment & Configuration](#8-environment--configuration)
- [9. File System Analysis](#9-file-system-analysis)
- [10. Migration Considerations (Replit)](#10-migration-considerations-replit)

---

## 1. Executive Summary

- Platform purpose:
  - An influencer commerce marketplace where suppliers list products and influencers curate their own storefronts to drive sales. Commissions are tracked and paid out based on sales and influencer pricing.

- Current functional status:
  - Works:
    - Main shop catalog with modern UI and cart interactions ([/app/shop/enhanced-page-fixed.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/enhanced-page-fixed.tsx:0:0-0:0), cart in [lib/store/cart.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/store/cart.ts:0:0-0:0), UI in `components/shop/*`).
    - Public product listing API ([/app/api/products/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/products/route.ts:0:0-0:0)).
    - Influencer shop SSR + API data path (`/app/shop/[handle]/page.tsx`, `/app/api/shop/[handle]/route.ts`), product detail SSR (`/app/shop/[handle]/product/[id]/page.tsx`).
  - Broken/unstable:
    - Checkout to Stripe returns 500 if Stripe env vars are missing or database/RPCs are misaligned ([/app/api/checkout/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/checkout/route.ts:0:0-0:0), [lib/stripe.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/stripe.ts:0:0-0:0)).
    - Stripe webhook commission flow likely fails due to missing RPC function and schema mismatches ([/app/api/webhooks/stripe/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/webhooks/stripe/route.ts:0:0-0:0)).
    - Product card links may 404 due to route mismatch ([components/shop/product-card.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/product-card.tsx:0:0-0:0) links to `/products/[id]`, but actual product pages live under `/shop/[handle]/product/[id]`).

- Technology stack:
  - Next.js 15.2.4 (App Router), React 18, TypeScript 5
  - Supabase (auth, Postgres with RLS, storage), `@supabase/ssr`, `@supabase/supabase-js`
  - Stripe (Checkout + webhook)
  - UI: Radix UI + shadcn-based components, Tailwind CSS v4
  - State: Zustand for cart
  - E2E: Playwright
  - CI utilities: Postman/Newman, Artillery, Swagger CLI

- Deployment status & environment setup:
  - Environment variables defined in [env.example](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/env.example:0:0-0:0) with missing Stripe keys.
  - Next.js image config allows Supabase storage and common public CDNs ([next.config.mjs](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/next.config.mjs:0:0-0:0)).
  - Middleware-based RBAC for dashboards ([/middleware.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/middleware.ts:0:0-0:0)).

- Critical blockers:
  - Missing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` will break checkout/webhook at import-time or verification-time ([lib/stripe.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/stripe.ts:0:0-0:0), webhook route).
  - Webhook references non-existent RPC `update_product_stock` (schema exposes `decrement_stock`), leading to commission pipeline failure.
  - RLS/policies must allow anon read for public routes. Migrations exist to fix policies but must be applied to target DB.
  - Main product card linking to `/products/[id]` causes 404.

---

## 2. System Architecture Overview

- Frontend (Next.js App Router):
  - Main catalog: [app/shop/page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/page.tsx:0:0-0:0) → [enhanced-page-fixed.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/enhanced-page-fixed.tsx:0:0-0:0)
  - Influencer shops: `app/shop/[handle]/page.tsx` → [InfluencerShopClient.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/%5Bhandle%5D/InfluencerShopClient.tsx:0:0-0:0)
  - Influencer product detail: `app/shop/[handle]/product/[id]/page.tsx`
  - Checkout UI: [components/shop/checkout-page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/checkout-page.tsx:0:0-0:0)
  - Cart: Zustand store in [lib/store/cart.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/store/cart.ts:0:0-0:0), UI in [components/shop/cart-sidebar.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/cart-sidebar.tsx:0:0-0:0), product cards in [components/shop/product-card.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/product-card.tsx:0:0-0:0)

- Backend (API routes and server components):
  - Products API: [app/api/products/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/products/route.ts:0:0-0:0)
  - Products import/export/stats: `app/api/products/*`
  - Influencer shop API: `app/api/shop/[handle]/route.ts`
  - Checkout session creation: [app/api/checkout/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/checkout/route.ts:0:0-0:0)
  - Stripe webhook: [app/api/webhooks/stripe/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/webhooks/stripe/route.ts:0:0-0:0)

- Database (Supabase):
  - Typed client and schema in `lib/supabase/*`, types in [lib/supabase/database.types.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/database.types.ts:0:0-0:0)
  - Migrations under [supabase/migrations/](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations:0:0-0:0)
  - Key tables: `products`, `shops`, `influencer_shop_products`, `profiles`, `orders`, `commissions`, `verification_requests`, `verification_documents`
  - Functions listed include `decrement_stock` (typed); no `update_product_stock`.

- Authentication:
  - Supabase Auth via SSR clients ([lib/supabase/client.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/client.ts:0:0-0:0), [lib/supabase/server.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/server.ts:0:0-0:0))
  - Route middleware manages public vs protected pages and role-based rules ([/middleware.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/middleware.ts:0:0-0:0)).
  - `profiles` carries role column.

- Payment:
  - Stripe Checkout session creation with item metadata and optional influencer attribution ([app/api/checkout/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/checkout/route.ts:0:0-0:0))
  - Webhook processes orders, stock updates, and commissions ([app/api/webhooks/stripe/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/webhooks/stripe/route.ts:0:0-0:0))

- File Storage:
  - Next.js image loader configured for Supabase Storage and common CDNs ([next.config.mjs](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/next.config.mjs:0:0-0:0))
  - Product images stored as URLs; Supabase storage endpoints whitelisted

- State Management:
  - Cart with `zustand` and persistence to `localStorage` ([lib/store/cart.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/store/cart.ts:0:0-0:0))
  - Auth context `lib/auth-context.tsx` (for [components/shop/checkout-page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/checkout-page.tsx:0:0-0:0))

---

## 3. Database Schema & Data Structure

References: [lib/supabase/database.types.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/database.types.ts:0:0-0:0), [supabase/migrations/](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations:0:0-0:0)

Core tables (selected columns/types):
- products
  - id (uuid), title (text), description (text), images (text[]), price (numeric), original_price (numeric|null)
  - stock_count (int|null), in_stock (bool|null), active (bool|null)
  - supplier_id (uuid), commission (numeric), category (text|null), region (text[])
- shops
  - id (uuid), influencer_id (uuid), handle (text), name (text|null), products (text[]|null), active (bool|null)
- influencer_shop_products
  - id (uuid), influencer_id (uuid), product_id (uuid), custom_title (text|null), sale_price (numeric|null), published (bool|null)
- profiles
  - id (uuid), name (text|null), handle (text|null), role (text|null), avatar_url (text|null), verified (bool|null)
- orders
  - id (uuid), customer_id (uuid), items (json), total (numeric), status (text|null)
  - shipping_address (json), billing_address (json), stripe_payment_intent_id (text|null)
- commissions
  - id (uuid), order_id (uuid), influencer_id (uuid), supplier_id (uuid), product_id (uuid)
  - amount (numeric), rate (numeric), status (text|null)
- verification_requests & verification_documents
  - standard KYC/KYB artifact tables with `user_id` and `request_id` relationships

Relationships (from types):
- commissions.order_id → orders.id
- commissions.product_id → products.id
- verification_documents.request_id → verification_requests.id
- verification_requests.reviewed_by → users.id
- brand_details.user_id → users.id

RLS Policies:
- Migrations under [supabase/migrations/](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations:0:0-0:0) include:
  - [20250917_fix_rls_products_insert.sql](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations/20250917_fix_rls_products_insert.sql:0:0-0:0)
  - [20250921_fix_products_select_policy.sql](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations/20250921_fix_products_select_policy.sql:0:0-0:0)
  - Ensure anon/public read paths are permitted for `/api/products` and `/api/shop/[handle]`.

Indexes & constraints:
- See migrations for constraints; types file does not list indexes
- Ensure indexes on `products(id)`, `influencer_shop_products(product_id, influencer_id)`, `shops(handle)`

Current data status (to verify on target Supabase):
- How many products exist: Use `scripts/check-data.mjs` or `pnpm db:verify` if available; otherwise run SQL in Supabase SQL editor:
  - select count(*) from products;
  - select count(*) from shops;
  - select count(*) from influencer_shop_products;
- Which influencer shops are populated:
  - select s.handle, count(isp.id) from shops s left join influencer_shop_products isp on isp.influencer_id=s.influencer_id group by s.handle;
- Users/roles:
  - select role, count(*) from profiles group by role;

Seed/test data:
- Check [supabase/migrations/20250103_test_data.sql](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations/20250103_test_data.sql:0:0-0:0) for included samples

---

## 4. Route Analysis & File Structure

App routes (selected):
- `/shop`
  - [app/shop/page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/page.tsx:0:0-0:0) delegates to [enhanced-page-fixed.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/enhanced-page-fixed.tsx:0:0-0:0)
  - Client fetch via Supabase SSR client to list products; rich UI and cart integration
- `/shop/[handle]`
  - `app/shop/[handle]/page.tsx` SSR fetches `GET /api/shop/[handle]` using absolute base derived from headers/env
  - Client renderer: [InfluencerShopClient.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/%5Bhandle%5D/InfluencerShopClient.tsx:0:0-0:0)
- `/shop/[handle]/product/[id]`
  - [page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/page.tsx:0:0-0:0) SSR loads shop by handle, profile, and the influencer-product link with sale price/title
- Dashboards
  - `app/dashboard/*` for supplier/influencer/admin pages (RBAC via [middleware.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/middleware.ts:0:0-0:0))

API routes:
- `/api/products` [GET](cci:1://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/products/route.ts:9:0-86:1) list products with filters/pagination ([app/api/products/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/products/route.ts:0:0-0:0))
- `/api/products/import` CSV ingestion ([app/api/products/import/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/products/import/route.ts:0:0-0:0))
- `/api/products/export` CSV export ([app/api/products/export/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/products/export/route.ts:0:0-0:0))
- `/api/shop/[handle]` public influencer shop data (`app/api/shop/[handle]/route.ts`)
- `/api/checkout` Stripe Checkout session creation ([app/api/checkout/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/checkout/route.ts:0:0-0:0))
- `/api/webhooks/stripe` Stripe webhook processing ([app/api/webhooks/stripe/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/webhooks/stripe/route.ts:0:0-0:0))

Components:
- Shop UI, filters, cards: `components/shop/*`
- Checkout page UI: [components/shop/checkout-page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/checkout-page.tsx:0:0-0:0)
- Cart sidebar/UI: [components/shop/cart-sidebar.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/cart-sidebar.tsx:0:0-0:0)

Auth/Onboarding:
- Auth onboarding steps in `app/auth/onboarding/components/*` (InfluencerKYCStep, BrandKYBStep, etc.)
- Route guarding in [middleware.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/middleware.ts:0:0-0:0)

Known route/status notes:
- Product card link in [components/shop/product-card.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/product-card.tsx:0:0-0:0) points to `/products/[id]` but actual product pages are nested under `/shop/[handle]/product/[id]` for influencer context. This causes 404 from main catalog.

---

## 5. Commerce & Payment System

Shopping cart
- Store: [lib/store/cart.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/store/cart.ts:0:0-0:0)
  - Persistent (localStorage), defensive logging, computed totals, hydration-safe flags
  - Supports influencer attribution fields on [CartItem](cci:2://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/store/cart.ts:4:0-32:1) (e.g., `shopHandle`, `influencerId`, `effectivePrice`)
- UI:
  - [components/shop/cart-sidebar.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/cart-sidebar.tsx:0:0-0:0) for slide-in cart
  - In-page add-to-cart via product card and influencer shop page
- Current issues:
  - Items added from influencer shops do not populate `supplierId` and `influencerId` in [InfluencerShopClient.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/%5Bhandle%5D/InfluencerShopClient.tsx:0:0-0:0), relying on server-side inference later.
  - Some images may be external and require Next Image remotePatterns (already configured).

Checkout process
- Flow:
  - Client Checkout Page: [components/shop/checkout-page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/checkout-page.tsx:0:0-0:0)
    - Validates address/contact, builds `checkoutData` with cart items and addresses
    - Posts to `/api/checkout`, then redirects to Stripe Checkout using `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - Session creation: [app/api/checkout/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/checkout/route.ts:0:0-0:0)
    - Validates schema (`lib/validators`), fetches products to re-validate availability
    - Builds Stripe `line_items` and metadata:
      - `orderData` with items/addresses/total
      - `influencer_id` when inferred from `items` or `shopHandle` or Referer or product ownership
      - `custom_prices` map from influencer sale prices
    - Creates Stripe session and returns `sessionId` and `url`
- 500 errors and causes:
  - If `STRIPE_SECRET_KEY` not set, import of [lib/stripe.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/stripe.ts:0:0-0:0) throws immediately (server 500)
  - If RLS blocks `products` read or if schema differs (e.g., missing columns), product validation may fail and return 500/400
  - If environment lacks `NEXT_PUBLIC_APP_URL`, it falls back to `request.nextUrl.origin` (OK for local)

Stripe integration and webhooks
- Webhook route: [app/api/webhooks/stripe/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/webhooks/stripe/route.ts:0:0-0:0)
  - Verifies with `STRIPE_WEBHOOK_SECRET`
  - On `checkout.session.completed`:
    - Reads `orderData` from metadata and creates an `orders` row
    - Attempts to update stock via `rpc('update_product_stock')` — this function does not exist in the typed schema (only `decrement_stock` is present). This is a critical bug.
    - Logs commissions:
      - Supplier commission = product commission percent of item revenue
      - Influencer commission = (effective sale price - base price) * quantity if influencer involved
- Required environment variables:
  - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Commission system coverage:
  - Tables: `commissions`, `orders`
  - Commission entries created by webhook after stock update
  - Dependencies:
    - Accurate influencer attribution (via metadata)
    - Correct `commission` field present in `products` and passed in `orderItems`
  - Current implementation status:
    - Session creation supports influencer attribution
    - Webhook likely fails on stock update RPC and may prevent commission logging
    - Commission calculation assumes `item.commission` and baseline `item.price` exist in webhook metadata

Product management
- Supplier product creation via CSV import ([/app/api/products/import/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/products/import/route.ts:0:0-0:0))
  - Validates headers and fields; inserts `products` as supplier’s items
- Export ([/app/api/products/export/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/products/export/route.ts:0:0-0:0)) produces template-compatible CSV
- Inventory tracking via `stock_count`, `in_stock`; webhook intended to update stock atomically (RPC currently mismatched)
- Image handling:
  - Uses external URLs and Next Image `remotePatterns` ([next.config.mjs](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/next.config.mjs:0:0-0:0))
  - Supabase Storage host support is included

---

## 6. User Management & Authentication

User roles
- Roles stored in `profiles.role` (admin, supplier, influencer, customer)
- RBAC enforced in [middleware.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/middleware.ts:0:0-0:0):
  - Public routes: `/`, `/shop`, `/checkout`, `/api/products`, `/api/shop`, etc.
  - Protected dashboards and admin APIs check `profiles.role` and path rules

Onboarding flow
- Multi-step under `app/auth/onboarding/components/*`:
  - [BrandKYBStep.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/onboarding/components/BrandKYBStep.tsx:0:0-0:0), [InfluencerKYCStep.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/onboarding/components/InfluencerKYCStep.tsx:0:0-0:0), [ProfileBasicsStep.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/onboarding/components/ProfileBasicsStep.tsx:0:0-0:0), [CommissionStep.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/onboarding/components/CommissionStep.tsx:0:0-0:0), [ReviewStep.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/auth/onboarding/components/ReviewStep.tsx:0:0-0:0)
  - Document upload to `/api/onboarding/docs` (client code references exist; server routes not included in the file set above)
  - Verification tables: `verification_requests`, `verification_documents`, `influencer_payouts`, `brand_details`

Authentication
- Supabase SSR clients:
  - [lib/supabase/client.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/client.ts:0:0-0:0) (browser)
  - [lib/supabase/server.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/server.ts:0:0-0:0) (server, with cookie passthrough when request exists)
  - [lib/supabase/admin.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/admin.ts:0:0-0:0) (service role for server-side tasks like webhook)
- Route protection:
  - [middleware.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/middleware.ts:0:0-0:0) checks `session` and `profiles.role`, redirects unauthenticated users to `/sign-in` with `redirectTo`
  - API rules:
    - `admin` routes require admin
    - Write operations for `/api/products` require supplier or admin
    - Write operations for `/api/shops` require influencer or admin

---

## 7. Current Issues & Debugging

Critical issues

1) Checkout 500 errors
- Symptoms:
  - `/api/checkout` returns 500 during session creation
- Likely causes:
  - Missing `STRIPE_SECRET_KEY` causes [lib/stripe.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/stripe.ts:0:0-0:0) to throw at import:
    - [lib/stripe.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/stripe.ts:0:0-0:0) line 3–7 throws if not set
  - RLS blocking product reads during session validation:
    - Check migrations like [20250921_fix_products_select_policy.sql](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations/20250921_fix_products_select_policy.sql:0:0-0:0) are applied
- Logs/stack traces:
  - Server logs would show “STRIPE_SECRET_KEY is not set in environment variables” or Supabase query errors from [app/api/checkout/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/checkout/route.ts:0:0-0:0)
- Steps to reproduce:
  - Add items to cart in UI → proceed to checkout from [components/shop/checkout-page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/checkout-page.tsx:0:0-0:0)
  - Check Network tab and Server logs
- Fix plan:
  - Set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Confirm `NEXT_PUBLIC_APP_URL` for redirect URLs
  - Ensure RLS allows anon read for products (apply migrations)

2) Influencer shop 404s
- Symptoms:
  - Visiting `/shop/[handle]` or product subpages leads to `notFound()`
- Causes:
  - `/api/shop/[handle]` returns 404 when no `shops` row exists for handle or influencer has no published items (`app/api/shop/[handle]/route.ts`)
  - Data not seeded or published flags are false
- Steps to reproduce:
  - Navigate to `/shop/some-handle` without corresponding DB data
- Fix plan:
  - Seed shops and influencer links
  - Ensure `published=true` in `influencer_shop_products` for visible listings

3) Image display issues
- Observations:
  - Next Image requires remotePatterns; configured in [next.config.mjs](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/next.config.mjs:0:0-0:0)
  - Fallbacks are implemented in components (`/placeholder.svg` etc.)
- Potential issues:
  - Broken external URLs from CSV import
  - Missing primary images in products arrays
- Fix plan:
  - Validate `images` arrays on import
  - Add sanity checks before rendering
  - Confirm `SUPABASE_HOST` derived correctly for storage access

4) Dialog accessibility errors
- Likely cause:
  - Radix UI Dialog components may be missing `Title`/`Description` in certain modals
- Impact:
  - Accessibility warnings in console and automated tests
- Fix plan:
  - Audit all Dialog usages in `components/*` and add `DialogTitle`/`DialogDescription`

Additional issues

- Webhook stock update RPC mismatch:
  - [app/api/webhooks/stripe/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/webhooks/stripe/route.ts:0:0-0:0) calls `rpc('update_product_stock')` but types only expose `decrement_stock`
  - Fix by creating the required RPC or changing to existing function signature
- Product card routing mismatch:
  - [components/shop/product-card.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/product-card.tsx:0:0-0:0) links to `/products/[id]` instead of influencer-aware path; user lands on 404
  - Fix: route to `/shop/[handle]/product/[id]` when context exists, or add a general product detail page

---

## 8. Environment & Configuration

Environment variables (required)
- Supabase
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- Stripe
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (used in [components/shop/checkout-page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/checkout-page.tsx:0:0-0:0))
  - `STRIPE_SECRET_KEY` (used in [lib/stripe.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/stripe.ts:0:0-0:0) and required by API routes)
  - `STRIPE_WEBHOOK_SECRET` (required in [app/api/webhooks/stripe/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/webhooks/stripe/route.ts:0:0-0:0))
- App URLs
  - `NEXT_PUBLIC_APP_URL` (used for success/cancel URLs in checkout)
- Optional/legacy placeholders in [env.example](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/env.example:0:0-0:0):
  - `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (not used by NextAuth here; leftover template)

Next.js configuration
- [next.config.mjs](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/next.config.mjs:0:0-0:0)
  - Image `remotePatterns` includes Unsplash, Picsum, Supabase storage host (derived from `NEXT_PUBLIC_SUPABASE_URL`), and local dev ports
  - Dev fetch logging enabled
  - Aggressive caching for `/_next/image`

Middleware auth routing
- [middleware.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/middleware.ts:0:0-0:0) controls public vs protected routes, dashboards, and admin API writes

Database connection strings
- For direct DB inspection/migrations CI, configure `SUPABASE_DB_URL` (not used directly in app code but may be needed in CI or scripts)

---

## 9. File System Analysis

Configuration files
- [package.json](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/package.json:0:0-0:0)
  - Scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `test:api:*`, `db:verify`, `seed:influencer-shops`
  - Dependencies: Next 15.2.4, Tailwind 4, Supabase, Stripe, Playwright, Radix
- [next.config.mjs](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/next.config.mjs:0:0-0:0)
  - Image sources and dev logging; see “images.remotePatterns”
- [middleware.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/middleware.ts:0:0-0:0)
  - Uses `updateSession` and [createServerSupabaseClient](cci:1://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/server.ts:11:0-50:1)
  - Public routes allow `/api/checkout` and `/api/webhooks/stripe` to be unauthenticated as required
- [env.example](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/env.example:0:0-0:0)
  - Supabase and app URL populated
  - Stripe vars must be added here for clarity

Critical components
- Cart store: [lib/store/cart.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/store/cart.ts:0:0-0:0)
  - Clean API, persistence, hydration control
- Checkout components: [components/shop/checkout-page.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/checkout-page.tsx:0:0-0:0)
  - Validations, Stripe redirect, robust UX state
- Product display:
  - Main grid: [app/shop/enhanced-page-fixed.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/enhanced-page-fixed.tsx:0:0-0:0)
  - Cards: [components/shop/product-card.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/product-card.tsx:0:0-0:0)
- Shop management:
  - Dashboard routes under `app/dashboard/*`, product import/export components present

API routes
- Working endpoints:
  - `/api/products` listing with filters and pagination
  - `/api/products/import|export` functioning with validation
  - `/api/shop/[handle]` formats influencer + curated product data
- Suspect/broken endpoints:
  - `/api/checkout` breaks if Stripe env missing or RLS restricts read
  - `/api/webhooks/stripe` breaks on nonexistent RPC

Utilities
- Supabase clients in `lib/supabase/*`
- Stripe helpers in [lib/stripe.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/stripe.ts:0:0-0:0)
- Validation schemas in `lib/validation/*` or `lib/validators.ts`
- API request helpers in [lib/utils/api-helpers.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/utils/api-helpers.ts:0:0-0:0)

---

## 10. Migration Considerations (Replit)

Immediate requirements
- Provision environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_APP_URL` (e.g., Replit URL)
- Re-create database schema:
  - Apply all SQL migrations in [supabase/migrations/](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations:0:0-0:0) sequentially
  - Confirm RLS policies are aligned for public routes
- Seed data:
  - Use [20250103_test_data.sql](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations/20250103_test_data.sql:0:0-0:0) if safe, or run `pnpm seed:influencer-shops:allow` in dev to create example shops
- Stripe webhook:
  - Configure a public webhook endpoint URL pointing to `/api/webhooks/stripe`
  - Add the webhook signing secret to environment

Known compatibility issues
- RPC mismatch in webhook (must fix `update_product_stock` vs. `decrement_stock`)
- File system dependencies are minimal; image URLs use external sources and Supabase storage
- Replit build:
  - Needs Node 18+ (prefer 20), pnpm 9.x (as per `packageManager`), and Next.js 15 dynamic routing support
- External services:
  - Supabase must be reachable from Replit; configure CORS for storage if needed

Success metrics and validation
- Architecture verification:
  - Visit `/shop` and confirm product list renders from DB, with images
- Influencer flow:
  - Visit `/shop/[handle]` for a seeded handle, verify product grid shows curated/published items
  - Visit `/shop/[handle]/product/[id]` and verify influencer sale price appears when set
- Cart and checkout:
  - Add items to cart, proceed to `/checkout`, create Stripe session and redirect successfully
  - Complete payment on test mode and verify:
    - Webhook hit succeeds (200)
    - `orders` row inserted
    - Stock decremented
    - `commissions` rows created (supplier and influencer where applicable)
- Admin/Supplier:
  - Import products via `/api/products/import` (or via dashboard UI if wired), export CSV and validate round-trip

---

# Actionable Next Steps

- Fix Stripe environment variables:
  - Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` to Replit/Env
- Align stock update RPC:
  - Replace `rpc('update_product_stock')` in [app/api/webhooks/stripe/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/webhooks/stripe/route.ts:0:0-0:0) with the actual function present in DB, or create the RPC
  - The typed schema shows `decrement_stock(product_id, quantity) returns number`. Either:
    - Create an RPC `update_product_stock(product_id_param uuid, quantity_to_subtract int)` returning structured status, or
    - Call `decrement_stock` and then fetch updated product state to log
- Ensure RLS public read for products:
  - Apply [20250921_fix_products_select_policy.sql](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/supabase/migrations/20250921_fix_products_select_policy.sql:0:0-0:0) and earlier RLS migration files
- Fix product card routing:
  - In [components/shop/product-card.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/components/shop/product-card.tsx:0:0-0:0), change product details URL to match existing route structure or add a general product page:
    - If global detail page desired: create `app/products/[id]/page.tsx`
    - Otherwise derive `handle` context and link to `/shop/[handle]/product/[id]`
- Seed shops for test:
  - Insert a `shops` row and `influencer_shop_products(published=true)` entries for a test handle
- Validate webhook end-to-end:
  - Use Stripe CLI to forward `checkout.session.completed` events and confirm all side effects

---

# Appendix

Mermaid diagram: High-level flow from browse to commission logging

```mermaid
flowchart TD
  A[User browses /shop] --> B[Adds to cart]
  B --> C[/checkout page/]
  C -->|POST /api/checkout| D[Create Stripe session]
  D -->|Redirect| E[Stripe Checkout]
  E -->|Payment succeeds| F[Stripe Webhook → /api/webhooks/stripe]
  F --> G[Create order in Supabase]
  G --> H[Update stock (RPC)]
  H --> I[Create commissions rows]
  I --> J[Supplier/Influencer dashboards]
```

Key file references
- Checkout creation: [app/api/checkout/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/checkout/route.ts:0:0-0:0)
- Webhook processing: [app/api/webhooks/stripe/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/webhooks/stripe/route.ts:0:0-0:0)
- Stripe client: [lib/stripe.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/stripe.ts:0:0-0:0)
- Supabase server/client: [lib/supabase/server.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/server.ts:0:0-0:0), [lib/supabase/client.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/client.ts:0:0-0:0), [lib/supabase/admin.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/lib/supabase/admin.ts:0:0-0:0)
- Influencer shops:
  - API: `app/api/shop/[handle]/route.ts`
  - SSR page: `app/shop/[handle]/page.tsx`
  - Product detail SSR: `app/shop/[handle]/product/[id]/page.tsx`
- Catalog:
  - UI: [app/shop/enhanced-page-fixed.tsx](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/shop/enhanced-page-fixed.tsx:0:0-0:0), `components/shop/*`
  - API: [app/api/products/route.ts](cci:7://file:///c:/Users/Lenovo/Desktop/Workspce/vo-onelink-google/app/api/products/route.ts:0:0-0:0)

Scripts and commands
- Dev server: `pnpm dev`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- API tests (if used in CI): `pnpm test:api:smoke` | `pnpm test:api:contract`
- Database verify: `pnpm db:verify` (see `scripts/verify-db.mjs`)
- Seed influencer shops: `pnpm seed:influencer-shops:allow` (dev only)

This document equips you to migrate to Replit, configure environments, validate all flows, and systematically fix the critical blockers preventing complete commerce functionality.