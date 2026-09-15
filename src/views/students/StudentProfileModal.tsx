import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  X,
  User,
  GraduationCap,
  FileCheck,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Edit2,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';

interface Props {
  studentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export const StudentProfileModal: React.FC<Props> = ({ studentId, isOpen, onClose, onUpdate }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'academic' | 'documents' | 'fees'>('profile');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode for Demographics
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState('');
  const [editGuardianName, setEditGuardianName] = useState('');
  const [editGuardianMobile, setEditGuardianMobile] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Document Review Action State
  const [reviewRemarks, setReviewRemarks] = useState<{ [docId: string]: string }>({});
  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/students/${studentId}`);
      setData(res);
      if (res.student) {
        setEditFirstName(res.student.first_name);
        setEditLastName(res.student.last_name);
        setEditBloodGroup(res.student.blood_group || 'O+');
        setEditGuardianName(res.student.guardian_name || '');
        setEditGuardianMobile(res.student.guardian_mobile || res.student.user_mobile || '');
        setEditAddress(res.student.address_line1 || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch student details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && studentId) {
      fetchProfile();
      setIsEditing(false);
    }
  }, [isOpen, studentId]);

  const handleSaveProfile = async () => {
    if (!studentId) return;
    setSavingEdit(true);
    try {
      await apiRequest(`/api/students/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          bloodGroup: editBloodGroup,
          guardianName: editGuardianName,
          guardianMobile: editGuardianMobile,
          addressLine1: editAddress,
        }),
      });
      setIsEditing(false);
      fetchProfile();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert(err.message || 'Failed to save changes');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleReviewDoc = async (docId: string, status: 'approved' | 'rejected') => {
    setReviewingDocId(docId);
    try {
      await apiRequest(`/api/documents/${docId}/review`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          remarks: reviewRemarks[docId] || (status === 'approved' ? 'Verified valid' : 'Discrepancy observed'),
        }),
      });
      fetchProfile();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert(err.message || 'Failed to update document status');
    } finally {
      setReviewingDocId(null);
    }
  };

  if (!isOpen) return null;

  const s = data?.student;
  const canEdit = user?.role === 'OFFICE' || user?.role === 'PRINCIPAL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
              {s ? `${s.first_name[0]}${s.last_name[0]}` : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  {s ? `${s.first_name} ${s.last_name}` : 'Student Profile'}
                </h3>
                {s && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {s.status}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono mt-0.5">
                <span>Adm: {s?.admission_number}</span>
                <span>•</span>
                <span>User: {s?.user_id}</span>
                {s?.class_name && (
                  <>
                    <span>•</span>
                    <span className="text-slate-700 font-sans font-medium">
                      {s.class_name} - {s.section_name} (Roll #{s.roll_number})
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-white px-6 space-x-6 text-xs font-semibold text-slate-500">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Demographics</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('academic')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'academic'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Academic Record</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Documents ({data?.documents?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fees')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'fees'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Fees & Receipts</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading student 360 profile...</div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg">{error}</div>
          ) : !s ? (
            <div className="py-12 text-center text-xs text-slate-500">Student not found</div>
          ) : (
            <>
              {/* TAB 1: DEMOGRAPHICS */}
              {activeTab === 'profile' && (
                <div className="space-y-6 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider">
                      Personal & Guardian Information
                    </h4>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            handleSaveProfile();
                          } else {
                            setIsEditing(true);
                          }
                        }}
                        disabled={savingEdit}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        {isEditing ? <Save className="w-3.5 h-3.5 text-blue-600" /> : <Edit2 className="w-3.5 h-3.5" />}
                        <span>{isEditing ? (savingEdit ? 'Saving...' : 'Save Profile') : 'Edit Info'}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-2">
                      <span className="font-semibold text-slate-700 block border-b border-slate-200 pb-1">
                        Student Identifiers
                      </span>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Admission No:</span>
                        <span className="font-mono font-bold text-blue-600">{s.admission_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Gender / DOB:</span>
                        <span className="font-medium text-slate-800">
                          {s.gender} • {s.date_of_birth}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Blood Group:</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editBloodGroup}
                            onChange={(e) => setEditBloodGroup(e.target.value)}
                            className="px-2 py-0.5 border rounded text-xs w-16 text-right"
                          />
                        ) : (
                          <span className="font-medium text-slate-800">{s.blood_group || 'N/A'}</span>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Admission Date:</span>
                        <span className="text-slate-800">{s.admission_date}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-2">
                      <span className="font-semibold text-slate-700 block border-b border-slate-200 pb-1">
                        Parent & Contact
                      </span>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Guardian Name:</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGuardianName}
                            onChange={(e) => setEditGuardianName(e.target.value)}
                            className="px-2 py-0.5 border rounded text-xs"
                          />
                        ) : (
                          <span className="font-medium text-slate-800">{s.guardian_name || s.father_name}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Guardian Mobile:</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGuardianMobile}
                            onChange={(e) => setEditGuardianMobile(e.target.value)}
                            className="px-2 py-0.5 border rounded text-xs font-mono"
                          />
                        ) : (
                          <span className="font-mono font-medium text-slate-800">
                            {s.guardian_mobile || s.user_mobile}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Emergency Contact:</span>
                        <span className="font-mono text-slate-700">{s.emergency_contact || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">City / State:</span>
                        <span className="text-slate-800">
                          {s.city || 'N/A'}, {s.state || ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sibling Links */}
                  {data?.siblings && data.siblings.length > 0 && (
                    <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg space-y-2">
                      <span className="font-semibold text-blue-900 block">
                        Linked Siblings ({data.siblings.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {data.siblings.map((sib: any) => (
                          <div
                            key={sib.id}
                            className="px-3 py-2 bg-white rounded border border-blue-200 flex justify-between items-center"
                          >
                            <span className="font-medium text-slate-800">
                              {sib.first_name} {sib.last_name} ({sib.class_name})
                            </span>
                            <span className="font-mono text-[11px] text-blue-600 font-semibold">
                              {sib.admission_number}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ACADEMIC RECORD */}
              {activeTab === 'academic' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-semibold text-slate-700">Enrolled Class:</span>
                      <span className="font-bold text-slate-900 text-sm">{s.class_name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-semibold text-slate-700">Assigned Section:</span>
                      <span className="font-bold text-blue-600">Section {s.section_name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-semibold text-slate-700">Section Roll Number:</span>
                      <span className="font-mono font-bold text-slate-800">Roll #{s.roll_number}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-semibold text-slate-700">Academic Year:</span>
                      <span className="font-medium text-slate-800">{s.academic_year_name || 'AY-2026-27'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Promotion Status:</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded text-[11px] border border-emerald-200 uppercase">
                        {s.promotion_status || 'Enrolled'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DOCUMENTS VERIFICATION (Section 6 & 43) */}
              {activeTab === 'documents' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider">Document Checklist</h4>
                    <span className="text-slate-500 text-[11px]">Verification status is tracked in immutable audit log</span>
                  </div>

                  <div className="space-y-3">
                    {data.documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 text-sm">{doc.requirement_title}</span>
                            {doc.is_required === 1 && (
                              <span className="ml-2 text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                Mandatory
                              </span>
                            )}
                            <p className="text-slate-500 text-[11px] mt-0.5">{doc.requirement_description}</p>
                          </div>

                          <div>
                            {doc.status === 'approved' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Verified & Approved
                              </span>
                            )}
                            {doc.status === 'rejected' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Rejected
                              </span>
                            )}
                            {(doc.status === 'uploaded' || doc.status === 'under_review') && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3 mr-1" /> Under Review
                              </span>
                            )}
                          </div>
                        </div>

                        {doc.remarks && (
                          <div className="p-2 bg-slate-50 rounded text-slate-600 text-[11px] border border-slate-200/60">
                            <span className="font-semibold text-slate-700">Remarks:</span> {doc.remarks}
                          </div>
                        )}

                        {/* Admin Approval / Rejection Controls (Section 6) */}
                        {canEdit && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <input
                              type="text"
                              placeholder="Review remarks (e.g. Verified with original)..."
                              value={reviewRemarks[doc.id] || ''}
                              onChange={(e) =>
                                setReviewRemarks({ ...reviewRemarks, [doc.id]: e.target.value })
                              }
                              className="px-2.5 py-1 text-xs border border-slate-200 rounded-md w-3/5"
                            />

                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={() => handleReviewDoc(doc.id, 'approved')}
                                disabled={reviewingDocId === doc.id}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px] cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewDoc(doc.id, 'rejected')}
                                disabled={reviewingDocId === doc.id}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-medium text-[11px] cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: FEES & PAYMENTS */}
              {activeTab === 'fees' && (
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider">Fee Structure & Dues</h4>

                  {data.feeAssignments.length === 0 ? (
                    <p className="text-slate-500 py-4">No fee structures assigned yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.feeAssignments.map((fa: any) => (
                        <div key={fa.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                          <div className="flex justify-between font-semibold text-slate-800">
                            <span>{fa.fee_structure_name}</span>
                            <span className="font-mono text-sm">₹{fa.net_payable.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>Paid: ₹{fa.paid_amount.toFixed(2)}</span>
                            <span className="text-amber-700 font-semibold">
                              Due: ₹{(fa.net_payable - fa.paid_amount).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h4 className="font-bold text-slate-900 uppercase tracking-wider pt-2">Receipt History</h4>
                  {data.payments.length === 0 ? (
                    <p className="text-slate-500">No payment receipts issued.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.payments.map((p: any) => (
                        <div
                          key={p.id}
                          className="p-2.5 bg-white border border-slate-200 rounded-lg flex justify-between items-center"
                        >
                          <div>
                            <span className="font-mono font-bold text-blue-600">Receipt #{p.receipt_number}</span>
                            <p className="text-slate-500 text-[11px]">
                              {new Date(p.payment_date).toLocaleDateString()} • {p.payment_method.toUpperCase()}
                            </p>
                          </div>
                          <span className="font-bold text-slate-900 font-mono text-sm">
                            ₹{p.amount_paid.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
