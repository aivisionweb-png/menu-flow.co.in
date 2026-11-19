import { useState } from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { PaymentStatusText } from '../common/StatusLabel';
import { InvoiceModal } from '../common/InvoiceModal';
import type {
  Invoice,
  Order,
  Payment,
  Restaurant,
  RestaurantSettings,
} from '../../types';

interface PaymentsViewProps {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  payments: Payment[];
  invoices: Invoice[];
  orders: Order[];
  razorpayStatus: { configured: boolean; mode: 'LIVE' | 'TEST_MODE'; keyId: string | null };
  onMarkPaid: (orderId: string) => Promise<void>;
}

export function PaymentsView({
  restaurant,
  settings,
  payments,
  invoices,
  orders,
  razorpayStatus,
  onMarkPaid,
}: PaymentsViewProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const sym = settings.currencySymbol;

  const totalCollected = payments
    .filter((p) => p.status === 'PAID')
    .reduce((s, p) => s + p.amount, 0);
  const pendingTotal = payments
    .filter((p) => p.status === 'PENDING')
    .reduce((s, p) => s + p.amount, 0);

  const openInvoiceForOrder = (orderId: string) => {
    const found = orders.find((o) => o.id === orderId);
    if (found) setSelectedOrder(found);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
            Payments & Invoices
          </h1>
          <p className="mt-1 text-xs text-[#9BA3AA]">
            Razorpay UPI / Cards / Netbanking ledger and GST tax invoices
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-[#12171C] px-4 py-2 text-xs">
          <ShieldCheck
            className={`h-4 w-4 ${razorpayStatus.configured ? 'text-[#34D399]' : 'text-[#E7C77A]'}`}
          />
          <span className="text-[#F5F2EA]">
            Razorpay Gateway:{' '}
            <strong className="font-mono">
              {razorpayStatus.configured ? 'LIVE' : 'TEST MODE'}
            </strong>
          </span>
        </div>
      </div>

      {!razorpayStatus.configured && (
        <div className="rounded-2xl border border-[#E7C77A]/30 bg-[#12171C] p-4 text-xs text-[#9BA3AA]">
          <p className="font-medium text-[#E7C77A]">
            Running in Razorpay Test Mode
          </p>
          <p className="mt-1">
            To process live INR UPI, Card, and Netbanking settlements, add{' '}
            <code className="text-[#F5F2EA]">RAZORPAY_KEY_ID</code>,{' '}
            <code className="text-[#F5F2EA]">RAZORPAY_KEY_SECRET</code>, and{' '}
            <code className="text-[#F5F2EA]">RAZORPAY_WEBHOOK_SECRET</code> to your server
            environment. Secret keys are never exposed to the browser.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Collected Revenue</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#34D399] tabular-nums">
            {formatCurrency(totalCollected, sym)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Pending Collection</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#E7C77A] tabular-nums">
            {formatCurrency(pendingTotal, sym)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-4">
          <p className="text-xs text-[#9BA3AA]">Invoices Issued</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F5F2EA] tabular-nums">
            {invoices.length}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#12171C]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] text-[#9BA3AA]">
              <th className="px-5 py-3.5 font-medium">Order</th>
              <th className="px-5 py-3.5 font-medium">Method / Provider</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">Gateway Ref</th>
              <th className="px-5 py-3.5 text-right font-medium">Amount</th>
              <th className="px-5 py-3.5 text-right font-medium">Date</th>
              <th className="px-5 py-3.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3.5 font-mono font-semibold text-[#F5F2EA]">
                  {p.orderNumber}
                </td>
                <td className="px-5 py-3.5 text-[#9BA3AA]">
                  {p.method} · {p.provider}
                  {p.testMode ? ' (Test)' : ''}
                </td>
                <td className="px-5 py-3.5">
                  <PaymentStatusText status={p.status} />
                </td>
                <td className="px-5 py-3.5 font-mono text-[11px] text-[#9BA3AA]">
                  {p.razorpayPaymentId || p.razorpayOrderId || '—'}
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold text-[#F5F2EA] tabular-nums">
                  {formatCurrency(p.amount, sym)}
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-[#9BA3AA] tabular-nums">
                  {formatDateTime(p.createdAt)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="inline-flex items-center gap-2">
                    {p.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => onMarkPaid(p.orderId)}
                        className="rounded-lg border border-[#34D399]/40 bg-[#34D399]/10 px-2.5 py-1 text-[11px] font-medium text-[#34D399]"
                      >
                        Mark Paid
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openInvoiceForOrder(p.orderId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#0D1115] px-2.5 py-1 text-[11px] text-[#F5F2EA]"
                    >
                      <FileText className="h-3 w-3" />
                      Invoice
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <InvoiceModal
          order={selectedOrder}
          restaurant={restaurant}
          gstin={settings.gstin}
          currencySymbol={sym}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
