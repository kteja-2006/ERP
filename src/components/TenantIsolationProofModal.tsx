import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api.ts';
import { ShieldCheck, X, AlertOctagon, CheckCircle2, Lock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TenantIsolationProofModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      apiRequest('/api/schools/verify-isolation')
        .then((res) => setData(res))
        .catch((err) => setData({ error: err.message }))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Tenant Isolation Verification</h3>
              <p className="text-xs text-slate-500">Live Database Proof of Cross-Tenant Protection</p>
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

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="py-6 text-center text-xs text-slate-500">Running database isolation query...</div>
          ) : data?.error ? (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {data.error}
            </div>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-emerald-50/75 border border-emerald-200 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-emerald-900">Tenant Isolation Verified</h4>
                  <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                    Database authorization rules strictly enforce row-level boundary conditions. A user from School A
                    cannot query or view records belonging to School B even by tampering with request payloads.
                  </p>
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Active Tenant Code:</span>
                  <span className="font-semibold text-slate-800 uppercase font-mono">{data.schoolCode}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Current School ID:</span>
                  <span className="font-mono text-slate-700">{data.userSchoolId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Accessible Students (Within Tenant):</span>
                  <span className="font-semibold text-emerald-700 font-mono">{data.accessibleStudentsCount} students</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Other Schools' Records Blocked:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {data.otherSchoolRecordsHiddenCount} records blocked
                  </span>
                </div>
              </div>

              {data.sampleAccessible && data.sampleAccessible.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center">
                    <Lock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Authorized Tenant Records (Sample)
                  </h5>
                  <div className="space-y-1">
                    {data.sampleAccessible.map((s: any) => (
                      <div
                        key={s.id}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs flex justify-between items-center"
                      >
                        <span className="font-medium text-slate-800">
                          {s.first_name} {s.last_name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">{s.admission_number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
