import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'menuflow.db');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      tagline TEXT,
      cuisine_type TEXT NOT NULL,
      logo_url TEXT,
      cover_url TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'Bengaluru',
      phone TEXT NOT NULL,
      email TEXT,
      opening_hours TEXT NOT NULL DEFAULT '12:00 PM - 11:30 PM',
      is_open INTEGER NOT NULL DEFAULT 1,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurant_members (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('OWNER','MANAGER','KITCHEN','STAFF')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(restaurant_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS restaurant_settings (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
      currency_code TEXT NOT NULL DEFAULT 'INR',
      currency_symbol TEXT NOT NULL DEFAULT '₹',
      tax_rate_percent REAL NOT NULL DEFAULT 5.0,
      service_charge_percent REAL NOT NULL DEFAULT 0.0,
      gstin TEXT,
      accepting_orders INTEGER NOT NULL DEFAULT 1,
      auto_confirm_orders INTEGER NOT NULL DEFAULT 0,
      allow_cash_payments INTEGER NOT NULL DEFAULT 1,
      allow_online_payments INTEGER NOT NULL DEFAULT 1,
      razorpay_enabled INTEGER NOT NULL DEFAULT 0,
      razorpay_key_id TEXT,
      menu_theme_accent TEXT NOT NULL DEFAULT '#2DD4BF',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL,
      image_url TEXT,
      is_veg INTEGER NOT NULL DEFAULT 1,
      is_spicy INTEGER NOT NULL DEFAULT 0,
      is_bestseller INTEGER NOT NULL DEFAULT 0,
      is_available INTEGER NOT NULL DEFAULT 1,
      prep_time_mins INTEGER NOT NULL DEFAULT 15,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_item_variants (
      id TEXT PRIMARY KEY,
      menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_delta REAL NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_item_addons (
      id TEXT PRIMARY KEY,
      menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      is_veg INTEGER NOT NULL DEFAULT 1,
      is_available INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      table_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4,
      zone TEXT NOT NULL DEFAULT 'Main Dining',
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','OCCUPIED','ORDERING','BILL_REQUESTED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(restaurant_id, table_number)
    );

    CREATE TABLE IF NOT EXISTS qr_codes (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      table_id TEXT NOT NULL UNIQUE REFERENCES tables(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      target_path TEXT NOT NULL,
      scan_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      last_visit_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_sessions (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      table_id TEXT REFERENCES tables(id) ON DELETE SET NULL,
      session_token TEXT NOT NULL UNIQUE,
      guest_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      order_number TEXT NOT NULL,
      table_id TEXT REFERENCES tables(id) ON DELETE SET NULL,
      table_number INTEGER NOT NULL,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL DEFAULT 'Guest',
      customer_phone TEXT,
      session_id TEXT,
      status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','CONFIRMED','PREPARING','READY','SERVED','COMPLETED','CANCELLED')),
      payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING','PAID','FAILED','REFUNDED')),
      payment_method TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('UPI','CARD','NETBANKING','CASH')),
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      service_charge_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      applied_offer_code TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id TEXT REFERENCES menu_items(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      variant_id TEXT,
      variant_name TEXT,
      quantity INTEGER NOT NULL,
      special_instructions TEXT,
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_item_addons (
      id TEXT PRIMARY KEY,
      order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
      addon_id TEXT,
      name TEXT NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
      order_number TEXT,
      customer_name TEXT NOT NULL DEFAULT 'Guest',
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      table_number INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      offer_type TEXT NOT NULL CHECK (offer_type IN ('PERCENTAGE','FLAT','BOGO')),
      discount_value REAL NOT NULL DEFAULT 0,
      min_order_amount REAL NOT NULL DEFAULT 0,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      order_number TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      method TEXT NOT NULL CHECK (method IN ('UPI','CARD','NETBANKING','CASH')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','FAILED','REFUNDED')),
      provider TEXT NOT NULL DEFAULT 'RAZORPAY' CHECK (provider IN ('RAZORPAY','CASH')),
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      test_mode INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL UNIQUE,
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      service_charge_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      issued_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      table_id TEXT REFERENCES tables(id) ON DELETE SET NULL,
      table_number INTEGER NOT NULL,
      request_type TEXT NOT NULL CHECK (request_type IN ('CALL_STAFF','REQUEST_WATER','REQUEST_BILL','NEED_ASSISTANCE')),
      note TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACKNOWLEDGED','COMPLETED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      table_number INTEGER,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_rest_created ON orders(restaurant_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_menu_items_rest ON menu_items(restaurant_id, category_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_categories_rest ON categories(restaurant_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_tables_rest ON tables(restaurant_id, table_number);
  `);

  seedIfNeeded();
}

function uid(): string {
  return crypto.randomUUID();
}

function isoOffset(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

function seedIfNeeded(): void {
  const existing = db.prepare(`SELECT id FROM restaurants WHERE slug = ?`).get('casa-verde') as { id: string } | undefined;
  if (existing) return;

  const now = new Date().toISOString();
  const ownerId = '11111111-1111-4111-8111-111111111101';
  const chefId = '11111111-1111-4111-8111-111111111102';
  const staffId = '11111111-1111-4111-8111-111111111103';
  const restId = '22222222-2222-4222-8222-222222222201';

  const passwordHash = bcrypt.hashSync('CasaVerde2026!', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, full_name, phone, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run(ownerId, 'owner@casaverde.in', 'Aarav Mehta', '+91 98450 11223', passwordHash, now, now);
  insertUser.run(chefId, 'chef@casaverde.in', 'Elena Morales', '+91 98450 44556', passwordHash, now, now);
  insertUser.run(staffId, 'floor@casaverde.in', 'Rohan Kapoor', '+91 98450 77889', passwordHash, now, now);

  db.prepare(`
    INSERT INTO restaurants (
      id, owner_id, name, slug, tagline, cuisine_type, logo_url, cover_url,
      address, city, phone, email, opening_hours, is_open, onboarding_completed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
  `).run(
    restId,
    ownerId,
    'Casa Verde',
    'casa-verde',
    'Heirloom Masa & Wood-Fired Mexican Kitchen',
    'Mexican / Modern Casual',
    null,
    '/src/assets/images/casaverde_hero_1795070509445.jpg',
    '100 Feet Road, Indiranagar',
    'Bengaluru',
    '+91 80 4123 8890',
    'hola@casaverde.in',
    '12:00 PM - 11:30 PM',
    now,
    now
  );

  const insertMember = db.prepare(`
    INSERT INTO restaurant_members (id, restaurant_id, user_id, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `);
  insertMember.run(uid(), restId, ownerId, 'OWNER', now, now);
  insertMember.run(uid(), restId, chefId, 'KITCHEN', now, now);
  insertMember.run(uid(), restId, staffId, 'MANAGER', now, now);

  db.prepare(`
    INSERT INTO restaurant_settings (
      id, restaurant_id, currency_code, currency_symbol, tax_rate_percent, service_charge_percent,
      gstin, accepting_orders, auto_confirm_orders, allow_cash_payments, allow_online_payments,
      razorpay_enabled, menu_theme_accent, updated_at
    ) VALUES (?, ?, 'INR', '₹', 5.0, 5.0, '29AABCC1234M1Z5', 1, 0, 1, 1, 1, '#2DD4BF', ?)
  `).run(uid(), restId, now);

  // 6 Categories
  const catDefs = [
    { id: 'cat-starters', name: 'Starters', desc: 'Molcajete dips, street corn & crisp small plates', sort: 1 },
    { id: 'cat-tacos', name: 'Tacos', desc: 'Hand-pressed heirloom blue & white corn tortillas', sort: 2 },
    { id: 'cat-bowls', name: 'Bowls', desc: 'Cilantro-lime rice, heirloom beans & wood-grilled proteins', sort: 3 },
    { id: 'cat-mains', name: 'Mains', desc: 'Wood-fired platters, enchiladas & chef signatures', sort: 4 },
    { id: 'cat-drinks', name: 'Drinks', desc: 'Craft agave cocktails, agua frescas & zero-proof refreshers', sort: 5 },
    { id: 'cat-desserts', name: 'Desserts', desc: 'Warm cinnamon churros, tres leches & Oaxacan chocolate', sort: 6 },
  ];
  const insertCat = db.prepare(`
    INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  for (const c of catDefs) {
    insertCat.run(c.id, restId, c.name, c.desc, c.sort, now, now);
  }

  const IMG_GUAC = '/src/assets/images/dish_starter_guac_1795070508560.jpg';
  const IMG_TACOS = '/src/assets/images/dish_tacos_al_pastor_1795070508535.jpg';
  const IMG_BOWL = '/src/assets/images/dish_baja_bowl_1795070508564.jpg';
  const IMG_MAINS = '/src/assets/images/dish_carne_asada_1795070508507.jpg';
  const IMG_DRINK = '/src/assets/images/dish_hibiscus_margarita_1795070508792.jpg';
  const IMG_DESSERT = '/src/assets/images/dish_churros_dessert_1795070508877.jpg';

  interface SeedDish {
    id: string;
    cat: string;
    name: string;
    desc: string;
    price: number;
    img: string;
    veg: boolean;
    spicy: boolean;
    best: boolean;
    prep: number;
    sort: number;
    variants?: Array<{ name: string; delta: number; def?: boolean }>;
    addons?: Array<{ name: string; price: number; veg: boolean }>;
  }

  // 18 realistic dishes for Casa Verde
  const dishes: SeedDish[] = [
    // Starters (3)
    {
      id: 'dish-1',
      cat: 'cat-starters',
      name: 'Molcajete Guacamole & Blue Totopos',
      desc: 'Hand-mashed Hass avocado with charred serrano, toasted pepitas, pomegranate arils, lime & crisp heirloom blue corn chips.',
      price: 360,
      img: IMG_GUAC,
      veg: true,
      spicy: false,
      best: true,
      prep: 8,
      sort: 1,
      variants: [
        { name: 'Regular Share', delta: 0, def: true },
        { name: 'Table Size (Double)', delta: 240 },
      ],
      addons: [
        { name: 'Extra Blue Corn Totopos', price: 90, veg: true },
        { name: 'Crumbled Queso Fresco', price: 70, veg: true },
      ],
    },
    {
      id: 'dish-2',
      cat: 'cat-starters',
      name: 'Charred Elote Street Corn',
      desc: 'Fire-roasted sweet corn brushed with chipotle-lime crema, aged cotija, Tajin dust and fresh cilantro.',
      price: 290,
      img: IMG_GUAC,
      veg: true,
      spicy: true,
      best: false,
      prep: 10,
      sort: 2,
      variants: [
        { name: 'On the Cob (2 pcs)', delta: 0, def: true },
        { name: 'Esquites Cup', delta: 30 },
      ],
      addons: [
        { name: 'Jalapeno Lime Drizzle', price: 45, veg: true },
      ],
    },
    {
      id: 'dish-3',
      cat: 'cat-starters',
      name: 'Queso Fundido con Chorizo',
      desc: 'Bubbling cast-iron Oaxaca & Monterey Jack cheese folded with spiced house chorizo, roasted poblano strips & warm flour tortillas.',
      price: 410,
      img: IMG_MAINS,
      veg: false,
      spicy: true,
      best: false,
      prep: 12,
      sort: 3,
      addons: [
        { name: 'Extra Warm Tortillas (3 pcs)', price: 75, veg: true },
      ],
    },
    // Tacos (4)
    {
      id: 'dish-4',
      cat: 'cat-tacos',
      name: 'Birria Quesatacos & Consomme',
      desc: 'Slow-braised spiced beef brisket folded into crispy melted Oaxaca cheese tortillas with onion, cilantro and rich dipping consomme.',
      price: 490,
      img: IMG_TACOS,
      veg: false,
      spicy: true,
      best: true,
      prep: 16,
      sort: 1,
      variants: [
        { name: '2 Tacos', delta: 0, def: true },
        { name: '3 Tacos', delta: 190 },
      ],
      addons: [
        { name: 'Extra Bone Broth Consomme', price: 80, veg: false },
        { name: 'Salsa Macha', price: 50, veg: true },
      ],
    },
    {
      id: 'dish-5',
      cat: 'cat-tacos',
      name: 'Al Pastor Charred Pineapple Tacos',
      desc: 'Achiote-marinated pork shoulder shaved from the trompo with grilled pineapple, white onion, salsa verde & lime on heirloom corn.',
      price: 440,
      img: IMG_TACOS,
      veg: false,
      spicy: false,
      best: true,
      prep: 14,
      sort: 2,
      variants: [
        { name: '2 Tacos', delta: 0, def: true },
        { name: '3 Tacos', delta: 170 },
      ],
      addons: [
        { name: 'Avocado Crema', price: 60, veg: true },
      ],
    },
    {
      id: 'dish-6',
      cat: 'cat-tacos',
      name: 'Wild Mushroom & Poblano Tacos',
      desc: 'Seared oyster & cremini mushrooms tossed with charred poblano rajas, caramelized shallots, pepita mole and pickled red onion.',
      price: 390,
      img: IMG_TACOS,
      veg: true,
      spicy: false,
      best: false,
      prep: 12,
      sort: 3,
      variants: [
        { name: '2 Tacos', delta: 0, def: true },
        { name: '3 Tacos', delta: 150 },
      ],
      addons: [
        { name: 'Extra Avocado Slices', price: 85, veg: true },
      ],
    },
    {
      id: 'dish-7',
      cat: 'cat-tacos',
      name: 'Baja Crispy Fish Tacos',
      desc: 'Beer-battered Pacific snapper with shaved cabbage slaw, pickled jalapeno, mango pico and smoked chipotle aioli.',
      price: 460,
      img: IMG_TACOS,
      veg: false,
      spicy: true,
      best: false,
      prep: 15,
      sort: 4,
      variants: [
        { name: '2 Tacos', delta: 0, def: true },
        { name: '3 Tacos', delta: 180 },
      ],
    },
    // Bowls (3)
    {
      id: 'dish-8',
      cat: 'cat-bowls',
      name: 'Chipotle Chicken Harvest Bowl',
      desc: 'Wood-grilled chipotle chicken thigh over cilantro-lime rice, slow-simmered black beans, charred corn, avocado & lime crema.',
      price: 470,
      img: IMG_BOWL,
      veg: false,
      spicy: true,
      best: true,
      prep: 15,
      sort: 1,
      variants: [
        { name: 'Standard Bowl', delta: 0, def: true },
        { name: 'High-Protein Double Chicken', delta: 150 },
      ],
      addons: [
        { name: 'Guacamole Scoop', price: 95, veg: true },
        { name: 'Crispy Tortilla Strips', price: 45, veg: true },
      ],
    },
    {
      id: 'dish-9',
      cat: 'cat-bowls',
      name: 'Oaxacan Roasted Squash & Black Bean Bowl',
      desc: 'Adobo-glazed kabocha squash, heirloom black beans, quinoa-rice pilaf, pickled radishes, avocado and toasted pumpkin seeds.',
      price: 420,
      img: IMG_BOWL,
      veg: true,
      spicy: false,
      best: false,
      prep: 14,
      sort: 2,
      addons: [
        { name: 'Grilled Halloumi / Paneer', price: 110, veg: true },
      ],
    },
    {
      id: 'dish-10',
      cat: 'cat-bowls',
      name: 'Garlic Mojo Tiger Prawn Bowl',
      desc: 'Seared tiger prawns glazed in citrus-garlic mojo over herb rice, mango salsa, cucumber ribbons and habanero crema.',
      price: 560,
      img: IMG_BOWL,
      veg: false,
      spicy: true,
      best: false,
      prep: 16,
      sort: 3,
    },
    // Mains (3)
    {
      id: 'dish-11',
      cat: 'cat-mains',
      name: 'Carne Asada Skirt Steak Platter',
      desc: '24-hour citrus-achiote marinated tenderloin/skirt steak seared over charcoal with ancho chimichurri, charred scallions & warm tortillas.',
      price: 780,
      img: IMG_MAINS,
      veg: false,
      spicy: false,
      best: true,
      prep: 22,
      sort: 1,
      variants: [
        { name: '220g Single Cut', delta: 0, def: true },
        { name: '350g Sharing Cut', delta: 340 },
      ],
      addons: [
        { name: 'Truffle Elote Side', price: 160, veg: true },
        { name: 'Bone Marrow Butter', price: 140, veg: false },
      ],
    },
    {
      id: 'dish-12',
      cat: 'cat-mains',
      name: 'Enchiladas Verdes Suizas',
      desc: 'Three rolled corn tortillas stuffed with smoked jackfruit or shredded chicken, baked in tangy roasted tomatillo cream sauce.',
      price: 510,
      img: IMG_MAINS,
      veg: true,
      spicy: false,
      best: false,
      prep: 18,
      sort: 2,
      variants: [
        { name: 'Smoked Jackfruit & Cheese (Veg)', delta: 0, def: true },
        { name: 'Braised Tinga Chicken', delta: 70 },
      ],
    },
    {
      id: 'dish-13',
      cat: 'cat-mains',
      name: 'Wood-Fired Mojo Sea Bass',
      desc: 'Crisp-skin sea bass fillet over saffron-tomato Veracruz sauce, capers, castelvetrano olives and grilled heirloom carrots.',
      price: 740,
      img: IMG_MAINS,
      veg: false,
      spicy: false,
      best: false,
      prep: 20,
      sort: 3,
    },
    // Drinks (3)
    {
      id: 'dish-14',
      cat: 'cat-drinks',
      name: 'Hibiscus Smoked Mezcal Margarita',
      desc: 'Espadin mezcal shaken with house-steeped jamaica hibiscus syrup, fresh key lime and a spiced Tajin chili-salt rim.',
      price: 540,
      img: IMG_DRINK,
      veg: true,
      spicy: false,
      best: true,
      prep: 5,
      sort: 1,
      variants: [
        { name: 'Craft Mezcal Cocktail', delta: 0, def: true },
        { name: 'Zero-Proof Botanical Mocktail', delta: -220 },
      ],
    },
    {
      id: 'dish-15',
      cat: 'cat-drinks',
      name: 'Charred Grapefruit Paloma',
      desc: 'Reposado agave spirit, fresh ruby red grapefruit juice, sea salt and sparkling mineral water over hand-carved ice.',
      price: 490,
      img: IMG_DRINK,
      veg: true,
      spicy: false,
      best: false,
      prep: 5,
      sort: 2,
    },
    {
      id: 'dish-16',
      cat: 'cat-drinks',
      name: 'Toasted Cinnamon Horchata',
      desc: 'Traditional cold-steeped rice & almond milk infused with Ceylon cinnamon bark, Mexican vanilla bean and crushed ice.',
      price: 240,
      img: IMG_DRINK,
      veg: true,
      spicy: false,
      best: false,
      prep: 4,
      sort: 3,
      addons: [
        { name: 'Espresso Shot Float', price: 70, veg: true },
      ],
    },
    // Desserts (2)
    {
      id: 'dish-17',
      cat: 'cat-desserts',
      name: 'Warm Churros & Oaxacan Chocolate',
      desc: 'Crisp fried choux pastry rolled in raw cane cinnamon sugar, served with warm 70% dark chili-spiced chocolate ganache.',
      price: 320,
      img: IMG_DESSERT,
      veg: true,
      spicy: false,
      best: true,
      prep: 10,
      sort: 1,
      addons: [
        { name: 'Salted Cajeta Caramel Dip', price: 65, veg: true },
        { name: 'Vanilla Bean Gelato Scoop', price: 95, veg: true },
      ],
    },
    {
      id: 'dish-18',
      cat: 'cat-desserts',
      name: 'Saffron Tres Leches Cake',
      desc: 'Airy sponge soaked in three-milk cardamom cream, finished with torched meringue and pistachio crumble.',
      price: 350,
      img: IMG_DESSERT,
      veg: true,
      spicy: false,
      best: false,
      prep: 6,
      sort: 2,
    },
  ];

  const insertDish = db.prepare(`
    INSERT INTO menu_items (
      id, restaurant_id, category_id, name, description, price, image_url,
      is_veg, is_spicy, is_bestseller, is_available, prep_time_mins, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `);
  const insertVariant = db.prepare(`
    INSERT INTO menu_item_variants (id, menu_item_id, name, price_delta, is_default, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAddon = db.prepare(`
    INSERT INTO menu_item_addons (id, menu_item_id, name, price, is_veg, is_available)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  for (const d of dishes) {
    insertDish.run(
      d.id,
      restId,
      d.cat,
      d.name,
      d.desc,
      d.price,
      d.img,
      d.veg ? 1 : 0,
      d.spicy ? 1 : 0,
      d.best ? 1 : 0,
      d.prep,
      d.sort,
      now,
      now
    );
    (d.variants ?? []).forEach((v, idx) => {
      insertVariant.run(uid(), d.id, v.name, v.delta, v.def ? 1 : 0, idx + 1);
    });
    (d.addons ?? []).forEach((a) => {
      insertAddon.run(uid(), d.id, a.name, a.price, a.veg ? 1 : 0);
    });
  }

  // 10 Tables + QR codes
  const insertTable = db.prepare(`
    INSERT INTO tables (id, restaurant_id, table_number, label, capacity, zone, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertQr = db.prepare(`
    INSERT INTO qr_codes (id, restaurant_id, table_id, token, target_path, scan_count, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const tableZones = [
    { num: 1, cap: 2, zone: 'Window Bay', status: 'OCCUPIED' },
    { num: 2, cap: 4, zone: 'Main Dining', status: 'ORDERING' },
    { num: 3, cap: 4, zone: 'Main Dining', status: 'AVAILABLE' },
    { num: 4, cap: 6, zone: 'Chef Counter', status: 'OCCUPIED' },
    { num: 5, cap: 2, zone: 'Patio Terrace', status: 'BILL_REQUESTED' },
    { num: 6, cap: 4, zone: 'Patio Terrace', status: 'AVAILABLE' },
    { num: 7, cap: 6, zone: 'Private Alcove', status: 'OCCUPIED' },
    { num: 8, cap: 4, zone: 'Main Dining', status: 'AVAILABLE' },
    { num: 9, cap: 2, zone: 'Bar Lounge', status: 'AVAILABLE' },
    { num: 10, cap: 8, zone: 'Private Alcove', status: 'AVAILABLE' },
  ];

  const tableIdsByNum = new Map<number, string>();
  for (const t of tableZones) {
    const tid = `table-${t.num}`;
    tableIdsByNum.set(t.num, tid);
    const label = `Table ${String(t.num).padStart(2, '0')}`;
    insertTable.run(tid, restId, t.num, label, t.cap, t.zone, t.status, now, now);
    insertQr.run(
      uid(),
      restId,
      tid,
      `cv-t${t.num}-${crypto.randomBytes(4).toString('hex')}`,
      `/menu/casa-verde/${t.num}`,
      18 + t.num * 7,
      now,
      now
    );
  }

  // Customers
  const custs = [
    { id: 'cust-1', name: 'Ananya Rao', phone: '+91 98861 23456', email: 'ananya@example.in', orders: 4, spent: 4820, ago: 18 },
    { id: 'cust-2', name: 'Vikramaditya Nair', phone: '+91 99001 44521', email: 'vikram@example.in', orders: 3, spent: 3690, ago: 35 },
    { id: 'cust-3', name: 'Meera Krishnan', phone: '+91 97410 88210', email: 'meera@example.in', orders: 2, spent: 2240, ago: 90 },
    { id: 'cust-4', name: 'Kabir Sen', phone: '+91 98112 77340', email: 'kabir@example.in', orders: 5, spent: 6410, ago: 180 },
    { id: 'cust-5', name: 'Zoya Merchant', phone: '+91 98204 55901', email: 'zoya@example.in', orders: 2, spent: 1980, ago: 1500 },
  ];
  const insertCust = db.prepare(`
    INSERT INTO customers (id, restaurant_id, name, phone, email, total_orders, total_spent, last_visit_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of custs) {
    insertCust.run(c.id, restId, c.name, c.phone, c.email, c.orders, c.spent, isoOffset(c.ago), isoOffset(5000));
  }

  // Offers
  const futureDate = new Date(Date.now() + 90 * 86400000).toISOString();
  const pastDate = new Date(Date.now() - 10 * 86400000).toISOString();
  const insertOffer = db.prepare(`
    INSERT INTO offers (id, restaurant_id, title, code, description, offer_type, discount_value, min_order_amount, starts_at, ends_at, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  insertOffer.run(uid(), restId, '10% Off Table Orders', 'VERDE10', 'Enjoy 10% off orders above ₹600 placed via QR table menu.', 'PERCENTAGE', 10, 600, pastDate, futureDate, now, now);
  insertOffer.run(uid(), restId, '₹150 Off Agave Night', 'AGAVE150', 'Flat ₹150 instant savings on orders above ₹1,200.', 'FLAT', 150, 1200, pastDate, futureDate, now, now);
  insertOffer.run(uid(), restId, 'Happy Hour Tacos BOGO', 'TACOBOGO', 'Order 2 taco plates and get the lower-priced plate free.', 'BOGO', 100, 400, pastDate, futureDate, now, now);

  // Sample Orders (covering today + past 7 days + all statuses for lively dashboard & analytics)
  const sampleOrders = [
    {
      id: 'ord-1001',
      num: 'MF-1041',
      table: 2,
      custId: 'cust-1',
      custName: 'Ananya Rao',
      custPhone: '+91 98861 23456',
      status: 'NEW',
      payStatus: 'PENDING',
      payMethod: 'UPI',
      ago: 4,
      items: [
        { dishId: 'dish-4', name: 'Birria Quesatacos & Consomme', price: 490, qty: 2 },
        { dishId: 'dish-1', name: 'Molcajete Guacamole & Blue Totopos', price: 360, qty: 1 },
      ],
    },
    {
      id: 'ord-1002',
      num: 'MF-1040',
      table: 4,
      custId: 'cust-2',
      custName: 'Vikramaditya Nair',
      custPhone: '+91 99001 44521',
      status: 'PREPARING',
      payStatus: 'PAID',
      payMethod: 'CARD',
      ago: 14,
      items: [
        { dishId: 'dish-11', name: 'Carne Asada Skirt Steak Platter', price: 780, qty: 1 },
        { dishId: 'dish-14', name: 'Hibiscus Smoked Mezcal Margarita', price: 540, qty: 2 },
      ],
    },
    {
      id: 'ord-1003',
      num: 'MF-1039',
      table: 1,
      custId: 'cust-3',
      custName: 'Meera Krishnan',
      custPhone: '+91 97410 88210',
      status: 'READY',
      payStatus: 'PAID',
      payMethod: 'UPI',
      ago: 22,
      items: [
        { dishId: 'dish-8', name: 'Chipotle Chicken Harvest Bowl', price: 470, qty: 2 },
        { dishId: 'dish-16', name: 'Toasted Cinnamon Horchata', price: 240, qty: 1 },
      ],
    },
    {
      id: 'ord-1004',
      num: 'MF-1038',
      table: 5,
      custId: 'cust-4',
      custName: 'Kabir Sen',
      custPhone: '+91 98112 77340',
      status: 'SERVED',
      payStatus: 'PENDING',
      payMethod: 'CASH',
      ago: 38,
      items: [
        { dishId: 'dish-5', name: 'Al Pastor Charred Pineapple Tacos', price: 440, qty: 2 },
        { dishId: 'dish-17', name: 'Warm Churros & Oaxacan Chocolate', price: 320, qty: 1 },
      ],
    },
    {
      id: 'ord-1005',
      num: 'MF-1037',
      table: 7,
      custId: 'cust-1',
      custName: 'Ananya Rao',
      custPhone: '+91 98861 23456',
      status: 'COMPLETED',
      payStatus: 'PAID',
      payMethod: 'UPI',
      ago: 95,
      items: [
        { dishId: 'dish-9', name: 'Oaxacan Roasted Squash & Black Bean Bowl', price: 420, qty: 2 },
        { dishId: 'dish-14', name: 'Hibiscus Smoked Mezcal Margarita', price: 540, qty: 1 },
      ],
    },
    {
      id: 'ord-1006',
      num: 'MF-1036',
      table: 3,
      custId: 'cust-5',
      custName: 'Zoya Merchant',
      custPhone: '+91 98204 55901',
      status: 'COMPLETED',
      payStatus: 'PAID',
      payMethod: 'NETBANKING',
      ago: 1450, // yesterday
      items: [
        { dishId: 'dish-13', name: 'Wood-Fired Mojo Sea Bass', price: 740, qty: 1 },
        { dishId: 'dish-2', name: 'Charred Elote Street Corn', price: 290, qty: 2 },
      ],
    },
    {
      id: 'ord-1007',
      num: 'MF-1035',
      table: 6,
      custId: 'cust-4',
      custName: 'Kabir Sen',
      custPhone: '+91 98112 77340',
      status: 'COMPLETED',
      payStatus: 'PAID',
      payMethod: 'CARD',
      ago: 2900, // 2 days ago
      items: [
        { dishId: 'dish-4', name: 'Birria Quesatacos & Consomme', price: 490, qty: 3 },
        { dishId: 'dish-17', name: 'Warm Churros & Oaxacan Chocolate', price: 320, qty: 2 },
      ],
    },
    {
      id: 'ord-1008',
      num: 'MF-1034',
      table: 8,
      custId: 'cust-2',
      custName: 'Vikramaditya Nair',
      custPhone: '+91 99001 44521',
      status: 'COMPLETED',
      payStatus: 'PAID',
      payMethod: 'UPI',
      ago: 4300, // 3 days ago
      items: [
        { dishId: 'dish-11', name: 'Carne Asada Skirt Steak Platter', price: 780, qty: 2 },
        { dishId: 'dish-15', name: 'Charred Grapefruit Paloma', price: 490, qty: 2 },
      ],
    },
  ];

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, restaurant_id, order_number, table_id, table_number, customer_id, customer_name, customer_phone,
      status, payment_status, payment_method, subtotal, discount_amount, tax_amount, service_charge_amount,
      total_amount, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `);
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (id, order_id, menu_item_id, name, unit_price, quantity, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO payments (id, restaurant_id, order_id, order_number, amount, currency, method, status, provider, razorpay_order_id, razorpay_payment_id, test_mode, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (id, restaurant_id, order_id, invoice_number, subtotal, discount_amount, tax_amount, service_charge_amount, total_amount, payment_method, payment_status, issued_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `);

  for (const o of sampleOrders) {
    const subtotal = o.items.reduce((s, it) => s + it.price * it.qty, 0);
    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const sc = Math.round(subtotal * 0.05 * 100) / 100;
    const total = Math.round((subtotal + tax + sc) * 100) / 100;
    const created = isoOffset(o.ago);
    insertOrder.run(
      o.id,
      restId,
      o.num,
      tableIdsByNum.get(o.table) ?? null,
      o.table,
      o.custId,
      o.custName,
      o.custPhone,
      o.status,
      o.payStatus,
      o.payMethod,
      subtotal,
      tax,
      sc,
      total,
      o.table === 2 ? 'Extra lime on the side please' : null,
      created,
      created
    );
    for (const it of o.items) {
      insertOrderItem.run(uid(), o.id, it.dishId, it.name, it.price, it.qty, it.price * it.qty);
    }
    insertPayment.run(
      uid(),
      restId,
      o.id,
      o.num,
      total,
      o.payMethod,
      o.payStatus,
      o.payMethod === 'CASH' ? 'CASH' : 'RAZORPAY',
      o.payMethod === 'CASH' ? null : `order_test_${o.id}`,
      o.payStatus === 'PAID' && o.payMethod !== 'CASH' ? `pay_test_${o.id}` : null,
      created,
      created
    );
    insertInvoice.run(
      uid(),
      restId,
      o.id,
      `INV-${o.num}`,
      subtotal,
      tax,
      sc,
      total,
      o.payMethod,
      o.payStatus,
      created
    );
  }

  // Sample Reviews
  const insertReview = db.prepare(`
    INSERT INTO reviews (id, restaurant_id, order_id, order_number, customer_name, rating, food_rating, comment, table_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertReview.run(uid(), restId, 'ord-1005', 'MF-1037', 'Ananya Rao', 5, 5, 'The Birria Quesatacos and hibiscus margarita were phenomenal. Ordering straight from the QR stand saved us waiting for a menu.', 7, isoOffset(80));
  insertReview.run(uid(), restId, 'ord-1006', 'MF-1036', 'Zoya Merchant', 5, 5, 'Wood-fired sea bass had crisp skin and bright Veracruz flavours. Live kitchen tracker was super accurate.', 3, isoOffset(1390));
  insertReview.run(uid(), restId, 'ord-1007', 'MF-1035', 'Kabir Sen', 4, 5, 'Warm churros with Oaxacan spiced chocolate hit the spot. Great atmosphere on the terrace.', 6, isoOffset(2840));
  insertReview.run(uid(), restId, 'ord-1008', 'MF-1034', 'Vikramaditya Nair', 5, 5, 'Carne Asada cooked medium-rare with punchy ancho chimichurri. Seamless UPI checkout right at the table.', 8, isoOffset(4220));

  // Sample Service Requests
  const insertSr = db.prepare(`
    INSERT INTO service_requests (id, restaurant_id, table_id, table_number, request_type, note, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSr.run(uid(), restId, tableIdsByNum.get(5) ?? null, 5, 'REQUEST_BILL', 'Ready for card or UPI bill', 'PENDING', isoOffset(3), isoOffset(3));
  insertSr.run(uid(), restId, tableIdsByNum.get(1) ?? null, 1, 'REQUEST_WATER', '2 chilled sparkling waters', 'ACKNOWLEDGED', isoOffset(11), isoOffset(9));
}
