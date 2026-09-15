import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { authenticate, requireRole } from '../middlewares/auth.ts';
import { logAudit } from '../utils/audit.ts';

export const attendanceRouter = Router();

// 1. Get Student Attendance by Class, Section, and Date
attendanceRouter.get('/students', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { classId, sectionId, date } = req.query;
    if (!classId || !sectionId) {
      res.status(400).json({ error: 'Class ID and Section ID are required' });
      return;
    }

    const attendanceDate = (date as string) || new Date().toISOString().split('T')[0];

    // Fetch active academic year
    const activeYear = await queryOne(
      'SELECT id, name FROM academic_years WHERE school_id = ? AND is_active = 1 LIMIT 1;',
      [schoolId]
    );

    // Fetch students enrolled in this class & section
    const students = await query(`
      SELECT s.id as student_id, s.admission_number, s.first_name, s.last_name, s.photo_url,
             sar.roll_number,
             sa.id as attendance_id,
             COALESCE(sa.morning_status, 'present') as morning_status,
             COALESCE(sa.afternoon_status, 'present') as afternoon_status,
             COALESCE(sa.calculated_status, 'present') as calculated_status,
             sa.remarks,
             sa.created_at as marked_at
      FROM students s
      JOIN student_academic_records sar ON s.id = sar.student_id
      LEFT JOIN student_attendance sa ON s.id = sa.student_id AND sa.date = ?
      WHERE s.school_id = ? AND sar.class_id = ? AND sar.section_id = ? AND s.status = 'active'
      ORDER BY sar.roll_number ASC, s.first_name ASC
    `, [attendanceDate, schoolId, classId, sectionId]);

    // Calculate quick stats for this batch
    let presentCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;

    for (const st of students) {
      if (st.calculated_status === 'present') presentCount++;
      else if (st.calculated_status === 'absent') absentCount++;
      else if (st.calculated_status === 'half_day') halfDayCount++;
    }

    res.json({
      date: attendanceDate,
      academicYear: activeYear,
      students,
      stats: {
        total: students.length,
        present: presentCount,
        absent: absentCount,
        halfDay: halfDayCount,
        attendanceRate: students.length ? Math.round((presentCount / students.length) * 100) : 100
      }
    });
  } catch (err: any) {
    console.error('Fetch student attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch student attendance' });
  }
});

// 2. Mark / Bulk Save Student Attendance
attendanceRouter.post('/students', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'FACULTY', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { date, records } = req.body;
    if (!date || !records || !Array.isArray(records)) {
      res.status(400).json({ error: 'Date and records array are required' });
      return;
    }

    // Active academic year
    const activeYear = await queryOne(
      'SELECT id FROM academic_years WHERE school_id = ? AND is_active = 1 LIMIT 1;',
      [schoolId]
    );
    const academicYearId = activeYear ? activeYear.id : 'ay-default';

    await transaction(async () => {
      for (const rec of records) {
        const studentId = rec.studentId;
        const morningStatus = rec.morningStatus === 'absent' ? 'absent' : 'present';
        const afternoonStatus = rec.afternoonStatus === 'absent' ? 'absent' : 'present';
        
        // Calculate status
        let calculatedStatus = 'present';
        if (morningStatus === 'absent' && afternoonStatus === 'absent') {
          calculatedStatus = 'absent';
        } else if (morningStatus === 'absent' || afternoonStatus === 'absent') {
          calculatedStatus = 'half_day';
        }

        const remarks = rec.remarks || null;

        // Check if already exists
        const existing = await queryOne(
          'SELECT id FROM student_attendance WHERE student_id = ? AND date = ?;',
          [studentId, date]
        );

        if (existing) {
          await execute(`
            UPDATE student_attendance
            SET morning_status = ?, afternoon_status = ?, calculated_status = ?, remarks = ?,
                recorded_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?;
          `, [morningStatus, afternoonStatus, calculatedStatus, remarks, req.user!.id, existing.id]);
        } else {
          const newId = 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
          await execute(`
            INSERT INTO student_attendance (id, school_id, student_id, academic_year_id, date, morning_status, afternoon_status, calculated_status, remarks, recorded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `, [newId, schoolId, studentId, academicYearId, date, morningStatus, afternoonStatus, calculatedStatus, remarks, req.user!.id]);
        }
      }
    });

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'MARK_STUDENT_ATTENDANCE',
      module: 'ATTENDANCE',
      newValue: { date, count: records.length },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Attendance for ${records.length} students recorded successfully` });
  } catch (err: any) {
    console.error('Save student attendance error:', err);
    res.status(500).json({ error: 'Failed to record student attendance' });
  }
});

// 3. Student Individual Attendance Summary (with low attendance alert)
attendanceRouter.get('/student/:studentId/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    let { studentId } = req.params;

    if (studentId === 'me' || studentId === 'undefined' || !studentId) {
      if (req.user!.role === 'STUDENT' && req.user!.studentId) {
        studentId = req.user!.studentId;
      }
    }

    // Authorization check
    if (req.user!.role === 'STUDENT') {
      const student = await queryOne('SELECT id FROM students WHERE user_id = ?;', [req.user!.id]);
      if (!student || student.id !== studentId) {
        res.status(403).json({ error: 'Unauthorized to view other students attendance' });
        return;
      }
    }

    const attendanceRecords = await query(`
      SELECT date, morning_status, afternoon_status, calculated_status, remarks, created_at
      FROM student_attendance
      WHERE student_id = ?
      ORDER BY date DESC
      LIMIT 60
    `, [studentId]);

    const stats = await queryOne(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN calculated_status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN calculated_status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN calculated_status = 'half_day' THEN 1 ELSE 0 END) as half_days
      FROM student_attendance
      WHERE student_id = ?;
    `, [studentId]);

    const totalDays = stats?.total_days || 0;
    const presentDays = stats?.present_days || 0;
    const halfDays = stats?.half_days || 0;
    const absentDays = stats?.absent_days || 0;

    // Standard school formula: Present + 0.5 * HalfDay
    const effectivePresent = presentDays + (halfDays * 0.5);
    const percentage = totalDays > 0 ? Math.round((effectivePresent / totalDays) * 100) : 100;
    const isBelowThreshold = percentage < 75;

    res.json({
      summary: {
        totalDays,
        presentDays,
        halfDays,
        absentDays,
        percentage,
        isBelowThreshold,
        threshold: 75
      },
      records: attendanceRecords
    });
  } catch (err: any) {
    console.error('Fetch student attendance summary error:', err);
    res.status(500).json({ error: 'Failed to fetch student attendance summary' });
  }
});

