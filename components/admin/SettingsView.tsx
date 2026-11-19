import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import type {
  Restaurant,
  RestaurantMember,
  RestaurantSettings,
  UserRole,
} from '../../types';

interface SettingsViewProps {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  staff: RestaurantMember[];
  onSaveSettings: (payload: Record<string, unknown>) => Promise<void>;
  onInviteStaff: (input: {
    fullName: string;
    email: string;
    role: Exclude<UserRole, 'OWNER'>;
    password: string;
  }) => Promise<void>;
  onRemoveStaff: (memberId: string) => Promise<void>;
}

export function SettingsView({
  restaurant,
  settings,
  staff,
  onSaveSettings,
  onInviteStaff,
  onRemoveStaff,
}: SettingsViewProps) {
  const [name, setName] = useState(restaurant.name);
  const [tagline, setTagline] = useState(restaurant.tagline || '');
  const [cuisineType, setCuisineType] = useState(restaurant.cuisineType);
  const [address, setAddress] = useState(restaurant.address);
  const [city, setCity] = useState(restaurant.city);
  const [phone, setPhone] = useState(restaurant.phone);
  const [email, setEmail] = useState(restaurant.email || '');
  const [openingHours, setOpeningHours] = useState(restaurant.openingHours);
  const [isOpen, setIsOpen] = useState(restaurant.isOpen);

  const [taxRatePercent, setTaxRatePercent] = useState(String(settings.taxRatePercent));
  const [serviceChargePercent, setServiceChargePercent] = useState(
    String(settings.serviceChargePercent)
  );
  const [gstin, setGstin] = useState(settings.gstin || '');
  const [acceptingOrders, setAcceptingOrders] = useState(settings.acceptingOrders);
  const [autoConfirmOrders, setAutoConfirmOrders] = useState(settings.autoConfirmOrders);
  const [allowCashPayments, setAllowCashPayments] = useState(settings.allowCashPayments);
  const [allowOnlinePayments, setAllowOnlinePayments] = useState(settings.allowOnlinePayments);
  const [saving, setSaving] = useState(false);

  // Staff invite
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<'MANAGER' | 'KITCHEN' | 'STAFF'>('KITCHEN');
  const [staffPassword, setStaffPassword] = useState('MenuFlow2026!');
  const [inviting, setInviting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        name: name.trim(),
        tagline: tagline.trim() || null,
        cuisineType: cuisineType.trim(),
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim(),
        email: email.trim(),
        openingHours: openingHours.trim(),
        isOpen,
        taxRatePercent: Number(taxRatePercent) || 0,
        serviceChargePercent: Number(serviceChargePercent) || 0,
        gstin: gstin.trim() || null,
        acceptingOrders,
        autoConfirmOrders,
        allowCashPayments,
        allowOnlinePayments,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      await onInviteStaff({
        fullName: staffName.trim(),
        email: staffEmail.trim(),
        role: staffRole,
        password: staffPassword,
      });
      setStaffName('');
      setStaffEmail('');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
          Restaurant Settings
        </h1>
        <p className="mt-1 text-xs text-[#9BA3AA]">
          Configure dining profile, GST rates, order behavior, and team permissions
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 rounded-2xl border border-white/[0.08] bg-[#12171C] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">Restaurant Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">Cuisine Type</label>
            <input
              type="text"
              value={cuisineType}
              onChange={(e) => setCuisineType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#9BA3AA]">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">Opening Hours</label>
            <input
              type="text"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">GST Tax (%)</label>
            <input
              type="number"
              step="0.5"
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-sm text-[#F5F2EA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">Service Charge (%)</label>
            <input
              type="number"
              step="0.5"
              value={serviceChargePercent}
              onChange={(e) => setServiceChargePercent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-sm text-[#F5F2EA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">GSTIN (for invoices)</label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-sm text-[#F5F2EA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA3AA]">Public Contact Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-sm text-[#F5F2EA]"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 border-t border-white/[0.08] pt-4 text-xs text-[#F5F2EA]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />
            Restaurant Open
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={acceptingOrders} onChange={(e) => setAcceptingOrders(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />
            Accepting QR Orders
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoConfirmOrders} onChange={(e) => setAutoConfirmOrders(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />
            Auto-Confirm New Orders
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowOnlinePayments} onChange={(e) => setAllowOnlinePayments(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />
            Allow UPI / Card / Netbanking
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowCashPayments} onChange={(e) => setAllowCashPayments(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />
            Allow Cash Settlement
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#2DD4BF] px-5 py-2.5 text-xs font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Staff Access & RBAC */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12171C] p-6">
        <h2 className="font-display text-lg font-semibold text-[#F5F2EA]">Staff & Role Access</h2>
        <p className="mt-1 text-xs text-[#9BA3AA]">
          Staff members can only access {restaurant.name} data.
        </p>

        <form onSubmit={handleInvite} className="mt-4 grid gap-3 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-[#9BA3AA]">Name</label>
            <input
              type="text"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-[#9BA3AA]">Email</label>
            <input
              type="email"
              required
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#9BA3AA]">Role</label>
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as 'MANAGER' | 'KITCHEN' | 'STAFF')}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 text-xs text-[#F5F2EA]"
            >
              <option value="MANAGER">Manager</option>
              <option value="KITCHEN">Kitchen</option>
              <option value="STAFF">Floor Staff</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#9BA3AA]">Temp Password</label>
            <input
              type="text"
              required
              minLength={6}
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3 py-2 font-mono text-xs text-[#F5F2EA]"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={inviting}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#171D23] border border-white/[0.12] px-3 py-2 text-xs font-semibold text-[#F5F2EA] hover:bg-white/[0.08]"
            >
              <UserPlus className="h-3.5 w-3.5 text-[#2DD4BF]" />
              <span>Add Staff</span>
            </button>
          </div>
        </form>

        <div className="mt-5 divide-y divide-white/[0.06]">
          {staff.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-3 text-xs">
              <div>
                <p className="font-medium text-[#F5F2EA]">{m.fullName}</p>
                <p className="text-[#9BA3AA]">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[#2DD4BF]">{m.role}</span>
                {m.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() => onRemoveStaff(m.id)}
                    aria-label={`Remove ${m.fullName}`}
                    className="rounded-lg p-1 text-[#9BA3AA] hover:text-[#F87171]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
