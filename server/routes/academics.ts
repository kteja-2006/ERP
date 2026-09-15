import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { authenticate, requireRole } from '../middlewares/auth.ts';
import { logAudit } from '../utils/audit.ts';

export const academicsRouter = Router();

// ==========================================
// 1. ACADEMIC YEARS
// ==========================================

// Get all academic years
academicsRouter.get('/academic-years', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const years = await query(`
      SELECT * FROM academic_years
      WHERE school_id = ? OR ? IS NULL
      ORDER BY start_date DESC
    `, [schoolId, schoolId]);

    res.json({ academicYears: years });
  } catch (err: any) {
    console.error('Fetch academic years error:', err);
    res.status(500).json({ error: 'Failed to fetch academic years' });
  }
});

// Create academic year
academicsRouter.post('/academic-years', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { name, startDate, endDate, isActive } = req.body;
    if (!name || !startDate || !endDate) {
      res.status(400).json({ error: 'Name, start date, and end date are required' });
      return;
    }

    const id = `ay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const activeVal = isActive ? 1 : 0;

    await transaction(async () => {
      if (activeVal === 1) {
        // Deactivate other academic years in this school
        await execute('UPDATE academic_years SET is_active = 0 WHERE school_id = ?;', [schoolId]);
      }

      await execute(`
        INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_active, is_closed)
        VALUES (?, ?, ?, ?, ?, ?, 0);
      `, [id, schoolId, name, startDate, endDate, activeVal]);
    });

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'CREATE_ACADEMIC_YEAR',
      module: 'academic_years',
      recordId: id,
      newValue: { name, startDate, endDate, isActive: activeVal },
      ipAddress: req.ip,
    });

    const created = await queryOne('SELECT * FROM academic_years WHERE id = ?;', [id]);
    res.status(201).json({ academicYear: created, message: 'Academic year created successfully' });
  } catch (err: any) {
    console.error('Create academic year error:', err);
    res.status(500).json({ error: err.message || 'Failed to create academic year' });
  }
});

// Set active academic year
academicsRouter.put('/academic-years/:id/activate', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { id } = req.params;

    const existing = await queryOne('SELECT * FROM academic_years WHERE id = ? AND (school_id = ? OR ? IS NULL);', [id, schoolId, schoolId]);
    if (!existing) {
      res.status(404).json({ error: 'Academic year not found' });
      return;
    }

    await transaction(async () => {
      await execute('UPDATE academic_years SET is_active = 0 WHERE school_id = ?;', [schoolId]);
      await execute('UPDATE academic_years SET is_active = 1 WHERE id = ?;', [id]);
    });

    await logAudit({
      schoolId: schoolId || existing.school_id,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'ACTIVATE_ACADEMIC_YEAR',
      module: 'academic_years',
      recordId: id,
      oldValue: { is_active: existing.is_active },
      newValue: { is_active: 1 },
      ipAddress: req.ip,
    });

    res.json({ message: `Academic year ${existing.name} is now active` });
  } catch (err: any) {
    console.error('Activate academic year error:', err);
    res.status(500).json({ error: 'Failed to activate academic year' });
  }
});

// ==========================================
// 2. CLASSES & SECTIONS
// ==========================================

// Get Classes with Sections and Subject Count
academicsRouter.get('/classes', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const classes = await query(`
      SELECT c.*,
             (SELECT COUNT(*) FROM class_subject_mappings csm WHERE csm.class_id = c.id) as subjects_count
      FROM classes c
      WHERE c.school_id = ? OR ? IS NULL
      ORDER BY c.display_order ASC, c.name ASC
    `, [schoolId, schoolId]);

    const sections = await query(`
      SELECT s.*,
             (SELECT COUNT(*) FROM student_academic_records sar WHERE sar.section_id = s.id) as student_count
      FROM sections s
      WHERE s.school_id = ? OR ? IS NULL
      ORDER BY s.name ASC
    `, [schoolId, schoolId]);

    const classesWithSections = classes.map((c) => ({
      ...c,
      sections: sections.filter((s) => s.class_id === c.id),
    }));

    res.json({ classes: classesWithSections });
  } catch (err: any) {
    console.error('Fetch classes error:', err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Create class
academicsRouter.post('/classes', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { name, classCode, displayOrder } = req.body;
    if (!name || !classCode) {
      res.status(400).json({ error: 'Name and class code are required' });
      return;
    }

    const id = `cls-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const order = displayOrder ? parseInt(displayOrder, 10) : 99;

    await execute(`
      INSERT INTO classes (id, school_id, name, class_code, display_order)
      VALUES (?, ?, ?, ?, ?);
    `, [id, schoolId, name, classCode, order]);

    // Automatically create default section 'A'
    const defaultSectionId = `sec-${Date.now()}-a`;
    await execute(`
      INSERT INTO sections (id, school_id, class_id, name)
      VALUES (?, ?, ?, 'A');
    `, [defaultSectionId, schoolId, id]);

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'CREATE_CLASS',
      module: 'classes',
      recordId: id,
      newValue: { name, classCode, displayOrder: order, defaultSection: 'A' },
      ipAddress: req.ip,
    });

    const created = await queryOne('SELECT * FROM classes WHERE id = ?;', [id]);
    res.status(201).json({ class: created, message: 'Class created successfully with Section A' });
  } catch (err: any) {
    console.error('Create class error:', err);
    res.status(500).json({ error: err.message || 'Failed to create class' });
  }
});

