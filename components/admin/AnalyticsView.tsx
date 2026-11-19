import { useMemo } from 'react';
import { formatCurrency } from '../../lib/format';
import type {
  Category,
  DiningTable,
  MenuItem,
  Order,
  RestaurantSettings,
  Review,
} from '../../types';

interface AnalyticsViewProps {
  settings: RestaurantSettings;
  orders: Order[];
  categories: Category[];
  menuItems: MenuItem[];
  tables: DiningTable[];
  reviews: Review[];
}

export function AnalyticsView({
  settings,
  orders,
  categories,
  menuItems,
  tables,
  reviews,
}: AnalyticsViewProps) {
  const sym = settings.currencySymbol;

  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== 'CANCELLED');
    const completed = orders.filter((o) => o.status === 'COMPLETED' || o.status === 'SERVED');
    const revenue = valid.reduce((s, o) => s + o.totalAmount, 0);
    const aov = valid.length > 0 ? revenue / valid.length : 0;
    const completionRate = orders.length > 0 ? (completed.length / orders.length) * 100 : 100;
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : 0;

    // Top dishes
    const dishTotals = new Map<string, { name: string; qty: number; rev: number }>();
    const dishCategoryLookup = new Map(menuItems.map((m) => [m.id, m.categoryId]));
    const catNameLookup = new Map(categories.map((c) => [c.id, c.name]));
    const catTotals = new Map<string, { name: string; rev: number; qty: number }>();

    for (const o of valid) {
      for (const it of o.items) {
        const cur = dishTotals.get(it.name) || { name: it.name, qty: 0, rev: 0 };
        cur.qty += it.quantity;
        cur.rev += it.lineTotal;
        dishTotals.set(it.name, cur);

        const cid = dishCategoryLookup.get(it.menuItemId);
        const cname = (cid && catNameLookup.get(cid)) || 'Specials';
        const cc = catTotals.get(cname) || { name: cname, rev: 0, qty: 0 };
        cc.rev += it.lineTotal;
        cc.qty += it.quantity;
        catTotals.set(cname, cc);
      }
    }

    // Peak hours across full 24h day in 2-hour service blocks
    const hourBuckets = new Map<number, number>();
    for (let h = 0; h < 24; h += 2) hourBuckets.set(h, 0);
    for (const o of valid) {
      const hr = new Date(o.createdAt).getHours();
      const bucket = Math.floor(hr / 2) * 2;
      hourBuckets.set(bucket, (hourBuckets.get(bucket) ?? 0) + 1);
    }

    // Table performance
    const tblMap = new Map<number, { label: string; orders: number; rev: number }>();
    for (const t of tables) {
      tblMap.set(t.tableNumber, { label: t.label, orders: 0, rev: 0 });
    }
    for (const o of valid) {
      const cur = tblMap.get(o.tableNumber) || {
        label: `Table ${String(o.tableNumber).padStart(2, '0')}`,
        orders: 0,
        rev: 0,
      };
      cur.orders += 1;
      cur.rev += o.totalAmount;
      tblMap.set(o.tableNumber, cur);
    }

    return {
      revenue,
      orderCount: valid.length,
      aov,
      completionRate,
      avgRating,
      topDishes: [...dishTotals.values()].sort((a, b) => b.rev - a.rev).slice(0, 6),
      categories: [...catTotals.values()].sort((a, b) => b.rev - a.rev),
      peakHours: [...hourBuckets.entries()].map(([h, count]) => ({
        label: h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`,
        count,
      })),
      tablePerf: [...tblMap.values()].sort((a, b) => b.rev - a.rev).slice(0, 6),
    };
  }, [orders, categories, menuItems, tables, reviews]);

  const maxHour = Math.max(1, ...stats.peakHours.map((h) => h.count));
  const maxCatRev = Math.max(1, ...stats.categories.map((c) => c.rev));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
          Analytics
        </h1>
        <p className="mt-1 text-xs text-[#9BA3AA]">
          Sales velocity, category mix, peak hours, and table productivity
        </p>
      </div>

      {/* Top Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Gross Revenue</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#2DD4BF] tabular-nums">
            {formatCurrency(stats.revenue, sym)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Total Orders</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F5F2EA] tabular-nums">
            {stats.orderCount}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Avg Order Value</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F5F2EA] tabular-nums">
            {formatCurrency(Math.round(stats.aov), sym)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Completion Rate</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#34D399] tabular-nums">
            {stats.completionRate.toFixed(0)}%
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Guest Rating</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#E7C77A] tabular-nums">
            {stats.avgRating ? `${stats.avgRating.toFixed(1)} / 5` : '—'}
          </p>
        </div>
      </div>

      {/* Peak Hours + Category Share */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 lg:col-span-7">
          <h2 className="font-display text-base font-semibold text-[#F5F2EA]">Peak Hours</h2>
          <p className="text-xs text-[#9BA3AA]">Order volume across service hours</p>
          <div className="mt-6 grid h-44 grid-cols-12 items-end gap-2 border-b border-white/[0.08] pb-2">
            {stats.peakHours.map((slot) => (
              <div key={slot.label} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span className="font-mono text-[10px] text-[#9BA3AA] tabular-nums">
                  {slot.count > 0 ? slot.count : ''}
                </span>
                <div
                  className={`w-full rounded-t transition-colors ${slot.count > 0 ? 'bg-[#E7C77A]' : 'bg-[#171D23]'}`}
                  style={{ height: `${slot.count > 0 ? Math.max(12, Math.round((slot.count / maxHour) * 100)) : 4}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-12 gap-2 text-center">
            {stats.peakHours.map((slot) => (
              <span key={slot.label} className="font-mono text-[10px] text-[#9BA3AA]">
                {slot.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 lg:col-span-5">
          <h2 className="font-display text-base font-semibold text-[#F5F2EA]">
            Popular Categories
          </h2>
          <div className="mt-4 space-y-3.5">
            {stats.categories.map((cat) => (
              <div key={cat.name}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[#F5F2EA]">{cat.name}</span>
                  <span className="font-mono text-[#9BA3AA] tabular-nums">
                    {formatCurrency(cat.rev, sym)} · {cat.qty} items
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#0D1115]">
                  <div
                    className="h-full rounded-full bg-[#2DD4BF]"
                    style={{ width: `${Math.max(4, Math.round((cat.rev / maxCatRev) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Dishes + Table Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-5">
          <h2 className="font-display text-base font-semibold text-[#F5F2EA]">
            Top Revenue Dishes
          </h2>
          <div className="mt-4 divide-y divide-white/[0.06] text-xs">
            {stats.topDishes.map((d) => (
              <div key={d.name} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-[#F5F2EA]">{d.name}</p>
                  <p className="font-mono text-[11px] text-[#9BA3AA] tabular-nums">
                    {d.qty} units
                  </p>
                </div>
                <span className="font-mono font-semibold text-[#F5F2EA] tabular-nums">
                  {formatCurrency(d.rev, sym)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-5">
          <h2 className="font-display text-base font-semibold text-[#F5F2EA]">
            Table Performance
          </h2>
          <div className="mt-4 divide-y divide-white/[0.06] text-xs">
            {stats.tablePerf.map((t) => (
              <div key={t.label} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-mono font-medium text-[#F5F2EA]">{t.label}</p>
                  <p className="text-[11px] text-[#9BA3AA] tabular-nums">{t.orders} orders</p>
                </div>
                <span className="font-mono font-semibold text-[#2DD4BF] tabular-nums">
                  {formatCurrency(t.rev, sym)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
