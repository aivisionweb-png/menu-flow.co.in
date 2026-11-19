import { z } from 'zod';

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(80),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().max(30).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, 'Restaurant name is required').max(100),
  cuisineType: z.string().trim().min(2, 'Cuisine type is required').max(80),
  logoUrl: z.string().max(1_500_000).optional().nullable(),
  address: z.string().trim().min(4, 'Address is required').max(200),
  city: z.string().trim().min(2).max(80).default('Bengaluru'),
  phone: z.string().trim().min(6, 'Phone number is required').max(30),
  email: z.string().trim().email().optional().or(z.literal('')),
  openingHours: z.string().trim().min(3).max(80).default('11:00 AM - 11:00 PM'),
  firstCategoryName: z.string().trim().min(2).max(60).default('Starters'),
  firstDish: z
    .object({
      name: z.string().trim().min(2).max(100),
      description: z.string().trim().max(400).default(''),
      price: z.number().min(1).max(100000),
      isVeg: z.boolean().default(true),
      isSpicy: z.boolean().default(false),
    })
    .optional(),
  tableCount: z.number().int().min(1).max(60).default(6),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Category name is required').max(60),
  description: z.string().trim().max(240).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

export const menuItemSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().trim().min(2, 'Dish name is required').max(100),
  description: z.string().trim().max(500).default(''),
  price: z.number().min(0).max(100000),
  imageUrl: z.string().max(2_000_000).optional().nullable(),
  isVeg: z.boolean().default(true),
  isSpicy: z.boolean().default(false),
  isBestseller: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  prepTimeMins: z.number().int().min(1).max(180).default(15),
  sortOrder: z.number().int().min(0).max(999).optional(),
  variants: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        priceDelta: z.number().min(-5000).max(50000),
        isDefault: z.boolean().optional(),
      })
    )
    .optional(),
  addons: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        price: z.number().min(0).max(10000),
        isVeg: z.boolean().default(true),
        isAvailable: z.boolean().default(true),
      })
    )
    .optional(),
});

export const tableSchema = z.object({
  tableNumber: z.number().int().min(1).max(500),
  label: z.string().trim().min(1).max(40).optional(),
  capacity: z.number().int().min(1).max(30).default(4),
  zone: z.string().trim().min(1).max(50).default('Main Dining'),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'ORDERING', 'BILL_REQUESTED']).optional(),
});

export const placeOrderSchema = z.object({
  tableNumber: z.number().int().min(1).max(500),
  customerName: z.string().trim().min(1, 'Please enter your name').max(80),
  customerPhone: z.string().trim().max(24).optional(),
  sessionId: z.string().max(100).optional(),
  paymentMethod: z.enum(['UPI', 'CARD', 'NETBANKING', 'CASH']).default('UPI'),
  offerCode: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(400).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        variantId: z.string().optional().nullable(),
        addonIds: z.array(z.string()).default([]),
        quantity: z.number().int().min(1).max(50),
        specialInstructions: z.string().trim().max(240).optional(),
      })
    )
    .min(1, 'Cart cannot be empty'),
});

export const serviceRequestSchema = z.object({
  tableNumber: z.number().int().min(1).max(500),
  requestType: z.enum(['CALL_STAFF', 'REQUEST_WATER', 'REQUEST_BILL', 'NEED_ASSISTANCE']),
  note: z.string().trim().max(200).optional(),
});

export const reviewSchema = z.object({
  orderId: z.string().optional().nullable(),
  customerName: z.string().trim().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  foodRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(600).default(''),
  tableNumber: z.number().int().min(1).max(500).optional(),
});

export const offerSchema = z.object({
  title: z.string().trim().min(2).max(80),
  code: z.string().trim().min(2).max(30).transform((s) => s.toUpperCase()),
  description: z.string().trim().max(240).default(''),
  offerType: z.enum(['PERCENTAGE', 'FLAT', 'BOGO']),
  discountValue: z.number().min(0).max(100000),
  minOrderAmount: z.number().min(0).max(100000).default(0),
  startsAt: z.string(),
  endsAt: z.string(),
  isActive: z.boolean().default(true),
});

export const staffInviteSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  role: z.enum(['MANAGER', 'KITCHEN', 'STAFF']),
  password: z.string().min(6).max(100).default('MenuFlow2026!'),
});

export const settingsUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  tagline: z.string().trim().max(140).optional().nullable(),
  cuisineType: z.string().trim().min(2).max(80).optional(),
  logoUrl: z.string().max(1_500_000).optional().nullable(),
  coverUrl: z.string().max(1_500_000).optional().nullable(),
  address: z.string().trim().min(3).max(200).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  openingHours: z.string().trim().min(3).max(80).optional(),
  isOpen: z.boolean().optional(),
  currencyCode: z.string().min(3).max(6).optional(),
  currencySymbol: z.string().min(1).max(4).optional(),
  taxRatePercent: z.number().min(0).max(40).optional(),
  serviceChargePercent: z.number().min(0).max(30).optional(),
  gstin: z.string().max(25).optional().nullable(),
  acceptingOrders: z.boolean().optional(),
  autoConfirmOrders: z.boolean().optional(),
  allowCashPayments: z.boolean().optional(),
  allowOnlinePayments: z.boolean().optional(),
  razorpayEnabled: z.boolean().optional(),
  razorpayKeyId: z.string().max(80).optional().nullable(),
  menuThemeAccent: z.string().max(20).optional(),
});
