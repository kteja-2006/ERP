import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Receipt,
  DollarSign,
  Search,
  CheckCircle2,
  Printer,
  Calendar,
  Lock,
  ArrowRight,
  TrendingUp,
  User
} from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const FeeCollectionTerminalView: React.FC = () => {
  const { user } = useAuth();

  // Cashier Summary stats
  const [cashierSummary, setCashierSummary] = useState<any>(null);
  const [todayTransactions, setTodayTransactions] = useState<any[]>([]);

  // Search & Student selection
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Student fee details
  const [feeAssignments, setFeeAssignments] = useState<any[]>([]);
  const [studentPayments, setStudentPayments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');

  // Payment form state
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Receipt Modal state
  const [receiptModal, setReceiptModal] = useState<{
    isOpen: boolean;
    receiptNumber: string | null;
    loading: boolean;
    data: any | null;
  }>({
    isOpen: false,
    receiptNumber: null,
    loading: false,
    data: null
  });

  // 1. Fetch Cashier Daily Summary
  const fetchCashierSummary = async () => {
    try {
      const res = await apiRequest('/api/fees/cashier/summary');
      setCashierSummary(res.summary);
      setTodayTransactions(res.transactions || []);
    } catch (err) {
      console.error('Failed to load cashier summary:', err);
    }
  };

  useEffect(() => {
    fetchCashierSummary();
  }, []);

  // 2. Search Students
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      apiRequest(`/api/students?search=${encodeURIComponent(searchQuery)}`)
        .then((res) => {
          setSearchResults(res.students || []);
        })
        .catch((e) => console.error(e));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. Load Student Fee Profile
  const handleSelectStudent = async (stu: any) => {
    setSelectedStudent(stu);
    setSearchQuery('');
    setSearchResults([]);
    setMessage(null);
    try {
      const res = await apiRequest(`/api/fees/student/${stu.id}`);
      setFeeAssignments(res.assignments || []);
      setStudentPayments(res.payments || []);
      if (res.assignments && res.assignments.length > 0) {
        // Find first assignment with balance due
        const pending = res.assignments.find((a: any) => a.balance_due > 0) || res.assignments[0];
        setSelectedAssignmentId(pending.id);
        setPayAmount(pending.balance_due > 0 ? pending.balance_due.toString() : '');
      }
    } catch (err: any) {
      console.error('Failed to load student fee profile:', err);
    }
  };

  // Switch active fee assignment
  const handleAssignmentChange = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    const target = feeAssignments.find((a) => a.id === assignmentId);
    if (target && target.balance_due > 0) {
      setPayAmount(target.balance_due.toString());
    } else {
      setPayAmount('');
    }
  };

  // 4. Submit Payment
  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentId || !payAmount || parseFloat(payAmount) <= 0) {
      setMessage({ type: 'error', text: 'Please select a fee assignment and enter valid amount.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await apiRequest('/api/fees/collect', {
        method: 'POST',
        body: JSON.stringify({
          studentFeeAssignmentId: selectedAssignmentId,
          amountPaid: payAmount,
          paymentMethod: payMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined
        })
      });

      setMessage({ type: 'success', text: res.message });
      setPayAmount('');
      setReferenceNumber('');
      setNotes('');

      // Refresh student fees and cashier summary
      if (selectedStudent) {
        handleSelectStudent(selectedStudent);
      }
      fetchCashierSummary();

      // Automatically open the receipt modal!
      if (res.receiptNumber) {
        handleOpenReceipt(res.receiptNumber);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Payment collection failed' });
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Open Receipt Voucher
  const handleOpenReceipt = async (receiptNum: string) => {
    setReceiptModal({
      isOpen: true,
      receiptNumber: receiptNum,
      loading: true,
      data: null
    });

    try {
      const res = await apiRequest(`/api/fees/receipt/${receiptNum}`);
      setReceiptModal((prev) => ({
        ...prev,
        loading: false,
        data: res
      }));
    } catch (err: any) {
      alert('Failed to load receipt');
      setReceiptModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // 6. Perform Daily Settlement Closing
  const handleDailyClosing = async () => {
    const confirmClosing = window.confirm(
      'Are you sure you want to execute Day End Closing? This will tally and lock today’s cashier register.'
    );
    if (!confirmClosing) return;

    try {
      const res = await apiRequest('/api/fees/cashier/daily-closing', {
        method: 'POST'
      });
      alert(res.message);
      fetchCashierSummary();
    } catch (err: any) {
      alert(err.message || 'Failed to close register');
    }
  };

  const currentAssignment = feeAssignments.find((a) => a.id === selectedAssignmentId);

  return (
    <div className="space-y-6">
      {/* Cashier Terminal Header & Day Totals */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <span>Cashier Point-of-Sale (POS) & Fee Collection</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time fee collection, partial dues settlement, instant print vouchers, and daily closing.
          </p>
        </div>

        {cashierSummary && (
          <div className="flex items-center space-x-2">
            {cashierSummary.isClosed ? (
              <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Today's Register Settled & Closed</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleDailyClosing}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>End-of-Day Settlement</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cashier Daily Totals Metric Ribbon */}
      {cashierSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-slate-400 font-semibold">Today's Transactions</span>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {cashierSummary.transactionCount} receipts
            </p>
          </div>
          <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
            <span className="text-emerald-700 font-semibold">Cash in Register</span>
            <p className="text-lg font-bold text-emerald-900 mt-0.5">
              ₹{cashierSummary.totalCash.toLocaleString()}
            </p>
          </div>
          <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200/80 shadow-xs">
            <span className="text-blue-700 font-semibold">UPI Collection</span>
            <p className="text-lg font-bold text-blue-900 mt-0.5">
              ₹{cashierSummary.totalUpi.toLocaleString()}
            </p>
          </div>
          <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200/80 shadow-xs">
            <span className="text-indigo-700 font-semibold">Card Terminal</span>
            <p className="text-lg font-bold text-indigo-900 mt-0.5">
              ₹{cashierSummary.totalCard.toLocaleString()}
            </p>
          </div>
          <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200/80 shadow-xs">
            <span className="text-purple-700 font-semibold">Total Gross Inflow</span>
            <p className="text-lg font-bold text-purple-900 mt-0.5">
              ₹{cashierSummary.totalCollection.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs font-bold px-2 py-0.5 hover:opacity-75 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Two-Column Layout: Left Search & Collect, Right Today's Register */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Student Fee Lookup & POS Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Search Box */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2 relative">
            <label className="block text-xs font-bold text-slate-800">
              Student Lookup (by Name or Admission No)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type student name (e.g. Rahul Verma) or admission number..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((stu) => (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => handleSelectStudent(stu)}
                    className="w-full text-left p-3 hover:bg-blue-50/60 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {stu.first_name} {stu.last_name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Admission: <strong className="font-mono">{stu.admission_number}</strong> • Class:{' '}
                        {stu.class_name} - {stu.section_name}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Student Fee Account */}
          {selectedStudent ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {selectedStudent.first_name[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {selectedStudent.first_name} {selectedStudent.last_name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Adm: {selectedStudent.admission_number} • {selectedStudent.class_name || 'Class 10'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>

              {/* Fee Assignments Cards */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Fee Assessment Terms</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {feeAssignments.map((fa) => {
                    const isSelected = fa.id === selectedAssignmentId;
                    return (
                      <div
                        key={fa.id}
                        onClick={() => handleAssignmentChange(fa.id)}
                        className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{fa.term_name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              fa.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : fa.status === 'partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {fa.status}
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                          <div className="flex justify-between">
                            <span>Net Payable:</span>
                            <strong className="font-mono">₹{fa.net_payable.toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Paid to Date:</span>
                            <span className="text-emerald-700 font-mono">
                              ₹{fa.paid_amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200/60 pt-1 font-bold">
                            <span>Balance Due:</span>
                            <span className="text-rose-600 font-mono">
                              ₹{fa.balance_due.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* POS Payment Form */}
              {currentAssignment && currentAssignment.balance_due > 0 && !cashierSummary?.isClosed ? (
                <form
                  onSubmit={handleCollectPayment}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 text-xs"
                >
                  <h4 className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>POS Terminal Checkout</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Amount to collect */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Amount to Collect (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        max={currentAssignment.balance_due}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 text-sm font-bold font-mono border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setPayAmount(currentAssignment.balance_due.toString())}
                        className="mt-1 text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        Set Full Due (₹{currentAssignment.balance_due})
                      </button>
                    </div>

                    {/* Payment Mode */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['cash', 'upi', 'card'] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPayMethod(method)}
                            className={`py-2 text-xs font-bold rounded-lg uppercase cursor-pointer transition-colors ${
                              payMethod === method
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Ref & Remarks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Transaction Ref / Cheque No (Optional)
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="e.g. UPI-928410294 or Card Auth 331"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Notes / Memo (Optional)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Paid in full by father"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Processing Payment...'
                        : `Collect ₹${parseFloat(payAmount || '0').toLocaleString()} & Generate Receipt`}
                    </span>
                  </button>
                </form>
              ) : currentAssignment && currentAssignment.balance_due === 0 ? (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>All fees for this term have been fully settled! No balance due.</span>
                </div>
              ) : null}

              {/* Past Payment Receipts for Student */}
              {studentPayments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-slate-700 text-xs">Past Payment Receipts</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {studentPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 bg-white flex items-center justify-between text-xs hover:bg-slate-50"
                      >
                        <div>
                          <p className="font-mono font-bold text-blue-700">{p.receipt_number}</p>
                          <p className="text-[11px] text-slate-500">
                            {p.term_name} • {p.payment_method.toUpperCase()} •{' '}
                            {new Date(p.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <strong className="font-mono text-slate-900">
                            ₹{p.amount_paid.toLocaleString()}
                          </strong>
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(p.receipt_number)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
                          >
                            Print Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-400">
              Search and select a student above to access fee records and accept payments.
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Today's Cashier Ledger */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Today's Receipts</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400 font-bold">
              {todayTransactions.length}
            </span>
          </div>

          {todayTransactions.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No transactions recorded yet today.</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {todayTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-100/70 transition-colors text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-mono text-blue-600">{tx.receipt_number}</span>
                    <strong className="font-mono text-slate-900">
                      ₹{tx.amount_paid.toLocaleString()}
                    </strong>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {tx.first_name} {tx.last_name} ({tx.admission_number})
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <span className="uppercase font-bold">{tx.payment_method}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenReceipt(tx.receipt_number)}
                      className="text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      View Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PRINTABLE DIGITAL RECEIPT VOUCHER MODAL */}
      {receiptModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 my-8 space-y-6">
            {receiptModal.loading || !receiptModal.data ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading receipt voucher...</div>
            ) : (
              <div className="space-y-5">
                {/* Receipt Header */}
                <div className="text-center border-b-2 border-slate-900 pb-4">
                  <h2 className="text-lg font-black uppercase tracking-wide text-slate-900">
                    {receiptModal.data.school?.school_name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {receiptModal.data.school?.address_line1}, {receiptModal.data.school?.city},{' '}
                    {receiptModal.data.school?.state}
                  </p>
                  <div className="mt-2 inline-block px-3 py-1 bg-slate-100 border border-slate-200 rounded font-bold text-xs uppercase tracking-widest text-slate-800">
                    Official Fee Receipt
                  </div>
                </div>

                {/* Receipt Meta */}
                <div className="flex justify-between text-xs font-mono border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">RECEIPT NO</span>
                    <strong className="text-blue-700 text-sm">
                      {receiptModal.data.payment.receipt_number}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">DATE & TIME</span>
                    <strong className="text-slate-800">
                      {new Date(receiptModal.data.payment.created_at).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* Student Details */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student Name:</span>
                    <strong className="text-slate-900">
                      {receiptModal.data.payment.first_name} {receiptModal.data.payment.last_name}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Admission No:</span>
                    <strong className="font-mono text-slate-900">
                      {receiptModal.data.payment.admission_number}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Class & Section:</span>
                    <strong className="text-slate-900">
                      {receiptModal.data.payment.class_name} - {receiptModal.data.payment.section_name} (Roll: {receiptModal.data.payment.roll_number || '—'})
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Term:</span>
                    <strong className="text-slate-900">{receiptModal.data.payment.term_name}</strong>
                  </div>
                </div>

                {/* Amount Paid Box */}
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center space-y-1">
                  <span className="text-xs text-emerald-800 font-semibold uppercase tracking-wider block">
                    Amount Received
                  </span>
                  <p className="text-2xl font-black text-emerald-900 font-mono">
                    ₹{receiptModal.data.payment.amount_paid.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Payment Mode: <strong>{receiptModal.data.payment.payment_method.toUpperCase()}</strong>
                    {receiptModal.data.payment.reference_number &&
                      ` • Ref: ${receiptModal.data.payment.reference_number}`}
                  </p>
                </div>

                {/* Outstanding balance breakdown */}
                <div className="text-xs text-slate-600 border-t border-slate-200 pt-3 flex justify-between">
                  <span>Remaining Term Balance:</span>
                  <strong className="font-mono text-slate-900">
                    ₹{(
                      receiptModal.data.payment.net_payable -
                      receiptModal.data.payment.total_paid_to_date
                    ).toLocaleString()}
                  </strong>
                </div>

                {/* Signatures */}
                <div className="pt-6 grid grid-cols-2 gap-6 text-center text-xs text-slate-600 border-t border-slate-200">
                  <div>
                    <div className="h-8 font-mono text-[11px] flex items-end justify-center text-slate-700">
                      {receiptModal.data.payment.cashier_code || 'Counter-01'}
                    </div>
                    <div className="border-t border-slate-300 pt-1 font-semibold">Cashier Signature</div>
                  </div>
                  <div>
                    <div className="h-8 flex items-end justify-center">
                      <span className="text-[10px] text-emerald-700 font-bold border border-emerald-300 px-2 py-0.5 rounded">
                        PAID & VERIFIED
                      </span>
                    </div>
                    <div className="border-t border-slate-300 pt-1 font-semibold">Institution Seal</div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReceiptModal((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center space-x-1.5 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