// Create section for class
academicsRouter.post('/classes/:classId/sections', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { classId } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Section name (e.g. A, B, C) is required' });
      return;
    }

    const targetClass = await queryOne('SELECT * FROM classes WHERE id = ?;', [classId]);
    if (!targetClass) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    const existingSection = await queryOne('SELECT id FROM sections WHERE class_id = ? AND name = ?;', [classId, name.trim().toUpperCase()]);
    if (existingSection) {
      res.status(400).json({ error: `Section ${name} already exists for ${targetClass.name}` });
      return;
    }

    const id = `sec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await execute(`
      INSERT INTO sections (id, school_id, class_id, name)
      VALUES (?, ?, ?, ?);
    `, [id, schoolId || targetClass.school_id, classId, name.trim().toUpperCase()]);

    const created = await queryOne('SELECT * FROM sections WHERE id = ?;', [id]);
    res.status(201).json({ section: created, message: `Section ${name} added to ${targetClass.name}` });
  } catch (err: any) {
    console.error('Create section error:', err);
    res.status(500).json({ error: err.message || 'Failed to create section' });
  }
});

// ==========================================
// 3. SUBJECTS & MAPPINGS
// ==========================================

// Get all subjects
academicsRouter.get('/subjects', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const subjects = await query(`
      SELECT sub.*,
             (SELECT COUNT(DISTINCT class_id) FROM class_subject_mappings WHERE subject_id = sub.id) as classes_count
      FROM subjects sub
      WHERE sub.school_id = ? OR ? IS NULL
      ORDER BY sub.name ASC
    `, [schoolId, schoolId]);

    const mappings = await query(`
      SELECT csm.*, c.name as class_name, sub.name as subject_name, sub.code as subject_code
      FROM class_subject_mappings csm
      JOIN classes c ON csm.class_id = c.id
      JOIN subjects sub ON csm.subject_id = sub.id
      WHERE csm.school_id = ? OR ? IS NULL
    `, [schoolId, schoolId]);

    res.json({ subjects, mappings });
  } catch (err: any) {
    console.error('Fetch subjects error:', err);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create subject
academicsRouter.post('/subjects', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { name, code, isOptional } = req.body;
    if (!name || !code) {
      res.status(400).json({ error: 'Subject name and code are required' });
      return;
    }

    const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await execute(`
      INSERT INTO subjects (id, school_id, name, code, is_optional)
      VALUES (?, ?, ?, ?, ?);
    `, [id, schoolId, name.trim(), code.trim().toUpperCase(), isOptional ? 1 : 0]);

    const created = await queryOne('SELECT * FROM subjects WHERE id = ?;', [id]);
    res.status(201).json({ subject: created, message: 'Subject created successfully' });
  } catch (err: any) {
    console.error('Create subject error:', err);
    res.status(500).json({ error: err.message || 'Failed to create subject' });
  }
});

// Map subject to class
academicsRouter.post('/classes/:classId/subjects', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { classId } = req.params;
    const { subjectId } = req.body;

    if (!subjectId) {
      res.status(400).json({ error: 'Subject ID is required' });
      return;
    }

    const existing = await queryOne('SELECT id FROM class_subject_mappings WHERE class_id = ? AND subject_id = ?;', [classId, subjectId]);
    if (existing) {
      res.status(400).json({ error: 'This subject is already mapped to this class' });
      return;
    }

    const id = `csm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await execute(`
      INSERT INTO class_subject_mappings (id, school_id, class_id, subject_id)
      VALUES (?, ?, ?, ?);
    `, [id, schoolId, classId, subjectId]);

    res.status(201).json({ message: 'Subject mapped to class successfully' });
  } catch (err: any) {
    console.error('Map subject error:', err);
    res.status(500).json({ error: err.message || 'Failed to map subject' });
  }
});

