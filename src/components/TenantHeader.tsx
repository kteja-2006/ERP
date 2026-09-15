import React from 'react';
import { useTenant } from '../context/TenantContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { Building2, ShieldCheck, Globe, LogOut, KeyRound, History } from 'lucide-react';

interface TenantHeaderProps {
  onOpenChangePassword?: () => void;
  onOpenLoginHistory?: () => void;
  onOpenIsolationProof?: () => void;
}

export const TenantHeader: React.FC<TenantHeaderProps> = ({
  onOpenChangePassword,
  onOpenLoginHistory,
  onOpenIsolationProof,
}) => {
  const { currentSchool, availableSchools, activeSchoolCode, setActiveSchoolCode } = useTenant();
  const { user, logout } = useAuth();

  const primaryColor = currentSchool?.primary_color || '#1e40af';

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* School Brand & Logo */}
          <div className="flex items-center space-x-3 min-w-0">
            {currentSchool?.logo_url ? (
              <img
                src={currentSchool.logo_url}
                alt="School Logo"
                className="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-xs"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-xs"
                style={{ backgroundColor: primaryColor }}
              >
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-900 truncate text-base">
                  {currentSchool?.name || 'Platform Administration'}
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Isolated Tenant
                </span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-slate-500">
                <span className="flex items-center">
                  <Globe className="w-3 h-3 mr-1 text-slate-400" />
                  {currentSchool?.subdomain ? `${currentSchool.subdomain}.yourproduct.com` : 'app.yourproduct.com'}
                </span>
                {currentSchool?.city && (
                  <span className="hidden md:inline text-slate-400">
                    • {currentSchool.city}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: School Switcher (Demo Simulator), Security Audits & User Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* School Switcher Simulator */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
              <span className="text-slate-400 font-medium px-1.5 hidden lg:inline">Tenant:</span>
              <select
                id="school-tenant-selector"
                value={activeSchoolCode}
                onChange={(e) => {
                  setActiveSchoolCode(e.target.value);
                  logout(); // Force re-auth on school change for isolation
                }}
                className="bg-transparent font-medium text-slate-800 text-xs focus:outline-hidden cursor-pointer pr-1"
              >
                {availableSchools.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Tenant Isolation Proof Button */}
            {user && (
              <button
                id="verify-isolation-btn"
                type="button"
                onClick={onOpenIsolationProof}
                className="hidden md:flex items-center space-x-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer transition-colors"
                title="Verify cross-school database isolation"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Verify Isolation</span>
              </button>
            )}

            {/* Authenticated User Actions */}
            {user ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-semibold text-slate-800 leading-none">{user.name}</p>
                  <p className="text-[11px] font-medium text-blue-600 mt-0.5">
                    {user.role} {user.admissionNumber ? `(${user.admissionNumber})` : `(${user.userId})`}
                  </p>
                </div>

                <button
                  id="btn-login-history"
                  type="button"
                  onClick={onOpenLoginHistory}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 cursor-pointer"
                  title="View Login History"
                >
                  <History className="w-4 h-4" />
                </button>

                <button
                  id="btn-change-password"
                  type="button"
                  onClick={onOpenChangePassword}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 cursor-pointer"
                  title="Change Password"
                >
                  <KeyRound className="w-4 h-4" />
                </button>

                <button
                  id="btn-logout"
                  type="button"
                  onClick={() => logout()}
                  className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md border border-rose-100 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
};
