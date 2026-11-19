# MenuFlow

**"Turn every table into a digital ordering experience."**

MenuFlow is a production-ready restaurant operating platform built for Indian hospitality venues. It pairs a high-speed mobile-first **Customer QR Menu Experience** with a real-time **Restaurant Admin Dashboard**.

---

## Key Capabilities

### Customer QR Menu (`/menu/:restaurantSlug/:tableNumber`)
- Zero-login anonymous guest sessions
- Category navigation, live dish search, Veg-only filter, and dietary indicators
- Dish detail sheets with portion variants, paid add-ons, and kitchen instructions
- Animated bottom-sheet cart with promo codes (`VERDE10`, `AGAVE150`, `TACOBOGO`), GST & service charge breakdown
- Live WebSocket order status tracker (`NEW` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `SERVED` -> `COMPLETED`)
- Instant Service Requests (`Call Staff`, `Request Water`, `Request Bill`, `Need Assistance`)
- Razorpay-ready payment verification (UPI / Cards / Netbanking / Cash + Test Mode)
- Printable GST Tax Invoices & post-order star reviews

### Restaurant Admin Dashboard (`/dashboard`)
- **Overview**: KPI strip, date range filters (`Today`, `7 days`, `30 days`, `Custom`), 7-day revenue pulse, popular dishes, recent orders, table activity
- **Orders Control Center**: Real-time WebSocket ticket stream, optional audio alerts, status transitions, and live service request queue
- **Menu & Categories**: Full CRUD, photo upload, variants/add-ons builder, drag-and-drop reordering, live sold-out toggles
- **Tables & QR Code Studio**: Floor zones, occupancy states, scannable QR generation, high-DPI PNG download, print sheet, link copy, and token regeneration
- **Offers, Customers, Reviews, Analytics, Payments & Settings**: Full RBAC staff management, GST rates, and Razorpay configuration

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   The application runs immediately out of the box using Node 22 built-in SQLite (`./data/menuflow.db`) seeded with the flagship **Casa Verde** restaurant (`18` dishes, `10` tables, sample orders, offers, and reviews).

3. **Start the full-stack server (Express + WebSockets + Vite on port 3000)**:
   ```bash
   npm run dev
   ```

4. **Demo Credentials**:
   - **Customer QR Menu**: `/menu/casa-verde/1`
   - **Admin Email**: `owner@casaverde.in`
   - **Admin Password**: `CasaVerde2026!`

---

## Supabase PostgreSQL & Production Setup

Complete PostgreSQL schema migrations, Row Level Security (RLS) policies, and seed files are located in `supabase/`:
- `supabase/migrations/001_initial_schema.sql` (22 relational tables with UUID PKs, foreign keys, indexes, and `updated_at` triggers)
- `supabase/migrations/002_rls_policies.sql` (strict restaurant-scoped RLS policies)
- `supabase/seed.sql`

To enable Razorpay live settlements, set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in `.env`. Without keys, Razorpay routes operate in clearly marked Test Mode.

---

## Scripts

- `npm run dev` — Start development server on port 3000
- `npm run test` — Run pure business logic unit tests (`node:test`)
- `npm run lint` — TypeScript strict check (`tsc --noEmit`)
- `npm run build` — Build frontend bundle (`dist/`) and server bundle (`server.js`)
- `npm run start` — Run production server

---

## GitHub Push Instructions

If pushing to a new GitHub remote:
```bash
git init
git add .
git commit -m "feat: initial MenuFlow platform"
git remote add origin https://github.com/<your-org>/menuflow.git
git push -u origin main
```


## Deployment notes
- `api/index.ts` is the Vercel HTTP entry point and exposes the complete generated Express API under `/api`.
- `server.ts` remains the local Node/WebSocket entry point used by the original project.
- Vercel does not provide a persistent WebSocket process; live WebSocket updates therefore remain a local/server deployment capability until the realtime layer is migrated to Supabase Realtime.
- The current generated database layer uses Node SQLite for the original demo/local experience. For durable multi-restaurant production data, point the generated API/data layer at the Supabase schema included in `supabase/migrations`.