// Remove subject mapping from class
academicsRouter.delete('/classes/:classId/subjects/:subjectId', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const { classId, subjectId } = req.params;
    await execute('DELETE FROM class_subject_mappings WHERE class_id = ? AND subject_id = ?;', [classId, subjectId]);
    res.json({ message: 'Subject mapping removed' });
  } catch (err: any) {
    console.error('Delete subject mapping error:', err);
    res.status(500).json({ error: 'Failed to remove subject mapping' });
  }
});

// ==========================================
// 4. ROOMS
// ==========================================

// Get Rooms
academicsRouter.get('/rooms', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const rooms = await query(`
      SELECT * FROM rooms
      WHERE school_id = ? OR ? IS NULL
      ORDER BY room_number ASC
    `, [schoolId, schoolId]);

    res.json({ rooms });
  } catch (err: any) {
    console.error('Fetch rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Create Room
academicsRouter.post('/rooms', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { roomNumber, capacity, building } = req.body;
    if (!roomNumber) {
      res.status(400).json({ error: 'Room number is required' });
      return;
    }

    const id = `room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await execute(`
      INSERT INTO rooms (id, school_id, room_number, capacity, building)
      VALUES (?, ?, ?, ?, ?);
    `, [id, schoolId, roomNumber.trim(), capacity ? parseInt(capacity, 10) : 40, building?.trim() || null]);

    const created = await queryOne('SELECT * FROM rooms WHERE id = ?;', [id]);
    res.status(201).json({ room: created, message: 'Room created successfully' });
  } catch (err: any) {
    console.error('Create room error:', err);
    res.status(500).json({ error: err.message || 'Failed to create room' });
  }
});

// ==========================================
// 5. FACULTY & ASSIGNMENTS
// ==========================================

// Get Faculty
academicsRouter.get('/faculty', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const faculty = await query(`
      SELECT f.*, u.email, u.mobile_number, u.user_id as login_user_id
      FROM faculty f
      JOIN users u ON f.user_id = u.id
      WHERE f.school_id = ? OR ? IS NULL
      ORDER BY f.first_name ASC, f.last_name ASC
    `, [schoolId, schoolId]);

    // Fetch assignments for each faculty
    const assignments = await query(`
      SELECT fa.*,
             c.name as class_name,
             sec.name as section_name,
             sub.name as subject_name,
             sub.code as subject_code
      FROM faculty_assignments fa
      JOIN classes c ON fa.class_id = c.id
      JOIN sections sec ON fa.section_id = sec.id
      JOIN subjects sub ON fa.subject_id = sub.id
      WHERE fa.school_id = ? OR ? IS NULL
    `, [schoolId, schoolId]);

    const enrichedFaculty = faculty.map((fac) => ({
      ...fac,
      assignments: assignments.filter((a) => a.faculty_id === fac.id),
    }));

    res.json({ faculty: enrichedFaculty });
  } catch (err: any) {
    console.error('Fetch faculty error:', err);
    res.status(500).json({ error: 'Failed to fetch faculty' });
  }
});

// Assign Faculty to Class Section Subject
academicsRouter.post('/faculty-assignments', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { facultyId, academicYearId, classId, sectionId, subjectId } = req.body;

    if (!facultyId || !academicYearId || !classId || !sectionId || !subjectId) {
      res.status(400).json({ error: 'Faculty, academic year, class, section, and subject are required' });
      return;
    }

    const existing = await queryOne(`
      SELECT id FROM faculty_assignments
      WHERE faculty_id = ? AND academic_year_id = ? AND class_id = ? AND section_id = ? AND subject_id = ?
    `, [facultyId, academicYearId, classId, sectionId, subjectId]);

    if (existing) {
      res.status(400).json({ error: 'This faculty assignment already exists' });
      return;
    }

    const id = `fa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await execute(`
      INSERT INTO faculty_assignments (id, school_id, faculty_id, academic_year_id, class_id, section_id, subject_id)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `, [id, schoolId, facultyId, academicYearId, classId, sectionId, subjectId]);

    res.status(201).json({ message: 'Faculty assigned successfully' });
  } catch (err: any) {
    console.error('Assign faculty error:', err);
    res.status(500).json({ error: err.message || 'Failed to assign faculty' });
  }
});

