import { useState } from 'react';
import { motion } from 'motion/react';
import { Flame, Leaf, Minus, Plus, X } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { formatCurrency } from '../../lib/format';
import { roundMoney } from '../../lib/orderLogic';
import type { MenuItem, MenuItemAddon, MenuItemVariant } from '../../types';

interface DishDetailSheetProps {
  dish: MenuItem;
  currencySymbol: string;
  onAdd: (
    dish: MenuItem,
    variant: MenuItemVariant | null,
    addons: MenuItemAddon[],
    quantity: number,
    specialInstructions: string
  ) => void;
  onClose: () => void;
}

export function DishDetailSheet({
  dish,
  currencySymbol,
  onAdd,
  onClose,
}: DishDetailSheetProps) {
  const defaultVariant =
    dish.variants.find((v) => v.isDefault) ?? dish.variants[0] ?? null;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    defaultVariant?.id ?? null
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');

  const selectedVariant =
    dish.variants.find((v) => v.id === selectedVariantId) ?? null;
  const selectedAddons = dish.addons.filter((a) =>
    selectedAddonIds.includes(a.id)
  );

  const unitPrice = roundMoney(
    dish.price +
      (selectedVariant?.priceDelta ?? 0) +
      selectedAddons.reduce((sum, a) => sum + a.price, 0)
  );
  const totalPrice = roundMoney(unitPrice * quantity);

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={dish.name}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/[0.1] bg-[#12171C] sm:rounded-2xl"
      >
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[#0D1115]">
          <ImageWithFallback
            src={dish.imageUrl}
            alt={dish.name}
            fallbackTitle={dish.name}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12171C] via-transparent to-black/30" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dish details"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-[#F5F2EA] backdrop-blur-md hover:bg-black/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          <div className="flex items-center gap-2 text-xs text-[#9BA3AA]">
            <span className="inline-flex items-center gap-1">
              <Leaf
                className={`h-3.5 w-3.5 ${dish.isVeg ? 'text-[#34D399]' : 'text-[#F87171]'}`}
              />
              {dish.isVeg ? 'Vegetarian' : 'Non-Veg'}
            </span>
            {dish.isSpicy && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-[#F87171]">
                  <Flame className="h-3.5 w-3.5" />
                  Spicy
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{dish.prepTimeMins} min prep</span>
            {dish.isBestseller && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#E7C77A] font-medium">Bestseller</span>
              </>
            )}
          </div>

          <div className="mt-2 flex items-start justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-[#F5F2EA]">
              {dish.name}
            </h2>
            <span className="font-mono text-lg font-semibold text-[#F5F2EA] tabular-nums shrink-0">
              {formatCurrency(dish.price, currencySymbol)}
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-[#9BA3AA]">
            {dish.description}
          </p>

          {/* Variants */}
          {dish.variants.length > 0 && (
            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9BA3AA]">
                Choose Portion / Option
              </p>
              <div className="mt-2.5 space-y-2">
                {dish.variants.map((v) => {
                  const checked = selectedVariantId === v.id;
                  return (
                    <label
                      key={v.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                        checked
                          ? 'border-[#2DD4BF]/60 bg-[#2DD4BF]/10 text-[#F5F2EA]'
                          : 'border-white/[0.08] bg-[#0D1115] text-[#9BA3AA]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="dish-variant"
                          checked={checked}
                          onChange={() => setSelectedVariantId(v.id)}
                          className="accent-[#2DD4BF]"
                        />
                        <span>{v.name}</span>
                      </span>
                      <span className="font-mono text-xs tabular-nums">
                        {v.priceDelta === 0
                          ? 'Included'
                          : v.priceDelta > 0
                            ? `+${formatCurrency(v.priceDelta, currencySymbol)}`
                            : `-${formatCurrency(Math.abs(v.priceDelta), currencySymbol)}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Addons */}
          {dish.addons.filter((a) => a.isAvailable).length > 0 && (
            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9BA3AA]">
                Add-ons
              </p>
              <div className="mt-2.5 space-y-2">
                {dish.addons
                  .filter((a) => a.isAvailable)
                  .map((a) => {
                    const checked = selectedAddonIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                          checked
                            ? 'border-[#2DD4BF]/60 bg-[#2DD4BF]/10 text-[#F5F2EA]'
                            : 'border-white/[0.08] bg-[#0D1115] text-[#9BA3AA]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(a.id)}
                            className="h-4 w-4 accent-[#2DD4BF]"
                          />
                          <span>{a.name}</span>
                        </span>
                        <span className="font-mono text-xs tabular-nums">
                          +{formatCurrency(a.price, currencySymbol)}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Special instructions */}
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <label
              htmlFor="dish-instructions"
              className="block text-xs font-semibold uppercase tracking-wider text-[#9BA3AA]"
            >
              Kitchen Instructions (optional)
            </label>
            <textarea
              id="dish-instructions"
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="No cilantro, extra lime, allergy notes..."
              className="mt-2 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3.5 py-2.5 text-sm text-[#F5F2EA] placeholder:text-[#9BA3AA]/50 focus:border-[#2DD4BF] focus:outline-none"
            />
          </div>
        </div>

        {/* Sticky Footer CTA */}
        <div className="flex items-center gap-3 border-t border-white/[0.08] bg-[#12171C] px-5 py-4">
          <div className="flex items-center rounded-xl border border-white/[0.12] bg-[#0D1115]">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="flex h-11 w-11 items-center justify-center text-[#F5F2EA] hover:bg-white/[0.06] rounded-l-xl"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-mono text-sm font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase quantity"
              className="flex h-11 w-11 items-center justify-center text-[#F5F2EA] hover:bg-white/[0.06] rounded-r-xl"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            disabled={!dish.isAvailable}
            onClick={() => {
              onAdd(dish, selectedVariant, selectedAddons, quantity, instructions);
              onClose();
            }}
            className="flex h-11 flex-1 items-center justify-between rounded-xl bg-[#2DD4BF] px-5 text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 disabled:opacity-50"
          >
            <span>{dish.isAvailable ? 'Add to cart' : 'Sold out'}</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(totalPrice, currencySymbol)}
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
