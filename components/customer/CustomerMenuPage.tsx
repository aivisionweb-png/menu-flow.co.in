import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import {
  Bell,
  Clock,
  Flame,
  Leaf,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Tag,
  UtensilsCrossed,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { buildCartKey, calculateOrderTotals } from '../../lib/orderLogic';
import { useRealtimeChannel } from '../../lib/realtime';
import { useToast } from '../../hooks/useToast';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { DishDetailSheet } from './DishDetailSheet';
import { CartSheet } from './CartSheet';
import { OrderTracker } from './OrderTracker';
import { ServiceRequestSheet } from './ServiceRequestSheet';
import type {
  CartItem,
  Category,
  MenuItem,
  MenuItemAddon,
  MenuItemVariant,
  Offer,
  Order,
  PaymentMethod,
  Restaurant,
  RestaurantSettings,
  Review,
  ServiceRequestType,
} from '../../types';

interface PublicMenuPayload {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  table: { id: string | null; tableNumber: number; label: string; zone: string; status: string };
  categories: Category[];
  menuItems: MenuItem[];
  offers: Offer[];
  reviews: Review[];
}

export function CustomerMenuPage() {
  const { restaurantSlug = 'casa-verde', tableNumber = '1' } = useParams();
  const parsedTableNum = Math.max(1, Number.parseInt(tableNumber, 10) || 1);
  const { toast } = useToast();

  const [data, setData] = useState<PublicMenuPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [appliedOffer, setAppliedOffer] = useState<Offer | null>(null);
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [showTracker, setShowTracker] = useState(false);

  const sessionKey = `mf_session_${restaurantSlug}_${parsedTableNum}`;
  const orderStorageKey = `mf_last_order_${restaurantSlug}_${parsedTableNum}`;

  const fetchMenu = useCallback(async () => {
    try {
      const payload = await apiRequest<PublicMenuPayload>(
        `/api/public/menu/${restaurantSlug}/${parsedTableNum}`
      );
      setData(payload);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load menu');
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug, parsedTableNum]);

  useEffect(() => {
    void fetchMenu();
    if (!localStorage.getItem(sessionKey)) {
      localStorage.setItem(sessionKey, `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    }
    const lastOrderId = localStorage.getItem(orderStorageKey);
    if (lastOrderId) {
      apiRequest<{ order: Order }>(`/api/public/orders/${lastOrderId}`)
        .then((res) => setActiveOrder(res.order))
        .catch(() => localStorage.removeItem(orderStorageKey));
    }
  }, [fetchMenu, sessionKey, orderStorageKey]);

  // Real-time menu updates when restaurant updates dishes or settings
  useRealtimeChannel(data?.restaurant.id ? `restaurant:${data.restaurant.id}` : null, (event) => {
    if (event === 'menu:updated') {
      void fetchMenu();
    }
  });

  const filteredDishes = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.menuItems.filter((item) => {
      if (activeCategoryId !== 'ALL' && item.categoryId !== activeCategoryId) return false;
      if (vegOnly && !item.isVeg) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [data, activeCategoryId, vegOnly, search]);

  const addToCart = (
    dish: MenuItem,
    variant: MenuItemVariant | null,
    addons: MenuItemAddon[],
    quantity: number,
    specialInstructions: string
  ) => {
    const key = buildCartKey(
      dish.id,
      variant?.id ?? null,
      addons.map((a) => a.id),
      specialInstructions
    );
    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === key);
      if (existing) {
        return prev.map((i) =>
          i.cartKey === key ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        {
          cartKey: key,
          menuItem: dish,
          variant,
          addons,
          quantity,
          specialInstructions,
        },
      ];
    });
    toast(`Added ${dish.name}`, { tone: 'success' });
  };

  const quickAdd = (dish: MenuItem) => {
    if (dish.variants.length > 0 || dish.addons.length > 0) {
      setSelectedDish(dish);
      return;
    }
    addToCart(dish, null, [], 1, '');
  };

  const updateCartQty = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.cartKey === cartKey ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeCartItem = (cartKey: string) => {
    setCart((prev) => prev.filter((i) => i.cartKey !== cartKey));
  };

  const getDishQtyInCart = (dishId: string): number =>
    cart.filter((i) => i.menuItem.id === dishId).reduce((s, i) => s + i.quantity, 0);

  const handlePlaceOrder = async (input: {
    customerName: string;
    customerPhone: string;
    paymentMethod: PaymentMethod;
    notes: string;
  }) => {
    if (!data) return;
    const res = await apiRequest<{ order: Order }>(`/api/public/menu/${data.restaurant.slug}/orders`, {
      method: 'POST',
      body: JSON.stringify({
        tableNumber: parsedTableNum,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        sessionId: localStorage.getItem(sessionKey) || undefined,
        paymentMethod: input.paymentMethod,
        offerCode: appliedOffer?.code,
        notes: input.notes,
        items: cart.map((c) => ({
          menuItemId: c.menuItem.id,
          variantId: c.variant?.id ?? null,
          addonIds: c.addons.map((a) => a.id),
          quantity: c.quantity,
          specialInstructions: c.specialInstructions,
        })),
      }),
    });

    setActiveOrder(res.order);
    localStorage.setItem(orderStorageKey, res.order.id);
    setCart([]);
    setAppliedOffer(null);
    setShowCart(false);
    setShowTracker(true);
    toast(`Order ${res.order.orderNumber} sent to kitchen`, { tone: 'success' });
  };

  const handleServiceRequest = async (requestType: ServiceRequestType, note: string) => {
    if (!data) return;
    await apiRequest(`/api/public/menu/${data.restaurant.slug}/service-requests`, {
      method: 'POST',
      body: JSON.stringify({
        tableNumber: parsedTableNum,
        requestType,
        note,
      }),
    });
    toast('Staff notified', {
      description: `Table ${String(parsedTableNum).padStart(2, '0')} request sent.`,
      tone: 'success',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080A0C] p-6">
        <div className="mx-auto max-w-6xl space-y-6 animate-pulse">
          <div className="h-16 rounded-2xl bg-[#12171C]" />
          <div className="h-12 rounded-xl bg-[#12171C]" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-72 rounded-2xl bg-[#12171C]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#080A0C] p-6 text-center">
        <UtensilsCrossed className="h-8 w-8 text-[#9BA3AA]" />
        <h1 className="mt-4 font-display text-xl font-semibold text-[#F5F2EA]">
          Menu unavailable
        </h1>
        <p className="mt-1 text-sm text-[#9BA3AA]">{error || 'Restaurant not found.'}</p>
        <Link
          to="/"
          className="mt-6 rounded-xl bg-[#2DD4BF] px-5 py-2.5 text-sm font-semibold text-[#080A0C]"
        >
          Back to MenuFlow
        </Link>
      </div>
    );
  }

  const { restaurant, settings, categories, offers, reviews } = data;
  const sym = settings.currencySymbol;
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotals = calculateOrderTotals(cart, settings, appliedOffer);
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : '4.8';

  return (
    <div className="min-h-screen bg-[#080A0C] pb-24 text-[#F5F2EA]">
      {/* Compact Sticky Top Bar (<= 56px to respect 15% mobile sticky cap) */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080A0C]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="h-8 w-8 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-[#12171C] font-display text-xs font-bold text-[#2DD4BF]">
                {restaurant.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate font-display text-sm font-semibold text-[#F5F2EA] sm:text-base">
                {restaurant.name}
              </h1>
              <p className="truncate text-[11px] text-[#9BA3AA]">
                Table {String(parsedTableNum).padStart(2, '0')} ·{' '}
                <span className={restaurant.isOpen ? 'text-[#34D399]' : 'text-[#F87171]'}>
                  {restaurant.isOpen ? 'Open' : 'Closed'}
                </span>{' '}
                · ★ {avgRating}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowServiceSheet(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#12171C] px-3 py-1.5 text-xs font-medium text-[#F5F2EA] hover:bg-[#171D23] whitespace-nowrap"
            >
              <Bell className="h-3.5 w-3.5 text-[#E7C77A]" />
              <span>Service</span>
            </button>
            {activeOrder && (
              <button
                type="button"
                onClick={() => setShowTracker(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 px-3 py-1.5 text-xs font-medium text-[#2DD4BF] whitespace-nowrap"
              >
                <span>Order {activeOrder.orderNumber}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-3.5 py-1.5 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 whitespace-nowrap"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>
                Cart ({cartCount}) · {formatCurrency(cartTotals.totalAmount, sym)}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        {/* Restaurant Cover & Active Offers */}
        <section className="grid gap-5 lg:grid-cols-12">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12171C] lg:col-span-8 min-h-[190px] sm:min-h-[220px]">
            <ImageWithFallback
              src={restaurant.coverUrl || '/src/assets/images/casaverde_hero_1795070509445.jpg'}
              alt={`${restaurant.name} dining atmosphere`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080A0C] via-[#080A0C]/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-xs text-[#E7C77A]">
                {restaurant.cuisineType} · {restaurant.openingHours}
              </p>
              <p className="mt-1 font-display text-xl font-semibold text-[#F5F2EA] sm:text-2xl">
                {restaurant.tagline || `${restaurant.name} Digital Menu`}
              </p>
              <p className="mt-0.5 text-xs text-[#9BA3AA]">
                {restaurant.address}, {restaurant.city}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 lg:col-span-4">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#E7C77A]">
                  Active Offers
                </p>
                <Tag className="h-3.5 w-3.5 text-[#E7C77A]" />
              </div>
              {offers.length === 0 ? (
                <p className="mt-3 text-xs text-[#9BA3AA]">No active promotions today.</p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {offers.slice(0, 3).map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[#F5F2EA]">{o.title}</p>
                        <p className="font-mono text-[11px] text-[#2DD4BF]">
                          Code: {o.code} · Min {formatCurrency(o.minOrderAmount, sym)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedOffer(o);
                          toast(`Offer ${o.code} selected`, { tone: 'info' });
                        }}
                        className="rounded-lg border border-white/[0.1] bg-[#0D1115] px-2.5 py-1 text-[11px] font-medium text-[#F5F2EA] hover:border-[#2DD4BF]/50 shrink-0"
                      >
                        {appliedOffer?.id === o.id ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Search + Veg Filter + Category Navigation */}
        <section className="mt-6 space-y-3 border-b border-white/[0.08] pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9BA3AA]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tacos, bowls, mezcal, churros..."
                aria-label="Search menu dishes"
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#12171C] pl-10 pr-4 text-sm text-[#F5F2EA] placeholder:text-[#9BA3AA]/60 focus:border-[#2DD4BF] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setVegOnly((v) => !v)}
              aria-pressed={vegOnly}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                vegOnly
                  ? 'border-[#34D399]/60 bg-[#34D399]/10 text-[#34D399]'
                  : 'border-white/[0.1] bg-[#12171C] text-[#9BA3AA] hover:text-[#F5F2EA]'
              }`}
            >
              <Leaf className="h-3.5 w-3.5" />
              <span>Veg Only</span>
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Menu Categories"
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeCategoryId === 'ALL'}
              onClick={() => setActiveCategoryId('ALL')}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeCategoryId === 'ALL'
                  ? 'bg-[#2DD4BF] text-[#080A0C]'
                  : 'bg-[#12171C] text-[#9BA3AA] hover:text-[#F5F2EA]'
              }`}
            >
              All ({data.menuItems.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCategoryId === cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeCategoryId === cat.id
                    ? 'bg-[#2DD4BF] text-[#080A0C]'
                    : 'bg-[#12171C] text-[#9BA3AA] hover:text-[#F5F2EA]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </section>

        {/* Menu Grid */}
        <section className="mt-6">
          {filteredDishes.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-10 text-center">
              <p className="text-sm font-medium text-[#F5F2EA]">No matching dishes found</p>
              <p className="mt-1 text-xs text-[#9BA3AA]">
                Try clearing your search or veg-only filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setVegOnly(false);
                  setActiveCategoryId('ALL');
                }}
                className="mt-4 rounded-xl bg-[#171D23] px-4 py-2 text-xs font-medium text-[#2DD4BF]"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDishes.map((dish) => {
                const qtyInCart = getDishQtyInCart(dish.id);
                return (
                  <article
                    key={dish.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12171C] transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDish(dish)}
                      className="relative aspect-[4/3] w-full overflow-hidden bg-[#0D1115] text-left"
                    >
                      <ImageWithFallback
                        src={dish.imageUrl}
                        alt={dish.name}
                        fallbackTitle={dish.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      {!dish.isAvailable && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#F87171]">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </button>

                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] text-[#9BA3AA]">
                          <span className={dish.isVeg ? 'text-[#34D399]' : 'text-[#F87171]'}>
                            {dish.isVeg ? 'Veg' : 'Non-Veg'}
                          </span>
                          {dish.isSpicy && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 text-[#F87171]">
                                <Flame className="h-3 w-3" />
                                Spicy
                              </span>
                            </>
                          )}
                          {dish.isBestseller && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#E7C77A] font-medium">Bestseller</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="h-3 w-3" />
                            {dish.prepTimeMins}m
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedDish(dish)}
                          className="mt-1.5 text-left"
                        >
                          <h3 className="font-display text-base font-semibold text-[#F5F2EA] group-hover:text-[#2DD4BF] transition-colors">
                            {dish.name}
                          </h3>
                        </button>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#9BA3AA]">
                          {dish.description}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                        <span className="font-mono text-base font-semibold text-[#F5F2EA] tabular-nums">
                          {formatCurrency(dish.price, sym)}
                        </span>

                        {qtyInCart > 0 && dish.variants.length === 0 && dish.addons.length === 0 ? (
                          <div className="flex items-center rounded-xl border border-[#2DD4BF]/50 bg-[#2DD4BF]/10">
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQty(buildCartKey(dish.id, null, [], ''), -1)
                              }
                              aria-label={`Remove one ${dish.name}`}
                              className="flex h-10 w-10 items-center justify-center text-[#2DD4BF]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center font-mono text-xs font-semibold text-[#F5F2EA] tabular-nums">
                              {qtyInCart}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQty(buildCartKey(dish.id, null, [], ''), 1)
                              }
                              aria-label={`Add one more ${dish.name}`}
                              className="flex h-10 w-10 items-center justify-center text-[#2DD4BF]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!dish.isAvailable}
                            onClick={() => quickAdd(dish)}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#171D23] px-4 text-xs font-semibold text-[#F5F2EA] hover:border-[#2DD4BF]/60 hover:text-[#2DD4BF] disabled:opacity-40 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>
                              {dish.variants.length > 0 || dish.addons.length > 0
                                ? 'Customize'
                                : 'Add'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Guest Reviews */}
        {reviews.length > 0 && (
          <section className="mt-12 border-t border-white/[0.08] pt-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#F5F2EA]">
                Recent Diner Reviews
              </h2>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-[#E7C77A] tabular-nums">
                <Star className="h-3.5 w-3.5 fill-[#E7C77A]" />
                {avgRating} ({reviews.length})
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-white/[0.08] bg-[#12171C] p-4"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#F5F2EA]">{r.customerName}</span>
                    <span className="font-mono text-[#E7C77A] tabular-nums">★ {r.rating}/5</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#9BA3AA]">{r.comment}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation (compact 56px height to respect 15% cap) */}
      <nav
        aria-label="Mobile menu navigation"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.08] bg-[#080A0C]/95 backdrop-blur-md sm:hidden"
      >
        <div className="grid h-14 grid-cols-3 items-center px-2">
          <button
            type="button"
            onClick={() => setShowServiceSheet(true)}
            className="flex h-11 flex-col items-center justify-center text-[#9BA3AA] hover:text-[#F5F2EA]"
          >
            <Bell className="h-4 w-4 text-[#E7C77A]" />
            <span className="mt-0.5 text-[10px] font-medium">Call Staff</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeOrder) setShowTracker(true);
              else toast('Place an order first to track it live', { tone: 'info' });
            }}
            className="flex h-11 flex-col items-center justify-center text-[#9BA3AA] hover:text-[#F5F2EA]"
          >
            <Clock className="h-4 w-4 text-[#2DD4BF]" />
            <span className="mt-0.5 text-[10px] font-medium">
              {activeOrder ? activeOrder.orderNumber : 'Track Order'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#2DD4BF] px-3 text-xs font-semibold text-[#080A0C]"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>
              {cartCount} · {formatCurrency(cartTotals.totalAmount, sym)}
            </span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {selectedDish && (
          <DishDetailSheet
            dish={selectedDish}
            currencySymbol={sym}
            onAdd={addToCart}
            onClose={() => setSelectedDish(null)}
          />
        )}

        {showCart && (
          <CartSheet
            items={cart}
            tableNumber={parsedTableNum}
            settings={settings}
            offers={offers}
            appliedOffer={appliedOffer}
            onApplyOffer={setAppliedOffer}
            onUpdateQty={updateCartQty}
            onRemoveItem={removeCartItem}
            onPlaceOrder={handlePlaceOrder}
            onClose={() => setShowCart(false)}
          />
        )}

        {showServiceSheet && (
          <ServiceRequestSheet
            tableNumber={parsedTableNum}
            onSend={handleServiceRequest}
            onClose={() => setShowServiceSheet(false)}
          />
        )}

        {showTracker && activeOrder && (
          <OrderTracker
            order={activeOrder}
            restaurant={restaurant}
            currencySymbol={sym}
            gstin={settings.gstin}
            onOrderUpdated={setActiveOrder}
            onClose={() => setShowTracker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
