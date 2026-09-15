import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { 
  ShieldCheck, History, Filter, Search, Calendar,
  User, CheckCircle, AlertTriangle, ChevronDown, ChevronRight,
  Database, RefreshCw, Key, FileText, Download
} from 'lucide-react';

interface AuditLog {
  id: string;
  school_id: string;
  user_id: string;
  actor_user_id?: string;
  role_id: string;
  action: string;
  module: string;
  record_id?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  ip_address?: string;
  created_at: string;
}

export const AuditLogsView: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalLogs: number; byModule: any[] } | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const url = selectedModule ? `/api/audit/logs?module=${selectedModule}` : '/api/audit/logs';
      const [logsRes, statsRes] = await Promise.all([
        apiRequest(url),
        apiRequest('/api/audit/stats').catch(() => null),
      ]);
      setLogs(logsRes.logs || []);
      if (statsRes) {
        setStats(statsRes);
      }
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedModule]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.module.toLowerCase().includes(q) ||
      (log.actor_user_id && log.actor_user_id.toLowerCase().includes(q)) ||
      (log.reason && log.reason.toLowerCase().includes(q)) ||
      (log.record_id && log.record_id.toLowerCase().includes(q))
    );
  });

  const getModuleBadgeColor = (module: string) => {
    switch (module) {
      case 'AUTH':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'FEES':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'EXAMS':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'STUDENTS':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'PAYROLL':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'NOTICES':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'ACADEMICS':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Institutional Security & Audit Trail</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident, immutable system ledger recording all administrative actions, overrides, mark modifications, and financial transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Summary Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 font-medium">Total Audited Events</span>
            <div className="text-xl font-bold font-mono text-slate-900">{stats.totalLogs}</div>
            <p className="text-[11px] text-slate-400">Recorded across school history</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 font-medium">Financial & Fee Operations</span>
            <div className="text-xl font-bold font-mono text-emerald-700">
              {stats.byModule.find((m) => m.module === 'FEES')?.count || 0}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium">Payments, closings & refunds</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 font-medium">Exam & Mark Entries</span>
            <div className="text-xl font-bold font-mono text-purple-700">
              {stats.byModule.find((m) => m.module === 'EXAMS')?.count || 0}
            </div>
            <p className="text-[11px] text-purple-600 font-medium">Scores & corrections</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 font-medium">Active Modules Covered</span>
            <div className="text-xl font-bold font-mono text-blue-700">{stats.byModule.length}</div>
            <p className="text-[11px] text-slate-400">Complete ERP subsystems</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search action, user, or record..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-slate-400 font-medium shrink-0">Module:</span>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:border-blue-600 cursor-pointer"
          >
            <option value="">All Modules</option>
            <option value="AUTH">Authentication & Security</option>
            <option value="STUDENTS">Students & Admissions</option>
            <option value="FEES">Fee Management & POS</option>
            <option value="EXAMS">Exams & Marksheets</option>
            <option value="PAYROLL">Faculty Payroll</option>
            <option value="NOTICES">Notices & Circulars</option>
            <option value="ACADEMICS">Academic Catalog</option>
          </select>
        </div>
      </div>

      {/* Log Feed Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading audit trail...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <History className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">No audit logs found</p>
            <p className="text-slate-400">No events matched your search or filter criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const dateStr = new Date(log.created_at).toLocaleString();

              let parsedOld = null;
              let parsedNew = null;
              try {
                if (log.old_value) parsedOld = JSON.parse(log.old_value);
              } catch (_) {
                parsedOld = log.old_value;
              }
              try {
                if (log.new_value) parsedNew = JSON.parse(log.new_value);
              } catch (_) {
                parsedNew = log.new_value;
              }

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/70 transition-colors space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer shrink-0"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase shrink-0 ${getModuleBadgeColor(log.module)}`}>
                        {log.module}
                      </span>

                      <span className="font-bold text-slate-900 font-mono text-[11px] truncate">
                        {log.action}
                      </span>

                      {log.record_id && (
                        <span className="text-slate-400 font-mono text-[10px] hidden md:inline truncate">
                          [{log.record_id}]
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 shrink-0">
                      <div className="flex items-center space-x-1 font-medium text-slate-600">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{log.actor_user_id || 'System'}</span>
                        <span className="text-[10px] text-slate-400">({log.role_id})</span>
                      </div>
                      <span>• {dateStr}</span>
                    </div>
                  </div>

                  {log.reason && (
                    <div className="pl-6 text-[11px] text-slate-600 flex items-center space-x-1.5">
                      <span className="font-semibold text-slate-700">Reason / Justification:</span>
                      <span className="italic">{log.reason}</span>
                    </div>
                  )}

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <div className="pl-6 pt-2 pb-1 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        {log.old_value && (
                          <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-1">
                            <span className="font-bold text-rose-900 block text-[10px] uppercase">Prior State (Before Mutation)</span>
                            <pre className="font-mono text-rose-800 text-[10px] overflow-x-auto whitespace-pre-wrap">
                              {typeof parsedOld === 'object' ? JSON.stringify(parsedOld, null, 2) : parsedOld}
                            </pre>
                          </div>
                        )}

                        {log.new_value && (
                          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1">
                            <span className="font-bold text-emerald-900 block text-[10px] uppercase">Committed State (After Mutation)</span>
                            <pre className="font-mono text-emerald-800 text-[10px] overflow-x-auto whitespace-pre-wrap">
                              {typeof parsedNew === 'object' ? JSON.stringify(parsedNew, null, 2) : parsedNew}
                            </pre>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-2 font-mono">
                        <span>Audit Record ID: {log.id}</span>
                        <span>IP Address: {log.ip_address || '127.0.0.1'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
