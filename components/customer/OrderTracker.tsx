import { useState } from 'react';
import { motion } from 'motion/react';
import {
  BellRing,
  CheckCircle2,
  CreditCard,
  FileText,
  Flame,
  Star,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE } from '../../lib/orderLogic';
import { formatCurrency, formatShortTime } from '../../lib/format';
import { apiRequest } from '../../lib/api';
import { useRealtimeChannel } from '../../lib/realtime';
import { useToast } from '../../hooks/useToast';
import { InvoiceModal } from '../common/InvoiceModal';
import type { Order, Restaurant } from '../../types';

interface OrderTrackerProps {
  order: Order;
  restaurant: Restaurant;
  currencySymbol: string;
  gstin?: string | null;
  onOrderUpdated: (order: Order) => void;
  onClose: () => void;
}

export function OrderTracker({
  order,
  restaurant,
  currencySymbol,
  gstin,
  onOrderUpdated,
  onClose,
}: OrderTrackerProps) {
  const { toast } = useToast();
  const [paying, setPaying] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  // Review state
  const [rating, setRating] = useState(5);
  const [foodRating, setFoodRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  useRealtimeChannel(`order:${order.id}`, (event, payload) => {
    if (event === 'order:updated' && payload && typeof payload === 'object') {
      onOrderUpdated(payload as Order);
    }
  });

  const activeIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status);

  const handlePayNow = async () => {
    setPaying(true);
    try {
      const gateway = await apiRequest<{
        orderId: string;
        razorpayOrderId: string;
        testMode: boolean;
      }>('/api/public/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, method: order.paymentMethod }),
      });

      // If in testMode (no Razorpay secrets configured), execute explicit test verification
      if (gateway.testMode) {
        const verified = await apiRequest<{ verified: boolean; order: Order }>(
          '/api/public/payments/verify',
          {
            method: 'POST',
            body: JSON.stringify({
              orderId: order.id,
              razorpayOrderId: gateway.razorpayOrderId,
              razorpayPaymentId: `pay_test_${Date.now()}`,
              razorpaySignature: 'test_verified',
            }),
          }
        );
        onOrderUpdated(verified.order);
        toast('Test payment verified', {
          description: `${order.orderNumber} marked as Paid (Razorpay Test Mode).`,
          tone: 'success',
        });
      } else {
        toast('Razorpay order initialized', {
          description: `Gateway Order ${gateway.razorpayOrderId} ready.`,
          tone: 'info',
        });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Payment initiation failed', { tone: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await apiRequest(`/api/public/menu/${restaurant.slug}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          customerName: order.customerName,
          rating,
          foodRating,
          comment: comment.trim(),
          tableNumber: order.tableNumber,
        }),
      });
      setReviewSubmitted(true);
      toast('Thank you for your feedback!', { tone: 'success' });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit review', { tone: 'error' });
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Order tracking for ${order.orderNumber}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/[0.1] bg-[#12171C] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div>
            <p className="font-mono text-xs text-[#2DD4BF]">{order.orderNumber}</p>
            <h2 className="font-display text-lg font-semibold text-[#F5F2EA]">
              Live Order Status · Table {String(order.tableNumber).padStart(2, '0')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order tracker"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#9BA3AA] hover:bg-white/[0.06]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Status Timeline */}
          {order.status === 'CANCELLED' ? (
            <div className="rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 p-4 text-sm text-[#F87171]">
              This order was cancelled. Please contact restaurant staff for assistance.
            </div>
          ) : (
            <ol className="space-y-3" aria-label="Order progress timeline">
              {ORDER_STATUS_SEQUENCE.map((st, idx) => {
                const done = idx <= activeIdx;
                const current = idx === activeIdx;
                return (
                  <li key={st} className="flex items-center gap-3.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        done
                          ? 'border-[#2DD4BF] bg-[#2DD4BF]/15 text-[#2DD4BF]'
                          : 'border-white/[0.1] bg-[#0D1115] text-[#9BA3AA]/50'
                      }`}
                    >
                      {st === 'PREPARING' ? (
                        <Flame className="h-4 w-4" />
                      ) : st === 'READY' ? (
                        <UtensilsCrossed className="h-4 w-4" />
                      ) : st === 'NEW' ? (
                        <BellRing className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex flex-1 items-center justify-between border-b border-white/[0.06] pb-2.5">
                      <span
                        className={`text-sm font-medium ${
                          current
                            ? 'text-[#F5F2EA]'
                            : done
                              ? 'text-[#F5F2EA]/80'
                              : 'text-[#9BA3AA]/50'
                        }`}
                      >
                        {ORDER_STATUS_LABELS[st]}
                      </span>
                      {current && (
                        <span className="font-mono text-[11px] text-[#2DD4BF]">
                          Active · {formatShortTime(order.updatedAt)}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Payment Box */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0D1115] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9BA3AA]">Total Payable ({order.paymentMethod})</p>
                <p className="mt-0.5 font-mono text-lg font-semibold text-[#F5F2EA] tabular-nums">
                  {formatCurrency(order.totalAmount, currencySymbol)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoice(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#12171C] px-3 py-2 text-xs font-medium text-[#F5F2EA] hover:bg-white/[0.06]"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Receipt
                </button>
                {order.paymentStatus !== 'PAID' && order.paymentMethod !== 'CASH' && (
                  <button
                    type="button"
                    disabled={paying}
                    onClick={handlePayNow}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-3.5 py-2 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>{paying ? 'Processing...' : 'Pay Now (Test Mode)'}</span>
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-[#9BA3AA]">
              Payment status:{' '}
              <span
                className={
                  order.paymentStatus === 'PAID' ? 'font-medium text-[#34D399]' : 'text-[#E7C77A]'
                }
              >
                {order.paymentStatus}
              </span>
            </p>
          </div>

          {/* Order Items Summary */}
          <div className="space-y-2 border-t border-white/[0.08] pt-4 text-xs">
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between text-[#9BA3AA]">
                <span>
                  {it.quantity} × {it.name}
                  {it.variantName ? ` (${it.variantName})` : ''}
                </span>
                <span className="font-mono tabular-nums text-[#F5F2EA]">
                  {formatCurrency(it.lineTotal, currencySymbol)}
                </span>
              </div>
            ))}
          </div>

          {/* Review Box */}
          <div className="border-t border-white/[0.08] pt-4">
            {reviewSubmitted ? (
              <div className="rounded-xl border border-[#34D399]/30 bg-[#34D399]/10 p-4 text-xs text-[#34D399]">
                Thank you! Your {rating}-star review has been shared with {restaurant.name}.
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="space-y-3">
                <p className="text-sm font-medium text-[#F5F2EA]">Rate your experience</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setRating(num);
                        setFoodRating(num);
                      }}
                      aria-label={`Rate ${num} stars`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#0D1115]"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          num <= rating
                            ? 'fill-[#E7C77A] text-[#E7C77A]'
                            : 'text-[#9BA3AA]/40'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How were the dishes and table service?"
                  className="w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA] placeholder:text-[#9BA3AA]/50"
                />
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="rounded-xl border border-white/[0.12] bg-[#171D23] px-4 py-2 text-xs font-medium text-[#F5F2EA] hover:bg-white/[0.08]"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      </motion.div>

      {showInvoice && (
        <InvoiceModal
          order={order}
          restaurant={restaurant}
          gstin={gstin}
          currencySymbol={currencySymbol}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </div>
  );
}
