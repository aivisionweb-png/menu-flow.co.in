import { useState } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus, Tag, Trash2, X } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { calculateOrderTotals, computeCartLineTotal } from '../../lib/orderLogic';
import type { CartItem, Offer, PaymentMethod, RestaurantSettings } from '../../types';

interface CartSheetProps {
  items: CartItem[];
  tableNumber: number;
  settings: RestaurantSettings;
  offers: Offer[];
  appliedOffer: Offer | null;
  onApplyOffer: (offer: Offer | null) => void;
  onUpdateQty: (cartKey: string, delta: number) => void;
  onRemoveItem: (cartKey: string) => void;
  onPlaceOrder: (input: {
    customerName: string;
    customerPhone: string;
    paymentMethod: PaymentMethod;
    notes: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function CartSheet({
  items,
  tableNumber,
  settings,
  offers,
  appliedOffer,
  onApplyOffer,
  onUpdateQty,
  onRemoveItem,
  onPlaceOrder,
  onClose,
}: CartSheetProps) {
  const [customerName, setCustomerName] = useState('Guest');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    settings.allowOnlinePayments ? 'UPI' : 'CASH'
  );
  const [offerInput, setOfferInput] = useState(appliedOffer?.code ?? '');
  const [offerMessage, setOfferMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totals = calculateOrderTotals(items, settings, appliedOffer);
  const sym = settings.currencySymbol;

  const handleApplyCode = () => {
    const code = offerInput.trim().toUpperCase();
    if (!code) {
      onApplyOffer(null);
      setOfferMessage('');
      return;
    }
    const found = offers.find((o) => o.code.toUpperCase() === code && o.isActive);
    if (!found) {
      setOfferMessage('Offer code not found or expired.');
      return;
    }
    if (totals.subtotal < found.minOrderAmount) {
      setOfferMessage(
        `Minimum order of ${formatCurrency(found.minOrderAmount, sym)} required for ${found.code}.`
      );
      return;
    }
    onApplyOffer(found);
    setOfferMessage(`${found.code} applied.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      await onPlaceOrder({
        customerName: customerName.trim() || 'Guest',
        customerPhone: customerPhone.trim(),
        paymentMethod,
        notes: notes.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to place order');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/80 sm:items-stretch"
      role="dialog"
      aria-modal="true"
      aria-label="Your Cart"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        className="flex max-h-[92vh] w-full flex-col rounded-t-3xl border-t border-white/[0.1] bg-[#12171C] sm:max-h-screen sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#F5F2EA]">Your Order</h2>
            <p className="text-xs text-[#9BA3AA]">
              Table {String(tableNumber).padStart(2, '0')} · {items.reduce((s, i) => s + i.quantity, 0)} items
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#9BA3AA] hover:bg-white/[0.06] hover:text-[#F5F2EA]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-[#F5F2EA]">Your cart is empty</p>
                <p className="mt-1 text-xs text-[#9BA3AA]">
                  Add dishes from the menu to place a table order.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/[0.06]">
                  {items.map((item) => (
                    <div key={item.cartKey} className="flex items-start justify-between gap-3 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#F5F2EA]">{item.menuItem.name}</p>
                        {item.variant && (
                          <p className="text-xs text-[#9BA3AA]">{item.variant.name}</p>
                        )}
                        {item.addons.length > 0 && (
                          <p className="text-xs text-[#9BA3AA]">
                            + {item.addons.map((a) => a.name).join(', ')}
                          </p>
                        )}
                        {item.specialInstructions && (
                          <p className="mt-0.5 text-[11px] italic text-[#E7C77A]">
                            "{item.specialInstructions}"
                          </p>
                        )}
                        <p className="mt-1 font-mono text-xs text-[#F5F2EA] tabular-nums">
                          {formatCurrency(computeCartLineTotal(item), sym)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center rounded-lg border border-white/[0.1] bg-[#0D1115]">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.cartKey, -1)}
                            aria-label={`Decrease quantity of ${item.menuItem.name}`}
                            className="flex h-9 w-9 items-center justify-center text-[#F5F2EA]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.cartKey, 1)}
                            aria-label={`Increase quantity of ${item.menuItem.name}`}
                            className="flex h-9 w-9 items-center justify-center text-[#F5F2EA]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.cartKey)}
                          aria-label={`Remove ${item.menuItem.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9BA3AA] hover:text-[#F87171]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Offer Code */}
                <div className="border-t border-white/[0.08] pt-4">
                  <label htmlFor="cart-offer" className="block text-xs font-medium text-[#9BA3AA]">
                    Promo / Offer Code
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9BA3AA]" />
                      <input
                        id="cart-offer"
                        type="text"
                        value={offerInput}
                        onChange={(e) => setOfferInput(e.target.value.toUpperCase())}
                        placeholder="e.g. VERDE10"
                        className="w-full rounded-xl border border-white/[0.1] bg-[#0D1115] py-2 pl-9 pr-3 font-mono text-xs text-[#F5F2EA] focus:border-[#2DD4BF] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCode}
                      className="rounded-xl border border-white/[0.12] bg-[#171D23] px-4 py-2 text-xs font-medium text-[#F5F2EA] hover:bg-white/[0.08]"
                    >
                      Apply
                    </button>
                  </div>
                  {offerMessage && (
                    <p className="mt-1.5 text-xs text-[#2DD4BF]">{offerMessage}</p>
                  )}
                </div>

                {/* Diner Details */}
                <div className="grid gap-3 border-t border-white/[0.08] pt-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="guest-name" className="block text-xs font-medium text-[#9BA3AA]">
                      Your Name
                    </label>
                    <input
                      id="guest-name"
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
                    />
                  </div>
                  <div>
                    <label htmlFor="guest-phone" className="block text-xs font-medium text-[#9BA3AA]">
                      Phone (for bill SMS)
                    </label>
                    <input
                      id="guest-phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+91 98..."
                      className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="border-t border-white/[0.08] pt-4">
                  <p className="text-xs font-medium text-[#9BA3AA]">Payment Method</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        { id: 'UPI', label: 'UPI', enabled: settings.allowOnlinePayments },
                        { id: 'CARD', label: 'Card', enabled: settings.allowOnlinePayments },
                        { id: 'NETBANKING', label: 'Bank', enabled: settings.allowOnlinePayments },
                        { id: 'CASH', label: 'Cash', enabled: settings.allowCashPayments },
                      ] as const
                    )
                      .filter((m) => m.enabled)
                      .map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                            paymentMethod === m.id
                              ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]'
                              : 'border-white/[0.08] bg-[#0D1115] text-[#9BA3AA]'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="order-notes" className="block text-xs font-medium text-[#9BA3AA]">
                    Order Notes (optional)
                  </label>
                  <input
                    id="order-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Serve starters first, extra napkins..."
                    className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
                  />
                </div>

                {/* Bill Breakdown */}
                <div className="space-y-1.5 rounded-xl border border-white/[0.08] bg-[#0D1115] p-4 text-xs">
                  <div className="flex justify-between text-[#9BA3AA]">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">{formatCurrency(totals.subtotal, sym)}</span>
                  </div>
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-[#34D399]">
                      <span>Offer ({totals.appliedOffer?.code})</span>
                      <span className="font-mono tabular-nums">
                        −{formatCurrency(totals.discountAmount, sym)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#9BA3AA]">
                    <span>GST ({settings.taxRatePercent}%)</span>
                    <span className="font-mono tabular-nums">{formatCurrency(totals.taxAmount, sym)}</span>
                  </div>
                  {settings.serviceChargePercent > 0 && (
                    <div className="flex justify-between text-[#9BA3AA]">
                      <span>Service Charge ({settings.serviceChargePercent}%)</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(totals.serviceChargeAmount, sym)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/[0.08] pt-2 text-sm font-semibold text-[#F5F2EA]">
                    <span>Grand Total</span>
                    <span className="font-mono tabular-nums">{formatCurrency(totals.totalAmount, sym)}</span>
                  </div>
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-xs text-[#F87171]">
                {error}
              </p>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-white/[0.08] bg-[#12171C] px-5 py-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex h-12 w-full items-center justify-between rounded-xl bg-[#2DD4BF] px-5 text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 disabled:opacity-60"
              >
                <span>{submitting ? 'Sending to kitchen...' : 'Place Order'}</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(totals.totalAmount, sym)}
                </span>
              </button>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
