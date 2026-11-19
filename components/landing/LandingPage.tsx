import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChefHat,
  CreditCard,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { InteractiveQrHero } from './InteractiveQrHero';
import { useAuth } from '../../hooks/useAuth';

const TRUSTED_VENUES = [
  'Casa Verde · Bengaluru',
  'Bombay Brasserie Co. · Mumbai',
  'Kissa Robata · Pune',
  'Saffron & Salt · Delhi NCR',
  'Tamarind Room · Hyderabad',
];

const FAQS = [
  {
    q: 'Do diners need to download an app or create an account?',
    a: 'No. Guests scan the table QR with their native phone camera, browse your menu in under a second, and place orders or pay via UPI without installing anything or signing up.',
  },
  {
    q: 'How do kitchen and floor staff receive incoming orders?',
    a: 'Every placed order streams in real time over WebSockets to your MenuFlow Orders Control Center with optional audio alerts, table numbers, dietary modifiers, and prep timers.',
  },
  {
    q: 'Does MenuFlow support Indian GST invoicing and Razorpay UPI?',
    a: 'Yes. Configure your GSTIN, CGST/SGST tax rate, and optional service charge once. Razorpay integration handles UPI, cards, and netbanking with server-verified webhooks, alongside cash settlement.',
  },
  {
    q: 'Can we edit prices, mark dishes sold out, or reorder categories live?',
    a: 'Yes. Availability toggles, price updates, variants, add-ons, and active offers update the customer QR menu instantly with zero manual QR reprinting.',
  },
];