// Remove Faculty Assignment
academicsRouter.delete('/faculty-assignments/:id', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await execute('DELETE FROM faculty_assignments WHERE id = ?;', [id]);
    res.json({ message: 'Faculty assignment removed' });
  } catch (err: any) {
    console.error('Delete faculty assignment error:', err);
    res.status(500).json({ error: 'Failed to remove assignment' });
  }
});

// ==========================================
// 6. TIMETABLE ENGINE & CLASH DETECTION
// ==========================================

// Standard Period Definitions
export const STANDARD_PERIODS = [
  { periodNumber: 1, startTime: '09:00', endTime: '09:45', label: 'Period 1' },
  { periodNumber: 2, startTime: '09:45', endTime: '10:30', label: 'Period 2' },
  { periodNumber: 3, startTime: '10:45', endTime: '11:30', label: 'Period 3' },
  { periodNumber: 4, startTime: '11:30', endTime: '12:15', label: 'Period 4' },
  { periodNumber: 5, startTime: '13:00', endTime: '13:45', label: 'Period 5' },
  { periodNumber: 6, startTime: '13:45', endTime: '14:30', label: 'Period 6' },
  { periodNumber: 7, startTime: '14:30', endTime: '15:15', label: 'Period 7' },
  { periodNumber: 8, startTime: '15:15', endTime: '16:00', label: 'Period 8' },
];

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper: Conflict checker
async function checkTimetableClashes({
  academicYearId,
  classId,
  sectionId,
  dayOfWeek,
  periodNumber,
  facultyId,
  roomId,
  currentSlotId = null,
}: {
  academicYearId: string;
  classId: string;
  sectionId: string;
  dayOfWeek: string;
  periodNumber: number;
  facultyId: string;
  roomId?: string | null;
  currentSlotId?: string | null;
}) {
  const clashes: { type: 'faculty' | 'room' | 'class'; message: string; details: any }[] = [];

  // 1. Teacher Conflict: Is this teacher already teaching another class/section during this day & period?
  if (facultyId) {
    const teacherClash = await queryOne(`
      SELECT t.*,
             c.name as class_name,
             s.name as section_name,
             sub.name as subject_name,
             f.first_name || ' ' || f.last_name as teacher_name
      FROM timetables t
      JOIN classes c ON t.class_id = c.id
      JOIN sections s ON t.section_id = s.id
      JOIN subjects sub ON t.subject_id = sub.id
      JOIN faculty f ON t.faculty_id = f.id
      WHERE t.academic_year_id = ?
        AND t.day_of_week = ?
        AND t.period_number = ?
        AND t.faculty_id = ?
        AND (t.id != ? OR ? IS NULL)
        AND NOT (t.class_id = ? AND t.section_id = ?)
    `, [academicYearId, dayOfWeek, periodNumber, facultyId, currentSlotId, currentSlotId, classId, sectionId]);

    if (teacherClash) {
      clashes.push({
        type: 'faculty',
        message: `Teacher Clash: ${teacherClash.teacher_name} is already teaching ${teacherClash.subject_name} in ${teacherClash.class_name} - Section ${teacherClash.section_name} during Period ${periodNumber} on ${dayOfWeek}.`,
        details: teacherClash,
      });
    }
  }

  // 2. Room Conflict: Is this room already occupied by another class during this day & period?
  if (roomId) {
    const roomClash = await queryOne(`
      SELECT t.*,
             c.name as class_name,
             s.name as section_name,
             sub.name as subject_name,
             r.room_number
      FROM timetables t
      JOIN classes c ON t.class_id = c.id
      JOIN sections s ON t.section_id = s.id
      JOIN subjects sub ON t.subject_id = sub.id
      JOIN rooms r ON t.room_id = r.id
      WHERE t.academic_year_id = ?
        AND t.day_of_week = ?
        AND t.period_number = ?
        AND t.room_id = ?
        AND (t.id != ? OR ? IS NULL)
        AND NOT (t.class_id = ? AND t.section_id = ?)
    `, [academicYearId, dayOfWeek, periodNumber, roomId, currentSlotId, currentSlotId, classId, sectionId]);

    if (roomClash) {
      clashes.push({
        type: 'room',
        message: `Room Clash: ${roomClash.room_number} is already booked for ${roomClash.class_name} - Section ${roomClash.section_name} (${roomClash.subject_name}) during Period ${periodNumber} on ${dayOfWeek}.`,
        details: roomClash,
      });
    }
  }

  return clashes;
}

