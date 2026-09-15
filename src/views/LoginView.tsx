import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTenant } from '../context/TenantContext.tsx';
import {
  Building2,
  Lock,
  User,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Users,
  AlertCircle,
  GraduationCap,
  Briefcase,
  CreditCard,
  UserCheck,
} from 'lucide-react';

interface Props {
  onOpenForgotPassword: () => void;
}

export const LoginView: React.FC<Props> = ({ onOpenForgotPassword }) => {
  const { login, lookupMobile } = useAuth();
  const { currentSchool, activeSchoolCode, setActiveSchoolCode } = useTenant();

  const [loginType, setLoginType] = useState<'userId' | 'mobile'>('userId');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sibling / Multi-Account Selection State (Section 10)
  const [candidateAccounts, setCandidateAccounts] = useState<any[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const primaryColor = currentSchool?.primary_color || '#1e40af';

  const handleLogin = async (e?: React.FormEvent, accountIdToUse?: string) => {
    if (e) e.preventDefault();
    setError(null);

    const uid = accountIdToUse || selectedUserId;

    // If mobile login and we haven't looked up accounts yet
    if (loginType === 'mobile' && !candidateAccounts && !accountIdToUse) {
      setLoading(true);
      try {
        const accounts = await lookupMobile(identifier);
        if (accounts.length > 1) {
          setCandidateAccounts(accounts);
          setSelectedUserId(accounts[0].id);
          setLoading(false);
          return;
        } else if (accounts.length === 1) {
          // Exactly 1 account, proceed directly
          await login(identifier, password, 'mobile', accounts[0].id);
          return;
        } else {
          setError('No account found registered with this mobile number in this school');
          setLoading(false);
          return;
        }
      } catch (err: any) {
        setError(err.message || 'Mobile lookup failed');
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      await login(identifier, password, loginType, uid);
    } catch (err: any) {
      if (err.data?.multipleAccounts) {
        setCandidateAccounts(err.data.accounts);
        setSelectedUserId(err.data.accounts[0]?.id || '');
      } else {
        setError(err.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleUid: string, pwd = 'password123') => {
    setLoginType('userId');
    setCandidateAccounts(null);
    setIdentifier(roleUid);
    setPassword(pwd);
    setError(null);
  };

  const handleQuickFillMobile = (mobile: string) => {
    setLoginType('mobile');
    setCandidateAccounts(null);
    setIdentifier(mobile);
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center py-10 sm:px-6 lg:px-8 bg-slate-50/50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* School Branding Card Header */}
        <div className="text-center space-y-2">
          {currentSchool?.logo_url ? (
            <img
              src={currentSchool.logo_url}
              alt="Logo"
              className="mx-auto w-14 h-14 rounded-xl object-cover shadow-sm border border-slate-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="mx-auto w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <Building2 className="w-8 h-8" />
            </div>
          )}
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {currentSchool?.name || 'School ERP Portal'}
          </h2>
          <p className="text-xs text-slate-500">
            Secure Multi-Tenant Education Management Platform
          </p>
        </div>

        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-6 px-4 shadow-sm border border-slate-200 sm:rounded-xl sm:px-8">
            {/* Login Mode Toggle: User ID vs Mobile */}
            <div className="grid grid-cols-2 p-1 mb-6 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setLoginType('userId');
                  setCandidateAccounts(null);
                  setError(null);
                }}
                className={`py-2 rounded-md transition-colors cursor-pointer flex items-center justify-center space-x-1.5 ${
                  loginType === 'userId'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>User ID</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginType('mobile');
                  setCandidateAccounts(null);
                  setError(null);
                }}
                className={`py-2 rounded-md transition-colors cursor-pointer flex items-center justify-center space-x-1.5 ${
                  loginType === 'mobile'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile Number</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center space-x-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Candidate Sibling Accounts Disambiguation Screen (Section 10) */}
            {candidateAccounts ? (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-xs font-semibold text-blue-900">Select Student Account</h4>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Multiple students share this guardian mobile number ({identifier}). Select the account you wish to log into:
                  </p>
                </div>

                <div className="space-y-2">
                  {candidateAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setSelectedUserId(acc.id);
                        handleLogin(undefined, acc.id);
                      }}
                      className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedUserId === acc.id
                          ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{acc.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {acc.className ? `${acc.className} - ${acc.sectionName}` : acc.role} • Adm: {acc.admissionNumber || acc.userId}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCandidateAccounts(null)}
                  className="w-full text-xs text-slate-500 hover:text-slate-800 text-center py-2"
                >
                  ← Back to Login Form
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {loginType === 'userId' ? 'User ID' : 'Mobile Number'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      {loginType === 'userId' ? <User className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    </div>
                    <input
                      type={loginType === 'userId' ? 'text' : 'tel'}
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={loginType === 'userId' ? 'e.g. ADM001, STU26001123' : 'e.g. 9876543210'}
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={onOpenForgotPassword}
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                  <ArrowRight className="ml-1.5 w-4 h-4" />
                </button>
              </form>
            )}

            {/* Quick-Fill Demonstration Selector */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Test Credentials (Click to Fill)
                </span>
                <span className="text-[11px] font-mono text-slate-400">pwd: password123</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickFill('ADM001')}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-left font-medium text-slate-800 transition-colors cursor-pointer"
                >
                  <span className="block text-[10px] text-blue-600 uppercase font-semibold">Principal</span>
                  ADM001
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('OFF001')}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-left font-medium text-slate-800 transition-colors cursor-pointer"
                >
                  <span className="block text-[10px] text-emerald-600 uppercase font-semibold">Office</span>
                  OFF001
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('CAS001')}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-left font-medium text-slate-800 transition-colors cursor-pointer"
                >
                  <span className="block text-[10px] text-amber-600 uppercase font-semibold">Cashier</span>
                  CAS001
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('FAC001')}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-left font-medium text-slate-800 transition-colors cursor-pointer"
                >
                  <span className="block text-[10px] text-indigo-600 uppercase font-semibold">Faculty</span>
                  FAC001
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('STU26001123')}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-left font-medium text-slate-800 transition-colors cursor-pointer"
                >
                  <span className="block text-[10px] text-violet-600 uppercase font-semibold">Student</span>
                  STU26001123
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('SUP001')}
                  className="p-1.5 rounded border border-purple-200 bg-purple-50/50 hover:bg-purple-100/50 text-left font-medium text-purple-900 transition-colors cursor-pointer"
                >
                  <span className="block text-[10px] text-purple-700 uppercase font-semibold">SuperAdmin</span>
                  SUP001
                </button>
              </div>

              {/* Mobile Sibling Disambiguation Quick Test */}
              <div className="mt-3 p-2 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-800">Shared Mobile Test:</span>
                  <p className="text-[10px] text-slate-500">Rahul & Pooja share 9876543210</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickFillMobile('9876543210')}
                  className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded shadow-2xs hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Test Sibling Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
