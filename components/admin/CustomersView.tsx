import { useState } from 'react';
import { Search } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/format';
import type { Customer, RestaurantSettings } from '../../types';

interface CustomersViewProps {
  customers: Customer[];
  settings: RestaurantSettings;
}

export function CustomersView({ customers, settings }: CustomersViewProps) {
  const [search, setSearch] = useState('');
  const sym = settings.currencySymbol;

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });

  const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);
  const repeatCount = customers.filter((c) => c.totalOrders > 1).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
            Customers
          </h1>
          <p className="mt-1 text-xs text-[#9BA3AA]">
            {customers.length} diners · {repeatCount} repeat guests ·{' '}
            {formatCurrency(totalSpent, sym)} cumulative spend
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9BA3AA]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guest name or phone..."
            className="w-full rounded-xl border border-white/[0.1] bg-[#12171C] py-2 pl-9 pr-3 text-xs text-[#F5F2EA]"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#12171C]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] text-[#9BA3AA]">
              <th className="px-5 py-3.5 font-medium">Guest Name</th>
              <th className="px-5 py-3.5 font-medium">Phone / Contact</th>
              <th className="px-5 py-3.5 text-right font-medium">Orders</th>
              <th className="px-5 py-3.5 text-right font-medium">Total Spent</th>
              <th className="px-5 py-3.5 text-right font-medium">Last Visit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[#9BA3AA]">
                  No customers found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5 font-medium text-[#F5F2EA]">{c.name}</td>
                  <td className="px-5 py-3.5 font-mono text-[#9BA3AA]">
                    {c.phone || c.email || 'Anonymous QR Guest'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[#F5F2EA] tabular-nums">
                    {c.totalOrders}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[#2DD4BF] tabular-nums">
                    {formatCurrency(c.totalSpent, sym)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[#9BA3AA] tabular-nums">
                    {formatDateTime(c.lastVisitAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
