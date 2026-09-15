import React, { useState } from 'react';
import { TenantProvider } from './context/TenantContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { TenantHeader } from './components/TenantHeader.tsx';
import { LoginView } from './views/LoginView.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { PasswordChangeModal } from './components/PasswordChangeModal.tsx';
import { LoginHistoryModal } from './components/LoginHistoryModal.tsx';
import { TenantIsolationProofModal } from './components/TenantIsolationProofModal.tsx';
import { ForgotPasswordModal } from './components/ForgotPasswordModal.tsx';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  const [isChangePasswordOpen, setChangePasswordOpen] = useState(false);
  const [isLoginHistoryOpen, setLoginHistoryOpen] = useState(false);
  const [isIsolationProofOpen, setIsolationProofOpen] = useState(false);
  const [isForgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-medium">Loading School ERP Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/75 flex flex-col">
      <TenantHeader
        onOpenChangePassword={() => setChangePasswordOpen(true)}
        onOpenLoginHistory={() => setLoginHistoryOpen(true)}
        onOpenIsolationProof={() => setIsolationProofOpen(true)}
      />

      <main className="flex-1">
        {user ? (
          <DashboardView />
        ) : (
          <LoginView onOpenForgotPassword={() => setForgotPasswordOpen(true)} />
        )}
      </main>

      {/* Persistent App Modals */}
      <PasswordChangeModal
        isOpen={isChangePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />

      <LoginHistoryModal
        isOpen={isLoginHistoryOpen}
        onClose={() => setLoginHistoryOpen(false)}
      />

      <TenantIsolationProofModal
        isOpen={isIsolationProofOpen}
        onClose={() => setIsolationProofOpen(false)}
      />

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <TenantProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </TenantProvider>
  );
}
