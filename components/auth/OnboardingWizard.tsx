import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Upload } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { QrCodeGraphic } from '../common/QrCodeGraphic';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { apiRequest } from '../../lib/api';
import { slugifyRestaurantName } from '../../lib/format';
import type { Restaurant } from '../../types';

const STEPS = [
  'Restaurant Name',
  'Restaurant Logo',
  'Cuisine Type',
  'Street Address',
  'Contact Details',
  'Opening Hours',
  'First Category',
  'First Menu Item',
  'Dining Tables',
  'Generate QR Codes',
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { restaurant, setRestaurant, refreshAuth } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [cuisineType, setCuisineType] = useState('Modern Indian / Casual');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [openingHours, setOpeningHours] = useState('11:30 AM - 11:00 PM');
  const [firstCategoryName, setFirstCategoryName] = useState('Starters');
  const [dishName, setDishName] = useState('Truffle Paneer Tikka');
  const [dishDesc, setDishDesc] = useState('Char-grilled cottage cheese with black pepper and mint chutney.');
  const [dishPrice, setDishPrice] = useState('340');
  const [dishVeg, setDishVeg] = useState(true);
  const [dishSpicy, setDishSpicy] = useState(false);
  const [tableCount, setTableCount] = useState(6);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get('autostart') === '1' && restaurant) {
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams, restaurant, navigate]);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      toast('Logo file must be under 1 MB', { tone: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const validateCurrentStep = (): boolean => {
    setError('');
    if (step === 0 && name.trim().length < 2) {
      setError('Please enter your restaurant name.');
      return false;
    }
    if (step === 2 && cuisineType.trim().length < 2) {
      setError('Please enter a cuisine type.');
      return false;
    }
    if (step === 3 && address.trim().length < 4) {
      setError('Please enter your street address.');
      return false;
    }
    if (step === 4 && phone.trim().length < 6) {
      setError('Please enter a valid contact phone number.');
      return false;
    }
    if (step === 6 && firstCategoryName.trim().length < 2) {
      setError('Please enter your first menu category.');
      return false;
    }
    if (step === 7 && (dishName.trim().length < 2 || Number(dishPrice) <= 0)) {
      setError('Please enter a valid dish name and price.');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateCurrentStep()) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const handleFinish = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ restaurant: Restaurant }>('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          logoUrl,
          cuisineType: cuisineType.trim(),
          address: address.trim(),
          city: city.trim(),
          phone: phone.trim(),
          email: email.trim(),
          openingHours: openingHours.trim(),
          firstCategoryName: firstCategoryName.trim(),
          firstDish: {
            name: dishName.trim(),
            description: dishDesc.trim(),
            price: Number(dishPrice),
            isVeg: dishVeg,
            isSpicy: dishSpicy,
          },
          tableCount,
        }),
      });
      setRestaurant(res.restaurant);
      await refreshAuth();
      toast('Restaurant workspace ready', {
        description: `${res.restaurant.name} is live with ${tableCount} QR tables.`,
        tone: 'success',
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  const previewSlug = slugifyRestaurantName(name || 'my-restaurant');
  const progressPct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-[#080A0C] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <BrandLogo size="md" />
          <span className="font-mono text-xs text-[#9BA3AA] tabular-nums">
            Step {step + 1} of {STEPS.length} · {progressPct}%
          </span>
        </div>

        {/* Progress track */}
        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-[#12171C]">
          <div
            className="h-full bg-[#2DD4BF] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#12171C] p-6 sm:p-8">
          <p className="text-xs font-medium text-[#E7C77A]">{STEPS[step]}</p>

          {step === 0 && (
            <div className="mt-3 space-y-4">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                What is your restaurant called?
              </h1>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Banyan Kitchen & Bar"
                aria-label="Restaurant name"
                className="w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-4 py-3 text-base text-[#F5F2EA] focus:border-[#2DD4BF] focus:outline-none"
              />
              <p className="text-xs text-[#9BA3AA]">
                Your digital menu URL will be{' '}
                <span className="font-mono text-[#2DD4BF]">/menu/{previewSlug}/1</span>
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="mt-3 space-y-4">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                Upload your restaurant logo
              </h1>
              <p className="text-sm text-[#9BA3AA]">
                Optional — your logo appears at the top of every customer QR menu and GST receipt.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.16] bg-[#0D1115] p-8 hover:border-[#2DD4BF]/50 transition-colors">
                {logoUrl ? (
                  <img src={logoUrl} alt="Restaurant logo preview" className="h-20 w-20 rounded-xl object-cover" />
                ) : (
                  <Upload className="h-7 w-7 text-[#9BA3AA]" />
                )}
                <span className="mt-3 text-xs font-medium text-[#F5F2EA]">
                  {logoUrl ? 'Click to replace logo' : 'Choose PNG, JPG, or SVG (max 1 MB)'}
                </span>
                <input type="file" accept="image/*" onChange={handleLogoFile} className="sr-only" />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="mt-3 space-y-4">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                Select your cuisine style
              </h1>
              <input
                type="text"
                value={cuisineType}
                onChange={(e) => setCuisineType(e.target.value)}
                aria-label="Cuisine type"
                className="w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-4 py-3 text-sm text-[#F5F2EA] focus:border-[#2DD4BF] focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                {['Modern Indian', 'Mexican / Casual', 'Specialty Coffee & Bakery', 'Pan-Asian Kitchen', 'Wood-Fired Pizzeria'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCuisineType(preset)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      cuisineType === preset
                        ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]'
                        : 'border-white/[0.08] bg-[#0D1115] text-[#9BA3AA] hover:text-[#F5F2EA]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-3 space-y-4">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                Where is your dining room located?
              </h1>
              <div>
                <label className="block text-xs font-medium text-[#9BA3AA]">Street Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="12th Main Road, Indiranagar"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-4 py-3 text-sm text-[#F5F2EA] focus:border-[#2DD4BF] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9BA3AA]">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-4 py-3 text-sm text-[#F5F2EA] focus:border-[#2DD4BF] focus:outline-none"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mt-3 space-y-4">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                Contact details for receipts & diners
              </h1>
              <div>
                <label className="block text-xs font-medium text-[#9BA3AA]">Restaurant Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 80 4123 8890"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-4 py-3 text-sm text-[#F5F2EA] focus:border-[#2DD4BF] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9BA3AA]">Public Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@banyankitchen.in"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-4 py-3 text-sm text-[#F5F2EA] focus:border-[#2DD4BF] focus:outline-none"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="mt-3 space-y-4">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                Set your opening hours
              </h1>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                aria-label="Opening hours"
                className="w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-4 py-3 text-sm text-[#F5F2EA] focus:border-[#2DD4BF] focus:outline-none"
              />
            </div>
          )}

          {step === 6 && (
            <div className="mt-3 space-y-4">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                Create your first menu category
              </h1>
              <input
                type="text"
                value={firstCategoryName}
                onChange={(e) => setFirstCategoryName(e.target.value)}
                aria-label="First category name"
                className="w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-4 py-3 text-sm text-[#F5F2EA] focus:border-[#2DD4BF] focus:outline-none"
              />
            </div>
          )}

          {step === 7 && (
            <div className="mt-3 space-y-4">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                Add your first dish to {firstCategoryName}
              </h1>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#9BA3AA]">Dish Name</label>
                  <input
                    type="text"
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3.5 py-2.5 text-sm text-[#F5F2EA]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9BA3AA]">Price (₹)</label>
                  <input
                    type="number"
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3.5 py-2.5 font-mono text-sm text-[#F5F2EA]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9BA3AA]">Description</label>
                <textarea
                  rows={2}
                  value={dishDesc}
                  onChange={(e) => setDishDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3.5 py-2.5 text-sm text-[#F5F2EA]"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-xs text-[#F5F2EA]">
                  <input
                    type="checkbox"
                    checked={dishVeg}
                    onChange={(e) => setDishVeg(e.target.checked)}
                    className="h-4 w-4 accent-[#2DD4BF]"
                  />
                  Vegetarian
                </label>
                <label className="flex items-center gap-2 text-xs text-[#F5F2EA]">
                  <input
                    type="checkbox"
                    checked={dishSpicy}
                    onChange={(e) => setDishSpicy(e.target.checked)}
                    className="h-4 w-4 accent-[#2DD4BF]"
                  />
                  Spicy
                </label>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="mt-3 space-y-4">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                How many tables do you want to create?
              </h1>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={tableCount}
                  onChange={(e) => setTableCount(Number(e.target.value))}
                  className="flex-1 accent-[#2DD4BF]"
                />
                <span className="w-16 rounded-xl border border-white/[0.1] bg-[#0D1115] py-2 text-center font-mono text-base font-semibold text-[#F5F2EA] tabular-nums">
                  {tableCount}
                </span>
              </div>
              <p className="text-xs text-[#9BA3AA]">
                You can add, rename, or group tables by floor zone anytime inside the dashboard.
              </p>
            </div>
          )}

          {step === 9 && (
            <div className="mt-3 space-y-5">
              <h1 className="font-display text-2xl font-semibold text-[#F5F2EA]">
                Your QR codes are ready to generate
              </h1>
              <p className="text-sm text-[#9BA3AA]">
                Previewing Table 01 QR for <span className="text-[#F5F2EA] font-medium">{name || 'Your Restaurant'}</span>.
              </p>
              <div className="flex flex-col items-center gap-4 rounded-xl border border-white/[0.08] bg-[#0D1115] p-6 sm:flex-row">
                <QrCodeGraphic
                  value={`${window.location.origin}/menu/${previewSlug}/1`}
                  size={130}
                />
                <div className="space-y-1.5 text-xs">
                  <p className="font-display text-base font-semibold text-[#F5F2EA]">
                    {tableCount} tables · {firstCategoryName}
                  </p>
                  <p className="text-[#9BA3AA]">
                    {address}, {city} · {openingHours}
                  </p>
                  <p className="font-mono text-[#2DD4BF]">/menu/{previewSlug}/1 … {tableCount}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3.5 py-2 text-xs text-[#F87171]">
              {error}
            </p>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-white/[0.08] pt-5">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-[#9BA3AA] hover:text-[#F5F2EA] disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2DD4BF] px-5 py-2.5 text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinish}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2DD4BF] px-5 py-2.5 text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                <span>{submitting ? 'Creating workspace...' : 'Launch Dashboard'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
