import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { KeyRound, X, Smartphone, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { requestOtp, resetPasswordWithOtp } = useAuth();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [identifier, setIdentifier] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await requestOtp(identifier);
      setOtpId(res.otpId);
      setDemoOtp(res.debugOtp);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithOtp(otpId, otpCode, newPassword, confirmPassword);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setStep('request');
        setSuccess(false);
        setIdentifier('');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Account Recovery (OTP)</h3>
              <p className="text-xs text-slate-500">Reset your password using verified mobile OTP</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-center space-x-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">Password Reset Complete</h4>
            <p className="text-xs text-slate-500">
              Your password has been successfully updated. You can now log in with your new credentials.
            </p>
          </div>
        ) : step === 'request' ? (
          <form onSubmit={handleRequestOtp} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Enter User ID or Registered Mobile Number
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="e.g. STU26001123 or 9876543210"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                We will send an authorization code to the registered mobile number.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-1 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? 'Sending...' : 'Send OTP'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="p-6 space-y-4">
            {demoOtp && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex justify-between items-center">
                <span>Demo SMS Gateway: Received OTP</span>
                <button
                  type="button"
                  onClick={() => setOtpCode(demoOtp)}
                  className="font-mono font-bold bg-amber-200/70 hover:bg-amber-200 px-2 py-0.5 rounded text-amber-900 underline cursor-pointer"
                >
                  Fill {demoOtp}
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">6-Digit Verification Code</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tracking-widest text-center border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="123456"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Re-enter new password"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Back
              </button>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Set New Password'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