// Check Clash Endpoint (called interactively by UI before booking)
academicsRouter.post('/timetable/check-clash', authenticate, async (req: Request, res: Response) => {
  try {
    const { academicYearId, classId, sectionId, dayOfWeek, periodNumber, facultyId, roomId, currentSlotId } = req.body;

    if (!academicYearId || !classId || !sectionId || !dayOfWeek || !periodNumber || !facultyId) {
      res.status(400).json({ error: 'Missing required parameters for clash verification' });
      return;
    }

    const clashes = await checkTimetableClashes({
      academicYearId,
      classId,
      sectionId,
      dayOfWeek,
      periodNumber: parseInt(periodNumber, 10),
      facultyId,
      roomId: roomId || null,
      currentSlotId: currentSlotId || null,
    });

    res.json({
      hasClash: clashes.length > 0,
      clashes,
    });
  } catch (err: any) {
    console.error('Check clash error:', err);
    res.status(500).json({ error: 'Failed to verify timetable clash' });
  }
});

// Get Timetable for a Class + Section
academicsRouter.get('/timetable', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { classId, sectionId, academicYearId } = req.query;

    if (!classId || !sectionId) {
      res.status(400).json({ error: 'Class ID and Section ID are required' });
      return;
    }

    // Default to active academic year if not provided
    let targetAy = academicYearId;
    if (!targetAy) {
      const activeAy = await queryOne('SELECT id FROM academic_years WHERE (school_id = ? OR ? IS NULL) AND is_active = 1 LIMIT 1;', [schoolId, schoolId]);
      targetAy = activeAy ? activeAy.id : null;
    }

    const slots = await query(`
      SELECT t.*,
             c.name as class_name,
             sec.name as section_name,
             sub.name as subject_name,
             sub.code as subject_code,
             sub.is_optional,
             f.first_name || ' ' || f.last_name as faculty_name,
             f.employee_code,
             r.room_number,
             r.building as room_building
      FROM timetables t
      JOIN classes c ON t.class_id = c.id
      JOIN sections sec ON t.section_id = sec.id
      JOIN subjects sub ON t.subject_id = sub.id
      JOIN faculty f ON t.faculty_id = f.id
      LEFT JOIN rooms r ON t.room_id = r.id
      WHERE t.class_id = ?
        AND t.section_id = ?
        AND (t.academic_year_id = ? OR ? IS NULL)
        AND (t.school_id = ? OR ? IS NULL)
      ORDER BY t.period_number ASC
    `, [classId, sectionId, targetAy, targetAy, schoolId, schoolId]);

    res.json({
      slots,
      standardPeriods: STANDARD_PERIODS,
      daysOfWeek: DAYS_OF_WEEK,
    });
  } catch (err: any) {
    console.error('Fetch timetable error:', err);
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

// Get Timetable for a Faculty
academicsRouter.get('/timetable/faculty/:facultyId', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { facultyId } = req.params;
    const { academicYearId } = req.query;

    let targetAy = academicYearId;
    if (!targetAy) {
      const activeAy = await queryOne('SELECT id FROM academic_years WHERE (school_id = ? OR ? IS NULL) AND is_active = 1 LIMIT 1;', [schoolId, schoolId]);
      targetAy = activeAy ? activeAy.id : null;
    }

    const slots = await query(`
      SELECT t.*,
             c.name as class_name,
             sec.name as section_name,
             sub.name as subject_name,
             sub.code as subject_code,
             r.room_number,
             r.building as room_building
      FROM timetables t
      JOIN classes c ON t.class_id = c.id
      JOIN sections sec ON t.section_id = sec.id
      JOIN subjects sub ON t.subject_id = sub.id
      LEFT JOIN rooms r ON t.room_id = r.id
      WHERE t.faculty_id = ?
        AND (t.academic_year_id = ? OR ? IS NULL)
        AND (t.school_id = ? OR ? IS NULL)
      ORDER BY t.period_number ASC
    `, [facultyId, targetAy, targetAy, schoolId, schoolId]);

    const faculty = await queryOne('SELECT * FROM faculty WHERE id = ?;', [facultyId]);

    res.json({
      faculty,
      slots,
      standardPeriods: STANDARD_PERIODS,
      daysOfWeek: DAYS_OF_WEEK,
    });
  } catch (err: any) {
    console.error('Fetch faculty timetable error:', err);
    res.status(500).json({ error: 'Failed to fetch faculty timetable' });
  }
});

