import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  ExternalLink,
  FolderKanban,
  Grid2x2,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  QrCode,
  Receipt,
  Settings,
  Tag,
  Users,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { apiRequest } from '../../lib/api';
import { useRealtimeChannel } from '../../lib/realtime';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { OverviewView } from './OverviewView';
import { OrdersView } from './OrdersView';
import { MenuView } from './MenuView';
import { CategoriesView } from './CategoriesView';
import { TablesQrView } from './TablesQrView';
import { CustomersView } from './CustomersView';
import { OffersView } from './OffersView';
import { ReviewsView } from './ReviewsView';
import { AnalyticsView } from './AnalyticsView';
import { PaymentsView } from './PaymentsView';
import { SettingsView } from './SettingsView';
import type {
  Category,
  Customer,
  DiningTable,
  Invoice,
  MenuItem,
  Offer,
  Order,
  OrderStatus,
  Payment,
  Restaurant,
  RestaurantMember,
  RestaurantSettings,
  Review,
  ServiceRequest,
  ServiceRequestStatus,
  TableStatus,
  UserRole,
} from '../../types';

interface BootstrapPayload {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  razorpayStatus: { configured: boolean; mode: 'LIVE' | 'TEST_MODE'; keyId: string | null };
  categories: Category[];
  menuItems: MenuItem[];
  tables: DiningTable[];
  orders: Order[];
  customers: Customer[];
  offers: Offer[];
  reviews: Review[];
  payments: Payment[];
  invoices: Invoice[];
  serviceRequests: ServiceRequest[];
  staff: RestaurantMember[];
}

function playNotificationTone() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  } catch {
    // Browser autoplay policy may block audio before interaction
  }
}

