import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.ts';
import {
  Calendar,
  BookOpen,
  Users,
  Building2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Layers,
  ChevronRight,
  ShieldCheck,
  Award,
} from 'lucide-react';

interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
  is_closed: number;
}

interface Section {
  id: string;
  class_id: string;
  name: string;
  student_count?: number;
}

interface SchoolClass {
  id: string;
  name: string;
  class_code: string;
  display_order: number;
  sections: Section[];
  subjects_count?: number;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  is_optional: number;
  classes_count?: number;
}

interface SubjectMapping {
  id: string;
  class_id: string;
  subject_id: string;
  class_name: string;
  subject_name: string;
  subject_code: string;
}

interface Room {
  id: string;
  room_number: string;
  capacity: number;
  building: string | null;
}

interface FacultyAssignment {
  id: string;
  faculty_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  class_name: string;
  section_name: string;
  subject_name: string;
  subject_code: string;
}

interface FacultyMember {
  id: string;
  user_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
  email?: string;
  mobile_number?: string;
  assignments: FacultyAssignment[];
}

export const AcademicManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'years' | 'classes' | 'subjects' | 'faculty' | 'rooms'>('classes');
  
  // Data States
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mappings, setMappings] = useState<SubjectMapping[]>([]);
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal States
  const [isYearModalOpen, setYearModalOpen] = useState(false);
  const [isClassModalOpen, setClassModalOpen] = useState(false);
  const [isSectionModalOpen, setSectionModalOpen] = useState<{ isOpen: boolean; classId: string; className: string }>({
    isOpen: false,
    classId: '',
    className: '',
  });
  const [isSubjectModalOpen, setSubjectModalOpen] = useState(false);
  const [isMapSubjectModalOpen, setMapSubjectModalOpen] = useState(false);
  const [isAssignFacultyModalOpen, setAssignFacultyModalOpen] = useState(false);
  const [isRoomModalOpen, setRoomModalOpen] = useState(false);

  // Form Inputs
  const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '', isActive: true });
  const [classForm, setClassForm] = useState({ name: '', classCode: '', displayOrder: 1 });
  const [sectionName, setSectionName] = useState('');
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', isOptional: false });
  const [mapSubjectForm, setMapSubjectForm] = useState({ classId: '', subjectId: '' });
  const [assignForm, setAssignForm] = useState({
    facultyId: '',
    academicYearId: '',
    classId: '',
    sectionId: '',
    subjectId: '',
  });
  const [roomForm, setRoomForm] = useState({ roomNumber: '', capacity: 40, building: '' });

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [ayRes, clsRes, subRes, facRes, rmRes] = await Promise.all([
        apiRequest('/api/academics/academic-years'),
        apiRequest('/api/academics/classes'),
        apiRequest('/api/academics/subjects'),
        apiRequest('/api/academics/faculty'),
        apiRequest('/api/academics/rooms'),
      ]);

      setAcademicYears(ayRes.academicYears || []);
      setClasses(clsRes.classes || []);
      setSubjects(subRes.subjects || []);
      setMappings(subRes.mappings || []);
      setFaculty(facRes.faculty || []);
      setRooms(rmRes.rooms || []);
    } catch (err: any) {
      console.error('Failed to load academic data:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load academic records' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleActivateYear = async (id: string, name: string) => {
    try {
      await apiRequest(`/api/academics/academic-years/${id}/activate`, { method: 'PUT' });
      setMessage({ type: 'success', text: `Academic Year ${name} set as active` });
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to activate academic year' });
    }
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/academic-years', {
        method: 'POST',
        body: JSON.stringify(yearForm),
      });
      setMessage({ type: 'success', text: 'Academic year created successfully' });
      setYearModalOpen(false);
      setYearForm({ name: '', startDate: '', endDate: '', isActive: true });
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create academic year' });
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/classes', {
        method: 'POST',
        body: JSON.stringify(classForm),
      });
      setMessage({ type: 'success', text: `Class ${classForm.name} created with Section A` });
      setClassModalOpen(false);
      setClassForm({ name: '', classCode: '', displayOrder: classes.length + 1 });
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create class' });
    }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionName.trim()) return;
    try {
      await apiRequest(`/api/academics/classes/${isSectionModalOpen.classId}/sections`, {
        method: 'POST',
        body: JSON.stringify({ name: sectionName.trim() }),
      });
      setMessage({ type: 'success', text: `Section ${sectionName.toUpperCase()} added to ${isSectionModalOpen.className}` });
      setSectionModalOpen({ isOpen: false, classId: '', className: '' });
      setSectionName('');
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add section' });
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/subjects', {
        method: 'POST',
        body: JSON.stringify(subjectForm),
      });
      setMessage({ type: 'success', text: `Subject ${subjectForm.name} created successfully` });
      setSubjectModalOpen(false);
      setSubjectForm({ name: '', code: '', isOptional: false });
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create subject' });
    }
  };

  const handleMapSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/academics/classes/${mapSubjectForm.classId}/subjects`, {
        method: 'POST',
        body: JSON.stringify({ subjectId: mapSubjectForm.subjectId }),
      });
      setMessage({ type: 'success', text: 'Subject mapped to class' });
      setMapSubjectModalOpen(false);
      setMapSubjectForm({ classId: '', subjectId: '' });
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to map subject' });
    }
  };

  const handleUnmapSubject = async (classId: string, subjectId: string) => {
    try {
      await apiRequest(`/api/academics/classes/${classId}/subjects/${subjectId}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Subject unmapped from class' });
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to unmap subject' });
    }
  };

  const handleAssignFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/faculty-assignments', {
        method: 'POST',
        body: JSON.stringify(assignForm),
      });
      setMessage({ type: 'success', text: 'Faculty assigned to class section subject' });
      setAssignFacultyModalOpen(false);
      setAssignForm({ facultyId: '', academicYearId: '', classId: '', sectionId: '', subjectId: '' });
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to assign faculty' });
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    try {
      await apiRequest(`/api/academics/faculty-assignments/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Faculty assignment removed' });
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove assignment' });
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/rooms', {
        method: 'POST',
        body: JSON.stringify(roomForm),
      });
      setMessage({ type: 'success', text: `Room ${roomForm.roomNumber} created` });
      setRoomModalOpen(false);
      setRoomForm({ roomNumber: '', capacity: 40, building: '' });
      loadAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create room' });
    }
  };

  const activeAy = academicYears.find((y) => y.is_active === 1);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Subnavigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl border space-x-6 text-xs font-semibold text-slate-500 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('classes')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'classes' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Classes & Sections ({classes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('subjects')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'subjects' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Subjects & Curriculum ({subjects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('faculty')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'faculty' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Faculty & Assignments ({faculty.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rooms')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'rooms' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Classrooms & Labs ({rooms.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('years')}
          className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'years' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Academic Years ({academicYears.length})</span>
        </button>
      </div>

      {/* 1. CLASSES & SECTIONS TAB */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Class & Section Hierarchy</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure grade levels, display orders, and section divisions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setClassModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Class</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <div key={cls.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-base font-bold text-slate-900">{cls.name}</h4>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-mono text-[11px] rounded">
                        {cls.class_code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Display Order: {cls.display_order}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold text-[10px] rounded-full border border-blue-200">
                    {cls.subjects_count || 0} Subjects
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Active Sections ({cls.sections.length})</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSectionModalOpen({ isOpen: true, classId: cls.id, className: cls.name })
                      }
                      className="text-blue-600 hover:underline cursor-pointer flex items-center space-x-1 text-[11px]"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Section</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {cls.sections.map((sec) => (
                      <div
                        key={sec.id}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center space-x-2"
                      >
                        <span className="font-bold text-slate-800">Section {sec.name}</span>
                        <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
                          {sec.student_count || 0} students
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. SUBJECTS & CURRICULUM TAB */}
      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Curriculum & Subject Catalog</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Define master subjects and map them to class grades.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setMapSubjectModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Map to Class</span>
              </button>
              <button
                type="button"
                onClick={() => setSubjectModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subject List */}
            <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Subject Catalog</h4>
              <div className="space-y-2">
                {subjects.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/75 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-800 text-xs">{sub.name}</span>
                      <p className="text-[11px] font-mono text-slate-400">{sub.code}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sub.is_optional === 1
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {sub.is_optional === 1 ? 'Optional' : 'Core'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Class-Subject Mappings */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Class Curriculum Mappings</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">Class</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Subject Code</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappings.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{m.class_name}</td>
                        <td className="py-2.5 px-3 font-medium text-blue-600">{m.subject_name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{m.subject_code}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleUnmapSubject(m.class_id, m.subject_id)}
                            className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 cursor-pointer"
                            title="Remove mapping"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. FACULTY & ASSIGNMENTS TAB */}
      {activeTab === 'faculty' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Faculty Roster & Teaching Assignments</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Staff member roles, departments, and assigned class sections.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeAy) {
                  setAssignForm((prev) => ({ ...prev, academicYearId: activeAy.id }));
                }
                setAssignFacultyModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign Faculty to Class</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faculty.map((fac) => (
              <div key={fac.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-base font-bold text-slate-900">
                        {fac.first_name} {fac.last_name}
                      </h4>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold text-[11px] rounded">
                        {fac.designation || 'Teacher'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Emp Code: <span className="font-mono font-medium text-slate-700">{fac.employee_code}</span> • Dept: {fac.department || 'General'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Email: {fac.email} • Mobile: {fac.mobile_number}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Teaching Assignments ({fac.assignments.length})
                  </span>

                  {fac.assignments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No class assignments currently</p>
                  ) : (
                    <div className="space-y-1.5">
                      {fac.assignments.map((asgn) => (
                        <div
                          key={asgn.id}
                          className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">
                              {asgn.class_name} - Section {asgn.section_name}
                            </span>
                            <span className="ml-2 text-blue-600 font-medium">
                              • {asgn.subject_name} ({asgn.subject_code})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAssignment(asgn.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            title="Remove assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ROOMS TAB */}
      {activeTab === 'rooms' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Classrooms & Laboratories</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical spaces used for timetable conflict prevention and seating.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRoomModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Room</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {rooms.map((rm) => (
              <div key={rm.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{rm.room_number}</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                    Cap: {rm.capacity || 40}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{rm.building || 'Main Block'}</p>
                <div className="pt-2 text-[11px] text-emerald-600 font-medium flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Available for Timetable</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. ACADEMIC YEARS TAB */}
      {activeTab === 'years' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Academic Year Periods</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage schooling sessions and active reporting year.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setYearModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Academic Year</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {academicYears.map((ay) => (
              <div
                key={ay.id}
                className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 ${
                  ay.is_active === 1 ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold text-slate-900">{ay.name}</span>
                    {ay.is_active === 1 ? (
                      <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold flex items-center space-x-1">
                        <Award className="w-3 h-3" />
                        <span>Active Session</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                  {ay.is_active !== 1 && (
                    <button
                      type="button"
                      onClick={() => handleActivateYear(ay.id, ay.name)}
                      className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
                    >
                      Set Active
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <p>
                    Duration: <span className="font-medium text-slate-700">{ay.start_date}</span> to{' '}
                    <span className="font-medium text-slate-700">{ay.end_date}</span>
                  </p>
                  <p>Status: {ay.is_closed === 1 ? 'Archived / Closed' : 'Open for operations'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Academic Year Modal */}
      {isYearModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900">Create Academic Year</h3>
            <form onSubmit={handleCreateYear} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Session Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2027-28"
                  value={yearForm.name}
                  onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={yearForm.startDate}
                    onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={yearForm.endDate}
                    onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="setAct"
                  checked={yearForm.isActive}
                  onChange={(e) => setYearForm({ ...yearForm, isActive: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <label htmlFor="setAct" className="font-medium text-slate-700">
                  Set as Active Academic Year immediately
                </label>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setYearModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Create Year
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Class Modal */}
      {isClassModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900">Add New Class</h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Class Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 11"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Class Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 011"
                  value={classForm.classCode}
                  onChange={(e) => setClassForm({ ...classForm, classCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Display Order (for sorting)</label>
                <input
                  type="number"
                  min="1"
                  value={classForm.displayOrder}
                  onChange={(e) => setClassForm({ ...classForm, displayOrder: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Note: Section 'A' will be created automatically for this class.
              </p>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Section Modal */}
      {isSectionModalOpen.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900">Add Section to {isSectionModalOpen.className}</h3>
            <form onSubmit={handleAddSection} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Section Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. B, C, D"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value.toUpperCase())}
                  maxLength={5}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold uppercase text-center text-lg"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSectionModalOpen({ isOpen: false, classId: '', className: '' })}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Add Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Subject Modal */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900">Add Master Subject</h3>
            <form onSubmit={handleCreateSubject} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subject Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biology"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subject Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BIO10"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase"
                />
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isOpt"
                  checked={subjectForm.isOptional}
                  onChange={(e) => setSubjectForm({ ...subjectForm, isOptional: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <label htmlFor="isOpt" className="font-medium text-slate-700">
                  Optional / Elective Subject (e.g. Foreign Language, Computer Science)
                </label>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSubjectModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Map Subject to Class Modal */}
      {isMapSubjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900">Map Subject to Class</h3>
            <form onSubmit={handleMapSubject} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Class *</label>
                <select
                  required
                  value={mapSubjectForm.classId}
                  onChange={(e) => setMapSubjectForm({ ...mapSubjectForm, classId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">Select Class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.class_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subject to Map *</label>
                <select
                  required
                  value={mapSubjectForm.subjectId}
                  onChange={(e) => setMapSubjectForm({ ...mapSubjectForm, subjectId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">Select Subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMapSubjectModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Confirm Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Assign Faculty Modal */}
      {isAssignFacultyModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900">Assign Teacher to Class & Subject</h3>
            <form onSubmit={handleAssignFaculty} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Faculty Member *</label>
                <select
                  required
                  value={assignForm.facultyId}
                  onChange={(e) => setAssignForm({ ...assignForm, facultyId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">Select Teacher...</option>
                  {faculty.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.first_name} {f.last_name} ({f.employee_code} - {f.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Academic Year *</label>
                <select
                  required
                  value={assignForm.academicYearId}
                  onChange={(e) => setAssignForm({ ...assignForm, academicYearId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">Select Year...</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name} {ay.is_active === 1 ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Class *</label>
                  <select
                    required
                    value={assignForm.classId}
                    onChange={(e) => {
                      setAssignForm({ ...assignForm, classId: e.target.value, sectionId: '' });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">Select Class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Section *</label>
                  <select
                    required
                    value={assignForm.sectionId}
                    onChange={(e) => setAssignForm({ ...assignForm, sectionId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    disabled={!assignForm.classId}
                  >
                    <option value="">Select Section...</option>
                    {classes
                      .find((c) => c.id === assignForm.classId)
                      ?.sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          Section {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Subject *</label>
                <select
                  required
                  value={assignForm.subjectId}
                  onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">Select Subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignFacultyModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Room Modal */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900">Add Room or Laboratory</h3>
            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Room Number / Lab Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Room 204 or Physics Lab"
                  value={roomForm.roomNumber}
                  onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Seating Capacity</label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value, 10) || 40 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Building / Wing</label>
                <input
                  type="text"
                  placeholder="e.g. Science Block, West Wing"
                  value={roomForm.building}
                  onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoomModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
