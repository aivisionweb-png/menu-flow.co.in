import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { LandingPage } from './components/landing/LandingPage';
import { AuthPage } from './components/auth/AuthPage';
import { OnboardingWizard } from './components/auth/OnboardingWizard';
import { DashboardLayout } from './components/admin/DashboardLayout';
import { CustomerMenuPage } from './components/customer/CustomerMenuPage';

function ProtectedDashboard({ children }: { children: React.ReactNode }) {
  const { user, restaurant, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080A0C] text-xs text-[#9BA3AA]">
        Verifying session...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!restaurant) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function ProtectedOnboarding({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080A0C] text-xs text-[#9BA3AA]">
        Verifying session...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedOnboarding>
                  <OnboardingWizard />
                </ProtectedOnboarding>
              }
            />
            <Route
              path="/dashboard/*"
              element={
                <ProtectedDashboard>
                  <DashboardLayout />
                </ProtectedDashboard>
              }
            />
            <Route
              path="/menu/:restaurantSlug/:tableNumber"
              element={<CustomerMenuPage />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
