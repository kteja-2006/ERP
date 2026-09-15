import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api.ts';
import { History, X, Shield, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface LoginRecord {
  id: string;
  identifier_entered: string;
  status: 'success' | 'failed_password' | 'failed_user' | 'suspended';
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export const LoginHistoryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      apiRequest<{ history: LoginRecord[] }>('/api/auth/login-history')
        .then((res) => setHistory(res.history || []))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Login History & Access Log</h3>
              <p className="text-xs text-slate-500">Security audit trail of account authentication attempts</p>
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

        <div className="p-6 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading audit log...</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No login records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Identifier</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        {h.status === 'success' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 mr-1" /> {h.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 font-mono">{h.identifier_entered}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{h.ip_address || '127.0.0.1'}</td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center">
            <Shield className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Immutable audit logs are preserved per compliance standards
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
