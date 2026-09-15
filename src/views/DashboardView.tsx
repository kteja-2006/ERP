import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTenant } from '../context/TenantContext.tsx';
import { apiRequest } from '../services/api.ts';
import {
  Users,
  GraduationCap,
  CreditCard,
  Calendar,
  BookOpen,
  FileCheck,
  Building2,
  Clock,
  ShieldCheck,
  Receipt,
  FileText,
  KeyRound,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import { StudentDirectoryView } from './students/StudentDirectoryView.tsx';
import { OfficeStudentResetModal } from '../components/OfficeStudentResetModal.tsx';
import { StudentAdmissionModal } from './students/StudentAdmissionModal.tsx';
import { AcademicManagementView } from './academics/AcademicManagementView.tsx';
import { TimetableEngineView } from './academics/TimetableEngineView.tsx';
import { AttendanceRegisterView } from './attendance/AttendanceRegisterView.tsx';
import { ExamManagementView } from './exams/ExamManagementView.tsx';
import { FeeCollectionTerminalView } from './fees/FeeCollectionTerminalView.tsx';
import { NoticeBoardView } from './notices/NoticeBoardView.tsx';
import { PayrollManagementView } from './payroll/PayrollManagementView.tsx';
import { AuditLogsView } from './audit/AuditLogsView.tsx';
import { Award, Printer, UserCheck, Megaphone, DollarSign, History } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { user } = useAuth();
  const { currentSchool, availableSchools } = useTenant();
  const [isResetStudentModalOpen, setResetStudentModalOpen] = useState(false);
  const [isAdmissionModalOpen, setAdmissionModalOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Welcome, {user.name}</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {user.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {currentSchool ? `${currentSchool.name} • ${currentSchool.subdomain}.yourproduct.com` : 'Platform Multi-School Environment'}
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {(user.role === 'OFFICE' || user.role === 'PRINCIPAL') && (
            <button
              type="button"
              onClick={() => setAdmissionModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Admission</span>
            </button>
          )}

          {user.role === 'OFFICE' && (
            <button
              type="button"
              onClick={() => setResetStudentModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Reset Student Password</span>
            </button>
          )}

          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
            <span className="text-slate-400 mr-1">User ID:</span>
            <span className="font-mono font-semibold text-slate-800">{user.userId}</span>
          </div>
        </div>
      </div>

      {/* Role-Specific Portal Views */}
      {user.role === 'PRINCIPAL' && <PrincipalView />}
      {user.role === 'OFFICE' && <OfficeView />}
      {user.role === 'CASHIER' && <CashierView />}
      {user.role === 'FACULTY' && <FacultyView />}
      {user.role === 'STUDENT' && <StudentView studentId={user.studentId} admissionNo={user.admissionNumber} />}
      {user.role === 'SUPER_ADMIN' && <SuperAdminView schools={availableSchools} />}

      <OfficeStudentResetModal
        isOpen={isResetStudentModalOpen}
        onClose={() => setResetStudentModalOpen(false)}
        defaultStudentUserId="STU26001123"
      />

      <StudentAdmissionModal
        isOpen={isAdmissionModalOpen}
        onClose={() => setAdmissionModalOpen(false)}
      />
    </div>
  );
};

// 1. PRINCIPAL DASHBOARD (Section 51)
const PrincipalView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'academics' | 'timetable' | 'attendance' | 'exams' | 'fees' | 'students' | 'notices' | 'payroll' | 'audit'>('overview');
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    apiRequest('/api/schools/dashboard-metrics')
      .then((res) => setMetrics(res))
      .catch((e) => console.error('Failed to load dashboard metrics:', e));
  }, []);

  return (
    <div className="space-y-6">
      {/* Principal Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl border space-x-6 text-xs font-semibold text-slate-500 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Executive Overview & Overrides</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notices')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'notices'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Notices & Circulars</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'payroll'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Staff Payroll & Salaries</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('academics')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'academics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Academic Hierarchy & Catalog</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('timetable')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'timetable'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Timetable Scheduler</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'attendance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Attendance Register</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exams')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'exams'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Exams & Report Cards</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fees')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'fees'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Fee Collections (POS)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'students'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Student Directory & Admissions</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Trail & Security</span>
        </button>
      </div>

      {activeTab === 'students' && <StudentDirectoryView />}
      {activeTab === 'notices' && <NoticeBoardView />}
      {activeTab === 'payroll' && <PayrollManagementView />}
      {activeTab === 'audit' && <AuditLogsView />}
      {activeTab === 'academics' && <AcademicManagementView />}
      {activeTab === 'timetable' && <TimetableEngineView />}
      {activeTab === 'attendance' && <AttendanceRegisterView />}
      {activeTab === 'exams' && <ExamManagementView />}
      {activeTab === 'fees' && <FeeCollectionTerminalView />}
      {activeTab === 'overview' && (
        <>
          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Enrolled</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl font-bold text-slate-900">
                  {metrics?.totalStudents ?? 3} Students
                </span>
                <span className="ml-2 text-xs text-emerald-600 font-medium">Active</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {metrics?.classDistribution
                  ? metrics.classDistribution.map((c: any) => `${c.class_name} (${c.student_count})`).join(', ')
                  : 'Class 10 (2), Class 8 (1)'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Attendance</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl font-bold text-slate-900">
                  {metrics?.attendancePercent ?? 100}%
                </span>
                <span className="ml-2 text-xs text-emerald-600 font-medium">Morning & Afternoon</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Calculated half-day auto rules active</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fee Collection</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl font-bold text-slate-900">
                  ₹{(metrics?.fees?.collected ?? 6000).toLocaleString()}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  of ₹{(metrics?.fees?.assessed ?? 15000).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Due: ₹{(metrics?.fees?.due ?? 9000).toLocaleString()}</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faculty Deployed</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl font-bold text-slate-900">
                  {metrics?.facultyCount ?? 4} Registered
                </span>
                <span className="ml-2 text-xs text-slate-500 font-medium">Active Staff</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Math, Science, English & Social</p>
            </div>
          </div>

          {/* Academic Structure & Override Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Academic Structure & Active Configuration</h3>
                <span className="text-xs text-slate-500 font-mono">AY: 2026-27</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">Class 10 (Code 010)</span>
                    <p className="text-slate-500 text-[11px]">Sections A, B, C • Core Subjects: Mathematics, Science, English</p>
                  </div>
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 font-medium rounded text-[11px]">2 Students</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">Class 8 (Code 008)</span>
                    <p className="text-slate-500 text-[11px]">Section A • Sibling student enrolled</p>
                  </div>
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 font-medium rounded text-[11px]">1 Student</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">Grading Rules Configuration</span>
                    <p className="text-slate-500 text-[11px]">A+ (90-100), A (80-89), B+ (70-79), B (60-69), C (50-59), D (35-49), F (&lt;35)</p>
                  </div>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 font-medium rounded text-[11px]">Active</span>
                </div>
              </div>
            </div>

            {/* Principal Controlled Override Capabilities (Section 27) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <ShieldCheck className="w-4 h-4 mr-1.5 text-blue-600" />
                Principal Controls & Overrides
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Faculty marks entry locks after a single one-time correction. Only Principal possesses controlled override capabilities with mandatory reason and immutable audit log.
              </p>

              <div className="p-3 bg-blue-50/75 border border-blue-200 rounded-lg space-y-2 text-xs">
                <span className="font-semibold text-blue-900 block">Pending Approvals</span>
                <div className="flex items-center justify-between text-[11px] text-blue-800">
                  <span>Proposed Fee Category: "Lab Equipment Fee"</span>
                  <span className="font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Pending</span>
                </div>
                <p className="text-[10px] text-slate-500">Requested by Cashier CAS001</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// 2. OFFICE DASHBOARD (Section 6 & Section 51)
const OfficeView: React.FC = () => {
  const [officeTab, setOfficeTab] = useState<'students' | 'academics' | 'timetable' | 'attendance' | 'fees' | 'documents' | 'notices' | 'payroll'>('students');

  return (
    <div className="space-y-6">
      {/* Office Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl border space-x-6 text-xs font-semibold text-slate-500 overflow-x-auto">
        <button
          type="button"
          onClick={() => setOfficeTab('students')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            officeTab === 'students'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Student Register & Admissions</span>
        </button>
        <button
          type="button"
          onClick={() => setOfficeTab('notices')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            officeTab === 'notices'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Notice Board</span>
        </button>
        <button
          type="button"
          onClick={() => setOfficeTab('payroll')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            officeTab === 'payroll'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Staff Payroll</span>
        </button>
        <button
          type="button"
          onClick={() => setOfficeTab('academics')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            officeTab === 'academics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Academic Structure & Catalog</span>
        </button>
        <button
          type="button"
          onClick={() => setOfficeTab('timetable')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            officeTab === 'timetable'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Timetable Scheduler</span>
        </button>
        <button
          type="button"
          onClick={() => setOfficeTab('attendance')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            officeTab === 'attendance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Daily Attendance Register</span>
        </button>
        <button
          type="button"
          onClick={() => setOfficeTab('fees')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            officeTab === 'fees'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Fee Collections (POS)</span>
        </button>
        <button
          type="button"
          onClick={() => setOfficeTab('documents')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            officeTab === 'documents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Document Verification Workflow</span>
        </button>
      </div>

      {officeTab === 'students' && <StudentDirectoryView />}
      {officeTab === 'notices' && <NoticeBoardView />}
      {officeTab === 'payroll' && <PayrollManagementView />}
      {officeTab === 'academics' && <AcademicManagementView />}
      {officeTab === 'timetable' && <TimetableEngineView />}
      {officeTab === 'attendance' && <AttendanceRegisterView />}
      {officeTab === 'fees' && <FeeCollectionTerminalView />}
      {officeTab === 'documents' && <OfficeDocumentManagementView />}
    </div>
  );
};

// Office Document Requirements & Review Center
const OfficeDocumentManagementView: React.FC = () => {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchRequirements = async () => {
    try {
      const res = await apiRequest('/api/documents/requirements');
      setRequirements(res.requirements || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, []);

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    try {
      await apiRequest('/api/documents/requirements', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          isRequired,
        }),
      });
      setNewTitle('');
      setNewDesc('');
      fetchRequirements();
    } catch (err: any) {
      alert(err.message || 'Failed to add requirement');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Mandatory & Optional Document Checklist</h3>
        <p className="text-xs text-slate-500">
          Enforced across student admissions and portal submissions.
        </p>

        <div className="space-y-2 text-xs">
          {requirements.map((req) => (
            <div
              key={req.id}
              className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-slate-800">{req.title}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{req.description || 'Verification required'}</p>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  req.is_required === 1
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {req.is_required === 1 ? 'Mandatory' : 'Optional'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Add Document Requirement</h3>
        <form onSubmit={handleAddRequirement} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Document Title *</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Income Certificate"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Description / Instructions</label>
            <textarea
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="e.g. Issued by Mandal Revenue Officer"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isReq"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="rounded text-blue-600"
            />
            <label htmlFor="isReq" className="font-medium text-slate-700">
              Mandatory for all admissions
            </label>
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer"
          >
            Add Requirement
          </button>
        </form>
      </div>
    </div>
  );
};

// 3. CASHIER DASHBOARD (Section 7 & 51)
const CashierView: React.FC = () => {
  return (
    <div className="space-y-6">
      <FeeCollectionTerminalView />
    </div>
  );
};

// 4. FACULTY DASHBOARD (Section 8 & 51)
const FacultyView: React.FC = () => {
  const [facultyTab, setFacultyTab] = useState<'my-schedule' | 'attendance' | 'marks' | 'all-timetables' | 'notices' | 'payroll'>('my-schedule');
  const [mySlots, setMySlots] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    apiRequest('/api/academics/timetable/my')
      .then((res) => setMySlots(res.slots || []))
      .catch((e) => console.error('Failed to load faculty timetable:', e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-indigo-50/75 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold">Assignment Scope Enforced</h4>
          <p className="mt-0.5 text-indigo-700 leading-relaxed">
            As a faculty member, your operational access is strictly restricted to your assigned classes and subjects. Daily morning and afternoon attendance and exam marks entries adhere to your school assignment limits.
          </p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl border space-x-6 text-xs font-semibold text-slate-500 overflow-x-auto">
        <button
          type="button"
          onClick={() => setFacultyTab('my-schedule')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            facultyTab === 'my-schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>My Teaching Schedule ({mySlots.length} Weekly Periods)</span>
        </button>
        <button
          type="button"
          onClick={() => setFacultyTab('notices')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            facultyTab === 'notices' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Institutional Circulars</span>
        </button>
        <button
          type="button"
          onClick={() => setFacultyTab('payroll')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            facultyTab === 'payroll' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>My Salary & Payslips</span>
        </button>
        <button
          type="button"
          onClick={() => setFacultyTab('attendance')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            facultyTab === 'attendance' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Mark Class Attendance</span>
        </button>
        <button
          type="button"
          onClick={() => setFacultyTab('marks')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            facultyTab === 'marks' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Marks Entry Sheet</span>
        </button>
        <button
          type="button"
          onClick={() => setFacultyTab('all-timetables')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            facultyTab === 'all-timetables' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Institutional Timetable Viewer</span>
        </button>
      </div>

      {facultyTab === 'notices' && <NoticeBoardView />}
      {facultyTab === 'payroll' && <PayrollManagementView isFacultySelfService={true} />}
      {facultyTab === 'attendance' && <AttendanceRegisterView />}
      {facultyTab === 'marks' && <ExamManagementView />}
      {facultyTab === 'all-timetables' && <TimetableEngineView />}
      {facultyTab === 'my-schedule' && (
        <div className="space-y-6">
          {/* Assigned Classes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Assigned Classes & Subjects</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-900 text-sm">Class 10 - Section A</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[11px]">Senior PGT</span>
                </div>
                <p className="text-slate-600">Subject: Mathematics (MATH10)</p>
                <p className="text-slate-500 text-[11px]">Enrolled Students: Rahul Verma, Amit Patel</p>
                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setFacultyTab('marks')}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 cursor-pointer text-xs"
                  >
                    Marks Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setFacultyTab('attendance')}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded font-medium hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    Class Attendance
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Period Schedule */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Your Weekly Teaching Timetable</h3>
              <span className="text-xs text-slate-500 font-mono">Academic Year 2026-27</span>
            </div>

            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading your timetable...</div>
            ) : mySlots.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                No timetable slots assigned yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {mySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{slot.day_of_week}</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                        Period {slot.period_number}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-800 text-xs">
                        {slot.subject_name} ({slot.subject_code})
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        🎓 {slot.class_name} - Section {slot.section_name}
                      </p>
                      {slot.room_number && (
                        <p className="text-slate-500 text-[11px]">📍 Room: {slot.room_number}</p>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 font-mono">
                      {slot.start_time} - {slot.end_time}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 5. STUDENT DASHBOARD (Section 9 & 51)
const StudentView: React.FC<{ studentId?: string; admissionNo?: string }> = ({ studentId, admissionNo }) => {
  const [studentTab, setStudentTab] = useState<'overview' | 'attendance' | 'report-card' | 'fees' | 'notices'>('overview');
  const [profileData, setProfileData] = useState<any>(null);
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [loading, setLoading] = useState(true);

  // Additional data for attendance, report card, fees
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [reportCardData, setReportCardData] = useState<any>(null);
  const [examsList, setExamsList] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [feeData, setFeeData] = useState<any>(null);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);

  useEffect(() => {
    const effectiveStudentId = studentId || 'me';
    apiRequest(`/api/students/${effectiveStudentId}`)
      .then((res) => setProfileData(res))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));

    // Attendance Summary
    apiRequest(`/api/attendance/student/${effectiveStudentId}/summary`)
      .then((res) => setAttendanceData(res))
      .catch((e) => console.error(e));

    // Available Exams for School
    apiRequest('/api/exams')
      .then((res) => {
        const list = res.exams || [];
        setExamsList(list);
        if (list.length > 0 && !selectedExamId) {
          setSelectedExamId(list[0].id);
        }
      })
      .catch((e) => console.error(e));

    // Fee details
    apiRequest(`/api/fees/student/${effectiveStudentId}`)
      .then((res) => setFeeData(res))
      .catch((e) => console.error(e));

    // Load student's own class timetable
    apiRequest('/api/academics/timetable/my')
      .then((res) => setTimetableSlots(res.slots || []))
      .catch((e) => console.error('Failed to load student timetable:', e));
  }, [studentId]);

  // Load report card dynamically whenever selectedExamId changes or defaults to latest
  useEffect(() => {
    const effectiveStudentId = studentId || 'me';
    const targetExam = selectedExamId || 'latest';
    apiRequest(`/api/exams/report-card/${effectiveStudentId}/${targetExam}`)
      .then((res) => setReportCardData(res))
      .catch((e) => {
        console.warn('Report card query notice:', e?.message || e);
        setReportCardData(null);
      });
  }, [studentId, selectedExamId]);

  const stu = profileData?.student;
  const daySlots = timetableSlots
    .filter((s) => s.day_of_week === selectedDay)
    .sort((a, b) => a.period_number - b.period_number);

  return (
    <div className="space-y-6">
      {/* Student Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl border space-x-6 text-xs font-semibold text-slate-500 overflow-x-auto">
        <button
          type="button"
          onClick={() => setStudentTab('overview')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            studentTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>My Profile & Timetable</span>
        </button>
        <button
          type="button"
          onClick={() => setStudentTab('notices')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            studentTab === 'notices' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Notice Board</span>
        </button>
        <button
          type="button"
          onClick={() => setStudentTab('attendance')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            studentTab === 'attendance' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Attendance Log ({attendanceData?.summary?.attendancePercentage || '100'}%)</span>
        </button>
        <button
          type="button"
          onClick={() => setStudentTab('report-card')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            studentTab === 'report-card' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Official Report Card</span>
        </button>
        <button
          type="button"
          onClick={() => setStudentTab('fees')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            studentTab === 'fees' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Fee Receipts & Balance</span>
        </button>
      </div>

      {studentTab === 'notices' && <NoticeBoardView />}

      {studentTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Admission Number</span>
              <div className="text-2xl font-bold text-blue-600 font-mono mt-1">
                {stu?.admission_number || admissionNo || '26001123'}
              </div>
              <span className="text-xs text-slate-400">
                {stu?.class_name ? `${stu.class_name} - ${stu.section_name} • Roll: ${stu.roll_number}` : 'Class 10 - Section A • Roll: 1'}
              </span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Fee Status</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                Paid ₹{feeData?.assignments?.[0]?.paid_amount || '6,000'}
              </div>
              <span className="text-xs text-amber-600 font-medium">
                Balance due: ₹{feeData?.assignments?.[0]?.balance_due ?? '9,000.00'}
              </span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Attendance Rate</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {attendanceData?.summary?.attendancePercentage || '100'}%
              </div>
              <span className="text-xs text-slate-500">Threshold requirement: &ge; 75%</span>
            </div>
          </div>

          {/* Timetable Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Class Timetable ({stu?.class_name || 'Class 10'} - Section {stu?.section_name || 'A'})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live scheduled subjects, teaching faculty, and designated classrooms.
                </p>
              </div>

              {/* Day Filter Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                      selectedDay === day
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {daySlots.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                No classes scheduled for {selectedDay}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Period {slot.period_number}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {slot.start_time} - {slot.end_time}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm mt-1">{slot.subject_name}</p>
                    <p className="text-slate-600 text-xs">👨‍🏫 {slot.faculty_name}</p>
                    {slot.room_number && (
                      <p className="text-slate-400 text-[11px]">📍 Room: {slot.room_number}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ATTENDANCE LOG TAB */}
      {studentTab === 'attendance' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Attendance Register & Defaulter Check</h3>
            {attendanceData?.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Total Working Days</span>
                  <strong className="text-base text-slate-900 font-mono">
                    {attendanceData.summary.totalSchoolDays}
                  </strong>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-emerald-700 block">Present Full Days</span>
                  <strong className="text-base text-emerald-900 font-mono">
                    {attendanceData.summary.presentDays}
                  </strong>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-amber-700 block">Half Days</span>
                  <strong className="text-base text-amber-900 font-mono">
                    {attendanceData.summary.halfDays}
                  </strong>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-blue-700 block">Calculated Percentage</span>
                  <strong className="text-base text-blue-900 font-mono">
                    {attendanceData.summary.attendancePercentage}%
                  </strong>
                </div>
              </div>
            )}

            {attendanceData?.summary?.isBelowThreshold && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Attendance Alert: Your attendance ({attendanceData.summary.attendancePercentage}%) is below the mandatory 75% examination eligibility threshold.
                </span>
              </div>
            )}

            {/* Attendance History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Morning Session</th>
                    <th className="py-2.5 px-3">Afternoon Session</th>
                    <th className="py-2.5 px-3">Effective Day Status</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceData?.records?.map((rec: any) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">{rec.date}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rec.morning_status === 'present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {rec.morning_status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rec.afternoon_status === 'present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {rec.afternoon_status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            rec.calculated_status === 'present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rec.calculated_status === 'half_day'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {rec.calculated_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">{rec.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. OFFICIAL REPORT CARD TAB */}
      {studentTab === 'report-card' && (
        <div className="space-y-4">
          {/* Exam Selector Toolbar if multiple exams available */}
          {examsList.length > 0 && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-700">Select Examination Session:</span>
              <select
                value={selectedExamId || (examsList[0]?.id || '')}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {examsList.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.academic_year_name || 'Current Session'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportCardData && reportCardData.exam ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs max-w-3xl mx-auto space-y-6">
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <h2 className="text-xl font-black uppercase text-slate-900">
                  {reportCardData.school?.school_name}
                </h2>
                <p className="text-xs text-slate-500">Official Student Progress & Examination Transcript</p>
                <div className="mt-2 inline-block px-3 py-1 bg-blue-50 border border-blue-200 rounded font-bold text-xs text-blue-800">
                  {reportCardData.exam.name} • Academic Year {reportCardData.exam.academic_year_name}
                </div>
              </div>

              {/* Student Bio */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-xs border border-slate-200 font-medium">
                <div>
                  <span className="text-slate-400 block text-[10px]">NAME</span>
                  <strong className="text-slate-900">
                    {reportCardData.student.first_name} {reportCardData.student.last_name}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ADMISSION NO</span>
                  <strong className="text-blue-700 font-mono">
                    {reportCardData.student.admission_number}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CLASS & SECTION</span>
                  <strong className="text-slate-900">
                    {reportCardData.student.class_name} - {reportCardData.student.section_name}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ROLL NUMBER</span>
                  <strong className="text-slate-900">{reportCardData.student.roll_number || '1'}</strong>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-bold">
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Max Marks</th>
                      <th className="py-2.5 px-3">Pass Marks</th>
                      <th className="py-2.5 px-3">Marks Scored</th>
                      <th className="py-2.5 px-3">Grade</th>
                      <th className="py-2.5 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {reportCardData.subjects.map((sub: any) => (
                      <tr key={sub.subject_code} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {sub.subject_name} ({sub.subject_code})
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{sub.max_marks}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{sub.pass_marks}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{sub.marks_obtained}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{sub.grade}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sub.is_passed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {sub.is_passed ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Grand Total & Overall Result */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs font-semibold">
                <div>
                  <span className="text-slate-500">Aggregate Total:</span>
                  <p className="text-lg font-black text-slate-900 font-mono">
                    {reportCardData.totalObtainedMarks} / {reportCardData.totalMaxMarks}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Overall Percentage:</span>
                  <p className="text-lg font-black text-blue-700 font-mono">
                    {reportCardData.overallPercentage}%
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Grade:</span>
                  <p className="text-lg font-black text-emerald-700 font-mono">
                    {reportCardData.overallGrade}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>
                  <p className="text-sm font-bold text-emerald-800 uppercase mt-0.5">
                    {reportCardData.remarks}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center space-x-2 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Official Transcript</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
              No examination report cards published yet.
            </div>
          )}
        </div>
      )}

      {/* 4. FEE RECEIPTS TAB */}
      {studentTab === 'fees' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Student Fee Account & Payment Ledger</h3>

            {/* Assignments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {feeData?.assignments?.map((fa: any) => (
                <div key={fa.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>{fa.term_name}</span>
                    <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      {fa.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                    <div className="flex justify-between">
                      <span>Total Amount:</span>
                      <strong className="font-mono">₹{fa.net_payable.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid to Date:</span>
                      <strong className="font-mono text-emerald-700">₹{fa.paid_amount.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                      <span>Remaining Balance:</span>
                      <strong className="font-mono text-rose-600">₹{fa.balance_due.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Receipts */}
            <h4 className="font-bold text-slate-800 text-xs pt-2">Paid Fee Receipts</h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {feeData?.payments?.map((p: any) => (
                <div key={p.id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <span className="font-mono font-bold text-blue-700">{p.receipt_number}</span>
                    <p className="text-[11px] text-slate-500">
                      {p.term_name} • {p.payment_method.toUpperCase()} • {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <strong className="font-mono text-slate-900">₹{p.amount_paid.toLocaleString()}</strong>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase">
                      Settled
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 6. SUPER ADMIN DASHBOARD (Section 4 & 85)
const SuperAdminView: React.FC<{ schools: any[] }> = ({ schools }) => {
  const [adminTab, setAdminTab] = useState<'tenants' | 'audit'>('tenants');

  return (
    <div className="space-y-6">
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl border space-x-6 text-xs font-semibold text-slate-500">
        <button
          type="button"
          onClick={() => setAdminTab('tenants')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            adminTab === 'tenants' ? 'border-purple-600 text-purple-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>School Tenants Directory</span>
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('audit')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            adminTab === 'audit' ? 'border-purple-600 text-purple-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Global Audit Trail & Security Logs</span>
        </button>
      </div>

      {adminTab === 'audit' && <AuditLogsView />}

      {adminTab === 'tenants' && (
        <>
          <div className="p-4 bg-purple-50/75 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start space-x-3">
            <Building2 className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold">Platform Multi-Tenant Master Control</h4>
              <p className="mt-0.5 text-purple-700 leading-relaxed">
                Super Admin oversees all schools, manages onboarding, sets subdomains, and configures initial Principal accounts. Platform Super Admin does not casually manipulate day-to-day school operational records.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Registered School Tenants</h3>
              <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                {schools.length} Active Tenants
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {schools.map((sch) => (
                <div key={sch.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{sch.name}</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold text-[11px]">
                      {sch.status}
                    </span>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px]">Subdomain: {sch.subdomain}.yourproduct.com</p>
                  <p className="text-slate-500">Principal: {sch.principal_name || 'Assigned'}</p>
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Code: {sch.code}</span>
                    <span className="text-purple-600 font-medium cursor-pointer hover:underline">
                      Configure School Settings →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
