import { Star } from 'lucide-react';
import { formatDateTime } from '../../lib/format';
import type { Review } from '../../types';

interface ReviewsViewProps {
  reviews: Review[];
}

export function ReviewsView({ reviews }: ReviewsViewProps) {
  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
            Guest Reviews
          </h1>
          <p className="mt-1 text-xs text-[#9BA3AA]">
            Direct post-order feedback submitted from customer table trackers
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#12171C] px-5 py-3">
          <Star className="h-5 w-5 fill-[#E7C77A] text-[#E7C77A]" />
          <div>
            <p className="font-mono text-xl font-semibold text-[#F5F2EA] tabular-nums">
              {avg ? avg.toFixed(1) : '—'} / 5.0
            </p>
            <p className="text-[11px] text-[#9BA3AA]">{reviews.length} verified reviews</p>
          </div>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-12 text-center text-xs text-[#9BA3AA]">
          No guest reviews submitted yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((rev) => (
            <article
              key={rev.id}
              className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[#F5F2EA]">{rev.customerName}</h2>
                  <p className="mt-0.5 text-xs text-[#9BA3AA]">
                    {rev.tableNumber ? `Table ${String(rev.tableNumber).padStart(2, '0')} · ` : ''}
                    {rev.orderNumber ? `${rev.orderNumber} · ` : ''}
                    {formatDateTime(rev.createdAt)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-[#E7C77A] tabular-nums">
                  <Star className="h-3.5 w-3.5 fill-[#E7C77A]" />
                  {rev.rating}.0
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#F5F2EA]/90">
                {rev.comment || 'No written comment provided.'}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
