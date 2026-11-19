import { Printer, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/format';
import type { Order, Restaurant } from '../../types';

interface InvoiceModalProps {
  order: Order;
  restaurant: Pick<Restaurant, 'name' | 'address' | 'city' | 'phone'>;
  invoiceNumber?: string;
  gstin?: string | null;
  currencySymbol?: string;
  onClose: () => void;
}

export function InvoiceModal({
  order,
  restaurant,
  invoiceNumber,
  gstin,
  currencySymbol = '₹',
  onClose,
}: InvoiceModalProps) {
  const invNo = invoiceNumber || `INV-${order.orderNumber}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Tax Invoice ${invNo}`}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#12171C] shadow-2xl">
        <div className="no-print flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[#F5F2EA]">Tax Invoice</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-3 py-1.5 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice"
              className="rounded-lg p-1.5 text-[#9BA3AA] hover:bg-white/[0.06] hover:text-[#F5F2EA]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 text-sm text-[#F5F2EA]">
          <div className="border-b border-dashed border-white/[0.12] pb-4 text-center">
            <p className="font-display text-lg font-semibold tracking-tight">{restaurant.name}</p>
            <p className="mt-0.5 text-xs text-[#9BA3AA]">
              {restaurant.address}, {restaurant.city}
            </p>
            <p className="text-xs text-[#9BA3AA]">Tel: {restaurant.phone}</p>
            {gstin && <p className="mt-1 font-mono text-[11px] text-[#9BA3AA]">GSTIN: {gstin}</p>}
          </div>

          <div className="grid grid-cols-2 gap-y-1.5 border-b border-dashed border-white/[0.12] py-3 text-xs">
            <span className="text-[#9BA3AA]">Invoice No</span>
            <span className="text-right font-mono tabular-nums">{invNo}</span>
            <span className="text-[#9BA3AA]">Order / Table</span>
            <span className="text-right font-mono tabular-nums">
              {order.orderNumber} · T{String(order.tableNumber).padStart(2, '0')}
            </span>
            <span className="text-[#9BA3AA]">Guest</span>
            <span className="text-right">{order.customerName}</span>
            <span className="text-[#9BA3AA]">Date</span>
            <span className="text-right font-mono tabular-nums">{formatDateTime(order.createdAt)}</span>
          </div>

          <div className="space-y-2.5 border-b border-dashed border-white/[0.12] py-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#F5F2EA]">
                    {item.quantity} × {item.name}
                    {item.variantName ? ` (${item.variantName})` : ''}
                  </p>
                  {item.addons.length > 0 && (
                    <p className="text-[11px] text-[#9BA3AA]">
                      + {item.addons.map((a) => a.name).join(', ')}
                    </p>
                  )}
                </div>
                <span className="font-mono text-xs tabular-nums text-[#F5F2EA]">
                  {formatCurrency(item.lineTotal, currencySymbol)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 pt-3 text-xs">
            <div className="flex justify-between text-[#9BA3AA]">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatCurrency(order.subtotal, currencySymbol)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-[#34D399]">
                <span>Offer ({order.appliedOfferCode || 'DISCOUNT'})</span>
                <span className="font-mono tabular-nums">
                  −{formatCurrency(order.discountAmount, currencySymbol)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[#9BA3AA]">
              <span>GST</span>
              <span className="font-mono tabular-nums">{formatCurrency(order.taxAmount, currencySymbol)}</span>
            </div>
            {order.serviceChargeAmount > 0 && (
              <div className="flex justify-between text-[#9BA3AA]">
                <span>Service Charge</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(order.serviceChargeAmount, currencySymbol)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-white/[0.1] pt-2 text-sm font-semibold text-[#F5F2EA]">
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatCurrency(order.totalAmount, currencySymbol)}</span>
            </div>
            <div className="flex justify-between pt-1 text-[11px] text-[#9BA3AA]">
              <span>Payment · {order.paymentMethod}</span>
              <span className={order.paymentStatus === 'PAID' ? 'text-[#34D399]' : 'text-[#E7C77A]'}>
                {order.paymentStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