export function LandingPage() {
  const { user, restaurant } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'growth' | 'multi'>('growth');

  return (
    <div className="min-h-screen bg-[#080A0C] text-[#F5F2EA]">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#080A0C]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0">
            <BrandLogo size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#9BA3AA]">
            <a
              href="#how-it-works"
              className="hover:text-[#F5F2EA] transition-colors whitespace-nowrap shrink-0"
            >
              How it works
            </a>
            <a
              href="#demo"
              className="hover:text-[#F5F2EA] transition-colors whitespace-nowrap shrink-0"
            >
              QR Demo
            </a>
            <a
              href="#platform"
              className="hover:text-[#F5F2EA] transition-colors whitespace-nowrap shrink-0"
            >
              Platform
            </a>
            <a
              href="#pricing"
              className="hover:text-[#F5F2EA] transition-colors whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
            <Link
              to={user ? '/dashboard' : '/login'}
              className="hover:text-[#F5F2EA] transition-colors whitespace-nowrap shrink-0"
            >
              {user ? 'Console' : 'Sign in'}
            </Link>
          </nav>

          <div className="shrink-0">
            <Link
              to={user ? (restaurant ? '/dashboard' : '/onboarding') : '/signup'}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-xs sm:text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 transition-colors whitespace-nowrap shrink-0"
            >
              <span>{user ? (restaurant ? 'Open Dashboard' : 'Finish Setup') : 'Create restaurant'}</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative border-b border-white/[0.08] bg-[#080A0C]">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-24">
            <div className="lg:col-span-7">
              <p className="text-xs font-medium tracking-wide text-[#E7C77A]">
                MenuFlow · Restaurant Operating System
              </p>
              <h1
                className="mt-4 font-display font-bold tracking-tight text-[#F5F2EA]"
                style={{ fontSize: 'clamp(2.35rem, 4.4vw, 3.85rem)', lineHeight: 1.06, textWrap: 'balance' }}
              >
                Your restaurant. One smarter menu.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#9BA3AA] sm:text-lg">
                Digital menus, QR ordering, table management and restaurant analytics — all in one
                simple platform. Turn every table into a digital ordering experience.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2DD4BF] px-6 py-3.5 text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Create your restaurant</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/menu/casa-verde/1"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-[#12171C] px-6 py-3.5 text-sm font-medium text-[#F5F2EA] hover:bg-[#171D23] transition-colors whitespace-nowrap shrink-0"
                >
                  <QrCode className="h-4 w-4 text-[#2DD4BF]" />
                  <span>View demo</span>
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/[0.08] pt-6 max-w-lg">
                <div>
                  <p className="font-mono text-xl font-semibold text-[#F5F2EA] tabular-nums">1.4s</p>
                  <p className="mt-1 text-xs text-[#9BA3AA]">QR menu load time</p>
                </div>
                <div>
                  <p className="font-mono text-xl font-semibold text-[#F5F2EA] tabular-nums">+22%</p>
                  <p className="mt-1 text-xs text-[#9BA3AA]">Average ticket lift</p>
                </div>
                <div>
                  <p className="font-mono text-xl font-semibold text-[#E7C77A] tabular-nums">0%</p>
                  <p className="mt-1 text-xs text-[#9BA3AA]">Commission on dine-in</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <InteractiveQrHero />
            </div>
          </div>
        </section>

        {/* Trusted By Strip */}
        <section className="border-b border-white/[0.08] bg-[#0D1115] py-7">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <span className="text-xs font-medium text-[#9BA3AA]">
              Trusted by independent dining rooms
            </span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-[#F5F2EA]/80">
              {TRUSTED_VENUES.map((venue) => (
                <span key={venue} className="whitespace-nowrap">
                  {venue}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b border-white/[0.08] bg-[#080A0C] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-[#2DD4BF]">How MenuFlow works</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#F5F2EA]">
                From setup to table service in fifteen minutes.
              </h2>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                {
                  step: '01. Build your digital menu',
                  desc: 'Add categories, dish photography, dietary tags, portion variants, and add-ons. Mark items sold out in one tap during busy service.',
                },
                {
                  step: '02. Print table QR stands',
                  desc: 'Generate unique scannable QR codes per table number. Download print-ready high-DPI PNGs or display custom anodized cards.',
                },
                {
                  step: '03. Stream orders & settle bills',
                  desc: 'Orders appear live on your kitchen and floor console. Guests track cooking progress, call staff, pay via UPI, and leave reviews.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-6"
                >
                  <h3 className="font-display text-lg font-semibold text-[#F5F2EA]">{item.step}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#9BA3AA]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Demo Showcase */}
        <section id="demo" className="border-b border-white/[0.08] bg-[#0D1115] py-20">
          <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12171C] lg:col-span-7 min-h-[340px]">
              <ImageWithFallback
                src="/src/assets/images/casaverde_hero_1795070509445.jpg"
                alt="Casa Verde dining table with tacos, craft cocktail, and tabletop QR stand"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080A0C] via-[#080A0C]/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <p className="text-xs font-medium text-[#E7C77A]">
                  Live Flagship Sandbox · Casa Verde, Indiranagar
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-[#F5F2EA]">
                  Experience the full guest & kitchen loop.
                </h3>
                <p className="mt-2 max-w-lg text-sm text-[#9BA3AA]">
                  18 seeded Mexican dishes, 10 tables, real WebSocket order updates, service calls,
                  and GST receipts.
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#12171C] p-6 sm:p-8 lg:col-span-5">
              <div>
                <h3 className="font-display text-xl font-semibold text-[#F5F2EA]">
                  Test both experiences side by side
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9BA3AA]">
                  Open a live customer table menu to add birria tacos and place an order, then
                  manage that exact order in the Restaurant Admin Dashboard.
                </p>

                <div className="mt-6 space-y-3 border-t border-white/[0.08] pt-6 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9BA3AA]">Demo Owner Email</span>
                    <span className="font-mono text-xs text-[#F5F2EA]">owner@casaverde.in</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9BA3AA]">Demo Password</span>
                    <span className="font-mono text-xs text-[#F5F2EA]">CasaVerde2026!</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9BA3AA]">Active Offer Code</span>
                    <span className="font-mono text-xs text-[#2DD4BF]">VERDE10 (10% off)</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Link
                  to="/menu/casa-verde/1"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] px-5 py-3 text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 transition-colors"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Open Customer QR Menu (Table 01)</span>
                </Link>
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-[#171D23] px-5 py-3 text-sm font-medium text-[#F5F2EA] hover:bg-white/[0.08] transition-colors"
                >
                  <span>Sign in to Admin Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Capabilities Asymmetric Bento */}
        <section id="platform" className="border-b border-white/[0.08] bg-[#080A0C] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-[#2DD4BF]">Built for floor speed</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#F5F2EA]">
                Every tool your floor, kitchen, and finance team needs.
              </h2>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-6 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <ChefHat className="h-5 w-5 text-[#2DD4BF]" />
                  <span className="font-mono text-xs text-[#9BA3AA]">Realtime Kitchen Queue</span>
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold text-[#F5F2EA]">
                  Live Order Control Center & Service Requests
                </h3>
                <p className="mt-2 max-w-xl text-sm text-[#9BA3AA]">
                  Move tickets through Received, Confirmed, Preparing, Ready, and Served. Receive
                  instant water, assistance, and bill requests pinned directly to table numbers.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/[0.08] pt-5 sm:grid-cols-4">
                  {['NEW', 'PREPARING', 'READY', 'SERVED'].map((st, idx) => (
                    <div key={st} className="rounded-xl bg-[#0D1115] p-3 border border-white/[0.06]">
                      <p className="font-mono text-[11px] text-[#9BA3AA]">{st}</p>
                      <p className="mt-1 font-mono text-lg font-semibold text-[#F5F2EA] tabular-nums">
                        {[3, 5, 2, 14][idx]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-6">
                <CreditCard className="h-5 w-5 text-[#E7C77A]" />
                <h3 className="mt-4 font-display text-xl font-semibold text-[#F5F2EA]">
                  Razorpay UPI & GST Invoices
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9BA3AA]">
                  Accept UPI QR, cards, netbanking, or cash at the table. Every settled order
                  generates a print-ready GST tax invoice with itemised add-ons and discounts.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-6">
                <BarChart3 className="h-5 w-5 text-[#2DD4BF]" />
                <h3 className="mt-4 font-display text-xl font-semibold text-[#F5F2EA]">
                  Revenue & Peak Hour Analytics
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9BA3AA]">
                  Track average order value, top-selling dishes, category velocity, table turnover,
                  and guest rating trends across Today, 7-day, 30-day, and custom date windows.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-6 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <ShieldCheck className="h-5 w-5 text-[#34D399]" />
                  <span className="font-mono text-xs text-[#9BA3AA]">Multi-Role Staff Access</span>
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold text-[#F5F2EA]">
                  Role-based isolation for Owners, Managers, Kitchen, and Floor Staff
                </h3>
                <p className="mt-2 max-w-xl text-sm text-[#9BA3AA]">
                  Every restaurant workspace is strictly scoped by membership and PostgreSQL Row
                  Level Security policies. Invite kitchen leads or floor managers in seconds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-b border-white/[0.08] bg-[#0D1115] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-[#E7C77A]">Simple INR pricing</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#F5F2EA]">
                Predictable software pricing. Keep 100% of your table sales.
              </h2>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {[
                {
                  id: 'starter' as const,
                  name: 'For cafes & pop-ups',
                  price: '₹0',
                  cadence: 'Forever free',
                  limits: [
                    'Up to 8 tables & QR codes',
                    'Up to 40 menu items',
                    'Live order tracking & service calls',
                    'Print-ready table QR stands',
                  ],
                },
                {
                  id: 'growth' as const,
                  name: 'For full-service dining',
                  price: '₹1,499',
                  cadence: 'per outlet / month',
                  limits: [
                    'Unlimited tables & QR regeneration',
                    'Unlimited dishes, variants & add-ons',
                    'Razorpay UPI / Cards + GST invoices',
                    'Offers engine & peak-hour analytics',
                  ],
                },
                {
                  id: 'multi' as const,
                  name: 'For hospitality groups',
                  price: '₹3,999',
                  cadence: 'up to 5 outlets / month',
                  limits: [
                    'Everything in Full-Service',
                    'Unlimited staff & kitchen accounts',
                    'Custom brand accent & domain routing',
                    'Priority onboarding & webhook support',
                  ],
                },
              ].map((tier) => {
                const active = selectedPlan === tier.id;
                return (
                  <div
                    key={tier.id}
                    onClick={() => setSelectedPlan(tier.id)}
                    className={`flex flex-col justify-between rounded-2xl border p-6 transition-colors cursor-pointer ${
                      active
                        ? 'border-[#2DD4BF]/60 bg-[#171D23]'
                        : 'border-white/[0.08] bg-[#12171C] hover:border-white/[0.16]'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-[#9BA3AA]">{tier.name}</p>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="font-display text-3xl font-bold text-[#F5F2EA] tabular-nums">
                          {tier.price}
                        </span>
                        <span className="text-xs text-[#9BA3AA]">{tier.cadence}</span>
                      </div>

                      <ul className="mt-6 space-y-3 border-t border-white/[0.08] pt-6">
                        {tier.limits.map((lim) => (
                          <li key={lim} className="flex items-start gap-2.5 text-sm text-[#F5F2EA]">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2DD4BF]" />
                            <span>{lim}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      to="/signup"
                      className={`mt-8 flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-[#2DD4BF] text-[#080A0C] hover:bg-[#2DD4BF]/90'
                          : 'border border-white/[0.12] bg-[#0D1115] text-[#F5F2EA] hover:bg-white/[0.06]'
                      }`}
                    >
                      Get started
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-white/[0.08] bg-[#080A0C] py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA] sm:text-3xl">
              Frequently asked questions
            </h2>
            <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {FAQS.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-[#F5F2EA]">
                    <span>{item.q}</span>
                    <Sparkles className="h-4 w-4 shrink-0 text-[#9BA3AA] group-open:text-[#2DD4BF]" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-[#9BA3AA]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-[#0D1115] py-20">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA] sm:text-3xl">
                Ready to digitise your dining room?
              </h2>
              <p className="mt-2 text-sm text-[#9BA3AA]">
                Create your restaurant profile, publish your menu, and print table QR codes today.
              </p>
            </div>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2DD4BF] px-6 py-3.5 text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Create your restaurant</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.08] bg-[#080A0C] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <BrandLogo size="sm" />
          <div className="flex flex-wrap items-center gap-6 text-xs text-[#9BA3AA]">
            <Link to="/menu/casa-verde/1" className="hover:text-[#F5F2EA]">
              Casa Verde Demo
            </Link>
            <Link to="/login" className="hover:text-[#F5F2EA]">
              Admin Sign In
            </Link>
            <Link to="/signup" className="hover:text-[#F5F2EA]">
              Create Account
            </Link>
            <span>© {new Date().getFullYear()} MenuFlow Hospitality Technologies</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
