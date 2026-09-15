import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building2,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Filter,
  Layers,
  Sparkles,
  ShieldCheck,
  Printer,
  ChevronDown,
} from 'lucide-react';

interface TimetableSlot {
  id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  faculty_id: string;
  room_id: string | null;
  class_name: string;
  section_name: string;
  subject_name: string;
  subject_code: string;
  faculty_name: string;
  room_number: string | null;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STANDARD_PERIODS = [
  { period: 1, start: '09:00', end: '09:45', label: 'Period 1' },
  { period: 2, start: '09:45', end: '10:30', label: 'Period 2' },
  { isBreak: true, label: 'Morning Break', duration: '15 min' },
  { period: 3, start: '10:45', end: '11:30', label: 'Period 3' },
  { period: 4, start: '11:30', end: '12:15', label: 'Period 4' },
  { isBreak: true, label: 'Lunch Interval', duration: '45 min' },
  { period: 5, start: '13:00', end: '13:45', label: 'Period 5' },
  { period: 6, start: '13:45', end: '14:30', label: 'Period 6' },
  { period: 7, start: '14:30', end: '15:15', label: 'Period 7' },
  { period: 8, start: '15:15', end: '16:00', label: 'Period 8' },
];

export const TimetableEngineView: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'PRINCIPAL' || user?.role === 'OFFICE' || user?.role === 'SUPER_ADMIN';

  // View mode
  const [viewMode, setViewMode] = useState<'class' | 'faculty' | 'room'>('class');

  // Master Data
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [activeAyId, setActiveAyId] = useState<string>('');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [subjects, setSubjects] = useState<any[]>([]);

