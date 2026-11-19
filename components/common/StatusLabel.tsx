import {
  CheckCircle2,
  Clock,
  Flame,
  BellRing,
  UtensilsCrossed,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type { OrderStatus, PaymentStatus, TableStatus } from '../../types';

export function OrderStatusText({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; color: string; Icon: typeof Clock }> = {
    NEW: { label: 'New Order', color: 'text-[#E7C77A]', Icon: BellRing },
    CONFIRMED: { label: 'Confirmed', color: 'text-[#2DD4BF]', Icon: CheckCircle2 },
    PREPARING: { label: 'Preparing', color: 'text-[#2DD4BF]', Icon: Flame },
    READY: { label: 'Ready', color: 'text-[#34D399]', Icon: UtensilsCrossed },
    SERVED: { label: 'Served', color: 'text-[#9BA3AA]', Icon: CheckCircle2 },
    COMPLETED: { label: 'Completed', color: 'text-[#34D399]', Icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', color: 'text-[#F87171]', Icon: XCircle },
  };
  const cfg = map[status];
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}

export function PaymentStatusText({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; color: string }> = {
    PAID: { label: 'Paid', color: 'text-[#34D399]' },
    PENDING: { label: 'Pending', color: 'text-[#E7C77A]' },
    FAILED: { label: 'Failed', color: 'text-[#F87171]' },
    REFUNDED: { label: 'Refunded', color: 'text-[#9BA3AA]' },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${cfg.color}`}>
      {status === 'FAILED' && <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{cfg.label}</span>
    </span>
  );
}

export function TableStatusText({ status }: { status: TableStatus }) {
  const map: Record<TableStatus, { label: string; color: string }> = {
    AVAILABLE: { label: 'Available', color: 'text-[#34D399]' },
    OCCUPIED: { label: 'Occupied', color: 'text-[#2DD4BF]' },
    ORDERING: { label: 'Ordering', color: 'text-[#E7C77A]' },
    BILL_REQUESTED: { label: 'Bill Requested', color: 'text-[#F87171]' },
  };
  const cfg = map[status];
  return (
    <span className={`text-xs font-medium whitespace-nowrap ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}
