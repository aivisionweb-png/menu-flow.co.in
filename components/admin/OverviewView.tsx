import { useMemo, useState } from 'react';
import { ArrowUpRight, Star } from 'lucide-react';
import { formatCurrency, formatShortTime } from '../../lib/format';
import { filterOrdersByDateRange } from '../../lib/orderLogic';
import { OrderStatusText, TableStatusText } from '../common/StatusLabel';
import type {
  DiningTable,
  Order,
  Restaurant,
  RestaurantSettings,
  Review,
} from '../../types';

interface OverviewViewProps {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  orders: Order[];
  tables: DiningTable[];
  reviews: Review[];
  onNavigateTab: (tab: string) => void;
}

export function OverviewView({
  restaurant,
  settings,
  orders,
  tables,
  reviews,
  onNavigateTab,
}: OverviewViewProps) {
  const [range, setRange] = useState<'TODAY' | '7D' | '30D' | 'CUSTOM'>('7D');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const sym = settings.currencySymbol;

  const filteredOrders = useMemo(
    () => filterOrdersByDateRange(orders, range, customStart, customEnd),
    [orders, range, customStart, customEnd]
  );

  const metrics = useMemo(() => {
    const valid = filteredOrders.filter((o) => o.status !== 'CANCELLED');
    const revenue = valid.reduce((s, o) => s + o.totalAmount, 0);
    const pending = orders.filter((o) =>
      ['NEW', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)
    ).length;
    const aov = valid.length > 0 ? revenue / valid.length : 0;
    const activeTables = tables.filter((t) => t.status !== 'AVAILABLE').length;
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : 0;

    // Popular dishes
    const dishMap = new Map<string, { name: string; qty: number; rev: number }>();
    for (const o of valid) {
      for (const it of o.items) {
        const cur = dishMap.get(it.name) || { name: it.name, qty: 0, rev: 0 };
        cur.qty += it.quantity;
        cur.rev += it.lineTotal;
        dishMap.set(it.name, cur);
      }
    }
    const popular = [...dishMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    // 7-bucket chart series
    const dayMap = new Map<string, { label: string; revenue: number; orders: number }>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
      dayMap.set(key, { label, revenue: 0, orders: 0 });
    }
    for (const o of valid) {
      const key = o.createdAt.slice(0, 10);
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.revenue += o.totalAmount;
        bucket.orders += 1;
      }
    }

    return {
      orderCount: valid.length,
      revenue,
      pending,
      aov,
      activeTables,
      avgRating,
      popular,
      chart: [...dayMap.values()],
    };
  }, [filteredOrders, orders, tables, reviews]);

  const maxChartRev = Math.max(1, ...metrics.chart.map((d) => d.revenue));

  return (
    <div className="space-y-6">
      {/* Header & Date Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
            {restaurant.name} Overview
          </h1>
          <p className="mt-1 text-xs text-[#9BA3AA]">
            {restaurant.cuisineType} · {restaurant.address}, {restaurant.city}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#12171C] p-1">
            {(
              [
                { id: 'TODAY', label: 'Today' },
                { id: '7D', label: '7 days' },
                { id: '30D', label: '30 days' },
                { id: 'CUSTOM', label: 'Custom' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  range === opt.id
                    ? 'bg-[#171D23] text-[#F5F2EA]'
                    : 'text-[#9BA3AA] hover:text-[#F5F2EA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {range === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Start date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-white/[0.1] bg-[#12171C] px-2.5 py-1.5 text-xs text-[#F5F2EA]"
              />
              <input
                type="date"
                aria-label="End date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-white/[0.1] bg-[#12171C] px-2.5 py-1.5 text-xs text-[#F5F2EA]"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Orders</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F5F2EA] tabular-nums">
            {metrics.orderCount}
          </p>
          <p className="mt-1 text-[11px] text-[#9BA3AA]">Selected period</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Revenue</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#2DD4BF] tabular-nums">
            {formatCurrency(metrics.revenue, sym)}
          </p>
          <p className="mt-1 text-[11px] text-[#9BA3AA]">Incl. GST & service</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Live Kitchen Queue</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#E7C77A] tabular-nums">
            {metrics.pending}
          </p>
          <p className="mt-1 text-[11px] text-[#9BA3AA]">Pending / Preparing</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Avg Order Value</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F5F2EA] tabular-nums">
            {formatCurrency(Math.round(metrics.aov), sym)}
          </p>
          <p className="mt-1 text-[11px] text-[#9BA3AA]">Per table ticket</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Active Tables · Rating</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-[#F5F2EA] tabular-nums">
              {metrics.activeTables}/{tables.length}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-sm text-[#E7C77A] tabular-nums">
              <Star className="h-3.5 w-3.5 fill-[#E7C77A]" />
              {metrics.avgRating ? metrics.avgRating.toFixed(1) : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#9BA3AA]">{reviews.length} guest reviews</p>
        </div>
      </div>

      {/* Main Split: Revenue Trend Chart + Popular Dishes */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F5F2EA]">
                7-Day Revenue Pulse
              </h2>
              <p className="text-xs text-[#9BA3AA]">Daily dining room sales</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('analytics')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#2DD4BF] hover:underline"
            >
              <span>Full analytics</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-6 grid h-48 grid-cols-7 items-end gap-3 border-b border-white/[0.08] pb-3">
            {metrics.chart.map((bar) => {
              const heightPct = Math.max(8, Math.round((bar.revenue / maxChartRev) * 100));
              return (
                <div key={bar.label} className="flex h-full flex-col items-center justify-end gap-2">
                  <span className="font-mono text-[10px] text-[#9BA3AA] tabular-nums">
                    {bar.revenue > 0 ? formatCurrency(Math.round(bar.revenue), sym) : '—'}
                  </span>
                  <div className="flex w-full max-w-[38px] flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-[#2DD4BF]/80 transition-all duration-300 hover:bg-[#2DD4BF]"
                      style={{ height: `${heightPct}%` }}
                      title={`${bar.label}: ${formatCurrency(bar.revenue, sym)} (${bar.orders} orders)`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-3 text-center">
            {metrics.chart.map((bar) => (
              <span key={bar.label} className="text-[11px] text-[#9BA3AA]">
                {bar.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#F5F2EA]">
              Popular Dishes
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('menu')}
              className="text-xs font-medium text-[#2DD4BF] hover:underline"
            >
              Manage menu
            </button>
          </div>
          <div className="mt-4 divide-y divide-white/[0.06]">
            {metrics.popular.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#9BA3AA]">No orders in this range.</p>
            ) : (
              metrics.popular.map((d, idx) => (
                <div key={d.name} className="flex items-center justify-between py-3">
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium text-[#F5F2EA]">
                      <span className="mr-2 font-mono text-xs text-[#9BA3AA]">0{idx + 1}.</span>
                      {d.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-[#9BA3AA] tabular-nums">
                      {d.qty} portions sold
                    </p>
                  </div>
                  <span className="font-mono text-sm font-medium text-[#F5F2EA] tabular-nums">
                    {formatCurrency(d.rev, sym)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Split: Recent Orders + Table Activity */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#F5F2EA]">
              Recent Orders
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-medium text-[#2DD4BF] hover:underline"
            >
              Open Control Center
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[#9BA3AA]">
                  <th className="pb-2.5 font-medium">Order</th>
                  <th className="pb-2.5 font-medium">Table</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 text-right font-medium">Total</th>
                  <th className="pb-2.5 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {orders.slice(0, 6).map((o) => (
                  <tr key={o.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 font-mono font-medium text-[#F5F2EA]">{o.orderNumber}</td>
                    <td className="py-3 font-mono text-[#9BA3AA] tabular-nums">
                      T{String(o.tableNumber).padStart(2, '0')}
                    </td>
                    <td className="py-3">
                      <OrderStatusText status={o.status} />
                    </td>
                    <td className="py-3 text-right font-mono text-[#F5F2EA] tabular-nums">
                      {formatCurrency(o.totalAmount, sym)}
                    </td>
                    <td className="py-3 text-right font-mono text-[#9BA3AA] tabular-nums">
                      {formatShortTime(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#F5F2EA]">
              Table Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('tables')}
              className="text-xs font-medium text-[#2DD4BF] hover:underline"
            >
              Floor plan
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {tables.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0D1115] px-3 py-2.5"
              >
                <div>
                  <p className="font-mono text-xs font-semibold text-[#F5F2EA]">{t.label}</p>
                  <p className="text-[11px] text-[#9BA3AA]">{t.zone}</p>
                </div>
                <TableStatusText status={t.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
