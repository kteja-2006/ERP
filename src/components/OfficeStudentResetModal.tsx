import React, { useState } from 'react';
import { apiRequest } from '../services/api.ts';
import { KeyRound, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultStudentUserId?: string;
}

export const OfficeStudentResetModal: React.FC<Props> = ({ isOpen, onClose, defaultStudentUserId = '' }) => {
  const [studentUserId, setStudentUserId] = useState(defaultStudentUserId);
  const [newPassword, setNewPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await apiRequest('/api/auth/reset-student-password', {
        method: 'POST',
        body: JSON.stringify({ studentUserId, newPassword }),
      });
      setSuccess(res.message || 'Student password reset successfully');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to reset student password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Office: Reset Student Password</h3>
              <p className="text-xs text-slate-500">Direct student credential reset (No Principal approval needed)</p>
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

        <form onSubmit={handleReset} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-2 p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Student User ID</label>
            <input
              type="text"
              required
              value={studentUserId}
              onChange={(e) => setStudentUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              placeholder="e.g. STU26001123"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">New Temporary Password</label>
            <input
              type="text"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              placeholder="Enter new password"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
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
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
