import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import type { Offer, OfferType, RestaurantSettings } from '../../types';

interface OffersViewProps {
  offers: Offer[];
  settings: RestaurantSettings;
  onCreateOffer: (payload: Record<string, unknown>) => Promise<void>;
  onToggleOffer: (id: string, isActive: boolean) => Promise<void>;
  onDeleteOffer: (id: string) => Promise<void>;
}

export function OffersView({
  offers,
  settings,
  onCreateOffer,
  onToggleOffer,
  onDeleteOffer,
}: OffersViewProps) {
  const sym = settings.currencySymbol;
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [offerType, setOfferType] = useState<OfferType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('15');
  const [minOrderAmount, setMinOrderAmount] = useState('500');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreateOffer({
        title: title.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        offerType,
        discountValue: Number(discountValue) || 0,
        minOrderAmount: Number(minOrderAmount) || 0,
        startsAt: new Date(`${startsAt}T00:00:00Z`).toISOString(),
        endsAt: new Date(`${endsAt}T23:59:59Z`).toISOString(),
        isActive: true,
      });
      setTitle('');
      setCode('');
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
          Offers & Promotions
        </h1>
        <p className="mt-1 text-xs text-[#9BA3AA]">
          Active offers appear automatically on your customer QR menu and cart checkout
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-4 rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 sm:grid-cols-12"
      >
        <div className="sm:col-span-4">
          <label className="block text-xs font-medium text-[#9BA3AA]">Offer Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Happy Hour 15% Off"
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[#9BA3AA]">Promo Code</label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="HAPPY15"
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-xs text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[#9BA3AA]">Type</label>
          <select
            value={offerType}
            onChange={(e) => setOfferType(e.target.value as OfferType)}
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
          >
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FLAT">Flat ({sym})</option>
            <option value="BOGO">Buy 1 Get 1</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[#9BA3AA]">
            {offerType === 'PERCENTAGE' ? 'Discount %' : `Discount ${sym}`}
          </label>
          <input
            type="number"
            min={0}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-xs text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[#9BA3AA]">Min Order ({sym})</label>
          <input
            type="number"
            min={0}
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-xs text-[#F5F2EA]"
          />
        </div>

        <div className="sm:col-span-5">
          <label className="block text-xs font-medium text-[#9BA3AA]">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Valid on dine-in QR orders"
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[#9BA3AA]">Start Date</label>
          <input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[#9BA3AA]">End Date</label>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
          />
        </div>
        <div className="flex items-end sm:col-span-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2DD4BF] px-4 py-2.5 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90"
          >
            <Plus className="h-4 w-4" />
            <span>Create Offer</span>
          </button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#12171C] p-5"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-semibold text-[#2DD4BF]">
                    {offer.code}
                  </span>
                  <h2 className="mt-1 font-display text-base font-semibold text-[#F5F2EA]">
                    {offer.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleOffer(offer.id, !offer.isActive)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    offer.isActive
                      ? 'border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]'
                      : 'border-white/[0.1] text-[#9BA3AA]'
                  }`}
                >
                  {offer.isActive ? 'Active' : 'Paused'}
                </button>
              </div>
              <p className="mt-2 text-xs text-[#9BA3AA]">{offer.description}</p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs text-[#9BA3AA]">
              <span className="font-mono tabular-nums">
                {offer.offerType === 'PERCENTAGE'
                  ? `${offer.discountValue}% off`
                  : offer.offerType === 'FLAT'
                    ? `${formatCurrency(offer.discountValue, sym)} off`
                    : 'Buy 1 Get 1'}{' '}
                · Min {formatCurrency(offer.minOrderAmount, sym)}
              </span>
              <button
                type="button"
                onClick={() => onDeleteOffer(offer.id)}
                aria-label={`Delete offer ${offer.code}`}
                className="rounded-lg p-1 text-[#9BA3AA] hover:text-[#F87171]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
