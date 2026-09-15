import React, { useState, useEffect } from 'react';
import {
  Award,
  BookOpen,
  FileText,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Printer,
  Plus,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  User
} from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const ExamManagementView: React.FC = () => {
  const { user } = useAuth();
  const isPrincipal = ['PRINCIPAL', 'SUPER_ADMIN'].includes(user?.role || '');

  // Exams state
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [examPapers, setExamPapers] = useState<any[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');

  // Marks Entry state
  const [currentPaper, setCurrentPaper] = useState<any>(null);
  const [studentsMarks, setStudentsMarks] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Principal Override Modal state
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    student: any | null;
    currentMark: number;
    newMark: string;
    reason: string;
    loading: boolean;
  }>({
    isOpen: false,
    student: null,
    currentMark: 0,
    newMark: '',
    reason: '',
    loading: false
  });

  // Report Card Modal state
  const [reportCardModal, setReportCardModal] = useState<{
    isOpen: boolean;
    studentId: string | null;
    loading: boolean;
    data: any | null;
  }>({
    isOpen: false,
    studentId: null,
    loading: false,
    data: null
  });

  // Create Exam Modal
  const [createExamModal, setCreateExamModal] = useState<boolean>(false);
  const [newExamName, setNewExamName] = useState<string>('');
  const [newExamStart, setNewExamStart] = useState<string>('');
  const [newExamEnd, setNewExamEnd] = useState<string>('');

  // 1. Fetch all exams
  const fetchExams = async () => {
    try {
      const res = await apiRequest('/api/exams');
      const exList = res.exams || [];
      setExams(exList);
      if (exList.length > 0 && !selectedExamId) {
        setSelectedExamId(exList[0].id);
      }
    } catch (err) {
      console.error('Failed to load exams:', err);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  // 2. Fetch subject papers for selected exam
  const fetchExamPapers = async () => {
    if (!selectedExamId) return;
    try {
      const res = await apiRequest(`/api/exams/${selectedExamId}/subjects`);
      const papers = res.subjects || [];
      setExamPapers(papers);
      if (papers.length > 0) {
        setSelectedPaperId(papers[0].id);
      } else {
        setSelectedPaperId('');
        setCurrentPaper(null);
        setStudentsMarks([]);
      }
    } catch (err) {
      console.error('Failed to load exam papers:', err);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      fetchExamPapers();
    }
  }, [selectedExamId]);

  // 3. Fetch marks sheet for selected paper
  const fetchMarksSheet = async () => {
    if (!selectedPaperId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiRequest(`/api/exams/subjects/${selectedPaperId}/marks`);
      setCurrentPaper(res.paper);
      setStudentsMarks(res.students || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch marks sheet' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPaperId) {
      fetchMarksSheet();
    }
  }, [selectedPaperId]);

  // Handle Mark change in input
  const handleMarkInputChange = (studentId: string, value: string) => {
    setStudentsMarks((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, inputMark: value } : s))
    );
  };

  // Save Marks (Faculty / Admin bulk save)
  const handleSaveMarks = async (lockMarks: boolean = false) => {
    setSaving(true);
    setMessage(null);
    try {
      const entries = studentsMarks
        .filter((s) => s.inputMark !== undefined || s.obtained_marks !== null)
        .map((s) => ({
          studentId: s.student_id,
          obtainedMarks: s.inputMark !== undefined ? s.inputMark : s.obtained_marks
        }));

      await apiRequest(`/api/exams/subjects/${selectedPaperId}/marks`, {
        method: 'POST',
        body: JSON.stringify({
          marksEntries: entries,
          lockMarks
        })
      });

      setMessage({
        type: 'success',
        text: lockMarks ? 'Marks finalized and locked successfully!' : 'Marks saved successfully!'
      });
      fetchMarksSheet();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save marks' });
    } finally {
      setSaving(false);
    }
  };

  // Submit Principal Override
  const handleSubmitOverride = async () => {
    if (!overrideModal.newMark || !overrideModal.reason.trim()) {
      alert('Please enter a new mark and justification reason.');
      return;
    }

    setOverrideModal((prev) => ({ ...prev, loading: true }));
    try {
      await apiRequest(`/api/exams/marks/${overrideModal.student.mark_id}/override`, {
        method: 'POST',
        body: JSON.stringify({
          newValue: overrideModal.newMark,
          reason: overrideModal.reason.trim()
        })
      });

      setOverrideModal({
        isOpen: false,
        student: null,
        currentMark: 0,
        newMark: '',
        reason: '',
        loading: false
      });
      setMessage({ type: 'success', text: 'Principal override logged with audit trail.' });
      fetchMarksSheet();
    } catch (err: any) {
      alert(err.message || 'Failed to override mark');
      setOverrideModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Report Card
  const handleOpenReportCard = async (studentId: string) => {
    setReportCardModal({
      isOpen: true,
      studentId,
      loading: true,
      data: null
    });

    try {
      const res = await apiRequest(`/api/exams/report-card/${studentId}/${selectedExamId}`);
      setReportCardModal((prev) => ({
        ...prev,
        loading: false,
        data: res
      }));
    } catch (err: any) {
      alert(err.message || 'Failed to load report card');
      setReportCardModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Create Exam handler
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim()) return;

    try {
      await apiRequest('/api/exams', {
        method: 'POST',
        body: JSON.stringify({
          name: newExamName.trim(),
          startDate: newExamStart || null,
          endDate: newExamEnd || null
        })
      });
      setCreateExamModal(false);
      setNewExamName('');
      setNewExamStart('');
      setNewExamEnd('');
      fetchExams();
    } catch (err: any) {
      alert(err.message || 'Failed to create exam');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Exam Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Award className="w-5 h-5 text-blue-600" />
            <span>Examinations, Marks & Report Cards</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-enforced marks entry with 1-time teacher edit restriction, Principal override audit logs, and printable report cards.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Exam Dropdown */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>

          {isPrincipal && (
            <button
              type="button"
              onClick={() => setCreateExamModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Exam</span>
            </button>
          )}
        </div>
      </div>

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

      {/* Main Two-Column Layout: Left Paper Selector, Right Marks Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left Column: Exam Subject Papers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Exam Papers</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400 font-bold">{examPapers.length}</span>
          </div>

          {examPapers.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No subject papers configured for this exam.</p>
          ) : (
            <div className="space-y-1.5">
              {examPapers.map((p) => {
                const isSelected = p.id === selectedPaperId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPaperId(p.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 border border-blue-200'
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div>
                      <p className="font-bold">{p.subject_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {p.class_name} • Max: {p.max_marks} | Pass: {p.pass_marks}
                      </p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Marks Entry Sheet & Roster */}
        <div className="lg:col-span-3 space-y-4">
          {currentPaper ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Paper Details Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <span>{currentPaper.class_name} - {currentPaper.subject_name}</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-[11px]">
                      {currentPaper.subject_code}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Max Marks: <strong className="text-slate-800">{currentPaper.max_marks}</strong> • Pass Marks:{' '}
                    <strong className="text-slate-800">{currentPaper.pass_marks}</strong>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleSaveMarks(false)}
                    disabled={saving}
                    className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveMarks(true)}
                    disabled={saving}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center space-x-1.5 transition-colors shadow-2xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Finalize & Lock</span>
                  </button>
                </div>
              </div>

              {/* Roster Table */}
              {loading ? (
                <div className="p-10 text-center text-xs text-slate-400">Loading student marks...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4 w-14">Roll</th>
                        <th className="py-2.5 px-4">Student Name</th>
                        <th className="py-2.5 px-4">Admission No</th>
                        <th className="py-2.5 px-4 text-center">Marks Obtained (Max {currentPaper.max_marks})</th>
                        <th className="py-2.5 px-4 text-center">Result / Status</th>
                        <th className="py-2.5 px-4 text-center">Audit Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentsMarks.map((stu) => {
                        const currentMarkVal =
                          stu.inputMark !== undefined
                            ? stu.inputMark
                            : stu.obtained_marks !== null
                            ? stu.obtained_marks
                            : '';
                        const numericVal = parseFloat(currentMarkVal);
                        const isPassing = !isNaN(numericVal) && numericVal >= currentPaper.pass_marks;
                        const isFailing = !isNaN(numericVal) && numericVal < currentPaper.pass_marks;
                        const isLocked = stu.is_locked === 1;
                        const editConsumed = stu.correction_count >= 1;

                        return (
                          <tr key={stu.student_id} className="hover:bg-slate-50/60">
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              {stu.roll_number || '—'}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {stu.first_name} {stu.last_name}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                              {stu.admission_number}
                            </td>

                            {/* Marks Input */}
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center space-x-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max={currentPaper.max_marks}
                                  value={currentMarkVal}
                                  disabled={isLocked && !isPrincipal}
                                  onChange={(e) =>
                                    handleMarkInputChange(stu.student_id, e.target.value)
                                  }
                                  placeholder="—"
                                  className={`w-18 px-2 py-1 text-center font-mono font-bold border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                    isFailing
                                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                                      : isPassing
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                      : 'border-slate-200 text-slate-800'
                                  } ${isLocked && !isPrincipal ? 'bg-slate-100 opacity-75 cursor-not-allowed' : ''}`}
                                />
                                <span className="text-[11px] text-slate-400 font-mono">
                                  / {currentPaper.max_marks}
                                </span>
                              </div>
                            </td>

                            {/* Pass / Fail / Pending */}
                            <td className="py-3 px-4 text-center">
                              {isNaN(numericVal) ? (
                                <span className="text-slate-400 text-[11px]">Not Entered</span>
                              ) : isPassing ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                  PASS
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                                  FAIL
                                </span>
                              )}
                            </td>

                            {/* Audit / Lock state */}
                            <td className="py-3 px-4 text-center">
                              {isLocked ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-semibold">
                                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                                  <span>Finalized</span>
                                </span>
                              ) : editConsumed ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-semibold">
                                  <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                                  <span>1-Edit Consumed</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Draft</span>
                              )}
                            </td>

                            {/* Actions: Report Card & Principal Override */}
                            <td className="py-3 px-4 text-right space-x-1.5">
                              {isPrincipal && stu.mark_id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOverrideModal({
                                      isOpen: true,
                                      student: stu,
                                      currentMark: stu.obtained_marks,
                                      newMark: stu.obtained_marks.toString(),
                                      reason: '',
                                      loading: false
                                    })
                                  }
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold cursor-pointer transition-colors"
                                  title="Principal Audit Override"
                                >
                                  Override
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenReportCard(stu.student_id)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold cursor-pointer transition-colors"
                              >
                                Report Card
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-400">
              Select an exam paper from the left panel to begin marks entry.
            </div>
          )}
        </div>
      </div>

      {/* PRINCIPAL OVERRIDE MODAL */}
      {overrideModal.isOpen && overrideModal.student && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-amber-700">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-sm font-bold text-slate-900">Principal Mark Override with Audit Log</h3>
            </div>

            <p className="text-xs text-slate-600">
              You are overriding the mark for{' '}
              <strong>
                {overrideModal.student.first_name} {overrideModal.student.last_name}
              </strong>{' '}
              ({overrideModal.student.admission_number}) in {currentPaper?.subject_name}. Every modification is permanently timestamped with your identity.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Mark</label>
                <input
                  type="text"
                  disabled
                  value={`${overrideModal.currentMark} / ${currentPaper?.max_marks}`}
                  className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  New Adjusted Mark (Max {currentPaper?.max_marks})
                </label>
                <input
                  type="number"
                  min="0"
                  max={currentPaper?.max_marks}
                  value={overrideModal.newMark}
                  onChange={(e) =>
                    setOverrideModal((prev) => ({ ...prev, newMark: e.target.value }))
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Statutory Reason for Override <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={overrideModal.reason}
                  onChange={(e) =>
                    setOverrideModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="e.g. Script re-totaling correction after student grievance petition"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setOverrideModal({
                    isOpen: false,
                    student: null,
                    currentMark: 0,
                    newMark: '',
                    reason: '',
                    loading: false
                  })
                }
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitOverride}
                disabled={overrideModal.loading}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
              >
                {overrideModal.loading ? 'Recording...' : 'Authorize & Commit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL STUDENT REPORT CARD MODAL */}
      {reportCardModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 my-8 space-y-6">
            {reportCardModal.loading || !reportCardModal.data ? (
              <div className="p-16 text-center text-xs text-slate-400">
                Generating student performance dossier...
              </div>
            ) : (
              <div id="printable-report-card" className="space-y-6">
                {/* School Letterhead */}
                <div className="text-center border-b-2 border-slate-900 pb-4">
                  <h1 className="text-xl font-extrabold tracking-wide uppercase text-slate-900">
                    {reportCardModal.data.school?.school_name || 'Academic Institution'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    {reportCardModal.data.school?.address_line1}, {reportCardModal.data.school?.city},{' '}
                    {reportCardModal.data.school?.state} • Phone: {reportCardModal.data.school?.phone}
                  </p>
                  <p className="text-xs font-bold text-blue-700 tracking-wider uppercase mt-1">
                    STUDENT PROGRESS REPORT • {reportCardModal.data.exam?.name}
                  </p>
                </div>

                {/* Student Demographic Information Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 font-semibold block">Student Name</span>
                    <strong className="text-slate-900">
                      {reportCardModal.data.student?.first_name} {reportCardModal.data.student?.last_name}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Admission No</span>
                    <strong className="text-slate-900 font-mono">
                      {reportCardModal.data.student?.admission_number}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Class & Section</span>
                    <strong className="text-slate-900">
                      {reportCardModal.data.student?.class_name} - {reportCardModal.data.student?.section_name}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Roll Number</span>
                    <strong className="text-slate-900 font-mono">
                      {reportCardModal.data.student?.roll_number || '—'}
                    </strong>
                  </div>
                </div>

                {/* Subject-Wise Assessment Table */}
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3 text-center">Max Marks</th>
                        <th className="py-2.5 px-3 text-center">Pass Marks</th>
                        <th className="py-2.5 px-3 text-center">Marks Obtained</th>
                        <th className="py-2.5 px-3 text-center">Percentage</th>
                        <th className="py-2.5 px-3 text-center">Grade</th>
                        <th className="py-2.5 px-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportCardModal.data.subjects?.map((sub: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {sub.subjectName}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">{sub.maxMarks}</td>
                          <td className="py-2.5 px-3 text-center text-slate-600">{sub.passMarks}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900 font-mono">
                            {sub.obtainedMarks}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">{sub.percentage}%</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-bold rounded text-[10px]">
                              {sub.grade}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">{sub.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                        <td className="py-2.5 px-3">Grand Total</td>
                        <td className="py-2.5 px-3 text-center">
                          {reportCardModal.data.summary?.totalMaxMarks}
                        </td>
                        <td className="py-2.5 px-3 text-center">—</td>
                        <td className="py-2.5 px-3 text-center font-mono text-blue-700 text-sm">
                          {reportCardModal.data.summary?.totalObtainedMarks}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-sm">
                          {reportCardModal.data.summary?.overallPercentage}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 bg-blue-600 text-white font-bold rounded text-[10px]">
                            {reportCardModal.data.summary?.overallGrade}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700">
                          {reportCardModal.data.summary?.resultStatus}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Term Attendance Summary */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="flex items-center space-x-2 text-slate-700 font-medium">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span>
                      Term Attendance Record:{' '}
                      <strong className="text-slate-900">
                        {reportCardModal.data.summary?.attendancePercentage}%
                      </strong>{' '}
                      ({reportCardModal.data.summary?.effectiveAtt} of{' '}
                      {reportCardModal.data.summary?.totalAttDays} working days)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                    Satisfactory
                  </span>
                </div>

                {/* Signatures Footer */}
                <div className="pt-8 grid grid-cols-3 gap-8 text-center text-xs text-slate-600 border-t border-slate-200">
                  <div>
                    <div className="h-10"></div>
                    <div className="border-t border-slate-300 pt-1 font-semibold">Class Teacher</div>
                  </div>
                  <div>
                    <div className="h-10"></div>
                    <div className="border-t border-slate-300 pt-1 font-semibold">Parent / Guardian</div>
                  </div>
                  <div>
                    <div className="h-10 font-serif italic text-slate-800 text-xs flex items-end justify-center pb-1">
                      {reportCardModal.data.school?.principal_name || 'Dr. K. S. Sharma'}
                    </div>
                    <div className="border-t border-slate-300 pt-1 font-semibold text-slate-900">
                      Principal
                    </div>
                  </div>
                </div>

                {/* Modal Action Controls */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReportCardModal((prev) => ({ ...prev, isOpen: false }))}
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
                    <span>Print Report Card</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE EXAM MODAL */}
      {createExamModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create Academic Examination</h3>
            <form onSubmit={handleCreateExam} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Exam Name</label>
                <input
                  type="text"
                  required
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  placeholder="e.g. Annual Final Assessment 2026"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newExamStart}
                    onChange={(e) => setNewExamStart(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newExamEnd}
                    onChange={(e) => setNewExamEnd(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateExamModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  Create Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