export function DashboardLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBootstrap = useCallback(async () => {
    try {
      const payload = await apiRequest<BootstrapPayload>('/api/dashboard/bootstrap');
      setData(payload);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load restaurant dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBootstrap();
  }, [fetchBootstrap]);

  // Real-time WebSocket listener scoped to restaurant ID
  const { connected } = useRealtimeChannel(
    data?.restaurant.id ? `restaurant:${data.restaurant.id}` : null,
    (event, payload) => {
      if (event === 'order:created' && payload && typeof payload === 'object') {
        const order = payload as Order;
        setData((prev) => {
          if (!prev) return prev;
          if (prev.orders.some((o) => o.id === order.id)) return prev;
          return { ...prev, orders: [order, ...prev.orders] };
        });
        if (soundEnabled) playNotificationTone();
        toast(`New Order ${order.orderNumber}`, {
          description: `Table ${String(order.tableNumber).padStart(2, '0')} · ${order.items.length} items`,
          tone: 'info',
        });
        void fetchBootstrap();
      } else if (event === 'order:updated' && payload && typeof payload === 'object') {
        const updated = payload as Order;
        setData((prev) =>
          prev
            ? { ...prev, orders: prev.orders.map((o) => (o.id === updated.id ? updated : o)) }
            : prev
        );
      } else if (event === 'service_request:created' && payload && typeof payload === 'object') {
        const sr = payload as ServiceRequest;
        setData((prev) => {
          if (!prev) return prev;
          if (prev.serviceRequests.some((x) => x.id === sr.id)) return prev;
          return { ...prev, serviceRequests: [sr, ...prev.serviceRequests] };
        });
        if (soundEnabled) playNotificationTone();
        toast(`Table ${sr.tableNumber} Request`, {
          description: sr.requestType.replace(/_/g, ' '),
          tone: 'info',
        });
      } else if (event === 'service_request:updated' && payload && typeof payload === 'object') {
        const sr = payload as ServiceRequest;
        setData((prev) =>
          prev
            ? {
                ...prev,
                serviceRequests: prev.serviceRequests.map((x) => (x.id === sr.id ? sr : x)),
              }
            : prev
        );
      } else if (event === 'review:created') {
        void fetchBootstrap();
      }
    }
  );

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#080A0C] p-6">
        <div className="mx-auto w-full max-w-7xl space-y-4 animate-pulse">
          <div className="h-14 rounded-2xl bg-[#12171C]" />
          <div className="grid gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 rounded-2xl bg-[#12171C]" />
            ))}
          </div>
          <div className="h-80 rounded-2xl bg-[#12171C]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#080A0C] p-6 text-center">
        <p className="text-base font-semibold text-[#F5F2EA]">Unable to load dashboard</p>
        <p className="mt-1 text-xs text-[#9BA3AA]">{error}</p>
        <button
          type="button"
          onClick={fetchBootstrap}
          className="mt-4 rounded-xl bg-[#2DD4BF] px-4 py-2 text-xs font-semibold text-[#080A0C]"
        >
          Retry
        </button>
      </div>
    );
  }

  const pendingOrdersCount = data.orders.filter((o) =>
    ['NEW', 'CONFIRMED', 'PREPARING'].includes(o.status)
  ).length;
  const pendingSrCount = data.serviceRequests.filter((sr) => sr.status === 'PENDING').length;

  const navItems = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', Icon: Receipt, badge: pendingOrdersCount + pendingSrCount },
    { id: 'menu', label: 'Menu', Icon: UtensilsCrossed },
    { id: 'categories', label: 'Categories', Icon: FolderKanban },
    { id: 'tables', label: 'Tables', Icon: Grid2x2 },
    { id: 'qr', label: 'QR Codes', Icon: QrCode },
    { id: 'customers', label: 'Customers', Icon: Users },
    { id: 'offers', label: 'Offers', Icon: Tag },
    { id: 'reviews', label: 'Reviews', Icon: MessageSquare },
    { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
    { id: 'payments', label: 'Payments', Icon: CreditCard },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ];

  // Action handlers wired directly to backend APIs
  const advanceOrderStatus = async (orderId: string, status: OrderStatus) => {
    const res = await apiRequest<{ order: Order }>(`/api/dashboard/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setData((prev) =>
      prev
        ? { ...prev, orders: prev.orders.map((o) => (o.id === orderId ? res.order : o)) }
        : prev
    );
    toast(`Order ${res.order.orderNumber} → ${status}`, { tone: 'success' });
  };

  const markPaid = async (orderId: string) => {
    await apiRequest(`/api/dashboard/orders/${orderId}/payment-status`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentStatus: 'PAID' }),
    });
    await fetchBootstrap();
    toast('Payment marked as Paid', { tone: 'success' });
  };

  const updateServiceRequest = async (id: string, status: ServiceRequestStatus) => {
    const res = await apiRequest<{ serviceRequest: ServiceRequest }>(
      `/api/dashboard/service-requests/${id}`,
      { method: 'PATCH', body: JSON.stringify({ status }) }
    );
    setData((prev) =>
      prev
        ? {
            ...prev,
            serviceRequests: prev.serviceRequests.map((sr) =>
              sr.id === id ? res.serviceRequest : sr
            ),
          }
        : prev
    );
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const currentNavLabel = navItems.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <div className="flex min-h-screen bg-[#080A0C] text-[#F5F2EA]">
      {/* Desktop Sidebar (240px) */}
      <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-white/[0.08] bg-[#0D1115] lg:flex">
        <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-5">
          <Link to="/">
            <BrandLogo size="sm" />
          </Link>
        </div>

        <div className="border-b border-white/[0.08] px-5 py-3.5">
          <p className="truncate text-sm font-semibold text-[#F5F2EA]">{data.restaurant.name}</p>
          <p className="truncate text-[11px] text-[#9BA3AA]">{data.restaurant.city}</p>
        </div>

        <nav aria-label="Dashboard sections" className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map(({ id, label, Icon, badge }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#171D23] text-[#F5F2EA]'
                    : 'text-[#9BA3AA] hover:bg-white/[0.04] hover:text-[#F5F2EA]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${active ? 'text-[#2DD4BF]' : ''}`} />
                  <span>{label}</span>
                </span>
                {badge !== undefined && badge > 0 && (
                  <span className="font-mono text-[11px] font-semibold text-[#E7C77A] tabular-nums">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.08] p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#9BA3AA] hover:bg-white/[0.04] hover:text-[#F87171]"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col border-r border-white/[0.08] bg-[#0D1115]">
            <div className="flex h-14 items-center justify-between border-b border-white/[0.08] px-4">
              <BrandLogo size="sm" />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation drawer"
                className="p-2 text-[#9BA3AA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {navItems.map(({ id, label, Icon, badge }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveTab(id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium ${
                    activeTab === id
                      ? 'bg-[#171D23] text-[#F5F2EA]'
                      : 'text-[#9BA3AA]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </span>
                  {badge !== undefined && badge > 0 && (
                    <span className="font-mono text-[11px] text-[#E7C77A]">{badge}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="border-t border-white/[0.08] p-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#F87171]"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#080A0C]/95 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu navigation"
              className="rounded-lg p-2 text-[#9BA3AA] hover:bg-white/[0.06] lg:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className="truncate text-xs text-[#9BA3AA]">
              <span>{data.restaurant.name}</span>
              <span className="mx-2">/</span>
              <span className="font-medium text-[#F5F2EA]">{currentNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] text-[#9BA3AA]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? 'bg-[#34D399]' : 'bg-[#E7C77A]'
                }`}
              />
              {connected ? 'Live Sync' : 'Reconnecting'}
            </span>

            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              aria-label={soundEnabled ? 'Mute order sound alerts' : 'Enable order sound alerts'}
              className="rounded-lg border border-white/[0.08] bg-[#12171C] p-2 text-[#9BA3AA] hover:text-[#F5F2EA]"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-[#2DD4BF]" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <Link
              to={`/menu/${data.restaurant.slug}/1`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#12171C] px-3.5 py-2 text-xs font-medium text-[#F5F2EA] hover:bg-[#171D23] whitespace-nowrap"
            >
              <span>Customer Menu</span>
              <ExternalLink className="h-3.5 w-3.5 text-[#2DD4BF]" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {activeTab === 'overview' && (
              <OverviewView
                restaurant={data.restaurant}
                settings={data.settings}
                orders={data.orders}
                tables={data.tables}
                reviews={data.reviews}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersView
                restaurant={data.restaurant}
                settings={data.settings}
                orders={data.orders}
                serviceRequests={data.serviceRequests}
                onAdvanceOrderStatus={advanceOrderStatus}
                onMarkPaid={markPaid}
                onUpdateServiceRequest={updateServiceRequest}
              />
            )}

            {activeTab === 'menu' && (
              <MenuView
                settings={data.settings}
                categories={data.categories}
                menuItems={data.menuItems}
                onCreateDish={async (payload) => {
                  await apiRequest('/api/dashboard/menu', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  });
                  await fetchBootstrap();
                  toast('Dish created', { tone: 'success' });
                }}
                onUpdateDish={async (id, payload) => {
                  await apiRequest(`/api/dashboard/menu/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                  });
                  await fetchBootstrap();
                  toast('Dish updated', { tone: 'success' });
                }}
                onDeleteDish={async (id) => {
                  await apiRequest(`/api/dashboard/menu/${id}`, { method: 'DELETE' });
                  await fetchBootstrap();
                  toast('Dish deleted', { tone: 'info' });
                }}
                onReorderDishes={async (orderedIds) => {
                  await apiRequest('/api/dashboard/menu/reorder', {
                    method: 'POST',
                    body: JSON.stringify({ orderedIds }),
                  });
                  await fetchBootstrap();
                }}
              />
            )}

            {activeTab === 'categories' && (
              <CategoriesView
                categories={data.categories}
                menuItems={data.menuItems}
                onCreateCategory={async (input) => {
                  await apiRequest('/api/dashboard/categories', {
                    method: 'POST',
                    body: JSON.stringify(input),
                  });
                  await fetchBootstrap();
                  toast('Category created', { tone: 'success' });
                }}
                onUpdateCategory={async (id, input) => {
                  await apiRequest(`/api/dashboard/categories/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(input),
                  });
                  await fetchBootstrap();
                }}
                onDeleteCategory={async (id) => {
                  await apiRequest(`/api/dashboard/categories/${id}`, { method: 'DELETE' });
                  await fetchBootstrap();
                  toast('Category removed', { tone: 'info' });
                }}
                onReorderCategories={async (orderedIds) => {
                  await apiRequest('/api/dashboard/categories/reorder', {
                    method: 'POST',
                    body: JSON.stringify({ orderedIds }),
                  });
                  await fetchBootstrap();
                }}
              />
            )}

            {(activeTab === 'tables' || activeTab === 'qr') && (
              <TablesQrView
                mode={activeTab === 'qr' ? 'qr' : 'tables'}
                restaurant={data.restaurant}
                tables={data.tables}
                onCreateTable={async (input) => {
                  await apiRequest('/api/dashboard/tables', {
                    method: 'POST',
                    body: JSON.stringify(input),
                  });
                  await fetchBootstrap();
                  toast(`Table ${input.tableNumber} added with QR code`, { tone: 'success' });
                }}
                onUpdateTableStatus={async (id, status: TableStatus) => {
                  await apiRequest(`/api/dashboard/tables/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status }),
                  });
                  await fetchBootstrap();
                }}
                onRegenerateQr={async (id) => {
                  await apiRequest(`/api/dashboard/tables/${id}/regenerate-qr`, {
                    method: 'POST',
                  });
                  await fetchBootstrap();
                  toast('QR token regenerated', { tone: 'success' });
                }}
                onDeleteTable={async (id) => {
                  await apiRequest(`/api/dashboard/tables/${id}`, { method: 'DELETE' });
                  await fetchBootstrap();
                  toast('Table deleted', { tone: 'info' });
                }}
              />
            )}

            {activeTab === 'customers' && (
              <CustomersView customers={data.customers} settings={data.settings} />
            )}

            {activeTab === 'offers' && (
              <OffersView
                offers={data.offers}
                settings={data.settings}
                onCreateOffer={async (payload) => {
                  await apiRequest('/api/dashboard/offers', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  });
                  await fetchBootstrap();
                  toast('Offer created', { tone: 'success' });
                }}
                onToggleOffer={async (id, isActive) => {
                  await apiRequest(`/api/dashboard/offers/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ isActive }),
                  });
                  await fetchBootstrap();
                }}
                onDeleteOffer={async (id) => {
                  await apiRequest(`/api/dashboard/offers/${id}`, { method: 'DELETE' });
                  await fetchBootstrap();
                  toast('Offer removed', { tone: 'info' });
                }}
              />
            )}

            {activeTab === 'reviews' && <ReviewsView reviews={data.reviews} />}

            {activeTab === 'analytics' && (
              <AnalyticsView
                settings={data.settings}
                orders={data.orders}
                categories={data.categories}
                menuItems={data.menuItems}
                tables={data.tables}
                reviews={data.reviews}
              />
            )}

            {activeTab === 'payments' && (
              <PaymentsView
                restaurant={data.restaurant}
                settings={data.settings}
                payments={data.payments}
                invoices={data.invoices}
                orders={data.orders}
                razorpayStatus={data.razorpayStatus}
                onMarkPaid={markPaid}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                restaurant={data.restaurant}
                settings={data.settings}
                staff={data.staff}
                onSaveSettings={async (payload) => {
                  await apiRequest('/api/dashboard/settings', {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                  });
                  await fetchBootstrap();
                  toast('Settings saved', { tone: 'success' });
                }}
                onInviteStaff={async (input: {
                  fullName: string;
                  email: string;
                  role: Exclude<UserRole, 'OWNER'>;
                  password: string;
                }) => {
                  await apiRequest('/api/dashboard/staff', {
                    method: 'POST',
                    body: JSON.stringify(input),
                  });
                  await fetchBootstrap();
                  toast(`${input.fullName} added to team`, { tone: 'success' });
                }}
                onRemoveStaff={async (id) => {
                  await apiRequest(`/api/dashboard/staff/${id}`, { method: 'DELETE' });
                  await fetchBootstrap();
                  toast('Staff member removed', { tone: 'info' });
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
