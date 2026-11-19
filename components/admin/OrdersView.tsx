import { useState } from 'react';
import { Bell, Check, FileText, XCircle } from 'lucide-react';
import { formatCurrency, formatRelativeMinutes } from '../../lib/format';
import { getNextOrderStatus, ORDER_STATUS_LABELS } from '../../lib/orderLogic';
import { OrderStatusText, PaymentStatusText } from '../common/StatusLabel';
import { InvoiceModal } from '../common/InvoiceModal';
import type {
  Order,
  OrderStatus,
  Restaurant,
  RestaurantSettings,
  ServiceRequest,
  ServiceRequestStatus,
} from '../../types';

interface OrdersViewProps {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  orders: Order[];
  serviceRequests: ServiceRequest[];
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onMarkPaid: (orderId: string) => Promise<void>;
  onUpdateServiceRequest: (id: string, status: ServiceRequestStatus) => Promise<void>;
}

const FILTER_TABS: Array<{ id: 'ALL' | OrderStatus; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'NEW', label: 'New' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'PREPARING', label: 'Preparing' },
  { id: 'READY', label: 'Ready' },
  { id: 'SERVED', label: 'Served' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export function OrdersView({
  restaurant,
  settings,
  orders,
  serviceRequests,
  onAdvanceOrderStatus,
  onMarkPaid,
  onUpdateServiceRequest,
}: OrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  const sym = settings.currencySymbol;
  const filtered =
    statusFilter === 'ALL'
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  const activeRequests = serviceRequests.filter((sr) => sr.status !== 'COMPLETED');

  const handleAction = async (orderId: string, nextStatus: OrderStatus) => {
    setBusyId(orderId);
    try {
      await onAdvanceOrderStatus(orderId, nextStatus);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
            Orders Control Center
          </h1>
          <p className="mt-1 text-xs text-[#9BA3AA]">
            Live kitchen ticket stream · Updates sync instantaneously to customer table trackers
          </p>
        </div>
      </div>

      {/* Active Service Requests Queue */}
      {activeRequests.length > 0 && (
        <section
          aria-label="Live Service Requests"
          className="rounded-2xl border border-[#E7C77A]/30 bg-[#12171C] p-4"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-[#E7C77A]">
            <Bell className="h-4 w-4" />
            <span>Active Table Service Requests ({activeRequests.length})</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeRequests.map((sr) => (
              <div
                key={sr.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0D1115] p-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-[#F5F2EA]">
                    Table {String(sr.tableNumber).padStart(2, '0')} ·{' '}
                    {sr.requestType.replace(/_/g, ' ')}
                  </p>
                  {sr.note && <p className="mt-0.5 truncate text-xs text-[#9BA3AA]">{sr.note}</p>}
                  <p className="mt-0.5 text-[11px] text-[#9BA3AA]">
                    {sr.status} · {formatRelativeMinutes(sr.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {sr.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => onUpdateServiceRequest(sr.id, 'ACKNOWLEDGED')}
                      className="rounded-lg border border-white/[0.12] bg-[#171D23] px-2.5 py-1.5 text-[11px] font-medium text-[#2DD4BF]"
                    >
                      Ack
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onUpdateServiceRequest(sr.id, 'COMPLETED')}
                    className="rounded-lg bg-[#2DD4BF] px-2.5 py-1.5 text-[11px] font-semibold text-[#080A0C]"
                  >
                    Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Status Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {FILTER_TABS.map((t) => {
          const count =
            t.id === 'ALL' ? orders.length : orders.filter((o) => o.status === t.id).length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatusFilter(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === t.id
                  ? 'bg-[#2DD4BF] text-[#080A0C]'
                  : 'border border-white/[0.08] bg-[#12171C] text-[#9BA3AA] hover:text-[#F5F2EA]'
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Order Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-12 text-center">
          <p className="text-sm font-medium text-[#F5F2EA]">No orders in this status</p>
          <p className="mt-1 text-xs text-[#9BA3AA]">
            Incoming orders from your QR table menus will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((order) => {
            const nextStatus = getNextOrderStatus(order.status);
            return (
              <article
                key={order.id}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#12171C] p-5"
              >
                <div>
                  <div className="flex items-start justify-between border-b border-white/[0.08] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-[#F5F2EA]">
                          {order.orderNumber}
                        </span>
                        <span className="text-xs text-[#9BA3AA]">·</span>
                        <span className="font-mono text-xs font-medium text-[#2DD4BF]">
                          Table {String(order.tableNumber).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#9BA3AA]">
                        {order.customerName} · {formatRelativeMinutes(order.createdAt)}
                      </p>
                    </div>
                    <OrderStatusText status={order.status} />
                  </div>

                  {/* Line items */}
                  <ul className="mt-3 space-y-2 border-b border-white/[0.08] pb-3 text-xs">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono font-semibold text-[#F5F2EA]">
                            {item.quantity}×
                          </span>{' '}
                          <span className="text-[#F5F2EA]">{item.name}</span>
                          {item.variantName && (
                            <span className="text-[#9BA3AA]"> ({item.variantName})</span>
                          )}
                          {item.addons.length > 0 && (
                            <p className="pl-5 text-[11px] text-[#9BA3AA]">
                              + {item.addons.map((a) => a.name).join(', ')}
                            </p>
                          )}
                          {item.specialInstructions && (
                            <p className="pl-5 text-[11px] italic text-[#E7C77A]">
                              Note: {item.specialInstructions}
                            </p>
                          )}
                        </div>
                        <span className="font-mono text-[#9BA3AA] tabular-nums shrink-0">
                          {formatCurrency(item.lineTotal, sym)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {order.notes && (
                    <p className="mt-2.5 text-xs italic text-[#E7C77A]">
                      Order note: {order.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#9BA3AA]">{order.paymentMethod}</span>
                      <span className="text-[#9BA3AA]">·</span>
                      <PaymentStatusText status={order.paymentStatus} />
                    </div>
                    <span className="font-mono text-base font-semibold text-[#F5F2EA] tabular-nums">
                      {formatCurrency(order.totalAmount, sym)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {nextStatus && (
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => handleAction(order.id, nextStatus)}
                        className="flex-1 rounded-xl bg-[#2DD4BF] px-3 py-2 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 disabled:opacity-50 whitespace-nowrap"
                      >
                        Move to {ORDER_STATUS_LABELS[nextStatus]}
                      </button>
                    )}

                    {order.paymentStatus === 'PENDING' && order.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => onMarkPaid(order.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#34D399]/40 bg-[#34D399]/10 px-3 py-2 text-xs font-medium text-[#34D399] hover:bg-[#34D399]/20"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Mark Paid</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setInvoiceOrder(order)}
                      aria-label={`View invoice for ${order.orderNumber}`}
                      className="rounded-xl border border-white/[0.1] bg-[#0D1115] p-2 text-[#9BA3AA] hover:text-[#F5F2EA]"
                    >
                      <FileText className="h-4 w-4" />
                    </button>

                    {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => handleAction(order.id, 'CANCELLED')}
                        aria-label={`Cancel order ${order.orderNumber}`}
                        className="rounded-xl border border-white/[0.1] bg-[#0D1115] p-2 text-[#9BA3AA] hover:text-[#F87171]"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {invoiceOrder && (
        <InvoiceModal
          order={invoiceOrder}
          restaurant={restaurant}
          gstin={settings.gstin}
          currencySymbol={sym}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
