import { z } from 'zod'
import { UserRole } from './types'

// Auth validation schemas
export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signUpSchema = z
  .object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    role: z.nativeEnum(UserRole),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// Product validation schemas
export const createProductSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().min(1, 'Description is required'),
  price: z.number().min(0, 'Price must be positive'),
  originalPrice: z.number().min(0).optional(),
  images: z.array(z.string().url()).min(1, 'At least one image is required'),
  category: z.string().min(1, 'Category is required'),
  region: z.array(z.enum(['KR', 'JP', 'CN', 'GLOBAL'])).min(1, 'At least one region is required'),
  stockCount: z.number().int().min(0, 'Stock count must be non-negative'),
  commission: z.number().min(0).max(95, 'Commission must be between 0-95%'),
  sku: z.string().min(1).trim().optional(),
})

export const updateProductSchema = createProductSchema.partial()

export const productQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  supplierId: z.string().optional(),
})

// CSV Import validation
export const csvImportSchema = z.object({
  csvData: z.string().min(1, 'CSV data is required'),
  dryRun: z.boolean().default(false),
})

export const productCSVSchema = z.object({
  sku: z.string().min(1).trim(),
  title: z.string().min(1).trim(),
  description: z.string().min(1),
  image_urls: z.string().optional(),
  base_price: z.number().min(0),
  commission_pct: z.number().min(0).max(95),
  regions: z.string().min(1),
  inventory: z.number().int().min(0),
  active: z.boolean(),
})

export const importRequestSchema = z.object({
  dryRun: z.boolean().default(true),
})

// Cart and Checkout validation
export const addToCartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  influencerHandle: z.string().min(1),
})

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(99),
})

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        // Accept any non-empty string; some demo data uses non-UUID IDs
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        // Optional influencer/referral context (additive)
        influencerId: z.string().min(1).optional(),
        shopHandle: z.string().min(1).optional(),
        effectivePrice: z.number().min(0).optional(),
        price: z.number().min(0).optional(),
      })
    )
    .min(1),
  // Support both 'street' and 'address' shapes from different clients
  shippingAddress: z
    .object({
      street: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      zipCode: z.string().min(1),
      country: z.string().min(1),
    })
    .refine((d) => Boolean(d.street || d.address), {
      message: "Provide street or address",
      path: ["street"],
    }),
  billingAddress: z
    .object({
      street: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      zipCode: z.string().min(1),
      country: z.string().min(1),
    })
    .refine((d) => Boolean(d.street || d.address), {
      message: "Provide street or address",
      path: ["street"],
    }),
})

// Shop validation
export const createShopSchema = z.object({
  handle: z.string()
    .min(3, 'Handle must be at least 3 characters')
    .max(30, 'Handle must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Handle can only contain letters, numbers, hyphens, and underscores'),
  name: z.string().min(1, 'Shop name is required'),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  banner: z.string().url().optional(),
})

export const updateShopSchema = createShopSchema.partial()

export const addProductToShopSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1),
})

// Admin validation
export const verifyUserSchema = z.object({
  userId: z.string().uuid(),
  verified: z.boolean(),
  notes: z.string().optional(),
})

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  notes: z.string().optional(),
})

// Pagination helpers
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
})

// Common ID validation
export const uuidSchema = z.string().uuid('Invalid ID format')

// File upload validation
export const uploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB'),
})

// ============================================================================
// ONBOARDING VALIDATION SCHEMAS
// ============================================================================

// Profile validation
export const profileUpdateSchema = z.object({
  role: z.enum(['influencer', 'brand', 'customer', 'admin']).optional(),
  handle: z.string().regex(/^[a-zA-Z0-9_-]{3,30}$/, 'Handle must be 3-30 characters, alphanumeric, underscore, or dash only').optional(),
  country: z.string().length(2, 'Country must be 2-letter ISO code').optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  language: z.string().length(2, 'Language must be 2-letter ISO code').optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional(),
  banner_url: z.string().url('Invalid banner URL').optional(),
})

// Verification request validation
export const verificationRequestSchema = z.object({
  role: z.enum(['influencer', 'brand', 'customer', 'admin']),
})

export const verificationRequestUpdateSchema = z.object({
  status: z.enum(['draft', 'submitted', 'in_review', 'verified', 'rejected']).optional(),
  rejection_reason: z.string().optional(),
})

// Verification document validation
export const verificationDocumentSchema = z.object({
  request_id: uuidSchema,
  doc_type: z.enum(['identity_card', 'passport', 'drivers_license', 'business_registration', 'tax_certificate', 'bank_statement', 'utility_bill', 'other']),
  storage_path: z.string().min(1, 'Storage path is required'),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  size_bytes: z.number().int().min(1).max(10485760), // 10MB limit
})

export const verificationDocumentUpdateSchema = z.object({
  status: z.enum(['pending', 'verified', 'rejected']).optional(),
  rejection_reason: z.string().optional(),
})

// Brand company validation
export const brandCompanySchema = z.object({
  legal_name: z.string().min(1, 'Legal name is required').max(255),
  trade_name: z.string().max(255).optional(),
  website: z.string().url('Invalid website URL').optional(),
  support_email: z.string().email('Invalid email format'),
  tax_country: z.string().length(2, 'Tax country must be 2-letter ISO code'),
  biz_registration_no: z.string().max(100).optional(),
  mail_order_license_no: z.string().max(100).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
})

export const brandCompanyUpdateSchema = brandCompanySchema.partial()

// Brand commission defaults validation
export const brandCommissionDefaultsSchema = z.object({
  rate_percent: z.number().min(0, 'Rate must be at least 0%').max(95, 'Rate cannot exceed 95%'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Currency must be 3-letter ISO code'),
})

export const brandCommissionDefaultsUpdateSchema = brandCommissionDefaultsSchema.partial()

// Influencer payouts validation
export const influencerPayoutsSchema = z.object({
  bank_holder: z.string().min(1, 'Bank holder name is required').max(255),
  bank_name: z.string().min(1, 'Bank name is required').max(255),
  account_no_encrypted: z.string().min(1, 'Account number is required'),
  iban_encrypted: z.string().optional(),
  country: z.string().length(2, 'Country must be 2-letter ISO code'),
})

export const influencerPayoutsUpdateSchema = influencerPayoutsSchema.partial()

// File upload validation for documents
export const documentUploadSchema = z.object({
  doc_type: z.enum(['identity_card', 'passport', 'drivers_license', 'business_registration', 'tax_certificate', 'bank_statement', 'utility_bill', 'other']),
  file_name: z.string().min(1, 'File name is required'),
  file_size: z.number().int().min(1).max(10485760), // 10MB limit
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
})

// Admin verification review validation
export const verificationReviewSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  rejection_reason: z.string().optional(),
})

// Query schemas for filtering
export const verificationRequestQuerySchema = z.object({
  status: z.enum(['draft', 'submitted', 'in_review', 'verified', 'rejected']).optional(),
  role: z.enum(['influencer', 'brand', 'customer', 'admin']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const profileQuerySchema = z.object({
  role: z.enum(['influencer', 'brand', 'customer', 'admin']).optional(),
  country: z.string().length(2).optional(),
  search: z.string().optional(), // Search by handle or name
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Brand onboarding validation schemas
export const brandDetailsSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  companyWebsite: z.string().url('Please enter a valid website URL').optional(),
  industry: z.string().min(2, 'Industry must be specified'),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  businessRegistrationNumber: z.string().optional(),
  taxId: z.string().optional()
})