// Get Logged-in User's Timetable (Student or Faculty)
academicsRouter.get('/timetable/my', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const userId = req.user!.id;
    const role = req.user!.role;

    if (role === 'STUDENT') {
      // Find student and active class/section
      const student = await queryOne(`
        SELECT s.id as student_id, s.first_name, s.last_name, sar.class_id, sar.section_id, sar.academic_year_id,
               c.name as class_name, sec.name as section_name
        FROM students s
        LEFT JOIN student_academic_records sar ON s.id = sar.student_id
        LEFT JOIN classes c ON sar.class_id = c.id
        LEFT JOIN sections sec ON sar.section_id = sec.id
        WHERE s.user_id = ?
        LIMIT 1
      `, [userId]);

      if (!student || !student.class_id || !student.section_id) {
        res.json({ role: 'STUDENT', slots: [], message: 'Student is not enrolled in an active class/section' });
        return;
      }

      const slots = await query(`
        SELECT t.*,
               c.name as class_name,
               sec.name as section_name,
               sub.name as subject_name,
               sub.code as subject_code,
               f.first_name || ' ' || f.last_name as faculty_name,
               f.employee_code,
               r.room_number,
               r.building as room_building
        FROM timetables t
        JOIN classes c ON t.class_id = c.id
        JOIN sections sec ON t.section_id = sec.id
        JOIN subjects sub ON t.subject_id = sub.id
        JOIN faculty f ON t.faculty_id = f.id
        LEFT JOIN rooms r ON t.room_id = r.id
        WHERE t.class_id = ?
          AND t.section_id = ?
          AND t.academic_year_id = ?
        ORDER BY t.period_number ASC
      `, [student.class_id, student.section_id, student.academic_year_id]);

      res.json({
        role: 'STUDENT',
        student,
        slots,
        standardPeriods: STANDARD_PERIODS,
        daysOfWeek: DAYS_OF_WEEK,
      });
      return;
    }

    if (role === 'FACULTY') {
      const faculty = await queryOne('SELECT * FROM faculty WHERE user_id = ?;', [userId]);
      if (!faculty) {
        res.json({ role: 'FACULTY', slots: [], message: 'Faculty profile not found' });
        return;
      }

      const slots = await query(`
        SELECT t.*,
               c.name as class_name,
               sec.name as section_name,
               sub.name as subject_name,
               sub.code as subject_code,
               r.room_number,
               r.building as room_building
        FROM timetables t
        JOIN classes c ON t.class_id = c.id
        JOIN sections sec ON t.section_id = sec.id
        JOIN subjects sub ON t.subject_id = sub.id
        LEFT JOIN rooms r ON t.room_id = r.id
        WHERE t.faculty_id = ?
        ORDER BY t.period_number ASC
      `, [faculty.id]);

      res.json({
        role: 'FACULTY',
        faculty,
        slots,
        standardPeriods: STANDARD_PERIODS,
        daysOfWeek: DAYS_OF_WEEK,
      });
      return;
    }

    // Default for admins: return overview status
    res.json({
      role,
      slots: [],
      message: 'Admin/Office timetable view. Select a class or faculty to view timetable.',
      standardPeriods: STANDARD_PERIODS,
      daysOfWeek: DAYS_OF_WEEK,
    });
  } catch (err: any) {
    console.error('Fetch my timetable error:', err);
    res.status(500).json({ error: 'Failed to fetch personal timetable' });
  }
});

