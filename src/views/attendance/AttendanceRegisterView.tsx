import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  AlertTriangle,
  UserCheck,
  Save,
  CheckCheck,
  Building2,
  GraduationCap
} from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface ClassItem {
  id: string;
  name: string;
  class_code: string;
  sections?: { id: string; name: string }[];
}

interface StudentAttendanceRow {
  student_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  roll_number: number;
  morning_status: 'present' | 'absent';
  afternoon_status: 'present' | 'absent';
  calculated_status: 'present' | 'absent' | 'half_day';
  remarks?: string;
}

export const AttendanceRegisterView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'students' | 'faculty' | 'defaulters'>('students');

  // Hierarchy states
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Student Attendance Register
  const [students, setStudents] = useState<StudentAttendanceRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Faculty Attendance Register
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [facultyLoading, setFacultyLoading] = useState<boolean>(false);

  // Defaulters list (< 75% attendance)
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);

  // Load Classes on mount
  useEffect(() => {
    apiRequest('/api/academics/classes')
      .then((res) => {
        const cls = res.classes || [];
        setClasses(cls);
        if (cls.length > 0) {
          setSelectedClassId(cls[0].id);
          if (cls[0].sections && cls[0].sections.length > 0) {
            setSelectedSectionId(cls[0].sections[0].id);
          }
        }
      })
      .catch((e) => console.error('Failed to load classes:', e));
  }, []);

  // Update section when class changes
  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    const target = classes.find((c) => c.id === classId);
    if (target && target.sections && target.sections.length > 0) {
      setSelectedSectionId(target.sections[0].id);
    } else {
      setSelectedSectionId('');
    }
  };

  // Fetch Student Attendance
  const fetchStudentAttendance = async () => {
    if (!selectedClassId || !selectedSectionId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiRequest(
        `/api/attendance/students?classId=${selectedClassId}&sectionId=${selectedSectionId}&date=${selectedDate}`
      );
      setStudents(res.students || []);
      setStats(res.stats || null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load attendance' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'students' && selectedClassId && selectedSectionId) {
      fetchStudentAttendance();
    }
  }, [activeTab, selectedClassId, selectedSectionId, selectedDate]);

  // Fetch Faculty Attendance
  const fetchFacultyAttendance = async () => {
    setFacultyLoading(true);
    try {
      const res = await apiRequest(`/api/attendance/faculty?date=${selectedDate}`);
      setFacultyList(res.faculty || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setFacultyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'faculty') {
      fetchFacultyAttendance();
    }
  }, [activeTab, selectedDate]);

  // Fetch Analytics & Defaulters
  useEffect(() => {
    if (activeTab === 'defaulters') {
      setAnalyticsLoading(true);
      apiRequest('/api/attendance/analytics')
        .then((res) => {
          setDefaulters(res.defaulters || []);
        })
        .catch((e) => console.error(e))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [activeTab]);

  // Toggle student session status
  const handleToggleStatus = (
    studentId: string,
    session: 'morning' | 'afternoon'
  ) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.student_id !== studentId) return s;
        const newMorning = session === 'morning'
          ? (s.morning_status === 'present' ? 'absent' : 'present')
          : s.morning_status;
        const newAfternoon = session === 'afternoon'
          ? (s.afternoon_status === 'present' ? 'absent' : 'present')
          : s.afternoon_status;

        let calc: 'present' | 'absent' | 'half_day' = 'present';
        if (newMorning === 'absent' && newAfternoon === 'absent') calc = 'absent';
        else if (newMorning === 'absent' || newAfternoon === 'absent') calc = 'half_day';

        return {
          ...s,
          morning_status: newMorning,
          afternoon_status: newAfternoon,
          calculated_status: calc
        };
      })
    );
  };

  // Quick action: Mark All Present
  const handleMarkAllPresent = () => {
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        morning_status: 'present',
        afternoon_status: 'present',
        calculated_status: 'present'
      }))
    );
  };

  // Save Student Attendance
  const handleSaveAttendance = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const records = students.map((s) => ({
        studentId: s.student_id,
        morningStatus: s.morning_status,
        afternoonStatus: s.afternoon_status,
        remarks: s.remarks || ''
      }));

      await apiRequest('/api/attendance/students', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          records
        })
      });

      setMessage({ type: 'success', text: 'Daily attendance saved successfully!' });
      fetchStudentAttendance();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save attendance' });
    } finally {
      setSaving(false);
    }
  };

  // Save Faculty Attendance
  const handleSaveFacultyAttendance = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const records = facultyList.map((f) => ({
        facultyId: f.faculty_id,
        status: f.status,
        remarks: f.remarks || ''
      }));

      await apiRequest('/api/attendance/faculty', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          records
        })
      });

      setMessage({ type: 'success', text: 'Faculty daily attendance saved!' });
      fetchFacultyAttendance();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save faculty attendance' });
    } finally {
      setSaving(false);
    }
  };

  const currentClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span>Daily Attendance Register & Verification</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Morning & afternoon session tracking with automatic half-day calculation and 75% threshold alerts.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'students' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student Register</span>
          </button>
          {['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN'].includes(user?.role || '') && (
            <button
              type="button"
              onClick={() => setActiveTab('faculty')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'faculty' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Faculty Register</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('defaulters')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'defaulters' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Attendance (&lt;75%)</span>
          </button>
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

      {/* 1. STUDENT ATTENDANCE TAB */}
      {activeTab === 'students' && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Class Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {currentClass?.sections?.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Picker */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Quick Actions & Save Button */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium cursor-pointer flex items-center space-x-1.5 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mark All Present</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={saving || students.length === 0}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Attendance'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-400 font-semibold">Total Students</span>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{stats.total}</p>
              </div>
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                <span className="text-emerald-700 font-semibold">Full Day Present</span>
                <p className="text-lg font-bold text-emerald-900 mt-0.5">{stats.present}</p>
              </div>
              <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80 shadow-xs">
                <span className="text-amber-700 font-semibold">Half Day</span>
                <p className="text-lg font-bold text-amber-900 mt-0.5">{stats.halfDay}</p>
              </div>
              <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200/80 shadow-xs">
                <span className="text-rose-700 font-semibold">Absent</span>
                <p className="text-lg font-bold text-rose-900 mt-0.5">{stats.absent}</p>
              </div>
              <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200/80 shadow-xs">
                <span className="text-blue-700 font-semibold">Attendance Rate</span>
                <p className="text-lg font-bold text-blue-900 mt-0.5">{stats.attendanceRate}%</p>
              </div>
            </div>
          )}

          {/* Student Roster Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {currentClass?.name} - Section{' '}
                {currentClass?.sections?.find((s) => s.id === selectedSectionId)?.name} • {selectedDate}
              </h3>
              <span className="text-[11px] text-slate-500">
                Click session buttons to toggle Present / Absent
              </span>
            </div>

            {loading ? (
              <div className="p-10 text-center text-xs text-slate-400">Loading student roster...</div>
            ) : students.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                No students enrolled in this section.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4 w-16">Roll</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4">Admission No</th>
                      <th className="py-2.5 px-4 text-center">Morning Session</th>
                      <th className="py-2.5 px-4 text-center">Afternoon Session</th>
                      <th className="py-2.5 px-4 text-center">Calculated Day Status</th>
                      <th className="py-2.5 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((stu) => (
                      <tr key={stu.student_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {stu.roll_number || '—'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {stu.first_name} {stu.last_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                          {stu.admission_number}
                        </td>

                        {/* Morning Toggle */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(stu.student_id, 'morning')}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                              stu.morning_status === 'present'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {stu.morning_status === 'present' ? '✓ Present' : '✗ Absent'}
                          </button>
                        </td>

                        {/* Afternoon Toggle */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(stu.student_id, 'afternoon')}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                              stu.afternoon_status === 'present'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {stu.afternoon_status === 'present' ? '✓ Present' : '✗ Absent'}
                          </button>
                        </td>

                        {/* Calculated Status Badge */}
                        <td className="py-3 px-4 text-center">
                          {stu.calculated_status === 'present' && (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px] inline-flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Full Day Present</span>
                            </span>
                          )}
                          {stu.calculated_status === 'half_day' && (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[10px] inline-flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Half Day (0.5)</span>
                            </span>
                          )}
                          {stu.calculated_status === 'absent' && (
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-[10px] inline-flex items-center space-x-1">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Absent</span>
                            </span>
                          )}
                        </td>

                        {/* Remarks */}
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="Optional note..."
                            value={stu.remarks || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setStudents((prev) =>
                                prev.map((s) =>
                                  s.student_id === stu.student_id ? { ...s, remarks: val } : s
                                )
                              );
                            }}
                            className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-blue-400"
                          />
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

      {/* 2. FACULTY ATTENDANCE TAB */}
      {activeTab === 'faculty' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center space-x-3">
              <label className="font-semibold text-slate-600">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveFacultyAttendance}
              disabled={saving || facultyList.length === 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Faculty Register'}</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/60">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Staff & Faculty Daily Attendance • {selectedDate}
              </h3>
            </div>

            {facultyLoading ? (
              <div className="p-10 text-center text-xs text-slate-400">Loading faculty list...</div>
            ) : facultyList.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">No active faculty found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">Employee Code</th>
                      <th className="py-2.5 px-4">Faculty Name</th>
                      <th className="py-2.5 px-4">Department / Designation</th>
                      <th className="py-2.5 px-4 text-center">Attendance Status</th>
                      <th className="py-2.5 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {facultyList.map((f) => (
                      <tr key={f.faculty_id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {f.employee_code}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {f.first_name} {f.last_name}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {f.designation} ({f.department})
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                            {(['present', 'half_day', 'absent'] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => {
                                  setFacultyList((prev) =>
                                    prev.map((item) =>
                                      item.faculty_id === f.faculty_id ? { ...item, status: st } : item
                                    )
                                  );
                                }}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md capitalize cursor-pointer transition-colors ${
                                  f.status === st
                                    ? st === 'present'
                                      ? 'bg-emerald-600 text-white'
                                      : st === 'half_day'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-rose-600 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {st.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="e.g. Leave approved"
                            value={f.remarks || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFacultyList((prev) =>
                                prev.map((item) =>
                                  item.faculty_id === f.faculty_id ? { ...item, remarks: val } : item
                                )
                              );
                            }}
                            className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-blue-400"
                          />
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

      {/* 3. LOW ATTENDANCE & DEFAULTERS ALERT TAB */}
      {activeTab === 'defaulters' && (
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Education Board Statutory Compliance (75% Minimum Attendance)</p>
              <p className="mt-0.5 text-rose-700">
                The students listed below have cumulative attendance below the mandatory 75% threshold. Formal warning letters and parental notifications can be triggered from this registry.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {analyticsLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Auditing attendance records...</div>
            ) : defaulters.length === 0 ? (
              <div className="p-8 text-center text-xs text-emerald-700 bg-emerald-50/50">
                ✓ All students currently maintain satisfactory attendance above 75%!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">Admission No</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4">Class & Section</th>
                      <th className="py-2.5 px-4 text-center">Total Working Days</th>
                      <th className="py-2.5 px-4 text-center">Days Present</th>
                      <th className="py-2.5 px-4 text-center">Attendance %</th>
                      <th className="py-2.5 px-4 text-center">Statutory Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {defaulters.map((d) => {
                      const eff = d.present_days + (d.half_days * 0.5);
                      const pct = Math.round((eff / d.total_days) * 100);
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {d.admission_number}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {d.first_name} {d.last_name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {d.class_name} - {d.section_name}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-700 font-medium">
                            {d.total_days}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-700 font-medium">
                            {d.present_days} full + {d.half_days} half
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-rose-600 font-mono">
                            {pct}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded text-[10px] font-bold">
                              Defaulter Alert
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