  // Timetable Slots
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Slot Edit Modal
  const [slotModalOpen, setSlotModalOpen] = useState<boolean>(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState({
    dayOfWeek: 'Monday',
    periodNumber: 1,
    subjectId: '',
    facultyId: '',
    roomId: '',
    overrideConflict: false,
    reason: '',
  });

  // Real-time Clash Detection State
  const [clashCheckLoading, setClashCheckLoading] = useState<boolean>(false);
  const [clashResult, setClashResult] = useState<{ hasClash: boolean; clashes: string[] }>({
    hasClash: false,
    clashes: [],
  });

  // Load Reference Data
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [ayRes, clsRes, facRes, rmRes, subRes] = await Promise.all([
          apiRequest('/api/academics/academic-years'),
          apiRequest('/api/academics/classes'),
          apiRequest('/api/academics/faculty'),
          apiRequest('/api/academics/rooms'),
          apiRequest('/api/academics/subjects'),
        ]);

        setAcademicYears(ayRes.academicYears || []);
        const activeYear = (ayRes.academicYears || []).find((y: any) => y.is_active === 1);
        if (activeYear) {
          setActiveAyId(activeYear.id);
        }

        const cls = clsRes.classes || [];
        setClasses(cls);
        if (cls.length > 0) {
          setSelectedClassId(cls[0].id);
          if (cls[0].sections && cls[0].sections.length > 0) {
            setSelectedSectionId(cls[0].sections[0].id);
          }
        }

        const fac = facRes.faculty || [];
        setFacultyList(fac);
        if (fac.length > 0) {
          setSelectedFacultyId(fac[0].id);
        }

        const rms = rmRes.rooms || [];
        setRooms(rms);
        if (rms.length > 0) {
          setSelectedRoomId(rms[0].id);
        }

        setSubjects(subRes.subjects || []);
      } catch (err: any) {
        console.error('Failed to load timetable metadata:', err);
      }
    };
    fetchMasters();
  }, []);

  // Fetch Slots based on mode and selections
  const fetchTimetable = async () => {
    if (!activeAyId) return;
    setLoading(true);
    try {
      if (viewMode === 'class') {
        if (!selectedClassId || !selectedSectionId) return;
        const res = await apiRequest(
          `/api/academics/timetable/class/${selectedClassId}/section/${selectedSectionId}?academicYearId=${activeAyId}`
        );
        setTimetableSlots(res.slots || []);
      } else if (viewMode === 'faculty') {
        if (!selectedFacultyId) return;
        const res = await apiRequest(
          `/api/academics/timetable/faculty/${selectedFacultyId}?academicYearId=${activeAyId}`
        );
        setTimetableSlots(res.slots || []);
      } else if (viewMode === 'room') {
        if (!selectedRoomId) return;
        const res = await apiRequest(`/api/academics/timetable/room/${selectedRoomId}?academicYearId=${activeAyId}`);
        setTimetableSlots(res.slots || []);
      }
    } catch (err: any) {
      console.error('Failed to load timetable slots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [viewMode, activeAyId, selectedClassId, selectedSectionId, selectedFacultyId, selectedRoomId]);

  // Real-time clash detection whenever slotForm inputs change
  useEffect(() => {
    if (!slotModalOpen) return;
    if (!activeAyId || !selectedClassId || !selectedSectionId) return;
    if (!slotForm.facultyId && !slotForm.roomId) return;

    const timer = setTimeout(async () => {
      setClashCheckLoading(true);
      try {
        const res = await apiRequest('/api/academics/timetable/check-clash', {
          method: 'POST',
          body: JSON.stringify({
            academicYearId: activeAyId,
            classId: selectedClassId,
            sectionId: selectedSectionId,
            dayOfWeek: slotForm.dayOfWeek,
            periodNumber: slotForm.periodNumber,
            facultyId: slotForm.facultyId,
            roomId: slotForm.roomId || null,
            excludeSlotId: editingSlotId,
          }),
        });

        setClashResult({
          hasClash: res.hasClash || false,
          clashes: res.clashes || [],
        });
      } catch (err) {
        console.error('Clash check failed:', err);
      } finally {
        setClashCheckLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [
    slotModalOpen,
    slotForm.dayOfWeek,
    slotForm.periodNumber,
    slotForm.facultyId,
    slotForm.roomId,
    activeAyId,
    selectedClassId,
    selectedSectionId,
    editingSlotId,
  ]);

  // Open Add / Edit Modal for a specific Day and Period
  const handleOpenSlotModal = (day: string, periodNumber: number, existing?: TimetableSlot) => {
    if (!canManage) return;

    if (existing) {
      setEditingSlotId(existing.id);
      setSlotForm({
        dayOfWeek: existing.day_of_week,
        periodNumber: existing.period_number,
        subjectId: existing.subject_id,
        facultyId: existing.faculty_id,
        roomId: existing.room_id || '',
        overrideConflict: false,
        reason: '',
      });
    } else {
      setEditingSlotId(null);
      // Auto-suggest faculty if mapped to class
      setSlotForm({
        dayOfWeek: day,
        periodNumber: periodNumber,
        subjectId: subjects.length > 0 ? subjects[0].id : '',
        facultyId: facultyList.length > 0 ? facultyList[0].id : '',
        roomId: rooms.length > 0 ? rooms[0].id : '',
        overrideConflict: false,
        reason: '',
      });
    }

    setClashResult({ hasClash: false, clashes: [] });
    setSlotModalOpen(true);
  };

  // Save Timetable Slot
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    if (clashResult.hasClash && !slotForm.overrideConflict) {
      setStatusMsg({
        type: 'error',
        text: 'Cannot save timetable slot with unresolved clashes. Please select another teacher or room.',
      });
      return;
    }

    try {
      await apiRequest('/api/academics/timetable/slot', {
        method: 'POST',
        body: JSON.stringify({
          slotId: editingSlotId,
          academicYearId: activeAyId,
          classId: selectedClassId,
          sectionId: selectedSectionId,
          dayOfWeek: slotForm.dayOfWeek,
          periodNumber: slotForm.periodNumber,
          subjectId: slotForm.subjectId,
          facultyId: slotForm.facultyId,
          roomId: slotForm.roomId || null,
          overrideConflict: slotForm.overrideConflict,
          reason: slotForm.reason,
        }),
      });

      setStatusMsg({
        type: 'success',
        text: `Slot for ${slotForm.dayOfWeek} (Period ${slotForm.periodNumber}) saved successfully`,
      });
      setSlotModalOpen(false);
      fetchTimetable();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save timetable slot' });
    }
  };

  // Delete Timetable Slot
  const handleDeleteSlot = async (slotId: string) => {
    if (!canManage) return;
    if (!confirm('Are you sure you want to remove this timetable slot?')) return;

    try {
      await apiRequest(`/api/academics/timetable/slot/${slotId}`, { method: 'DELETE' });
      setStatusMsg({ type: 'success', text: 'Timetable slot removed' });
      fetchTimetable();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to remove slot' });
    }
  };

  // Current selected class info
  const currentClass = classes.find((c) => c.id === selectedClassId);
  const currentSection = currentClass?.sections?.find((s: any) => s.id === selectedSectionId);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">Institutional Timetable Engine</h2>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[11px] font-semibold flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>Zero-Clash Algorithm Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dynamic clash detection across faculty schedules, room availability, and student cohorts.
            </p>
          </div>

          {/* Perspective View Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('class')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                viewMode === 'class' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Class Timetable
            </button>
            <button
              type="button"
              onClick={() => setViewMode('faculty')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                viewMode === 'faculty' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faculty Schedule
            </button>
            <button
              type="button"
              onClick={() => setViewMode('room')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                viewMode === 'room' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Room Occupancy
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Academic Year */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Academic Year</label>
            <select
              value={activeAyId}
              onChange={(e) => setActiveAyId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.is_active === 1 ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Class Mode Filter */}
          {viewMode === 'class' && (
            <>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Select Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    const sel = classes.find((c) => c.id === e.target.value);
                    if (sel && sel.sections && sel.sections.length > 0) {
                      setSelectedSectionId(sel.sections[0].id);
                    } else {
                      setSelectedSectionId('');
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.class_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Select Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                >
                  {currentClass?.sections?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Faculty Mode Filter */}
          {viewMode === 'faculty' && (
            <div className="sm:col-span-2">
              <label className="block text-slate-500 font-medium mb-1">Select Faculty Teacher</label>
              <select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
              >
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.first_name} {f.last_name} ({f.employee_code} - {f.department || 'General'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Room Mode Filter */}
          {viewMode === 'room' && (
            <div className="sm:col-span-2">
              <label className="block text-slate-500 font-medium mb-1">Select Room / Lab</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} (Capacity: {r.capacity || 40} - {r.building || 'Main Block'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Print action */}
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Schedule</span>
            </button>
          </div>
        </div>
      </div>

      {/* WEEKLY TIMETABLE GRID */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading timetable grid...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="p-3 w-28 text-center border-r border-slate-200 uppercase tracking-wider text-[11px]">
                    Day \ Period
                  </th>
                  {STANDARD_PERIODS.map((sp, idx) =>
                    sp.isBreak ? (
                      <th
                        key={idx}
                        className="p-2 w-16 text-center border-r border-slate-200 bg-amber-50/50 text-amber-800 text-[10px] font-semibold"
                      >
                        {sp.label}
                      </th>
                    ) : (
                      <th
                        key={idx}
                        className="p-3 border-r border-slate-200 text-center min-w-[120px]"
                      >
                        <div className="font-bold text-slate-900">{sp.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          {sp.start} - {sp.end}
                        </div>
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {DAYS_OF_WEEK.map((day) => (
                  <tr key={day} className="hover:bg-slate-50/30">
                    {/* Day Column */}
                    <td className="p-3 font-bold text-slate-900 bg-slate-50/75 border-r border-slate-200 text-center text-xs">
                      {day}
                    </td>

                    {/* Periods */}
                    {STANDARD_PERIODS.map((sp, pIdx) => {
                      if (sp.isBreak) {
                        return (
                          <td
                            key={pIdx}
                            className="p-1 border-r border-slate-200 bg-amber-50/30 text-center text-[10px] text-amber-700/80 select-none"
                          >
                            <span className="[writing-mode:vertical-lr] rotate-180 inline-block font-mono tracking-wider">
                              BREAK
                            </span>
                          </td>
                        );
                      }

                      // Find existing slot for this Day and Period
                      const slot = timetableSlots.find(
                        (s) => s.day_of_week === day && s.period_number === sp.period
                      );

                      return (
                        <td
                          key={pIdx}
                          className="p-2 border-r border-slate-200 align-top h-24 hover:bg-blue-50/20 transition-colors"
                        >
                          {slot ? (
                            <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-2.5 h-full flex flex-col justify-between group text-xs relative">
                              <div>
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-bold text-blue-900 text-xs leading-tight">
                                    {slot.subject_name}
                                  </span>
                                  <span className="font-mono text-[9px] bg-blue-100/80 text-blue-800 px-1 py-0.5 rounded font-semibold shrink-0">
                                    {slot.subject_code}
                                  </span>
                                </div>

                                {viewMode !== 'faculty' && (
                                  <p className="text-[11px] text-slate-600 font-medium mt-1 truncate">
                                    👨‍🏫 {slot.faculty_name}
                                  </p>
                                )}

                                {viewMode !== 'class' && (
                                  <p className="text-[11px] text-slate-600 font-medium mt-1 truncate">
                                    🎓 {slot.class_name} - {slot.section_name}
                                  </p>
                                )}

                                {slot.room_number && (
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    📍 {slot.room_number}
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons for Principal / Office */}
                              {canManage && viewMode === 'class' && (
                                <div className="pt-1.5 flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSlotModal(day, sp.period!, slot)}
                                    className="p-1 text-slate-500 hover:text-blue-700 rounded hover:bg-blue-100 cursor-pointer"
                                    title="Edit Period Slot"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSlot(slot.id)}
                                    className="p-1 text-slate-500 hover:text-rose-700 rounded hover:bg-rose-100 cursor-pointer"
                                    title="Clear Slot"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              {canManage && viewMode === 'class' ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenSlotModal(day, sp.period!)}
                                  className="w-full h-full min-h-[50px] border border-dashed border-slate-200 rounded-lg text-slate-300 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer group"
                                  title="Add Period Assignment"
                                >
                                  <Plus className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                                  <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100">
                                    Assign
                                  </span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-300 select-none italic font-mono">
                                  Free
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INTERACTIVE TIMETABLE SLOT MODAL (WITH ZERO-CLASH VALIDATION) */}
      {slotModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingSlotId ? 'Edit Timetable Period' : 'Assign Timetable Period'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentClass?.name} - Section {currentSection?.name} • {slotForm.dayOfWeek} (Period{' '}
                  {slotForm.periodNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSlotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* REAL-TIME CLASH WARNING BANNER */}
            {clashCheckLoading ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 flex items-center space-x-2">
                <Clock className="w-4 h-4 animate-spin text-blue-600" />
                <span>Checking teacher and room availability...</span>
              </div>
            ) : clashResult.hasClash ? (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-rose-800 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Timetable Conflict Detected!</span>
                </div>
                <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-1">
                  {clashResult.clashes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>

                <div className="pt-2 border-t border-rose-200 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="override"
                    checked={slotForm.overrideConflict}
                    onChange={(e) => setSlotForm({ ...slotForm, overrideConflict: e.target.checked })}
                    className="rounded text-rose-600"
                  />
                  <label htmlFor="override" className="font-semibold text-rose-900 text-xs">
                    Principal Emergency Override (will record audit log)
                  </label>
                </div>

                {slotForm.overrideConflict && (
                  <input
                    type="text"
                    required
                    placeholder="Mandatory justification for conflict override..."
                    value={slotForm.reason}
                    onChange={(e) => setSlotForm({ ...slotForm, reason: e.target.value })}
                    className="w-full px-3 py-1.5 border border-rose-300 rounded-lg text-xs bg-white"
                  />
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-emerald-800 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero clashes detected: Faculty and room are free during this period!</span>
              </div>
            )}

            <form onSubmit={handleSaveSlot} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Day of Week</label>
                  <select
                    value={slotForm.dayOfWeek}
                    onChange={(e) => setSlotForm({ ...slotForm, dayOfWeek: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Period Number</label>
                  <select
                    value={slotForm.periodNumber}
                    onChange={(e) =>
                      setSlotForm({ ...slotForm, periodNumber: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <option key={p} value={p}>
                        Period {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Curriculum Subject *</label>
                <select
                  required
                  value={slotForm.subjectId}
                  onChange={(e) => setSlotForm({ ...slotForm, subjectId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium"
                >
                  <option value="">Select Subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) {s.is_optional === 1 ? '• Optional' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Assigned Teacher *</label>
                <select
                  required
                  value={slotForm.facultyId}
                  onChange={(e) => setSlotForm({ ...slotForm, facultyId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium"
                >
                  <option value="">Select Faculty...</option>
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.first_name} {f.last_name} ({f.employee_code} - {f.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Classroom / Laboratory</label>
                <select
                  value={slotForm.roomId}
                  onChange={(e) => setSlotForm({ ...slotForm, roomId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium"
                >
                  <option value="">No specific room (Standard Class)</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_number} (Cap: {r.capacity || 40} - {r.building || 'Main Block'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSlotModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={clashResult.hasClash && !slotForm.overrideConflict}
                  className={`px-4 py-2 rounded-lg font-semibold text-white transition-colors cursor-pointer ${
                    clashResult.hasClash && !slotForm.overrideConflict
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {editingSlotId ? 'Update Slot' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