// 4. Faculty Attendance Register
attendanceRouter.get('/faculty', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const faculty = await query(`
      SELECT f.id as faculty_id, f.employee_code, f.first_name, f.last_name, f.designation, f.department,
             fa.id as attendance_id,
             COALESCE(fa.status, 'present') as status,
             fa.remarks,
             fa.created_at as marked_at
      FROM faculty f
      LEFT JOIN faculty_attendance fa ON f.id = fa.faculty_id AND fa.date = ?
      WHERE f.school_id = ? AND f.status = 'active'
      ORDER BY f.first_name ASC
    `, [date, schoolId]);

    res.json({ date, faculty });
  } catch (err: any) {
    console.error('Fetch faculty attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch faculty attendance' });
  }
});

// 5. Mark Faculty Attendance
attendanceRouter.post('/faculty', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { date, records } = req.body;
    if (!date || !records || !Array.isArray(records)) {
      res.status(400).json({ error: 'Date and records array are required' });
      return;
    }

    await transaction(async () => {
      for (const rec of records) {
        const facultyId = rec.facultyId;
        const status = ['present', 'absent', 'half_day'].includes(rec.status) ? rec.status : 'present';
        const remarks = rec.remarks || null;

        const existing = await queryOne(
          'SELECT id FROM faculty_attendance WHERE faculty_id = ? AND date = ?;',
          [facultyId, date]
        );

        if (existing) {
          await execute(`
            UPDATE faculty_attendance
            SET status = ?, remarks = ?, recorded_by = ?
            WHERE id = ?;
          `, [status, remarks, req.user!.id, existing.id]);
        } else {
          const newId = 'fatt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
          await execute(`
            INSERT INTO faculty_attendance (id, school_id, faculty_id, date, status, remarks, recorded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?);
          `, [newId, schoolId, facultyId, date, status, remarks, req.user!.id]);
        }
      }
    });

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'MARK_FACULTY_ATTENDANCE',
      module: 'ATTENDANCE',
      newValue: { date, count: records.length },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Faculty attendance for ${records.length} staff recorded successfully` });
  } catch (err: any) {
    console.error('Save faculty attendance error:', err);
    res.status(500).json({ error: 'Failed to record faculty attendance' });
  }
});

// 6. School-wide Attendance Analytics & Defaulters Alert
attendanceRouter.get('/analytics', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Today's summary
    const todaySummary = await queryOne(`
      SELECT 
        COUNT(*) as total_marked,
        SUM(CASE WHEN calculated_status = 'present' THEN 1 ELSE 0 END) as present_today,
        SUM(CASE WHEN calculated_status = 'absent' THEN 1 ELSE 0 END) as absent_today,
        SUM(CASE WHEN calculated_status = 'half_day' THEN 1 ELSE 0 END) as half_day_today
      FROM student_attendance
      WHERE school_id = ? AND date = ?;
    `, [schoolId, today]);

    // Defaulters (< 75% attendance)
    const defaulters = await query(`
      SELECT s.id, s.admission_number, s.first_name, s.last_name,
             c.name as class_name, sec.name as section_name,
             COUNT(sa.id) as total_days,
             SUM(CASE WHEN sa.calculated_status = 'present' THEN 1 ELSE 0 END) as present_days,
             SUM(CASE WHEN sa.calculated_status = 'half_day' THEN 1 ELSE 0 END) as half_days,
             SUM(CASE WHEN sa.calculated_status = 'absent' THEN 1 ELSE 0 END) as absent_days
      FROM students s
      JOIN student_academic_records sar ON s.id = sar.student_id
      JOIN classes c ON sar.class_id = c.id
      JOIN sections sec ON sar.section_id = sec.id
      JOIN student_attendance sa ON s.id = sa.student_id
      WHERE s.school_id = ? AND s.status = 'active'
      GROUP BY s.id
      HAVING (CAST(SUM(CASE WHEN sa.calculated_status = 'present' THEN 1 ELSE 0 END) + (SUM(CASE WHEN sa.calculated_status = 'half_day' THEN 1 ELSE 0 END) * 0.5) AS FLOAT) / COUNT(sa.id)) < 0.75
      ORDER BY present_days ASC
      LIMIT 10;
    `, [schoolId]);

    res.json({
      todaySummary: todaySummary || { total_marked: 0, present_today: 0, absent_today: 0, half_day_today: 0 },
      defaulters
    });
  } catch (err: any) {
    console.error('Fetch attendance analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance analytics' });
  }
});
