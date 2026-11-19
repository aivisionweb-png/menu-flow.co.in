import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { db } from './db';
import {
  clearSessionCookie,
  requireAuth,
  requireRestaurantAccess,
  resolveAuthFromRequest,
  setSessionCookie,
  signSessionToken,
  type AuthenticatedRequest,
} from './auth';
import {
  createGatewayOrder,
  getRazorpayConfigStatus,
  verifyRazorpaySignature,
  verifyWebhookSignature,
} from './razorpay';
import {
  categorySchema,
  loginSchema,
  menuItemSchema,
  offerSchema,
  onboardingSchema,
  placeOrderSchema,
  reviewSchema,
  serviceRequestSchema,
  settingsUpdateSchema,
  signupSchema,
  staffInviteSchema,
  tableSchema,
} from './validation';
import { slugifyRestaurantName } from '../src/lib/format';
import {
  calculateOfferDiscount,
  canTransitionOrderStatus,
  roundMoney,
} from '../src/lib/orderLogic';
import type { CartItem, MenuItem, MenuItemAddon, MenuItemVariant, OrderStatus } from '../src/types';

type SqlVal = string | number | bigint | Uint8Array | null;
function sqlVal(v: unknown): SqlVal {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' || v instanceof Uint8Array) {
    return v;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return String(v);
}

export type RealtimeBroadcastFn = (channel: string, event: string, payload: unknown) => void;

// Lightweight in-memory sliding window rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip || 'local'}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please slow down.' });
      return;
    }
    bucket.count += 1;
    next();
  };
}

function uid(): string {
  return crypto.randomUUID();
}

function mapRestaurant(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    slug: String(row.slug),
    tagline: row.tagline ? String(row.tagline) : null,
    cuisineType: String(row.cuisine_type),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    coverUrl: row.cover_url ? String(row.cover_url) : null,
    address: String(row.address),
    city: String(row.city),
    phone: String(row.phone),
    email: row.email ? String(row.email) : null,
    openingHours: String(row.opening_hours),
    isOpen: Boolean(row.is_open),
    onboardingCompleted: Boolean(row.onboarding_completed),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapSettings(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    currencyCode: String(row.currency_code),
    currencySymbol: String(row.currency_symbol),
    taxRatePercent: Number(row.tax_rate_percent),
    serviceChargePercent: Number(row.service_charge_percent),
    gstin: row.gstin ? String(row.gstin) : null,
    acceptingOrders: Boolean(row.accepting_orders),
    autoConfirmOrders: Boolean(row.auto_confirm_orders),
    allowCashPayments: Boolean(row.allow_cash_payments),
    allowOnlinePayments: Boolean(row.allow_online_payments),
    razorpayEnabled: Boolean(row.razorpay_enabled),
    razorpayKeyId: row.razorpay_key_id ? String(row.razorpay_key_id) : null,
    menuThemeAccent: String(row.menu_theme_accent),
    updatedAt: String(row.updated_at),
  };
}

function hydrateMenuItems(restaurantId: string): MenuItem[] {
  const items = db
    .prepare(`SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY sort_order ASC, created_at ASC`)
    .all(restaurantId) as Array<Record<string, unknown>>;

  const variants = db
    .prepare(`
      SELECT v.* FROM menu_item_variants v
      JOIN menu_items m ON m.id = v.menu_item_id
      WHERE m.restaurant_id = ?
      ORDER BY v.sort_order ASC
    `)
    .all(restaurantId) as Array<Record<string, unknown>>;

  const addons = db
    .prepare(`
      SELECT a.* FROM menu_item_addons a
      JOIN menu_items m ON m.id = a.menu_item_id
      WHERE m.restaurant_id = ?
    `)
    .all(restaurantId) as Array<Record<string, unknown>>;

  const varMap = new Map<string, MenuItemVariant[]>();
  for (const v of variants) {
    const k = String(v.menu_item_id);
    if (!varMap.has(k)) varMap.set(k, []);
    varMap.get(k)!.push({
      id: String(v.id),
      menuItemId: k,
      name: String(v.name),
      priceDelta: Number(v.price_delta),
      isDefault: Boolean(v.is_default),
      sortOrder: Number(v.sort_order),
    });
  }

  const addMap = new Map<string, MenuItemAddon[]>();
  for (const a of addons) {
    const k = String(a.menu_item_id);
    if (!addMap.has(k)) addMap.set(k, []);
    addMap.get(k)!.push({
      id: String(a.id),
      menuItemId: k,
      name: String(a.name),
      price: Number(a.price),
      isVeg: Boolean(a.is_veg),
      isAvailable: Boolean(a.is_available),
    });
  }

  return items.map((m) => ({
    id: String(m.id),
    restaurantId: String(m.restaurant_id),
    categoryId: String(m.category_id),
    name: String(m.name),
    description: String(m.description),
    price: Number(m.price),
    imageUrl: m.image_url ? String(m.image_url) : null,
    isVeg: Boolean(m.is_veg),
    isSpicy: Boolean(m.is_spicy),
    isBestseller: Boolean(m.is_bestseller),
    isAvailable: Boolean(m.is_available),
    prepTimeMins: Number(m.prep_time_mins),
    sortOrder: Number(m.sort_order),
    variants: varMap.get(String(m.id)) ?? [],
    addons: addMap.get(String(m.id)) ?? [],
    createdAt: String(m.created_at),
    updatedAt: String(m.updated_at),
  }));
}

function hydrateOrder(orderRow: Record<string, unknown>) {
  const orderId = String(orderRow.id);
  const itemRows = db
    .prepare(`SELECT * FROM order_items WHERE order_id = ?`)
    .all(orderId) as Array<Record<string, unknown>>;

  const addonRows = db
    .prepare(`
      SELECT oia.* FROM order_item_addons oia
      JOIN order_items oi ON oi.id = oia.order_item_id
      WHERE oi.order_id = ?
    `)
    .all(orderId) as Array<Record<string, unknown>>;

  const addonMap = new Map<string, Array<{ id: string; addonId: string; name: string; price: number }>>();
  for (const a of addonRows) {
    const k = String(a.order_item_id);
    if (!addonMap.has(k)) addonMap.set(k, []);
    addonMap.get(k)!.push({
      id: String(a.id),
      addonId: a.addon_id ? String(a.addon_id) : '',
      name: String(a.name),
      price: Number(a.price),
    });
  }

  return {
    id: orderId,
    restaurantId: String(orderRow.restaurant_id),
    orderNumber: String(orderRow.order_number),
    tableId: orderRow.table_id ? String(orderRow.table_id) : null,
    tableNumber: Number(orderRow.table_number),
    customerId: orderRow.customer_id ? String(orderRow.customer_id) : null,
    customerName: String(orderRow.customer_name),
    customerPhone: orderRow.customer_phone ? String(orderRow.customer_phone) : null,
    sessionId: orderRow.session_id ? String(orderRow.session_id) : null,
    status: String(orderRow.status),
    paymentStatus: String(orderRow.payment_status),
    paymentMethod: String(orderRow.payment_method),
    subtotal: Number(orderRow.subtotal),
    discountAmount: Number(orderRow.discount_amount),
    taxAmount: Number(orderRow.tax_amount),
    serviceChargeAmount: Number(orderRow.service_charge_amount),
    totalAmount: Number(orderRow.total_amount),
    appliedOfferCode: orderRow.applied_offer_code ? String(orderRow.applied_offer_code) : null,
    notes: orderRow.notes ? String(orderRow.notes) : null,
    items: itemRows.map((i) => ({
      id: String(i.id),
      orderId,
      menuItemId: i.menu_item_id ? String(i.menu_item_id) : '',
      name: String(i.name),
      unitPrice: Number(i.unit_price),
      variantId: i.variant_id ? String(i.variant_id) : null,
      variantName: i.variant_name ? String(i.variant_name) : null,
      quantity: Number(i.quantity),
      specialInstructions: i.special_instructions ? String(i.special_instructions) : null,
      lineTotal: Number(i.line_total),
      addons: addonMap.get(String(i.id)) ?? [],
    })),
    createdAt: String(orderRow.created_at),
    updatedAt: String(orderRow.updated_at),
  };
}

