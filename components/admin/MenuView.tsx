import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { useToast } from '../../hooks/useToast';
import type { Category, MenuItem, RestaurantSettings } from '../../types';

interface MenuViewProps {
  settings: RestaurantSettings;
  categories: Category[];
  menuItems: MenuItem[];
  onCreateDish: (payload: Record<string, unknown>) => Promise<void>;
  onUpdateDish: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onDeleteDish: (id: string) => Promise<void>;
  onReorderDishes: (orderedIds: string[]) => Promise<void>;
}

const PRESET_IMAGES = [
  { label: 'Guacamole & Chips', url: '/src/assets/images/dish_starter_guac_1795070508560.jpg' },
  { label: 'Artisanal Tacos', url: '/src/assets/images/dish_tacos_al_pastor_1795070508535.jpg' },
  { label: 'Harvest Bowl', url: '/src/assets/images/dish_baja_bowl_1795070508564.jpg' },
  { label: 'Carne Asada Platter', url: '/src/assets/images/dish_carne_asada_1795070508507.jpg' },
  { label: 'Craft Cocktail', url: '/src/assets/images/dish_hibiscus_margarita_1795070508792.jpg' },
  { label: 'Churros & Chocolate', url: '/src/assets/images/dish_churros_dessert_1795070508877.jpg' },
];

