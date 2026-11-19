import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category, MenuItem } from '../../types';

interface CategoriesViewProps {
  categories: Category[];
  menuItems: MenuItem[];
  onCreateCategory: (input: { name: string; description: string }) => Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onReorderCategories: (orderedIds: string[]) => Promise<void>;
}

export function CategoriesView({
  categories,
  menuItems,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
}: CategoriesViewProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreateCategory({ name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  const moveCategory = async (id: string, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === id);
    const next = idx + dir;
    if (idx === -1 || next < 0 || next >= categories.length) return;
    const copy = [...categories];
    const [removed] = copy.splice(idx, 1);
    copy.splice(next, 0, removed);
    await onReorderCategories(copy.map((c) => c.id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
          Categories
        </h1>
        <p className="mt-1 text-xs text-[#9BA3AA]">
          Organize menu sections and control category visibility on the QR menu
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="grid gap-3 rounded-2xl border border-white/[0.08] bg-[#12171C] p-5 sm:grid-cols-12 sm:items-end"
      >
        <div className="sm:col-span-4">
          <label htmlFor="cat-name" className="block text-xs font-medium text-[#9BA3AA]">
            Category Name
          </label>
          <input
            id="cat-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wood-Fired Specials"
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-6">
          <label htmlFor="cat-desc" className="block text-xs font-medium text-[#9BA3AA]">
            Subtitle (optional)
          </label>
          <input
            id="cat-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short editorial description"
            className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2DD4BF] px-4 py-2.5 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90"
          >
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </div>
      </form>

      <div className="divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12171C]">
        {categories.map((cat) => {
          const itemCount = menuItems.filter((m) => m.categoryId === cat.id).length;
          const isEditing = editingId === cat.id;

          return (
            <div key={cat.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              {isEditing ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-lg border border-white/[0.1] bg-[#0D1115] px-3 py-1.5 text-sm text-[#F5F2EA]"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="flex-1 rounded-lg border border-white/[0.1] bg-[#0D1115] px-3 py-1.5 text-xs text-[#F5F2EA]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await onUpdateCategory(cat.id, { name: editName, description: editDesc });
                      setEditingId(null);
                    }}
                    className="rounded-lg bg-[#2DD4BF] px-3 py-1.5 text-xs font-semibold text-[#080A0C]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-2 py-1.5 text-xs text-[#9BA3AA]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[#F5F2EA]">{cat.name}</h2>
                    <span className="font-mono text-xs text-[#9BA3AA] tabular-nums">
                      · {itemCount} dishes
                    </span>
                  </div>
                  {cat.description && (
                    <p className="mt-0.5 text-xs text-[#9BA3AA]">{cat.description}</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateCategory(cat.id, { isActive: !cat.isActive })}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    cat.isActive
                      ? 'border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]'
                      : 'border-white/[0.1] text-[#9BA3AA]'
                  }`}
                >
                  {cat.isActive ? 'Visible' : 'Hidden'}
                </button>
                <button
                  type="button"
                  onClick={() => moveCategory(cat.id, -1)}
                  aria-label={`Move ${cat.name} up`}
                  className="rounded-lg p-1.5 text-[#9BA3AA] hover:bg-white/[0.06]"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveCategory(cat.id, 1)}
                  aria-label={`Move ${cat.name} down`}
                  className="rounded-lg p-1.5 text-[#9BA3AA] hover:bg-white/[0.06]"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(cat.id);
                    setEditName(cat.name);
                    setEditDesc(cat.description || '');
                  }}
                  aria-label={`Edit ${cat.name}`}
                  className="rounded-lg p-1.5 text-[#9BA3AA] hover:bg-white/[0.06]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCategory(cat.id)}
                  aria-label={`Delete ${cat.name}`}
                  className="rounded-lg p-1.5 text-[#9BA3AA] hover:text-[#F87171]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