function hydrateTables(restaurantId: string) {
  const rows = db
    .prepare(`
      SELECT t.*, q.id as qr_id, q.token as qr_token, q.target_path as qr_path,
             q.scan_count as qr_scans, q.is_active as qr_active,
             q.created_at as qr_created, q.updated_at as qr_updated
      FROM tables t
      LEFT JOIN qr_codes q ON q.table_id = t.id
      WHERE t.restaurant_id = ?
      ORDER BY t.table_number ASC
    `)
    .all(restaurantId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    restaurantId: String(r.restaurant_id),
    tableNumber: Number(r.table_number),
    label: String(r.label),
    capacity: Number(r.capacity),
    zone: String(r.zone),
    status: String(r.status),
    qrCode: r.qr_id
      ? {
          id: String(r.qr_id),
          restaurantId: String(r.restaurant_id),
          tableId: String(r.id),
          token: String(r.qr_token),
          targetPath: String(r.qr_path),
          scanCount: Number(r.qr_scans),
          isActive: Boolean(r.qr_active),
          createdAt: String(r.qr_created),
          updatedAt: String(r.qr_updated),
        }
      : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export function createApiRouter(broadcast: RealtimeBroadcastFn) {
  const router = express.Router();

  // Health
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // QR SVG generator endpoint (returns real QR code SVG for any path)
  router.get('/qr-svg', async (req, res) => {
    try {
      const target = String(req.query.url || '/menu/casa-verde/1');
      const svg = await QRCode.toString(target, {
        type: 'svg',
        margin: 1,
        width: 240,
        color: { dark: '#080A0C', light: '#F5F2EA' },
      });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    } catch {
      res.status(400).json({ error: 'Unable to generate QR' });
    }
  });

  // ================= AUTH =================
  router.post('/auth/signup', rateLimit(20, 60_000), (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid signup input' });
      return;
    }
    const { fullName, email, phone, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const userId = uid();
    const now = new Date().toISOString();
    const hash = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (id, email, full_name, phone, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, fullName, phone || null, hash, now, now);

    const token = signSessionToken(userId);
    setSessionCookie(res, token);

    res.status(201).json({
      user: { id: userId, email: normalizedEmail, fullName, phone: phone || null, createdAt: now, updatedAt: now },
      restaurant: null,
      role: null,
      token,
    });
  });

  router.post('/auth/login', rateLimit(30, 60_000), (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid login credentials' });
      return;
    }
    const { email, password } = parsed.data;
    const userRow = db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .get(email.toLowerCase()) as Record<string, unknown> | undefined;

    if (!userRow || !bcrypt.compareSync(password, String(userRow.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const userId = String(userRow.id);
    const token = signSessionToken(userId);
    setSessionCookie(res, token);

    const member = db
      .prepare(`
        SELECT r.*, rm.role
        FROM restaurant_members rm
        JOIN restaurants r ON r.id = rm.restaurant_id
        WHERE rm.user_id = ? AND rm.is_active = 1
        ORDER BY rm.created_at ASC
        LIMIT 1
      `)
      .get(userId) as Record<string, unknown> | undefined;

    res.json({
      user: {
        id: userId,
        email: String(userRow.email),
        fullName: String(userRow.full_name),
        phone: userRow.phone ? String(userRow.phone) : null,
        createdAt: String(userRow.created_at),
        updatedAt: String(userRow.updated_at),
      },
      restaurant: member ? mapRestaurant(member) : null,
      role: member ? String(member.role) : null,
      token,
    });
  });

  router.post('/auth/magic-link', rateLimit(10, 60_000), (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }
    const userRow = db.prepare(`SELECT id, email, full_name FROM users WHERE email = ?`).get(email) as
      | { id: string; email: string; full_name: string }
      | undefined;

    // Never leak existence blindly in production; for dev demo provide direct one-time link if user exists
    if (!userRow) {
      res.json({
        sent: true,
        message: 'If an account matches that email, a sign-in link has been prepared.',
        previewToken: null,
      });
      return;
    }

    const token = signSessionToken(userRow.id);
    res.json({
      sent: true,
      message: 'Magic sign-in link ready. Click the confirmation link below to authenticate.',
      previewToken: token,
    });
  });

  router.post('/auth/magic-verify', (req, res) => {
    const token = String(req.body?.token || '');
    if (!token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }
    // Reuse resolveAuthFromRequest logic via Authorization header or direct verify
    req.headers.authorization = `Bearer ${token}`;
    const ctx = resolveAuthFromRequest(req);
    if (!ctx) {
      res.status(401).json({ error: 'Invalid or expired magic link token' });
      return;
    }
    setSessionCookie(res, token);
    res.json({ ok: true });
  });

  router.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/auth/me', (req, res) => {
    const ctx = resolveAuthFromRequest(req);
    if (!ctx) {
      res.json({ user: null, restaurant: null, role: null });
      return;
    }
    const userRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get(ctx.userId) as Record<string, unknown>;
    const restRow = ctx.restaurantId
      ? (db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(ctx.restaurantId) as Record<string, unknown> | undefined)
      : undefined;

    res.json({
      user: {
        id: ctx.userId,
        email: String(userRow.email),
        fullName: String(userRow.full_name),
        phone: userRow.phone ? String(userRow.phone) : null,
        createdAt: String(userRow.created_at),
        updatedAt: String(userRow.updated_at),
      },
      restaurant: restRow ? mapRestaurant(restRow) : null,
      role: ctx.role,
    });
  });

  // ================= ONBOARDING =================
  router.post('/onboarding', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid onboarding details' });
      return;
    }
    const data = parsed.data;
    const userId = req.auth!.userId;
    const now = new Date().toISOString();

    let slug = slugifyRestaurantName(data.name);
    const slugCollision = db.prepare(`SELECT id FROM restaurants WHERE slug = ?`).get(slug);
    if (slugCollision) {
      slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
    }

    const restId = uid();
    db.prepare(`
      INSERT INTO restaurants (
        id, owner_id, name, slug, tagline, cuisine_type, logo_url, cover_url,
        address, city, phone, email, opening_hours, is_open, onboarding_completed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
    `).run(
      restId,
      userId,
      data.name,
      slug,
      `${data.cuisineType} Kitchen`,
      data.cuisineType,
      data.logoUrl || null,
      '/src/assets/images/casaverde_hero_1795070509445.jpg',
      data.address,
      data.city,
      data.phone,
      data.email || req.auth!.email,
      data.openingHours,
      now,
      now
    );

    db.prepare(`
      INSERT INTO restaurant_members (id, restaurant_id, user_id, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 'OWNER', 1, ?, ?)
    `).run(uid(), restId, userId, now, now);

    db.prepare(`
      INSERT INTO restaurant_settings (
        id, restaurant_id, currency_code, currency_symbol, tax_rate_percent, service_charge_percent,
        accepting_orders, auto_confirm_orders, allow_cash_payments, allow_online_payments, razorpay_enabled, menu_theme_accent, updated_at
      ) VALUES (?, ?, 'INR', '₹', 5.0, 0.0, 1, 0, 1, 1, 1, '#2DD4BF', ?)
    `).run(uid(), restId, now);

    const catId = uid();
    db.prepare(`
      INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 'Signature house dishes', 1, 1, ?, ?)
    `).run(catId, restId, data.firstCategoryName, now, now);

    if (data.firstDish) {
      db.prepare(`
        INSERT INTO menu_items (
          id, restaurant_id, category_id, name, description, price, image_url,
          is_veg, is_spicy, is_bestseller, is_available, prep_time_mins, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 15, 1, ?, ?)
      `).run(
        uid(),
        restId,
        catId,
        data.firstDish.name,
        data.firstDish.description,
        data.firstDish.price,
        '/src/assets/images/dish_starter_guac_1795070508560.jpg',
        data.firstDish.isVeg ? 1 : 0,
        data.firstDish.isSpicy ? 1 : 0,
        now,
        now
      );
    }

    const insertTable = db.prepare(`
      INSERT INTO tables (id, restaurant_id, table_number, label, capacity, zone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 4, 'Main Dining', 'AVAILABLE', ?, ?)
    `);
    const insertQr = db.prepare(`
      INSERT INTO qr_codes (id, restaurant_id, table_id, token, target_path, scan_count, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
    `);

    for (let i = 1; i <= data.tableCount; i += 1) {
      const tid = uid();
      insertTable.run(tid, restId, i, `Table ${String(i).padStart(2, '0')}`, now, now);
      insertQr.run(
        uid(),
        restId,
        tid,
        `${slug}-t${i}-${crypto.randomBytes(3).toString('hex')}`,
        `/menu/${slug}/${i}`,
        now,
        now
      );
    }

    const created = db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(restId) as Record<string, unknown>;
    res.status(201).json({ restaurant: mapRestaurant(created) });
  });

  // ================= ADMIN DASHBOARD =================
  router.get('/dashboard/bootstrap', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    const restaurant = db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(restId) as Record<string, unknown>;
    const settings = db.prepare(`SELECT * FROM restaurant_settings WHERE restaurant_id = ?`).get(restId) as Record<string, unknown>;

    const categories = (
      db.prepare(`SELECT * FROM categories WHERE restaurant_id = ? ORDER BY sort_order ASC, created_at ASC`).all(restId) as Array<Record<string, unknown>>
    ).map((c) => ({
      id: String(c.id),
      restaurantId: String(c.restaurant_id),
      name: String(c.name),
      description: c.description ? String(c.description) : null,
      sortOrder: Number(c.sort_order),
      isActive: Boolean(c.is_active),
      createdAt: String(c.created_at),
      updatedAt: String(c.updated_at),
    }));

    const menuItems = hydrateMenuItems(restId);
    const tables = hydrateTables(restId);

    const orderRows = db
      .prepare(`SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 200`)
      .all(restId) as Array<Record<string, unknown>>;
    const orders = orderRows.map(hydrateOrder);

    const customers = (
      db.prepare(`SELECT * FROM customers WHERE restaurant_id = ? ORDER BY last_visit_at DESC`).all(restId) as Array<Record<string, unknown>>
    ).map((c) => ({
      id: String(c.id),
      restaurantId: String(c.restaurant_id),
      name: String(c.name),
      phone: c.phone ? String(c.phone) : null,
      email: c.email ? String(c.email) : null,
      totalOrders: Number(c.total_orders),
      totalSpent: Number(c.total_spent),
      lastVisitAt: String(c.last_visit_at),
      createdAt: String(c.created_at),
    }));

    const offers = (
      db.prepare(`SELECT * FROM offers WHERE restaurant_id = ? ORDER BY created_at DESC`).all(restId) as Array<Record<string, unknown>>
    ).map((o) => ({
      id: String(o.id),
      restaurantId: String(o.restaurant_id),
      title: String(o.title),
      code: String(o.code),
      description: String(o.description),
      offerType: String(o.offer_type),
      discountValue: Number(o.discount_value),
      minOrderAmount: Number(o.min_order_amount),
      startsAt: String(o.starts_at),
      endsAt: String(o.ends_at),
      isActive: Boolean(o.is_active),
      createdAt: String(o.created_at),
      updatedAt: String(o.updated_at),
    }));

    const reviews = (
      db.prepare(`SELECT * FROM reviews WHERE restaurant_id = ? ORDER BY created_at DESC`).all(restId) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: String(r.id),
      restaurantId: String(r.restaurant_id),
      orderId: r.order_id ? String(r.order_id) : null,
      orderNumber: r.order_number ? String(r.order_number) : null,
      customerName: String(r.customer_name),
      rating: Number(r.rating),
      foodRating: r.food_rating !== null ? Number(r.food_rating) : null,
      comment: String(r.comment),
      tableNumber: r.table_number !== null ? Number(r.table_number) : null,
      createdAt: String(r.created_at),
    }));

    const payments = (
      db.prepare(`SELECT * FROM payments WHERE restaurant_id = ? ORDER BY created_at DESC`).all(restId) as Array<Record<string, unknown>>
    ).map((p) => ({
      id: String(p.id),
      restaurantId: String(p.restaurant_id),
      orderId: String(p.order_id),
      orderNumber: String(p.order_number),
      amount: Number(p.amount),
      currency: String(p.currency),
      method: String(p.method),
      status: String(p.status),
      provider: String(p.provider),
      razorpayOrderId: p.razorpay_order_id ? String(p.razorpay_order_id) : null,
      razorpayPaymentId: p.razorpay_payment_id ? String(p.razorpay_payment_id) : null,
      testMode: Boolean(p.test_mode),
      createdAt: String(p.created_at),
      updatedAt: String(p.updated_at),
    }));

    const invoices = (
      db.prepare(`SELECT * FROM invoices WHERE restaurant_id = ? ORDER BY issued_at DESC`).all(restId) as Array<Record<string, unknown>>
    ).map((inv) => ({
      id: String(inv.id),
      restaurantId: String(inv.restaurant_id),
      orderId: String(inv.order_id),
      invoiceNumber: String(inv.invoice_number),
      subtotal: Number(inv.subtotal),
      discountAmount: Number(inv.discount_amount),
      taxAmount: Number(inv.tax_amount),
      serviceChargeAmount: Number(inv.service_charge_amount),
      totalAmount: Number(inv.total_amount),
      paymentMethod: String(inv.payment_method),
      paymentStatus: String(inv.payment_status),
      issuedAt: String(inv.issued_at),
    }));

    const serviceRequests = (
      db.prepare(`SELECT * FROM service_requests WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 60`).all(restId) as Array<Record<string, unknown>>
    ).map((sr) => ({
      id: String(sr.id),
      restaurantId: String(sr.restaurant_id),
      tableId: sr.table_id ? String(sr.table_id) : null,
      tableNumber: Number(sr.table_number),
      requestType: String(sr.request_type),
      note: sr.note ? String(sr.note) : null,
      status: String(sr.status),
      createdAt: String(sr.created_at),
      updatedAt: String(sr.updated_at),
    }));

    const staff = (
      db
        .prepare(`
          SELECT rm.*, u.email, u.full_name
          FROM restaurant_members rm
          JOIN users u ON u.id = rm.user_id
          WHERE rm.restaurant_id = ?
          ORDER BY rm.created_at ASC
        `)
        .all(restId) as Array<Record<string, unknown>>
    ).map((m) => ({
      id: String(m.id),
      restaurantId: String(m.restaurant_id),
      userId: String(m.user_id),
      email: String(m.email),
      fullName: String(m.full_name),
      role: String(m.role),
      isActive: Boolean(m.is_active),
      createdAt: String(m.created_at),
      updatedAt: String(m.updated_at),
    }));

    res.json({
      restaurant: mapRestaurant(restaurant),
      settings: mapSettings(settings),
      razorpayStatus: getRazorpayConfigStatus(),
      categories,
      menuItems,
      tables,
      orders,
      customers,
      offers,
      reviews,
      payments,
      invoices,
      serviceRequests,
      staff,
    });
  });

  // Update Order Status
  router.patch('/dashboard/orders/:id/status', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    const orderId = req.params.id;
    const nextStatus = String(req.body?.status || '') as OrderStatus;
    const existing = db
      .prepare(`SELECT * FROM orders WHERE id = ? AND restaurant_id = ?`)
      .get(orderId, restId) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const currentStatus = String(existing.status) as OrderStatus;
    if (!canTransitionOrderStatus(currentStatus, nextStatus)) {
      res.status(400).json({ error: `Cannot transition order from ${currentStatus} to ${nextStatus}` });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`).run(nextStatus, now, orderId);

    // If order completed and cash was pending, mark cash payment paid optionally or update table status
    if (nextStatus === 'COMPLETED' && existing.table_id) {
      db.prepare(`UPDATE tables SET status = 'AVAILABLE', updated_at = ? WHERE id = ?`).run(
        now,
        String(existing.table_id)
      );
      if (String(existing.payment_method) === 'CASH' && String(existing.payment_status) === 'PENDING') {
        db.prepare(`UPDATE orders SET payment_status = 'PAID', updated_at = ? WHERE id = ?`).run(now, orderId);
        db.prepare(`UPDATE payments SET status = 'PAID', updated_at = ? WHERE order_id = ?`).run(now, orderId);
        db.prepare(`UPDATE invoices SET payment_status = 'PAID' WHERE order_id = ?`).run(orderId);
      }
    }

    const updated = hydrateOrder(
      db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as Record<string, unknown>
    );

    broadcast(`restaurant:${restId}`, 'order:updated', updated);
    broadcast(`order:${orderId}`, 'order:updated', updated);

    res.json({ order: updated });
  });

  router.patch('/dashboard/orders/:id/payment-status', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    const orderId = req.params.id;
    const paymentStatus = String(req.body?.paymentStatus || '');
    if (!['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(paymentStatus)) {
      res.status(400).json({ error: 'Invalid payment status' });
      return;
    }
    const now = new Date().toISOString();
    const row = db
      .prepare(`SELECT id FROM orders WHERE id = ? AND restaurant_id = ?`)
      .get(orderId, restId);
    if (!row) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    db.prepare(`UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?`).run(paymentStatus, now, orderId);
    db.prepare(`UPDATE payments SET status = ?, updated_at = ? WHERE order_id = ?`).run(paymentStatus, now, orderId);
    db.prepare(`UPDATE invoices SET payment_status = ? WHERE order_id = ?`).run(paymentStatus, orderId);

    const updated = hydrateOrder(db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as Record<string, unknown>);
    broadcast(`restaurant:${restId}`, 'order:updated', updated);
    broadcast(`order:${orderId}`, 'order:updated', updated);
    res.json({ order: updated });
  });

  // Categories CRUD & Reorder
  router.post('/dashboard/categories', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid category' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const now = new Date().toISOString();
    const maxRow = db
      .prepare(`SELECT COALESCE(MAX(sort_order), 0) as m FROM categories WHERE restaurant_id = ?`)
      .get(restId) as { m: number };
    const id = uid();
    db.prepare(`
      INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      restId,
      parsed.data.name,
      parsed.data.description ?? null,
      parsed.data.sortOrder ?? maxRow.m + 1,
      parsed.data.isActive === false ? 0 : 1,
      now,
      now
    );

    const row = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id) as Record<string, unknown>;
    broadcast(`restaurant:${restId}`, 'menu:updated', { type: 'category_created' });
    res.status(201).json({
      category: {
        id,
        restaurantId: restId,
        name: String(row.name),
        description: row.description ? String(row.description) : null,
        sortOrder: Number(row.sort_order),
        isActive: Boolean(row.is_active),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      },
    });
  });

  router.patch('/dashboard/categories/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = categorySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid category' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const existing = db
      .prepare(`SELECT * FROM categories WHERE id = ? AND restaurant_id = ?`)
      .get(req.params.id, restId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE categories SET name = ?, description = ?, sort_order = ?, is_active = ?, updated_at = ?
      WHERE id = ? AND restaurant_id = ?
    `).run(
      sqlVal(parsed.data.name ?? existing.name),
      sqlVal(parsed.data.description !== undefined ? parsed.data.description : existing.description),
      sqlVal(parsed.data.sortOrder ?? existing.sort_order),
      sqlVal(parsed.data.isActive !== undefined ? (parsed.data.isActive ? 1 : 0) : existing.is_active),
      now,
      req.params.id,
      restId
    );
    const row = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(req.params.id) as Record<string, unknown>;
    broadcast(`restaurant:${restId}`, 'menu:updated', { type: 'category_updated' });
    res.json({
      category: {
        id: String(row.id),
        restaurantId: restId,
        name: String(row.name),
        description: row.description ? String(row.description) : null,
        sortOrder: Number(row.sort_order),
        isActive: Boolean(row.is_active),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      },
    });
  });

  router.post('/dashboard/categories/reorder', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const ids = Array.isArray(req.body?.orderedIds) ? (req.body.orderedIds as string[]) : [];
    const restId = req.auth!.restaurantId!;
    const stmt = db.prepare(`UPDATE categories SET sort_order = ? WHERE id = ? AND restaurant_id = ?`);
    ids.forEach((id, idx) => stmt.run(idx + 1, id, restId));
    broadcast(`restaurant:${restId}`, 'menu:updated', { type: 'categories_reordered' });
    res.json({ ok: true });
  });

  router.delete('/dashboard/categories/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    const info = db.prepare(`DELETE FROM categories WHERE id = ? AND restaurant_id = ?`).run(req.params.id, restId);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    broadcast(`restaurant:${restId}`, 'menu:updated', { type: 'category_deleted' });
    res.json({ ok: true });
  });

  // Menu Items CRUD & Reorder
  router.post('/dashboard/menu', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = menuItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid dish input' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const d = parsed.data;
    const cat = db.prepare(`SELECT id FROM categories WHERE id = ? AND restaurant_id = ?`).get(d.categoryId, restId);
    if (!cat) {
      res.status(400).json({ error: 'Category does not belong to this restaurant' });
      return;
    }

    const now = new Date().toISOString();
    const maxRow = db
      .prepare(`SELECT COALESCE(MAX(sort_order), 0) as m FROM menu_items WHERE restaurant_id = ?`)
      .get(restId) as { m: number };
    const id = uid();
    db.prepare(`
      INSERT INTO menu_items (
        id, restaurant_id, category_id, name, description, price, image_url,
        is_veg, is_spicy, is_bestseller, is_available, prep_time_mins, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      restId,
      d.categoryId,
      d.name,
      d.description,
      d.price,
      d.imageUrl || '/src/assets/images/dish_starter_guac_1795070508560.jpg',
      d.isVeg ? 1 : 0,
      d.isSpicy ? 1 : 0,
      d.isBestseller ? 1 : 0,
      d.isAvailable ? 1 : 0,
      d.prepTimeMins,
      d.sortOrder ?? maxRow.m + 1,
      now,
      now
    );

    const insVar = db.prepare(
      `INSERT INTO menu_item_variants (id, menu_item_id, name, price_delta, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
    );
    (d.variants ?? []).forEach((v, idx) =>
      insVar.run(uid(), id, v.name, v.priceDelta, v.isDefault ? 1 : 0, idx + 1)
    );

    const insAdd = db.prepare(
      `INSERT INTO menu_item_addons (id, menu_item_id, name, price, is_veg, is_available) VALUES (?, ?, ?, ?, ?, ?)`
    );
    (d.addons ?? []).forEach((a) =>
      insAdd.run(uid(), id, a.name, a.price, a.isVeg ? 1 : 0, a.isAvailable ? 1 : 0)
    );

    const item = hydrateMenuItems(restId).find((m) => m.id === id);
    broadcast(`restaurant:${restId}`, 'menu:updated', { type: 'item_created' });
    res.status(201).json({ menuItem: item });
  });

  router.patch('/dashboard/menu/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = menuItemSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid dish update' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const existing = db
      .prepare(`SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?`)
      .get(req.params.id, restId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Dish not found' });
      return;
    }
    const d = parsed.data;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE menu_items SET
        category_id = ?, name = ?, description = ?, price = ?, image_url = ?,
        is_veg = ?, is_spicy = ?, is_bestseller = ?, is_available = ?, prep_time_mins = ?,
        sort_order = ?, updated_at = ?
      WHERE id = ? AND restaurant_id = ?
    `).run(
      sqlVal(d.categoryId ?? existing.category_id),
      sqlVal(d.name ?? existing.name),
      sqlVal(d.description !== undefined ? d.description : existing.description),
      sqlVal(d.price !== undefined ? d.price : existing.price),
      sqlVal(d.imageUrl !== undefined ? d.imageUrl : existing.image_url),
      sqlVal(d.isVeg !== undefined ? (d.isVeg ? 1 : 0) : existing.is_veg),
      sqlVal(d.isSpicy !== undefined ? (d.isSpicy ? 1 : 0) : existing.is_spicy),
      sqlVal(d.isBestseller !== undefined ? (d.isBestseller ? 1 : 0) : existing.is_bestseller),
      sqlVal(d.isAvailable !== undefined ? (d.isAvailable ? 1 : 0) : existing.is_available),
      sqlVal(d.prepTimeMins !== undefined ? d.prepTimeMins : existing.prep_time_mins),
      sqlVal(d.sortOrder !== undefined ? d.sortOrder : existing.sort_order),
      now,
      req.params.id,
      restId
    );

    if (d.variants !== undefined) {
      db.prepare(`DELETE FROM menu_item_variants WHERE menu_item_id = ?`).run(req.params.id);
      const insVar = db.prepare(
        `INSERT INTO menu_item_variants (id, menu_item_id, name, price_delta, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
      );
      d.variants.forEach((v, idx) =>
        insVar.run(uid(), req.params.id, v.name, v.priceDelta, v.isDefault ? 1 : 0, idx + 1)
      );
    }

    if (d.addons !== undefined) {
      db.prepare(`DELETE FROM menu_item_addons WHERE menu_item_id = ?`).run(req.params.id);
      const insAdd = db.prepare(
        `INSERT INTO menu_item_addons (id, menu_item_id, name, price, is_veg, is_available) VALUES (?, ?, ?, ?, ?, ?)`
      );
      d.addons.forEach((a) =>
        insAdd.run(uid(), req.params.id, a.name, a.price, a.isVeg ? 1 : 0, a.isAvailable ? 1 : 0)
      );
    }

    const item = hydrateMenuItems(restId).find((m) => m.id === req.params.id);
    broadcast(`restaurant:${restId}`, 'menu:updated', { type: 'item_updated' });
    res.json({ menuItem: item });
  });

  router.post('/dashboard/menu/reorder', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const ids = Array.isArray(req.body?.orderedIds) ? (req.body.orderedIds as string[]) : [];
    const restId = req.auth!.restaurantId!;
    const stmt = db.prepare(`UPDATE menu_items SET sort_order = ? WHERE id = ? AND restaurant_id = ?`);
    ids.forEach((id, idx) => stmt.run(idx + 1, id, restId));
    broadcast(`restaurant:${restId}`, 'menu:updated', { type: 'items_reordered' });
    res.json({ ok: true });
  });

  router.delete('/dashboard/menu/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    const info = db.prepare(`DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?`).run(req.params.id, restId);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Dish not found' });
      return;
    }
    broadcast(`restaurant:${restId}`, 'menu:updated', { type: 'item_deleted' });
    res.json({ ok: true });
  });

  // Tables & QR Management
  router.post('/dashboard/tables', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = tableSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid table' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const { tableNumber, label, capacity, zone } = parsed.data;

    const dup = db
      .prepare(`SELECT id FROM tables WHERE restaurant_id = ? AND table_number = ?`)
      .get(restId, tableNumber);
    if (dup) {
      res.status(409).json({ error: `Table ${tableNumber} already exists` });
      return;
    }

    const rest = db.prepare(`SELECT slug FROM restaurants WHERE id = ?`).get(restId) as { slug: string };
    const now = new Date().toISOString();
    const tid = uid();
    db.prepare(`
      INSERT INTO tables (id, restaurant_id, table_number, label, capacity, zone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?)
    `).run(tid, restId, tableNumber, label || `Table ${String(tableNumber).padStart(2, '0')}`, capacity, zone, now, now);

    db.prepare(`
      INSERT INTO qr_codes (id, restaurant_id, table_id, token, target_path, scan_count, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
    `).run(
      uid(),
      restId,
      tid,
      `${rest.slug}-t${tableNumber}-${crypto.randomBytes(3).toString('hex')}`,
      `/menu/${rest.slug}/${tableNumber}`,
      now,
      now
    );

    const table = hydrateTables(restId).find((t) => t.id === tid);
    res.status(201).json({ table });
  });

  router.patch('/dashboard/tables/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = tableSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid table update' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const existing = db
      .prepare(`SELECT * FROM tables WHERE id = ? AND restaurant_id = ?`)
      .get(req.params.id, restId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE tables SET label = ?, capacity = ?, zone = ?, status = ?, updated_at = ?
      WHERE id = ? AND restaurant_id = ?
    `).run(
      sqlVal(parsed.data.label ?? existing.label),
      sqlVal(parsed.data.capacity ?? existing.capacity),
      sqlVal(parsed.data.zone ?? existing.zone),
      sqlVal(parsed.data.status ?? existing.status),
      now,
      req.params.id,
      restId
    );
    const table = hydrateTables(restId).find((t) => t.id === req.params.id);
    res.json({ table });
  });

  router.post('/dashboard/tables/:id/regenerate-qr', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    const tRow = db
      .prepare(`SELECT * FROM tables WHERE id = ? AND restaurant_id = ?`)
      .get(req.params.id, restId) as Record<string, unknown> | undefined;
    if (!tRow) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }
    const rest = db.prepare(`SELECT slug FROM restaurants WHERE id = ?`).get(restId) as { slug: string };
    const now = new Date().toISOString();
    const newToken = `${rest.slug}-t${tRow.table_number}-${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`UPDATE qr_codes SET token = ?, updated_at = ? WHERE table_id = ? AND restaurant_id = ?`).run(
      newToken,
      now,
      req.params.id,
      restId
    );
    const table = hydrateTables(restId).find((t) => t.id === req.params.id);
    res.json({ table });
  });

  router.delete('/dashboard/tables/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    const info = db.prepare(`DELETE FROM tables WHERE id = ? AND restaurant_id = ?`).run(req.params.id, restId);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Service Requests (Admin)
  router.patch('/dashboard/service-requests/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    const status = String(req.body?.status || '');
    if (!['PENDING', 'ACKNOWLEDGED', 'COMPLETED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const now = new Date().toISOString();
    const existing = db
      .prepare(`SELECT * FROM service_requests WHERE id = ? AND restaurant_id = ?`)
      .get(req.params.id, restId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }
    db.prepare(`UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, req.params.id);
    if (status === 'COMPLETED' && String(existing.request_type) === 'REQUEST_BILL' && existing.table_id) {
      db.prepare(`UPDATE tables SET status = 'AVAILABLE', updated_at = ? WHERE id = ?`).run(now, String(existing.table_id));
    }
    const row = db.prepare(`SELECT * FROM service_requests WHERE id = ?`).get(req.params.id) as Record<string, unknown>;
    const mapped = {
      id: String(row.id),
      restaurantId: String(row.restaurant_id),
      tableId: row.table_id ? String(row.table_id) : null,
      tableNumber: Number(row.table_number),
      requestType: String(row.request_type),
      note: row.note ? String(row.note) : null,
      status: String(row.status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
    broadcast(`restaurant:${restId}`, 'service_request:updated', mapped);
    res.json({ serviceRequest: mapped });
  });

  // Offers CRUD
  router.post('/dashboard/offers', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = offerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid offer' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const d = parsed.data;
    const now = new Date().toISOString();
    const id = uid();
    db.prepare(`
      INSERT INTO offers (id, restaurant_id, title, code, description, offer_type, discount_value, min_order_amount, starts_at, ends_at, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, restId, d.title, d.code, d.description, d.offerType, d.discountValue, d.minOrderAmount, d.startsAt, d.endsAt, d.isActive ? 1 : 0, now, now);

    const row = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(id) as Record<string, unknown>;
    res.status(201).json({
      offer: {
        id,
        restaurantId: restId,
        title: String(row.title),
        code: String(row.code),
        description: String(row.description),
        offerType: String(row.offer_type),
        discountValue: Number(row.discount_value),
        minOrderAmount: Number(row.min_order_amount),
        startsAt: String(row.starts_at),
        endsAt: String(row.ends_at),
        isActive: Boolean(row.is_active),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      },
    });
  });

  router.patch('/dashboard/offers/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = offerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid offer update' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const existing = db
      .prepare(`SELECT * FROM offers WHERE id = ? AND restaurant_id = ?`)
      .get(req.params.id, restId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Offer not found' });
      return;
    }
    const d = parsed.data;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE offers SET title = ?, code = ?, description = ?, offer_type = ?, discount_value = ?,
        min_order_amount = ?, starts_at = ?, ends_at = ?, is_active = ?, updated_at = ?
      WHERE id = ? AND restaurant_id = ?
    `).run(
      sqlVal(d.title ?? existing.title),
      sqlVal(d.code ?? existing.code),
      sqlVal(d.description ?? existing.description),
      sqlVal(d.offerType ?? existing.offer_type),
      sqlVal(d.discountValue ?? existing.discount_value),
      sqlVal(d.minOrderAmount ?? existing.min_order_amount),
      sqlVal(d.startsAt ?? existing.starts_at),
      sqlVal(d.endsAt ?? existing.ends_at),
      sqlVal(d.isActive !== undefined ? (d.isActive ? 1 : 0) : existing.is_active),
      now,
      req.params.id,
      restId
    );
    const row = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(req.params.id) as Record<string, unknown>;
    res.json({
      offer: {
        id: String(row.id),
        restaurantId: restId,
        title: String(row.title),
        code: String(row.code),
        description: String(row.description),
        offerType: String(row.offer_type),
        discountValue: Number(row.discount_value),
        minOrderAmount: Number(row.min_order_amount),
        startsAt: String(row.starts_at),
        endsAt: String(row.ends_at),
        isActive: Boolean(row.is_active),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      },
    });
  });

  router.delete('/dashboard/offers/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    db.prepare(`DELETE FROM offers WHERE id = ? AND restaurant_id = ?`).run(req.params.id, restId);
    res.json({ ok: true });
  });

  // Settings & Staff
  router.patch('/dashboard/settings', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = settingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const d = parsed.data;
    const now = new Date().toISOString();

    const rest = db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(restId) as Record<string, unknown>;
    db.prepare(`
      UPDATE restaurants SET
        name = ?, tagline = ?, cuisine_type = ?, logo_url = ?, cover_url = ?,
        address = ?, city = ?, phone = ?, email = ?, opening_hours = ?, is_open = ?, updated_at = ?
      WHERE id = ?
    `).run(
      sqlVal(d.name ?? rest.name),
      sqlVal(d.tagline !== undefined ? d.tagline : rest.tagline),
      sqlVal(d.cuisineType ?? rest.cuisine_type),
      sqlVal(d.logoUrl !== undefined ? d.logoUrl : rest.logo_url),
      sqlVal(d.coverUrl !== undefined ? d.coverUrl : rest.cover_url),
      sqlVal(d.address ?? rest.address),
      sqlVal(d.city ?? rest.city),
      sqlVal(d.phone ?? rest.phone),
      sqlVal(d.email !== undefined ? d.email : rest.email),
      sqlVal(d.openingHours ?? rest.opening_hours),
      sqlVal(d.isOpen !== undefined ? (d.isOpen ? 1 : 0) : rest.is_open),
      now,
      restId
    );

    const setRow = db.prepare(`SELECT * FROM restaurant_settings WHERE restaurant_id = ?`).get(restId) as Record<string, unknown>;
    db.prepare(`
      UPDATE restaurant_settings SET
        currency_code = ?, currency_symbol = ?, tax_rate_percent = ?, service_charge_percent = ?,
        gstin = ?, accepting_orders = ?, auto_confirm_orders = ?, allow_cash_payments = ?,
        allow_online_payments = ?, razorpay_enabled = ?, razorpay_key_id = ?, menu_theme_accent = ?, updated_at = ?
      WHERE restaurant_id = ?
    `).run(
      sqlVal(d.currencyCode ?? setRow.currency_code),
      sqlVal(d.currencySymbol ?? setRow.currency_symbol),
      sqlVal(d.taxRatePercent !== undefined ? d.taxRatePercent : setRow.tax_rate_percent),
      sqlVal(d.serviceChargePercent !== undefined ? d.serviceChargePercent : setRow.service_charge_percent),
      sqlVal(d.gstin !== undefined ? d.gstin : setRow.gstin),
      sqlVal(d.acceptingOrders !== undefined ? (d.acceptingOrders ? 1 : 0) : setRow.accepting_orders),
      sqlVal(d.autoConfirmOrders !== undefined ? (d.autoConfirmOrders ? 1 : 0) : setRow.auto_confirm_orders),
      sqlVal(d.allowCashPayments !== undefined ? (d.allowCashPayments ? 1 : 0) : setRow.allow_cash_payments),
      sqlVal(d.allowOnlinePayments !== undefined ? (d.allowOnlinePayments ? 1 : 0) : setRow.allow_online_payments),
      sqlVal(d.razorpayEnabled !== undefined ? (d.razorpayEnabled ? 1 : 0) : setRow.razorpay_enabled),
      sqlVal(d.razorpayKeyId !== undefined ? d.razorpayKeyId : setRow.razorpay_key_id),
      sqlVal(d.menuThemeAccent ?? setRow.menu_theme_accent),
      now,
      restId
    );

    const updatedRest = db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(restId) as Record<string, unknown>;
    const updatedSet = db.prepare(`SELECT * FROM restaurant_settings WHERE restaurant_id = ?`).get(restId) as Record<string, unknown>;
    broadcast(`restaurant:${restId}`, 'menu:updated', { type: 'settings_updated' });
    res.json({ restaurant: mapRestaurant(updatedRest), settings: mapSettings(updatedSet) });
  });

  router.post('/dashboard/staff', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const parsed = staffInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid staff details' });
      return;
    }
    const restId = req.auth!.restaurantId!;
    const { fullName, email, role, password } = parsed.data;
    const normalized = email.toLowerCase();
    const now = new Date().toISOString();

    let userRow = db.prepare(`SELECT id FROM users WHERE email = ?`).get(normalized) as { id: string } | undefined;
    if (!userRow) {
      const userId = uid();
      const hash = bcrypt.hashSync(password, 10);
      db.prepare(`
        INSERT INTO users (id, email, full_name, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, normalized, fullName, hash, now, now);
      userRow = { id: userId };
    }

    const existsMember = db
      .prepare(`SELECT id FROM restaurant_members WHERE restaurant_id = ? AND user_id = ?`)
      .get(restId, userRow.id);
    if (existsMember) {
      res.status(409).json({ error: 'This user is already a member of your restaurant' });
      return;
    }

    const memberId = uid();
    db.prepare(`
      INSERT INTO restaurant_members (id, restaurant_id, user_id, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(memberId, restId, userRow.id, role, now, now);

    res.status(201).json({
      member: {
        id: memberId,
        restaurantId: restId,
        userId: userRow.id,
        email: normalized,
        fullName,
        role,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  router.delete('/dashboard/staff/:id', requireRestaurantAccess, (req: AuthenticatedRequest, res) => {
    const restId = req.auth!.restaurantId!;
    const target = db
      .prepare(`SELECT role FROM restaurant_members WHERE id = ? AND restaurant_id = ?`)
      .get(req.params.id, restId) as { role: string } | undefined;
    if (!target) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }
    if (target.role === 'OWNER') {
      res.status(400).json({ error: 'Cannot remove primary restaurant owner' });
      return;
    }
    db.prepare(`DELETE FROM restaurant_members WHERE id = ? AND restaurant_id = ?`).run(req.params.id, restId);
    res.json({ ok: true });
  });

  // ================= PUBLIC CUSTOMER QR MENU =================
  router.get('/public/menu/:slug/:tableNumber', (req, res) => {
    const slug = String(req.params.slug);
    const tableNum = Number(req.params.tableNumber);

    const restRow = db.prepare(`SELECT * FROM restaurants WHERE slug = ?`).get(slug) as
      | Record<string, unknown>
      | undefined;
    if (!restRow) {
      res.status(404).json({ error: 'Restaurant menu not found' });
      return;
    }

    const restId = String(restRow.id);
    const settingsRow = db
      .prepare(`SELECT * FROM restaurant_settings WHERE restaurant_id = ?`)
      .get(restId) as Record<string, unknown>;

    const tableRow = db
      .prepare(`SELECT * FROM tables WHERE restaurant_id = ? AND table_number = ?`)
      .get(restId, tableNum) as Record<string, unknown> | undefined;

    if (tableRow) {
      db.prepare(`UPDATE qr_codes SET scan_count = scan_count + 1 WHERE table_id = ?`).run(String(tableRow.id));
    }

    const categories = (
      db.prepare(`SELECT * FROM categories WHERE restaurant_id = ? AND is_active = 1 ORDER BY sort_order ASC`).all(restId) as Array<Record<string, unknown>>
    ).map((c) => ({
      id: String(c.id),
      restaurantId: restId,
      name: String(c.name),
      description: c.description ? String(c.description) : null,
      sortOrder: Number(c.sort_order),
      isActive: true,
      createdAt: String(c.created_at),
      updatedAt: String(c.updated_at),
    }));

    const menuItems = hydrateMenuItems(restId);

    const nowIso = new Date().toISOString();
    const offers = (
      db
        .prepare(`
          SELECT * FROM offers
          WHERE restaurant_id = ? AND is_active = 1 AND starts_at <= ? AND ends_at >= ?
          ORDER BY created_at DESC
        `)
        .all(restId, nowIso, nowIso) as Array<Record<string, unknown>>
    ).map((o) => ({
      id: String(o.id),
      restaurantId: restId,
      title: String(o.title),
      code: String(o.code),
      description: String(o.description),
      offerType: String(o.offer_type),
      discountValue: Number(o.discount_value),
      minOrderAmount: Number(o.min_order_amount),
      startsAt: String(o.starts_at),
      endsAt: String(o.ends_at),
      isActive: true,
      createdAt: String(o.created_at),
      updatedAt: String(o.updated_at),
    }));

    const reviews = (
      db.prepare(`SELECT * FROM reviews WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 20`).all(restId) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: String(r.id),
      restaurantId: restId,
      orderId: r.order_id ? String(r.order_id) : null,
      orderNumber: r.order_number ? String(r.order_number) : null,
      customerName: String(r.customer_name),
      rating: Number(r.rating),
      foodRating: r.food_rating !== null ? Number(r.food_rating) : null,
      comment: String(r.comment),
      tableNumber: r.table_number !== null ? Number(r.table_number) : null,
      createdAt: String(r.created_at),
    }));

    res.json({
      restaurant: mapRestaurant(restRow),
      settings: mapSettings(settingsRow),
      table: tableRow
        ? {
            id: String(tableRow.id),
            tableNumber: Number(tableRow.table_number),
            label: String(tableRow.label),
            zone: String(tableRow.zone),
            status: String(tableRow.status),
          }
        : {
            id: null,
            tableNumber: Number.isFinite(tableNum) && tableNum > 0 ? tableNum : 1,
            label: `Table ${String(Number.isFinite(tableNum) && tableNum > 0 ? tableNum : 1).padStart(2, '0')}`,
            zone: 'Main Dining',
            status: 'AVAILABLE',
          },
      categories,
      menuItems,
      offers,
      reviews,
      razorpayStatus: getRazorpayConfigStatus(),
    });
  });

  // Place Order (Server-authoritative pricing & tax verification)
  router.post('/public/menu/:slug/orders', rateLimit(30, 60_000), (req, res) => {
    const parsed = placeOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid order' });
      return;
    }

    const restRow = db
      .prepare(`SELECT * FROM restaurants WHERE slug = ?`)
      .get(String(req.params.slug)) as Record<string, unknown> | undefined;
    if (!restRow) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    const restId = String(restRow.id);
    const settingsRow = db
      .prepare(`SELECT * FROM restaurant_settings WHERE restaurant_id = ?`)
      .get(restId) as Record<string, unknown>;
    const settings = mapSettings(settingsRow);

    if (!Boolean(restRow.is_open) || !settings.acceptingOrders) {
      res.status(400).json({ error: 'Restaurant is currently not accepting new orders' });
      return;
    }

    const d = parsed.data;
    const allDishes = hydrateMenuItems(restId);
    const dishMap = new Map(allDishes.map((dish) => [dish.id, dish]));

    const computedItems: Array<{
      menuItemId: string;
      name: string;
      unitPrice: number;
      variantId: string | null;
      variantName: string | null;
      quantity: number;
      specialInstructions: string | null;
      lineTotal: number;
      addons: Array<{ addonId: string; name: string; price: number }>;
    }> = [];

    const cartShapeForDiscount: CartItem[] = [];

    for (const reqItem of d.items) {
      const dish = dishMap.get(reqItem.menuItemId);
      if (!dish || !dish.isAvailable) {
        res.status(400).json({ error: `One of the selected items is no longer available` });
        return;
      }

      const variant = reqItem.variantId
        ? dish.variants.find((v) => v.id === reqItem.variantId) ?? null
        : dish.variants.find((v) => v.isDefault) ?? null;

      const selectedAddons = reqItem.addonIds
        .map((aid) => dish.addons.find((a) => a.id === aid && a.isAvailable))
        .filter((a): a is NonNullable<typeof a> => Boolean(a));

      const baseUnit = dish.price + (variant?.priceDelta ?? 0);
      const addonsUnit = selectedAddons.reduce((s, a) => s + a.price, 0);
      const unitWithAddons = roundMoney(baseUnit + addonsUnit);
      const lineTotal = roundMoney(unitWithAddons * reqItem.quantity);

      computedItems.push({
        menuItemId: dish.id,
        name: dish.name,
        unitPrice: baseUnit,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        quantity: reqItem.quantity,
        specialInstructions: reqItem.specialInstructions || null,
        lineTotal,
        addons: selectedAddons.map((a) => ({ addonId: a.id, name: a.name, price: a.price })),
      });

      cartShapeForDiscount.push({
        cartKey: dish.id,
        menuItem: dish,
        variant,
        addons: selectedAddons,
        quantity: reqItem.quantity,
        specialInstructions: reqItem.specialInstructions || '',
      });
    }

    const subtotal = roundMoney(computedItems.reduce((s, it) => s + it.lineTotal, 0));

    let appliedOfferCode: string | null = null;
    let discountAmount = 0;
    if (d.offerCode) {
      const offerRow = db
        .prepare(`SELECT * FROM offers WHERE restaurant_id = ? AND code = ? AND is_active = 1`)
        .get(restId, d.offerCode.toUpperCase()) as Record<string, unknown> | undefined;
      if (offerRow) {
        const offerObj = {
          id: String(offerRow.id),
          restaurantId: restId,
          title: String(offerRow.title),
          code: String(offerRow.code),
          description: String(offerRow.description),
          offerType: String(offerRow.offer_type) as 'PERCENTAGE' | 'FLAT' | 'BOGO',
          discountValue: Number(offerRow.discount_value),
          minOrderAmount: Number(offerRow.min_order_amount),
          startsAt: String(offerRow.starts_at),
          endsAt: String(offerRow.ends_at),
          isActive: Boolean(offerRow.is_active),
          createdAt: String(offerRow.created_at),
          updatedAt: String(offerRow.updated_at),
        };
        discountAmount = calculateOfferDiscount(offerObj, cartShapeForDiscount, subtotal);
        if (discountAmount > 0) appliedOfferCode = offerObj.code;
      }
    }

    const taxableBase = Math.max(0, roundMoney(subtotal - discountAmount));
    const taxAmount = roundMoney((taxableBase * settings.taxRatePercent) / 100);
    const serviceChargeAmount = roundMoney((taxableBase * settings.serviceChargePercent) / 100);
    const totalAmount = roundMoney(taxableBase + taxAmount + serviceChargeAmount);

    const now = new Date().toISOString();
    const orderId = uid();
    const countRow = db
      .prepare(`SELECT COUNT(*) as c FROM orders WHERE restaurant_id = ?`)
      .get(restId) as { c: number };
    const orderNumber = `MF-${1040 + countRow.c + 1}`;

    const tableRow = db
      .prepare(`SELECT id FROM tables WHERE restaurant_id = ? AND table_number = ?`)
      .get(restId, d.tableNumber) as { id: string } | undefined;

    if (tableRow) {
      db.prepare(`UPDATE tables SET status = 'OCCUPIED', updated_at = ? WHERE id = ?`).run(now, tableRow.id);
    }

    // Upsert customer record
    let customerId: string | null = null;
    if (d.customerPhone) {
      const cust = db
        .prepare(`SELECT id FROM customers WHERE restaurant_id = ? AND phone = ?`)
        .get(restId, d.customerPhone) as { id: string } | undefined;
      if (cust) {
        customerId = cust.id;
        db.prepare(`
          UPDATE customers SET name = ?, total_orders = total_orders + 1, total_spent = total_spent + ?, last_visit_at = ?
          WHERE id = ?
        `).run(d.customerName, totalAmount, now, customerId);
      }
    }
    if (!customerId) {
      customerId = uid();
      db.prepare(`
        INSERT INTO customers (id, restaurant_id, name, phone, total_orders, total_spent, last_visit_at, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(customerId, restId, d.customerName, d.customerPhone || null, totalAmount, now, now);
    }

    const initialStatus: OrderStatus = settings.autoConfirmOrders ? 'CONFIRMED' : 'NEW';

    db.prepare(`
      INSERT INTO orders (
        id, restaurant_id, order_number, table_id, table_number, customer_id, customer_name, customer_phone,
        session_id, status, payment_status, payment_method, subtotal, discount_amount, tax_amount,
        service_charge_amount, total_amount, applied_offer_code, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      restId,
      orderNumber,
      tableRow?.id ?? null,
      d.tableNumber,
      customerId,
      d.customerName,
      d.customerPhone || null,
      d.sessionId || null,
      initialStatus,
      d.paymentMethod,
      subtotal,
      discountAmount,
      taxAmount,
      serviceChargeAmount,
      totalAmount,
      appliedOfferCode,
      d.notes || null,
      now,
      now
    );

    const insOrderItem = db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, name, unit_price, variant_id, variant_name, quantity, special_instructions, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insOrderAddon = db.prepare(`
      INSERT INTO order_item_addons (id, order_item_id, addon_id, name, price)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of computedItems) {
      const oiId = uid();
      insOrderItem.run(
        oiId,
        orderId,
        item.menuItemId,
        item.name,
        item.unitPrice,
        item.variantId,
        item.variantName,
        item.quantity,
        item.specialInstructions,
        item.lineTotal
      );
      for (const a of item.addons) {
        insOrderAddon.run(uid(), oiId, a.addonId, a.name, a.price);
      }
    }

    db.prepare(`
      INSERT INTO payments (id, restaurant_id, order_id, order_number, amount, currency, method, status, provider, test_mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
    `).run(
      uid(),
      restId,
      orderId,
      orderNumber,
      totalAmount,
      settings.currencyCode,
      d.paymentMethod,
      d.paymentMethod === 'CASH' ? 'CASH' : 'RAZORPAY',
      getRazorpayConfigStatus().configured ? 0 : 1,
      now,
      now
    );

    db.prepare(`
      INSERT INTO invoices (id, restaurant_id, order_id, invoice_number, subtotal, discount_amount, tax_amount, service_charge_amount, total_amount, payment_method, payment_status, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(
      uid(),
      restId,
      orderId,
      `INV-${orderNumber}`,
      subtotal,
      discountAmount,
      taxAmount,
      serviceChargeAmount,
      totalAmount,
      d.paymentMethod,
      now
    );

    db.prepare(`
      INSERT INTO analytics_events (id, restaurant_id, event_type, table_number, metadata, created_at)
      VALUES (?, ?, 'order_placed', ?, ?, ?)
    `).run(uid(), restId, d.tableNumber, JSON.stringify({ orderId, totalAmount }), now);

    const createdOrder = hydrateOrder(
      db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as Record<string, unknown>
    );

    broadcast(`restaurant:${restId}`, 'order:created', createdOrder);
    res.status(201).json({ order: createdOrder });
  });

  // Public Order Status Lookup (for live tracker)
  router.get('/public/orders/:orderId', (req, res) => {
    const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.orderId) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const invoice = db.prepare(`SELECT * FROM invoices WHERE order_id = ?`).get(req.params.orderId) as
      | Record<string, unknown>
      | undefined;
    const restaurant = db
      .prepare(`SELECT name, slug, address, city, phone FROM restaurants WHERE id = ?`)
      .get(String(row.restaurant_id)) as Record<string, unknown>;
    res.json({
      order: hydrateOrder(row),
      restaurant,
      invoice: invoice
        ? {
            id: String(invoice.id),
            invoiceNumber: String(invoice.invoice_number),
            issuedAt: String(invoice.issued_at),
          }
        : null,
    });
  });

  // Public Service Request
  router.post('/public/menu/:slug/service-requests', rateLimit(20, 60_000), (req, res) => {
    const parsed = serviceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid service request' });
      return;
    }
    const restRow = db
      .prepare(`SELECT id FROM restaurants WHERE slug = ?`)
      .get(String(req.params.slug)) as { id: string } | undefined;
    if (!restRow) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }
    const d = parsed.data;
    const now = new Date().toISOString();
    const tableRow = db
      .prepare(`SELECT id FROM tables WHERE restaurant_id = ? AND table_number = ?`)
      .get(restRow.id, d.tableNumber) as { id: string } | undefined;

    if (d.requestType === 'REQUEST_BILL' && tableRow) {
      db.prepare(`UPDATE tables SET status = 'BILL_REQUESTED', updated_at = ? WHERE id = ?`).run(now, tableRow.id);
    }

    const srId = uid();
    db.prepare(`
      INSERT INTO service_requests (id, restaurant_id, table_id, table_number, request_type, note, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(srId, restRow.id, tableRow?.id ?? null, d.tableNumber, d.requestType, d.note || null, now, now);

    const sr = {
      id: srId,
      restaurantId: restRow.id,
      tableId: tableRow?.id ?? null,
      tableNumber: d.tableNumber,
      requestType: d.requestType,
      note: d.note || null,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    broadcast(`restaurant:${restRow.id}`, 'service_request:created', sr);
    res.status(201).json({ serviceRequest: sr });
  });

  // Public Review Submission
  router.post('/public/menu/:slug/reviews', rateLimit(15, 60_000), (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid review' });
      return;
    }
    const restRow = db
      .prepare(`SELECT id FROM restaurants WHERE slug = ?`)
      .get(String(req.params.slug)) as { id: string } | undefined;
    if (!restRow) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }
    const d = parsed.data;
    const now = new Date().toISOString();
    let orderNumber: string | null = null;
    if (d.orderId) {
      const o = db
        .prepare(`SELECT order_number FROM orders WHERE id = ? AND restaurant_id = ?`)
        .get(d.orderId, restRow.id) as { order_number: string } | undefined;
      orderNumber = o?.order_number ?? null;
    }
    const revId = uid();
    db.prepare(`
      INSERT INTO reviews (id, restaurant_id, order_id, order_number, customer_name, rating, food_rating, comment, table_number, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      revId,
      restRow.id,
      d.orderId || null,
      orderNumber,
      d.customerName,
      d.rating,
      d.foodRating ?? d.rating,
      d.comment,
      d.tableNumber ?? null,
      now
    );

    const review = {
      id: revId,
      restaurantId: restRow.id,
      orderId: d.orderId || null,
      orderNumber,
      customerName: d.customerName,
      rating: d.rating,
      foodRating: d.foodRating ?? d.rating,
      comment: d.comment,
      tableNumber: d.tableNumber ?? null,
      createdAt: now,
    };
    broadcast(`restaurant:${restRow.id}`, 'review:created', review);
    res.status(201).json({ review });
  });

  // ================= PAYMENTS (Razorpay-ready + Test Mode) =================
  router.post('/public/payments/create-order', rateLimit(20, 60_000), async (req, res) => {
    try {
      const orderId = String(req.body?.orderId || '');
      const method = String(req.body?.method || 'UPI');
      const orderRow = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as
        | Record<string, unknown>
        | undefined;
      if (!orderRow) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      const gateway = await createGatewayOrder({
        amountInRupees: Number(orderRow.total_amount),
        currency: 'INR',
        receipt: String(orderRow.order_number),
      });

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE payments
        SET razorpay_order_id = ?, method = ?, test_mode = ?, updated_at = ?
        WHERE order_id = ?
      `).run(gateway.razorpayOrderId, method, gateway.testMode ? 1 : 0, now, orderId);

      res.json({
        orderId,
        orderNumber: String(orderRow.order_number),
        razorpayOrderId: gateway.razorpayOrderId,
        amountPaise: gateway.amountPaise,
        currency: gateway.currency,
        testMode: gateway.testMode,
        keyId: gateway.keyId,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Payment setup failed' });
    }
  });

  router.post('/public/payments/verify', (req, res) => {
    const orderId = String(req.body?.orderId || '');
    const razorpayOrderId = String(req.body?.razorpayOrderId || '');
    const razorpayPaymentId = String(req.body?.razorpayPaymentId || '');
    const razorpaySignature = String(req.body?.razorpaySignature || '');

    const valid = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    if (!valid) {
      res.status(400).json({ error: 'Payment signature verification failed' });
      return;
    }

    const orderRow = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as
      | Record<string, unknown>
      | undefined;
    if (!orderRow) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`UPDATE orders SET payment_status = 'PAID', updated_at = ? WHERE id = ?`).run(now, orderId);
    db.prepare(`
      UPDATE payments SET status = 'PAID', razorpay_payment_id = ?, updated_at = ?
      WHERE order_id = ?
    `).run(razorpayPaymentId, now, orderId);
    db.prepare(`UPDATE invoices SET payment_status = 'PAID' WHERE order_id = ?`).run(orderId);

    const updated = hydrateOrder(db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as Record<string, unknown>);
    const restId = String(orderRow.restaurant_id);
    broadcast(`restaurant:${restId}`, 'order:updated', updated);
    broadcast(`order:${orderId}`, 'order:updated', updated);

    res.json({ verified: true, order: updated });
  });

  router.post('/webhooks/razorpay', (req, res) => {
    const signature = req.header('x-razorpay-signature');
    const rawBody = JSON.stringify(req.body);
    if (!verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }
    const event = String(req.body?.event || '');
    if (event === 'payment.captured') {
      const entity = req.body?.payload?.payment?.entity;
      if (entity?.order_id) {
        const now = new Date().toISOString();
        const payRow = db
          .prepare(`SELECT order_id, restaurant_id FROM payments WHERE razorpay_order_id = ?`)
          .get(String(entity.order_id)) as { order_id: string; restaurant_id: string } | undefined;
        if (payRow) {
          db.prepare(`UPDATE payments SET status = 'PAID', razorpay_payment_id = ?, updated_at = ? WHERE order_id = ?`).run(
            String(entity.id),
            now,
            payRow.order_id
          );
          db.prepare(`UPDATE orders SET payment_status = 'PAID', updated_at = ? WHERE id = ?`).run(now, payRow.order_id);
          db.prepare(`UPDATE invoices SET payment_status = 'PAID' WHERE order_id = ?`).run(payRow.order_id);
          const updated = hydrateOrder(
            db.prepare(`SELECT * FROM orders WHERE id = ?`).get(payRow.order_id) as Record<string, unknown>
          );
          broadcast(`restaurant:${payRow.restaurant_id}`, 'order:updated', updated);
          broadcast(`order:${payRow.order_id}`, 'order:updated', updated);
        }
      }
    }
    res.json({ received: true });
  });

  return router;
}
