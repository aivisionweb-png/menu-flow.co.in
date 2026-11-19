import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Mail, Sparkles } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { apiRequest } from '../../lib/api';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const { login, signup, refreshAuth } = useAuth();
  const { toast } = useToast();

  const [authTab, setAuthTab] = useState<'password' | 'magic'>('password');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [magicPreviewToken, setMagicPreviewToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (authTab === 'magic' && mode === 'login') {
        const res = await apiRequest<{ message: string; previewToken: string | null }>(
          '/api/auth/magic-link',
          { method: 'POST', body: JSON.stringify({ email }) }
        );
        setMagicPreviewToken(res.previewToken);
        toast('Magic link prepared', { description: res.message, tone: 'info' });
        setSubmitting(false);
        return;
      }

      if (mode === 'signup') {
        const res = await signup({ fullName, email, phone, password });
        toast('Account created', { description: 'Let us set up your restaurant profile.', tone: 'success' });
        navigate(res.restaurant ? '/dashboard' : '/onboarding');
      } else {
        const res = await login(email, password);
        toast('Welcome back', { tone: 'success' });
        navigate(res.restaurant ? '/dashboard' : '/onboarding');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyMagic = async () => {
    if (!magicPreviewToken) return;
    setSubmitting(true);
    try {
      await apiRequest('/api/auth/magic-verify', {
        method: 'POST',
        body: JSON.stringify({ token: magicPreviewToken }),
      });
      await refreshAuth();
      toast('Signed in with magic link', { tone: 'success' });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Magic link verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoOwner = () => {
    setEmail('owner@casaverde.in');
    setPassword('CasaVerde2026!');
    setAuthTab('password');
    setError('');
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#080A0C] px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link to="/">
          <BrandLogo size="md" />
        </Link>
        <Link
          to="/menu/casa-verde/1"
          className="text-xs font-medium text-[#9BA3AA] hover:text-[#F5F2EA]"
        >
          View QR Demo
        </Link>
      </div>

      <div className="mx-auto my-8 w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#12171C] p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#F5F2EA]">
          {mode === 'signup' ? 'Create your restaurant account' : 'Sign in to MenuFlow'}
        </h1>
        <p className="mt-1.5 text-sm text-[#9BA3AA]">
          {mode === 'signup'
            ? 'Start with a guided 10-step restaurant & QR setup.'
            : 'Manage your live orders, menu, tables, and analytics.'}
        </p>

        {mode === 'login' && (
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-[#0D1115] p-1">
            <button
              type="button"
              onClick={() => setAuthTab('password')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                authTab === 'password'
                  ? 'bg-[#171D23] text-[#F5F2EA]'
                  : 'text-[#9BA3AA] hover:text-[#F5F2EA]'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Password</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthTab('magic')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                authTab === 'magic'
                  ? 'bg-[#171D23] text-[#F5F2EA]'
                  : 'text-[#9BA3AA] hover:text-[#F5F2EA]'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Magic Link</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label htmlFor="auth-fullname" className="block text-xs font-medium text-[#9BA3AA]">
                  Full Name
                </label>
                <input
                  id="auth-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Aarav Mehta"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3.5 py-2.5 text-sm text-[#F5F2EA] placeholder:text-[#9BA3AA]/50 focus:border-[#2DD4BF] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="auth-phone" className="block text-xs font-medium text-[#9BA3AA]">
                  Phone Number (optional)
                </label>
                <input
                  id="auth-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98450 11223"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3.5 py-2.5 text-sm text-[#F5F2EA] placeholder:text-[#9BA3AA]/50 focus:border-[#2DD4BF] focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-[#9BA3AA]">
              Work Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@restaurant.in"
              className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3.5 py-2.5 text-sm text-[#F5F2EA] placeholder:text-[#9BA3AA]/50 focus:border-[#2DD4BF] focus:outline-none"
            />
          </div>

          {(mode === 'signup' || authTab === 'password') && (
            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-[#9BA3AA]">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0D1115] px-3.5 py-2.5 text-sm text-[#F5F2EA] placeholder:text-[#9BA3AA]/50 focus:border-[#2DD4BF] focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3.5 py-2.5 text-xs text-[#F87171]">
              {error}
            </p>
          )}

          {magicPreviewToken && (
            <div className="rounded-xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 p-3.5">
              <p className="text-xs font-medium text-[#F5F2EA]">
                Local dev magic link ready for {email}:
              </p>
              <button
                type="button"
                onClick={handleVerifyMagic}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-3 py-1.5 text-xs font-semibold text-[#080A0C]"
              >
                <span>Confirm & Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] px-4 py-3 text-sm font-semibold text-[#080A0C] hover:bg-[#2DD4BF]/90 disabled:opacity-60 transition-colors"
          >
            <span>
              {submitting
                ? 'Please wait...'
                : mode === 'signup'
                  ? 'Create account & continue'
                  : authTab === 'magic'
                    ? 'Send magic link'
                    : 'Sign in'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <button
              type="button"
              onClick={fillDemoOwner}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-[#171D23] px-3.5 py-2.5 text-xs font-medium text-[#E7C77A] hover:bg-white/[0.06] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Use Casa Verde Demo Owner (owner@casaverde.in)</span>
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-[#9BA3AA]">
          {mode === 'signup' ? (
            <>
              Already registered?{' '}
              <Link to="/login" className="font-medium text-[#2DD4BF] hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to MenuFlow?{' '}
              <Link to="/signup" className="font-medium text-[#2DD4BF] hover:underline">
                Create your restaurant
              </Link>
            </>
          )}
        </p>
      </div>

      <p className="text-center text-xs text-[#9BA3AA]/70">
        MenuFlow Hospitality Platform · Secure session cookies enabled
      </p>
    </div>
  );
}
