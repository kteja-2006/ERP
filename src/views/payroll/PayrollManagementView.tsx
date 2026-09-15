import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { 
  CreditCard, DollarSign, Calendar, Users, CheckCircle,
  Clock, Printer, AlertCircle, Edit3, X, ChevronRight,
  Building2, FileText, Send
} from 'lucide-react';

export const PayrollManagementView: React.FC<{ isFacultySelfService?: boolean }> = ({ isFacultySelfService = false }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'disbursements' | 'structures'>(isFacultySelfService ? 'disbursements' : 'disbursements');

  // Disbursements State
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [loadingDisbursements, setLoadingDisbursements] = useState(true);

  // Structures State
  const [structures, setStructures] = useState<any[]>([]);
  const [loadingStructures, setLoadingStructures] = useState(false);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateMonth, setGenerateMonth] = useState('2026-09');
  const [generating, setGenerating] = useState(false);

  const [disbursingItem, setDisbursingItem] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cheque' | 'cash'>('bank_transfer');
  const [refNumber, setRefNumber] = useState('');
  const [disbursing, setDisbursing] = useState(false);

  const [activePayslip, setActivePayslip] = useState<any | null>(null);
  const [loadingSlip, setLoadingSlip] = useState(false);

  const [editingStructure, setEditingStructure] = useState<any | null>(null);
  const [basicSalary, setBasicSalary] = useState<number>(0);
  const [allowances, setAllowances] = useState<number>(0);
  const [deductions, setDeductions] = useState<number>(0);
  const [savingStructure, setSavingStructure] = useState(false);

  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isManagement = user?.role === 'PRINCIPAL' || user?.role === 'OFFICE' || user?.role === 'SUPER_ADMIN';

  const fetchDisbursements = async () => {
    try {
      setLoadingDisbursements(true);
      if (isFacultySelfService) {
        const res = await apiRequest('/api/payroll/my');
        setDisbursements(res.payments || []);
        if (res.structure) {
          setStructures([res.structure]);
        }
      } else {
        const url = selectedMonth ? `/api/payroll/disbursements?month=${selectedMonth}` : '/api/payroll/disbursements';
        const res = await apiRequest(url);
        setDisbursements(res.disbursements || []);
      }
    } catch (err: any) {
      console.error('Failed to load payroll disbursements:', err);
    } finally {
      setLoadingDisbursements(false);
    }
  };

  const fetchStructures = async () => {
    if (isFacultySelfService) return;
    try {
      setLoadingStructures(true);
      const res = await apiRequest('/api/payroll/structures');
      setStructures(res.structures || []);
    } catch (err: any) {
      console.error('Failed to load salary structures:', err);
    } finally {
      setLoadingStructures(false);
    }
  };

  useEffect(() => {
    fetchDisbursements();
  }, [selectedMonth, isFacultySelfService]);

  useEffect(() => {
    if (activeTab === 'structures' && !isFacultySelfService) {
      fetchStructures();
    }
  }, [activeTab]);

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const res = await apiRequest('/api/payroll/generate-month', {
        method: 'POST',
        body: JSON.stringify({ month: generateMonth }),
      });
      setNotificationMsg({ type: 'success', text: res.message || 'Payroll generated successfully' });
      setShowGenerateModal(false);
      setSelectedMonth(generateMonth);
      await fetchDisbursements();
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to generate payroll' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDisbursePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disbursingItem) return;

    try {
      setDisbursing(true);
      const res = await apiRequest(`/api/payroll/pay/${disbursingItem.id}`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod,
          referenceNumber: refNumber,
        }),
      });

      setNotificationMsg({ type: 'success', text: res.message || 'Salary disbursed successfully!' });
      setDisbursingItem(null);
      setRefNumber('');
      await fetchDisbursements();
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to disburse salary' });
    } finally {
      setDisbursing(false);
    }
  };

  const handleViewPayslip = async (paymentId: string) => {
    try {
      setLoadingSlip(true);
      const res = await apiRequest(`/api/payroll/payslip/${paymentId}`);
      setActivePayslip(res.payslip);
    } catch (err: any) {
      alert(err.message || 'Failed to load payslip');
    } finally {
      setLoadingSlip(false);
    }
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStructure) return;

    try {
      setSavingStructure(true);
      await apiRequest('/api/payroll/structures', {
        method: 'POST',
        body: JSON.stringify({
          facultyId: editingStructure.faculty_id,
          basicSalary,
          allowances,
          deductions,
        }),
      });

      setNotificationMsg({ type: 'success', text: 'Salary structure updated successfully!' });
      setEditingStructure(null);
      await fetchStructures();
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to update structure' });
    } finally {
      setSavingStructure(false);
    }
  };

  const totalPayrollAmount = disbursements.reduce((acc, curr) => acc + (curr.net_payable || 0), 0);
  const paidPayrollAmount = disbursements
    .filter((d) => d.status === 'paid')
    .reduce((acc, curr) => acc + (curr.net_payable || 0), 0);
  const pendingCount = disbursements.filter((d) => d.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              {isFacultySelfService ? 'My Compensation & Payslips' : 'Faculty & Staff Payroll Terminal'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isFacultySelfService
              ? 'View monthly salary disbursements, breakdown of allowances and deductions, and official payslips.'
              : 'Salary structure configuration, monthly payroll generation, disbursements and printable payslips.'}
          </p>
        </div>

        {isManagement && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Generate Monthly Payroll</span>
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {notificationMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            notificationMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{notificationMsg.text}</span>
          <button type="button" onClick={() => setNotificationMsg(null)} className="font-bold cursor-pointer">×</button>
        </div>
      )}

      {/* Overview Cards (For Management) */}
      {isManagement && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 font-medium">Month Total Payroll</span>
            <div className="text-xl font-bold font-mono text-slate-900">
              ₹{totalPayrollAmount.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">Total payable for {selectedMonth || 'selected filter'}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 font-medium">Disbursed (Settled)</span>
            <div className="text-xl font-bold font-mono text-emerald-700">
              ₹{paidPayrollAmount.toLocaleString()}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium">
              {totalPayrollAmount > 0 ? Math.round((paidPayrollAmount / totalPayrollAmount) * 100) : 0}% settled
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 font-medium">Pending Payments</span>
            <div className="text-xl font-bold font-mono text-amber-700">
              {pendingCount}
            </div>
            <p className="text-[11px] text-slate-400">Faculty awaiting salary release</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs (For Management) */}
      {isManagement && (
        <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl border space-x-6 text-xs font-semibold text-slate-500">
          <button
            type="button"
            onClick={() => setActiveTab('disbursements')}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
              activeTab === 'disbursements'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Monthly Disbursements & Status</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('structures')}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
              activeTab === 'structures'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Faculty Salary Structures</span>
          </button>
        </div>
      )}

      {/* TAB 1: DISBURSEMENTS REGISTER */}
      {activeTab === 'disbursements' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          {isManagement && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-slate-500 font-semibold">Select Payroll Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:border-blue-600 cursor-pointer"
                >
                  <option value="2026-09">September 2026</option>
                  <option value="2026-08">August 2026</option>
                  <option value="2026-07">July 2026</option>
                  <option value="">All Months</option>
                </select>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">
                {disbursements.length} records found
              </span>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {loadingDisbursements ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading payroll records...</div>
            ) : disbursements.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600">No disbursements found</p>
                <p className="text-slate-400">Click "Generate Monthly Payroll" to create salary records for this month.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 pl-4">Month</th>
                      <th className="p-3">Faculty / Employee</th>
                      <th className="p-3">Basic Pay</th>
                      <th className="p-3">Allowances</th>
                      <th className="p-3">Deductions</th>
                      <th className="p-3">Net Payable</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {disbursements.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 pl-4 font-mono font-bold text-slate-700">
                          {d.salary_month}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">
                            {d.first_name ? `${d.first_name} ${d.last_name}` : 'Assigned Faculty'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {d.employee_code} • {d.designation || 'Faculty'}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-slate-600">₹{d.basic_salary?.toLocaleString()}</td>
                        <td className="p-3 font-mono text-emerald-700">+₹{d.allowances?.toLocaleString()}</td>
                        <td className="p-3 font-mono text-rose-600">-₹{d.deductions?.toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          ₹{d.net_payable?.toLocaleString()}
                        </td>
                        <td className="p-3">
                          {d.status === 'paid' ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase">
                              Disbursed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold uppercase">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3 pr-4 text-right space-x-2 whitespace-nowrap">
                          {d.status === 'pending' && isManagement && (
                            <button
                              type="button"
                              onClick={() => {
                                setDisbursingItem(d);
                                setRefNumber(`NEFT-${d.salary_month}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 cursor-pointer shadow-xs text-[11px]"
                            >
                              Disburse
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleViewPayslip(d.id)}
                            className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded font-medium hover:bg-slate-50 cursor-pointer text-[11px]"
                          >
                            View Payslip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FACULTY SALARY STRUCTURES */}
      {activeTab === 'structures' && isManagement && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">Faculty Compensation Master</h3>
              <span className="text-[11px] text-slate-500">Configure base salary, HRA/allowances, and PF deductions</span>
            </div>

            {loadingStructures ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading structures...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 pl-4">Faculty Member</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Basic Salary</th>
                      <th className="p-3">Allowances</th>
                      <th className="p-3">Deductions</th>
                      <th className="p-3">Net Monthly Salary</th>
                      <th className="p-3 pr-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {structures.map((s) => (
                      <tr key={s.faculty_id} className="hover:bg-slate-50">
                        <td className="p-3 pl-4">
                          <div className="font-semibold text-slate-900">
                            {s.first_name} {s.last_name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {s.employee_code} • {s.designation}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">{s.department || 'Academics'}</td>
                        <td className="p-3 font-mono text-slate-700">₹{s.basic_salary?.toLocaleString()}</td>
                        <td className="p-3 font-mono text-emerald-700">+₹{s.allowances?.toLocaleString()}</td>
                        <td className="p-3 font-mono text-rose-600">-₹{s.deductions?.toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          ₹{s.net_salary?.toLocaleString()}
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStructure(s);
                              setBasicSalary(s.basic_salary || 35000);
                              setAllowances(s.allowances || 8000);
                              setDeductions(s.deductions || 3500);
                            }}
                            className="px-2.5 py-1 bg-white border border-slate-200 text-blue-600 rounded font-medium hover:bg-slate-50 cursor-pointer text-[11px] inline-flex items-center space-x-1"
                          >
                            <Edit3 className="w-3 h-3 mr-1" />
                            <span>Edit Structure</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GENERATE MONTH MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Generate Monthly Payroll</h3>
              <button type="button" onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGeneratePayroll} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                This will create monthly payroll records for all active faculty members based on their registered compensation structures.
              </p>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payroll Month (YYYY-MM) *</label>
                <input
                  type="month"
                  required
                  value={generateMonth}
                  onChange={(e) => setGenerateMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Confirm & Generate Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISBURSE PAYMENT MODAL */}
      {disbursingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Disburse Salary Payment</h3>
              <button type="button" onClick={() => setDisbursingItem(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDisbursePayment} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-slate-500">Employee:</div>
                <div className="font-bold text-slate-900">
                  {disbursingItem.first_name} {disbursingItem.last_name} ({disbursingItem.employee_code})
                </div>
                <div className="flex justify-between pt-1 text-slate-700">
                  <span>Net Amount to Disburse:</span>
                  <strong className="font-mono text-emerald-700 text-sm">
                    ₹{disbursingItem.net_payable?.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Disbursement Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600 cursor-pointer"
                >
                  <option value="bank_transfer">Direct Bank Transfer (NEFT / RTGS)</option>
                  <option value="cheque">Bank Cheque</option>
                  <option value="cash">Petty Cash Voucher</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reference / UTR / Cheque Number *</label>
                <input
                  type="text"
                  required
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="e.g. UTR12345678 or CHQ-998811"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDisbursingItem(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disbursing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {disbursing ? 'Recording...' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SALARY STRUCTURE MODAL */}
      {editingStructure && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Update Salary Structure</h3>
              <button type="button" onClick={() => setEditingStructure(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStructure} className="p-5 space-y-4 text-xs">
              <div className="font-medium text-slate-700">
                Faculty: {editingStructure.first_name} {editingStructure.last_name} ({editingStructure.employee_code})
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Basic Salary (₹) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Allowances (HRA / DA / Travel) (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={allowances}
                  onChange={(e) => setAllowances(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Deductions (PF / TDS / ESI) (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={deductions}
                  onChange={(e) => setDeductions(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600 font-mono"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Calculated Net Salary:</span>
                <span className="font-mono text-emerald-700">
                  ₹{Math.max(0, basicSalary + allowances - deductions).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStructure(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStructure}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {savingStructure ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL PRINTABLE PAYSLIP MODAL */}
      {activePayslip && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Official Salary Payslip</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Payslip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePayslip(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs" id="printable-payslip">
              {/* Institutional Header */}
              <div className="text-center border-b border-slate-200 pb-4 space-y-1">
                <h1 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                  {activePayslip.school_name || 'School ERP'}
                </h1>
                <p className="text-[11px] text-slate-500">
                  {activePayslip.address_line1}, {activePayslip.city} • Phone: {activePayslip.phone}
                </p>
                <div className="pt-2">
                  <span className="inline-block px-3 py-0.5 bg-slate-100 text-slate-800 font-bold uppercase tracking-wider rounded-md text-[10px]">
                    Salary Payslip - {activePayslip.salary_month}
                  </span>
                </div>
              </div>

              {/* Employee Information */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block">EMPLOYEE NAME:</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {activePayslip.first_name} {activePayslip.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">EMPLOYEE CODE:</span>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {activePayslip.employee_code}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">DESIGNATION / ROLE:</span>
                  <span className="text-slate-800 font-medium">
                    {activePayslip.designation || 'Faculty Member'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">DEPARTMENT:</span>
                  <span className="text-slate-800 font-medium">
                    {activePayslip.department || 'Academics'}
                  </span>
                </div>
              </div>

              {/* Earnings and Deductions Table */}
              <div className="grid grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-emerald-50 px-3 py-2 border-b border-slate-200 font-bold text-emerald-900 text-[11px]">
                    EARNINGS & ALLOWANCES
                  </div>
                  <div className="p-3 space-y-2 text-slate-700">
                    <div className="flex justify-between">
                      <span>Basic Pay:</span>
                      <strong className="font-mono">₹{activePayslip.basic_salary?.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Dearness / House Allowance:</span>
                      <strong className="font-mono">₹{activePayslip.allowances?.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900">
                      <span>Gross Earnings:</span>
                      <strong className="font-mono">
                        ₹{(activePayslip.basic_salary + activePayslip.allowances)?.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-rose-50 px-3 py-2 border-b border-slate-200 font-bold text-rose-900 text-[11px]">
                    DEDUCTIONS & TAXES
                  </div>
                  <div className="p-3 space-y-2 text-slate-700">
                    <div className="flex justify-between">
                      <span>Provident Fund (PF):</span>
                      <strong className="font-mono">₹{(activePayslip.deductions * 0.75).toFixed(0)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Professional Tax / TDS:</span>
                      <strong className="font-mono">₹{(activePayslip.deductions * 0.25).toFixed(0)}</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900">
                      <span>Total Deductions:</span>
                      <strong className="font-mono text-rose-700">
                        ₹{activePayslip.deductions?.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Pay Highlight */}
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-blue-900 uppercase">Net Disbursed Take-Home Pay</span>
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    Mode: {activePayslip.payment_method?.toUpperCase() || 'BANK TRANSFER'} • Ref: {activePayslip.reference_number || 'PENDING'}
                  </p>
                </div>
                <div className="text-xl font-bold font-mono text-blue-900">
                  ₹{activePayslip.net_payable?.toLocaleString()}
                </div>
              </div>

              {/* Footer Disclaimers */}
              <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>Computer generated payslip — does not require physical signature.</span>
                <span>Disbursed on: {activePayslip.paid_at ? new Date(activePayslip.paid_at).toLocaleDateString() : 'Processing'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