export function MenuView({
  settings,
  categories,
  menuItems,
  onCreateDish,
  onUpdateDish,
  onDeleteDish,
  onReorderDishes,
}: MenuViewProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Modal state
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('350');
  const [prepTimeMins, setPrepTimeMins] = useState('15');
  const [imageUrl, setImageUrl] = useState(PRESET_IMAGES[0].url);
  const [isVeg, setIsVeg] = useState(true);
  const [isSpicy, setIsSpicy] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [variants, setVariants] = useState<Array<{ name: string; priceDelta: number; isDefault: boolean }>>([]);
  const [addons, setAddons] = useState<Array<{ name: string; price: number; isVeg: boolean; isAvailable: boolean }>>([]);
  const [saving, setSaving] = useState(false);

  const sym = settings.currencySymbol;

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setDescription('');
    setPrice('350');
    setPrepTimeMins('15');
    setImageUrl(PRESET_IMAGES[0].url);
    setIsVeg(true);
    setIsSpicy(false);
    setIsBestseller(false);
    setIsAvailable(true);
    setVariants([]);
    setAddons([]);
    setShowModal(true);
  };

  const openEdit = (dish: MenuItem) => {
    setEditing(dish);
    setName(dish.name);
    setCategoryId(dish.categoryId);
    setDescription(dish.description);
    setPrice(String(dish.price));
    setPrepTimeMins(String(dish.prepTimeMins));
    setImageUrl(dish.imageUrl || PRESET_IMAGES[0].url);
    setIsVeg(dish.isVeg);
    setIsSpicy(dish.isSpicy);
    setIsBestseller(dish.isBestseller);
    setIsAvailable(dish.isAvailable);
    setVariants(dish.variants.map((v) => ({ name: v.name, priceDelta: v.priceDelta, isDefault: v.isDefault })));
    setAddons(dish.addons.map((a) => ({ name: a.name, price: a.price, isVeg: a.isVeg, isAvailable: a.isAvailable })));
    setShowModal(true);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_200_000) {
      toast('Image must be under 1.2 MB', { tone: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        categoryId,
        description: description.trim(),
        price: Number(price),
        prepTimeMins: Number(prepTimeMins) || 15,
        imageUrl,
        isVeg,
        isSpicy,
        isBestseller,
        isAvailable,
        variants: variants.filter((v) => v.name.trim()),
        addons: addons.filter((a) => a.name.trim()),
      };
      if (editing) {
        await onUpdateDish(editing.id, payload);
      } else {
        await onCreateDish(payload);
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const moveItem = async (dishId: string, direction: -1 | 1) => {
    const idx = menuItems.findIndex((m) => m.id === dishId);
    const target = idx + direction;
    if (idx === -1 || target < 0 || target >= menuItems.length) return;
    const copy = [...menuItems];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    await onReorderDishes(copy.map((m) => m.id));
  };

  const handleDropOn = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const fromIdx = menuItems.findIndex((m) => m.id === draggingId);
    const toIdx = menuItems.findIndex((m) => m.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const copy = [...menuItems];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setDraggingId(null);
    await onReorderDishes(copy.map((m) => m.id));
  };

  const visible = menuItems.filter((m) => {
    if (catFilter !== 'ALL' && m.categoryId !== catFilter) return false;
    if (search.trim() && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const catName = (cid: string) => categories.find((c) => c.id === cid)?.name || 'Uncategorized';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
            Menu Items ({menuItems.length})
          </h1>
          <p className="mt-1 text-xs text-[#9BA3AA]">
            Drag rows or use arrows to reorder · Toggles reflect live on customer QR menus
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2DD4BF] px-4 py-2.5 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9BA3AA]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes..."
            className="w-full rounded-xl border border-white/[0.1] bg-[#12171C] py-2 pl-9 pr-3 text-xs text-[#F5F2EA]"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCatFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              catFilter === 'ALL'
                ? 'bg-[#2DD4BF] text-[#080A0C]'
                : 'border border-white/[0.08] bg-[#12171C] text-[#9BA3AA]'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatFilter(c.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                catFilter === c.id
                  ? 'bg-[#2DD4BF] text-[#080A0C]'
                  : 'border border-white/[0.08] bg-[#12171C] text-[#9BA3AA]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu List */}
      <div className="divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12171C]">
        {visible.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#9BA3AA]">
            No dishes match your filter.
          </div>
        ) : (
          visible.map((dish) => (
            <div
              key={dish.id}
              draggable
              onDragStart={() => setDraggingId(dish.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOn(dish.id)}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span
                  className="hidden sm:inline-flex cursor-grab text-[#9BA3AA]/60 hover:text-[#F5F2EA]"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0D1115]">
                  <ImageWithFallback src={dish.imageUrl} alt={dish.name} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-[#F5F2EA]">{dish.name}</h3>
                    {dish.isBestseller && (
                      <span className="text-[11px] font-medium text-[#E7C77A]">Bestseller</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#9BA3AA]">
                    {catName(dish.categoryId)} · {dish.isVeg ? 'Veg' : 'Non-Veg'}
                    {dish.isSpicy ? ' · Spicy' : ''} · {dish.prepTimeMins}m prep ·{' '}
                    {dish.variants.length} variants · {dish.addons.length} add-ons
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                <span className="font-mono text-sm font-semibold text-[#F5F2EA] tabular-nums">
                  {formatCurrency(dish.price, sym)}
                </span>

                <button
                  type="button"
                  onClick={() => onUpdateDish(dish.id, { isAvailable: !dish.isAvailable })}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    dish.isAvailable
                      ? 'border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]'
                      : 'border-[#F87171]/40 bg-[#F87171]/10 text-[#F87171]'
                  }`}
                >
                  {dish.isAvailable ? 'In Stock' : 'Sold Out'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(dish.id, -1)}
                    aria-label={`Move ${dish.name} up`}
                    className="rounded-lg p-1.5 text-[#9BA3AA] hover:bg-white/[0.06] hover:text-[#F5F2EA]"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(dish.id, 1)}
                    aria-label={`Move ${dish.name} down`}
                    className="rounded-lg p-1.5 text-[#9BA3AA] hover:bg-white/[0.06] hover:text-[#F5F2EA]"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(dish)}
                    aria-label={`Edit ${dish.name}`}
                    className="rounded-lg p-1.5 text-[#9BA3AA] hover:bg-white/[0.06] hover:text-[#F5F2EA]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDish(dish.id)}
                    aria-label={`Delete ${dish.name}`}
                    className="rounded-lg p-1.5 text-[#9BA3AA] hover:bg-white/[0.06] hover:text-[#F87171]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={editing ? `Edit ${editing.name}` : 'Add Menu Item'}
        >
          <form
            onSubmit={handleSave}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#12171C]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-[#F5F2EA]">
                {editing ? 'Edit Menu Item' : 'Create Menu Item'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close dish modal"
                className="rounded-lg p-1.5 text-[#9BA3AA] hover:bg-white/[0.06]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-medium text-[#9BA3AA]">Dish Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#9BA3AA]">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#9BA3AA]">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-medium text-[#9BA3AA]">Base Price ({sym})</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-sm text-[#F5F2EA]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#9BA3AA]">Prep Time (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={prepTimeMins}
                    onChange={(e) => setPrepTimeMins(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-sm text-[#F5F2EA]"
                  />
                </div>
              </div>

              {/* Image Upload or Gallery */}
              <div>
                <label className="block font-medium text-[#9BA3AA]">Dish Photograph</label>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <div className="h-14 w-20 overflow-hidden rounded-xl border border-white/[0.1]">
                    <ImageWithFallback src={imageUrl} alt="Dish preview" />
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#0D1115] px-3 py-2 font-medium text-[#F5F2EA] hover:bg-white/[0.06]">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImage}
                      className="sr-only"
                    />
                  </label>
                  <select
                    aria-label="Choose studio food preset"
                    value={PRESET_IMAGES.some((p) => p.url === imageUrl) ? imageUrl : ''}
                    onChange={(e) => e.target.value && setImageUrl(e.target.value)}
                    className="rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
                  >
                    <option value="">Studio presets...</option>
                    {PRESET_IMAGES.map((p) => (
                      <option key={p.url} value={p.url}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-5 pt-1 text-[#F5F2EA]">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isVeg} onChange={(e) => setIsVeg(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />
                  Vegetarian
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isSpicy} onChange={(e) => setIsSpicy(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />
                  Spicy
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />
                  Bestseller
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />
                  Available
                </label>
              </div>

              {/* Variants Builder */}
              <div className="border-t border-white/[0.08] pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#9BA3AA]">Variants (e.g. Half / Full)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setVariants((prev) => [
                        ...prev,
                        { name: '', priceDelta: 0, isDefault: prev.length === 0 },
                      ])
                    }
                    className="text-xs font-medium text-[#2DD4BF]"
                  >
                    + Add Variant
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {variants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Variant name"
                        value={v.name}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="flex-1 rounded-lg border border-white/[0.1] bg-[#0D1115] px-2.5 py-1.5 text-xs text-[#F5F2EA]"
                      />
                      <input
                        type="number"
                        placeholder="Price delta"
                        value={v.priceDelta}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, priceDelta: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-24 rounded-lg border border-white/[0.1] bg-[#0D1115] px-2.5 py-1.5 font-mono text-xs text-[#F5F2EA]"
                      />
                      <button
                        type="button"
                        onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-[#9BA3AA] hover:text-[#F87171]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Addons Builder */}
              <div className="border-t border-white/[0.08] pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#9BA3AA]">Add-ons (e.g. Extra Cheese)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAddons((prev) => [
                        ...prev,
                        { name: '', price: 60, isVeg: true, isAvailable: true },
                      ])
                    }
                    className="text-xs font-medium text-[#2DD4BF]"
                  >
                    + Add Add-on
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {addons.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add-on name"
                        value={a.name}
                        onChange={(e) =>
                          setAddons((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="flex-1 rounded-lg border border-white/[0.1] bg-[#0D1115] px-2.5 py-1.5 text-xs text-[#F5F2EA]"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={a.price}
                        onChange={(e) =>
                          setAddons((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, price: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-24 rounded-lg border border-white/[0.1] bg-[#0D1115] px-2.5 py-1.5 font-mono text-xs text-[#F5F2EA]"
                      />
                      <button
                        type="button"
                        onClick={() => setAddons((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-[#9BA3AA] hover:text-[#F87171]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] px-6 py-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-[#9BA3AA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#2DD4BF] px-5 py-2 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Dish'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
