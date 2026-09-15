import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Search,
  UserPlus,
  Filter,
  Eye,
  KeyRound,
  GraduationCap,
  Users,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { StudentAdmissionModal } from './StudentAdmissionModal.tsx';
import { StudentProfileModal } from './StudentProfileModal.tsx';
import { OfficeStudentResetModal } from '../../components/OfficeStudentResetModal.tsx';

export const StudentDirectoryView: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [isAdmissionOpen, setIsAdmissionOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [resetStudentUserId, setResetStudentUserId] = useState<string | null>(null);

  const fetchClasses = async () => {
    try {
      const res = await apiRequest('/api/academics/classes');
      setClasses(res.classes || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedClassId) params.set('classId', selectedClassId);
      if (selectedStatus) params.set('status', selectedStatus);

      const res = await apiRequest(`/api/students?${params.toString()}`);
      setStudents(res.students || []);
    } catch (e) {
      console.error('Failed to load students', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [selectedClassId, selectedStatus]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const canAdmit = user?.role === 'OFFICE' || user?.role === 'PRINCIPAL';
  const canResetPassword = user?.role === 'OFFICE' || user?.role === 'PRINCIPAL';

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, admission no, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Class Filter */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full sm:w-44 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-36 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="transferred">Transferred</option>
            <option value="graduated">Graduated</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchStudents}
            className="p-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
            title="Refresh Directory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {canAdmit && (
            <button
              type="button"
              onClick={() => setIsAdmissionOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New Admission</span>
            </button>
          )}
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Student Register ({students.length})
          </span>
          <span className="text-xs text-slate-400">Permanent ID Format: YY + Class + Serial</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Adm Number</th>
                <th className="py-2.5 px-4">Student Name & Roll</th>
                <th className="py-2.5 px-4">Class & Section</th>
                <th className="py-2.5 px-4">Guardian Contact</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No students found matching current filters.
                  </td>
                </tr>
              ) : (
                students.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {stu.admission_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {stu.first_name} {stu.last_name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {stu.roll_number ? `Roll #${stu.roll_number}` : 'Unassigned'} • DOB: {stu.date_of_birth}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">{stu.class_name || 'Class N/A'}</span>
                      <span className="text-slate-500 text-[11px] ml-1">
                        {stu.section_name ? `- Section ${stu.section_name}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800">{stu.guardian_name || stu.father_name || 'Guardian'}</div>
                      <div className="font-mono text-slate-500 text-[11px]">
                        {stu.guardian_mobile || stu.user_mobile}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          stu.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {stu.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentId(stu.id);
                            setIsProfileOpen(true);
                          }}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer"
                          title="View Student 360 Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>360° Profile</span>
                        </button>

                        {canResetPassword && (
                          <button
                            type="button"
                            onClick={() => setResetStudentUserId(stu.admission_number || stu.id)}
                            className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            title="Direct Password Reset (Office)"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <StudentAdmissionModal
        isOpen={isAdmissionOpen}
        onClose={() => setIsAdmissionOpen(false)}
        onSuccess={() => fetchStudents()}
      />

      <StudentProfileModal
        studentId={selectedStudentId}
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setSelectedStudentId(null);
        }}
        onUpdate={() => fetchStudents()}
      />

      <OfficeStudentResetModal
        isOpen={!!resetStudentUserId}
        onClose={() => setResetStudentUserId(null)}
        defaultStudentUserId={resetStudentUserId ? `STU${resetStudentUserId}` : ''}
      />
    </div>
  );
};