// Save or Update Timetable Slot with Clash Validation
academicsRouter.post('/timetable/slot', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const {
      id: slotId,
      academicYearId,
      classId,
      sectionId,
      dayOfWeek,
      periodNumber,
      subjectId,
      facultyId,
      roomId,
      startTime,
      endTime,
      force, // if true, override warning (still logged)
    } = req.body;

    if (!academicYearId || !classId || !sectionId || !dayOfWeek || !periodNumber || !subjectId || !facultyId) {
      res.status(400).json({ error: 'Missing required timetable slot parameters' });
      return;
    }

    const numPeriod = parseInt(periodNumber, 10);

    // 1. Clash Detection
    const clashes = await checkTimetableClashes({
      academicYearId,
      classId,
      sectionId,
      dayOfWeek,
      periodNumber: numPeriod,
      facultyId,
      roomId: roomId || null,
      currentSlotId: slotId || null,
    });

    if (clashes.length > 0 && !force) {
      res.status(409).json({
        error: 'Timetable conflict detected',
        clashes,
      });
      return;
    }

    // Calculate default start/end times if not provided
    const periodDef = STANDARD_PERIODS.find((p) => p.periodNumber === numPeriod);
    const finalStartTime = startTime || (periodDef ? periodDef.startTime : '09:00');
    const finalEndTime = endTime || (periodDef ? periodDef.endTime : '09:45');

    const id = slotId || `tt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    await transaction(async () => {
      // Check if slot exists for this exact class, section, day and period
      const existing = await queryOne(`
        SELECT id FROM timetables
        WHERE academic_year_id = ? AND class_id = ? AND section_id = ? AND day_of_week = ? AND period_number = ?
      `, [academicYearId, classId, sectionId, dayOfWeek, numPeriod]);

      if (existing) {
        await execute(`
          UPDATE timetables
          SET subject_id = ?, faculty_id = ?, room_id = ?, start_time = ?, end_time = ?
          WHERE id = ?;
        `, [subjectId, facultyId, roomId || null, finalStartTime, finalEndTime, existing.id]);
      } else {
        await execute(`
          INSERT INTO timetables (id, school_id, academic_year_id, class_id, section_id, day_of_week, period_number, subject_id, faculty_id, room_id, start_time, end_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [id, schoolId, academicYearId, classId, sectionId, dayOfWeek, numPeriod, subjectId, facultyId, roomId || null, finalStartTime, finalEndTime]);
      }
    });

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: slotId ? 'UPDATE_TIMETABLE_SLOT' : 'CREATE_TIMETABLE_SLOT',
      module: 'timetables',
      recordId: id,
      newValue: { classId, sectionId, dayOfWeek, periodNumber: numPeriod, subjectId, facultyId, roomId },
      ipAddress: req.ip,
    });

    const saved = await queryOne(`
      SELECT t.*,
             c.name as class_name,
             sec.name as section_name,
             sub.name as subject_name,
             f.first_name || ' ' || f.last_name as faculty_name,
             r.room_number
      FROM timetables t
      JOIN classes c ON t.class_id = c.id
      JOIN sections sec ON t.section_id = sec.id
      JOIN subjects sub ON t.subject_id = sub.id
      JOIN faculty f ON t.faculty_id = f.id
      LEFT JOIN rooms r ON t.room_id = r.id
      WHERE t.academic_year_id = ? AND t.class_id = ? AND t.section_id = ? AND t.day_of_week = ? AND t.period_number = ?
    `, [academicYearId, classId, sectionId, dayOfWeek, numPeriod]);

    res.status(200).json({
      slot: saved,
      message: 'Timetable slot saved successfully',
    });
  } catch (err: any) {
    console.error('Save timetable slot error:', err);
    res.status(500).json({ error: err.message || 'Failed to save timetable slot' });
  }
});

// Delete Timetable Slot
academicsRouter.delete('/timetable/slot/:id', authenticate, requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'OFFICE']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await queryOne('SELECT * FROM timetables WHERE id = ?;', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Timetable slot not found' });
      return;
    }

    await execute('DELETE FROM timetables WHERE id = ?;', [id]);

    await logAudit({
      schoolId: existing.school_id,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'DELETE_TIMETABLE_SLOT',
      module: 'timetables',
      recordId: id,
      oldValue: existing,
      ipAddress: req.ip,
    });

    res.json({ message: 'Timetable slot removed successfully' });
  } catch (err: any) {
    console.error('Delete timetable slot error:', err);
    res.status(500).json({ error: 'Failed to remove timetable slot' });
  }
});

