import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { authenticate, requireRole } from '../middlewares/auth.ts';
import { logAudit } from '../utils/audit.ts';

export const examsRouter = Router();

// Helper to calculate grade from percentage
async function calculateGrade(schoolId: string, percentage: number) {
  const rule = await queryOne(`
    SELECT grade, grade_point, remarks
    FROM grading_rules
    WHERE school_id = ? AND ? >= min_percentage AND ? <= max_percentage
    ORDER BY min_percentage DESC
    LIMIT 1;
  `, [schoolId, percentage, percentage]);

  if (rule) return rule;

  // Fallback default
  if (percentage >= 90) return { grade: 'A+', grade_point: 10, remarks: 'Outstanding' };
  if (percentage >= 80) return { grade: 'A', grade_point: 9, remarks: 'Excellent' };
  if (percentage >= 70) return { grade: 'B+', grade_point: 8, remarks: 'Very Good' };
  if (percentage >= 60) return { grade: 'B', grade_point: 7, remarks: 'Good' };
  if (percentage >= 50) return { grade: 'C', grade_point: 6, remarks: 'Average' };
  if (percentage >= 35) return { grade: 'D', grade_point: 5, remarks: 'Pass' };
  return { grade: 'F', grade_point: 0, remarks: 'Fail' };
}

// 1. List all Exams
examsRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const exams = await query(`
      SELECT e.*, ay.name as academic_year_name,
             (SELECT COUNT(*) FROM exam_subjects es WHERE es.exam_id = e.id) as subjects_count
      FROM exams e
      JOIN academic_years ay ON e.academic_year_id = ay.id
      WHERE e.school_id = ?
      ORDER BY e.created_at DESC
    `, [schoolId]);

    res.json({ exams });
  } catch (err: any) {
    console.error('Fetch exams error:', err);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

// 2. Create Exam
examsRouter.post('/', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { name, startDate, endDate, academicYearId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Exam name is required' });
      return;
    }

    let ayId = academicYearId;
    if (!ayId) {
      const activeYear = await queryOne('SELECT id FROM academic_years WHERE school_id = ? AND is_active = 1 LIMIT 1;', [schoolId]);
      ayId = activeYear ? activeYear.id : 'ay-default';
    }

    const id = 'ex-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    await execute(`
      INSERT INTO exams (id, school_id, academic_year_id, name, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?);
    `, [id, schoolId, ayId, name.trim(), startDate || null, endDate || null]);

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'CREATE_EXAM',
      module: 'EXAMS',
      recordId: id,
      newValue: { name },
      ipAddress: req.ip
    });

    res.status(201).json({ id, message: 'Exam created successfully' });
  } catch (err: any) {
    console.error('Create exam error:', err);
    res.status(500).json({ error: err.message || 'Failed to create exam' });
  }
});

// 3. List Exam Subject Papers
examsRouter.get('/:examId/subjects', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { examId } = req.params;

    const subjects = await query(`
      SELECT es.*, c.name as class_name, c.class_code, s.name as subject_name, s.code as subject_code,
             (SELECT COUNT(*) FROM marks m WHERE m.exam_subject_id = es.id) as marks_entered_count
      FROM exam_subjects es
      JOIN classes c ON es.class_id = c.id
      JOIN subjects s ON es.subject_id = s.id
      WHERE es.school_id = ? AND es.exam_id = ?
      ORDER BY c.display_order ASC, es.exam_date ASC, s.name ASC
    `, [schoolId, examId]);

    res.json({ subjects });
  } catch (err: any) {
    console.error('Fetch exam subjects error:', err);
    res.status(500).json({ error: 'Failed to fetch exam subjects' });
  }
});

// 4. Configure Subject for Exam
examsRouter.post('/:examId/subjects', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { examId } = req.params;
    const { classId, subjectId, maxMarks, passMarks, examDate } = req.body;

    if (!classId || !subjectId) {
      res.status(400).json({ error: 'Class ID and Subject ID are required' });
      return;
    }

    const existing = await queryOne(
      'SELECT id FROM exam_subjects WHERE exam_id = ? AND class_id = ? AND subject_id = ?;',
      [examId, classId, subjectId]
    );

    if (existing) {
      await execute(`
        UPDATE exam_subjects
        SET max_marks = ?, pass_marks = ?, exam_date = ?
        WHERE id = ?;
      `, [maxMarks || 100, passMarks || 35, examDate || null, existing.id]);
      res.json({ id: existing.id, message: 'Exam subject updated' });
      return;
    }

    const id = 'es-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    await execute(`
      INSERT INTO exam_subjects (id, school_id, exam_id, class_id, subject_id, max_marks, pass_marks, exam_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `, [id, schoolId, examId, classId, subjectId, maxMarks || 100, passMarks || 35, examDate || null]);

    res.status(201).json({ id, message: 'Subject paper added to exam' });
  } catch (err: any) {
    console.error('Configure exam subject error:', err);
    res.status(500).json({ error: 'Failed to configure exam subject' });
  }
});

// 5. Get Marks Sheet for an Exam Subject Paper
examsRouter.get('/subjects/:examSubjectId/marks', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { examSubjectId } = req.params;

    const paper = await queryOne(`
      SELECT es.*, e.name as exam_name, c.name as class_name, s.name as subject_name, s.code as subject_code
      FROM exam_subjects es
      JOIN exams e ON es.exam_id = e.id
      JOIN classes c ON es.class_id = c.id
      JOIN subjects s ON es.subject_id = s.id
      WHERE es.id = ? AND es.school_id = ?;
    `, [examSubjectId, schoolId]);

    if (!paper) {
      res.status(404).json({ error: 'Exam paper not found' });
      return;
    }

    // Get all students enrolled in this class
    const students = await query(`
      SELECT s.id as student_id, s.admission_number, s.first_name, s.last_name,
             sar.roll_number, sec.name as section_name,
             m.id as mark_id, m.obtained_marks, m.correction_count, m.is_locked,
             m.entered_by, u.user_id as entered_by_username
      FROM students s
      JOIN student_academic_records sar ON s.id = sar.student_id
      JOIN sections sec ON sar.section_id = sec.id
      LEFT JOIN marks m ON s.id = m.student_id AND m.exam_subject_id = ?
      LEFT JOIN users u ON m.entered_by = u.id
      WHERE s.school_id = ? AND sar.class_id = ? AND s.status = 'active'
      ORDER BY sec.name ASC, sar.roll_number ASC, s.first_name ASC;
    `, [examSubjectId, schoolId, paper.class_id]);

    res.json({ paper, students });
  } catch (err: any) {
    console.error('Fetch marks sheet error:', err);
    res.status(500).json({ error: 'Failed to fetch marks sheet' });
  }
});

// 6. Save Marks Entry (with 1-time Teacher Edit Enforcement and Principal Override)
examsRouter.post('/subjects/:examSubjectId/marks', authenticate, requireRole(['FACULTY', 'PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { examSubjectId } = req.params;
    const { marksEntries, lockMarks } = req.body;

    if (!marksEntries || !Array.isArray(marksEntries)) {
      res.status(400).json({ error: 'marksEntries array required' });
      return;
    }

    const paper = await queryOne('SELECT max_marks, pass_marks FROM exam_subjects WHERE id = ?;', [examSubjectId]);
    if (!paper) {
      res.status(404).json({ error: 'Exam paper not found' });
      return;
    }

    const isPrincipalOrAdmin = ['PRINCIPAL', 'SUPER_ADMIN'].includes(req.user!.role);

    await transaction(async () => {
      for (const entry of marksEntries) {
        const studentId = entry.studentId;
        const obtainedMarks = parseFloat(entry.obtainedMarks);

        if (isNaN(obtainedMarks) || obtainedMarks < 0 || obtainedMarks > paper.max_marks) {
          continue; // Skip invalid marks
        }

        const existing = await queryOne(
          'SELECT id, obtained_marks, correction_count, is_locked FROM marks WHERE exam_subject_id = ? AND student_id = ?;',
          [examSubjectId, studentId]
        );

        if (!existing) {
          // Initial entry
          const markId = 'mrk-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
          await execute(`
            INSERT INTO marks (id, school_id, exam_subject_id, student_id, obtained_marks, correction_count, is_locked, entered_by)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?);
          `, [markId, schoolId, examSubjectId, studentId, obtainedMarks, lockMarks ? 1 : 0, req.user!.id]);
        } else {
          // If marks didn't change, just update lock if requested
          if (existing.obtained_marks === obtainedMarks) {
            if (lockMarks) {
              await execute('UPDATE marks SET is_locked = 1 WHERE id = ?;', [existing.id]);
            }
            continue;
          }

          // Marks changed! Check permissions & correction count rules
          if (existing.is_locked && !isPrincipalOrAdmin) {
            throw new Error(`Marks for student are finalized and locked. Only Principal can override.`);
          }

          if (!isPrincipalOrAdmin) {
            // Teacher role
            if (existing.correction_count >= 1) {
              throw new Error(`One-time edit limit already exhausted for student. Principal approval required.`);
            }

            // Allowed 1-time self correction
            await execute(`
              UPDATE marks
              SET obtained_marks = ?, correction_count = correction_count + 1,
                  is_locked = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?;
            `, [obtainedMarks, lockMarks ? 1 : 0, existing.id]);

            // Log correction
            const corId = 'cor-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
            await execute(`
              INSERT INTO mark_corrections (id, mark_id, old_value, new_value, reason, correction_type, performed_by)
              VALUES (?, ?, ?, ?, 'Teacher initial adjustment', 'teacher_one_time', ?);
            `, [corId, existing.id, existing.obtained_marks, obtainedMarks, req.user!.id]);
          } else {
            // Principal / Admin update
            await execute(`
              UPDATE marks
              SET obtained_marks = ?, is_locked = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?;
            `, [obtainedMarks, lockMarks ? 1 : 0, existing.id]);

            const corId = 'cor-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
            await execute(`
              INSERT INTO mark_corrections (id, mark_id, old_value, new_value, reason, correction_type, performed_by)
              VALUES (?, ?, ?, ?, ?, 'principal_override', ?);
            `, [corId, existing.id, existing.obtained_marks, obtainedMarks, entry.overrideReason || 'Administrative mark adjustment', req.user!.id]);
          }
        }
      }
    });

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'UPDATE_MARKS',
      module: 'EXAMS',
      recordId: examSubjectId,
      newValue: { count: marksEntries.length, isLocked: !!lockMarks },
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Marks saved successfully' });
  } catch (err: any) {
    console.error('Save marks error:', err);
    res.status(400).json({ error: err.message || 'Failed to save marks' });
  }
});

// 7. Principal Override of Single Mark Record with Reason
examsRouter.post('/marks/:markId/override', authenticate, requireRole(['PRINCIPAL', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { markId } = req.params;
    const { newValue, reason } = req.body;

    if (newValue === undefined || !reason || !reason.trim()) {
      res.status(400).json({ error: 'New mark value and mandatory audit reason are required' });
      return;
    }

    const mark = await queryOne('SELECT * FROM marks WHERE id = ?;', [markId]);
    if (!mark) {
      res.status(404).json({ error: 'Mark record not found' });
      return;
    }

    const oldValue = mark.obtained_marks;
    const numericNew = parseFloat(newValue);

    await transaction(async () => {
      await execute(`
        UPDATE marks
        SET obtained_marks = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?;
      `, [numericNew, markId]);

      const corId = 'cor-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      await execute(`
        INSERT INTO mark_corrections (id, mark_id, old_value, new_value, reason, correction_type, performed_by)
        VALUES (?, ?, ?, ?, ?, 'principal_override', ?);
      `, [corId, markId, oldValue, numericNew, reason.trim(), req.user!.id]);
    });

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'PRINCIPAL_MARK_OVERRIDE',
      module: 'EXAMS',
      recordId: markId,
      oldValue,
      newValue: numericNew,
      reason: reason.trim(),
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Mark overridden successfully with audit record' });
  } catch (err: any) {
    console.error('Principal mark override error:', err);
    res.status(500).json({ error: 'Failed to perform mark override' });
  }
});

// 8. Generate Student Report Card
examsRouter.get('/report-card/:studentId/:examId', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    let { studentId, examId } = req.params;

    if (studentId === 'me' || studentId === 'undefined' || !studentId) {
      if (req.user!.role === 'STUDENT' && req.user!.studentId) {
        studentId = req.user!.studentId;
      }
    }

    // Student identity
    const student = await queryOne(`
      SELECT s.*, c.name as class_name, c.id as class_id, sec.name as section_name, sec.id as section_id,
             sar.roll_number
      FROM students s
      JOIN student_academic_records sar ON s.id = sar.student_id
      JOIN classes c ON sar.class_id = c.id
      JOIN sections sec ON sar.section_id = sec.id
      WHERE s.id = ? AND s.school_id = ?;
    `, [studentId, schoolId]);

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // School details
    const school = await queryOne(`
      SELECT s.name as school_name, ss.logo_url, ss.address_line1, ss.city, ss.state, ss.phone, ss.principal_name
      FROM schools s
      LEFT JOIN school_settings ss ON s.id = ss.school_id
      WHERE s.id = ?;
    `, [schoolId]);

    // Exam details
    let exam;
    if (examId === 'latest') {
      exam = await queryOne(`
        SELECT e.*, ay.name as academic_year_name
        FROM exams e
        JOIN academic_years ay ON e.academic_year_id = ay.id
        WHERE e.school_id = ?
        ORDER BY e.start_date DESC, e.created_at DESC
        LIMIT 1;
      `, [schoolId]);
    } else {
      exam = await queryOne(`
        SELECT e.*, ay.name as academic_year_name
        FROM exams e
        JOIN academic_years ay ON e.academic_year_id = ay.id
        WHERE e.id = ? AND e.school_id = ?;
      `, [examId, schoolId]);

      // Fallback to latest exam in the school if specified ID not found
      if (!exam) {
        exam = await queryOne(`
          SELECT e.*, ay.name as academic_year_name
          FROM exams e
          JOIN academic_years ay ON e.academic_year_id = ay.id
          WHERE e.school_id = ?
          ORDER BY e.start_date DESC, e.created_at DESC
          LIMIT 1;
        `, [schoolId]);
      }
    }

    if (!exam) {
      res.json({
        school,
        student,
        exam: null,
        subjects: [],
        totalMaxMarks: 0,
        totalObtainedMarks: 0,
        overallPercentage: 0,
        overallGrade: '-',
        remarks: 'No Exams Published',
        summary: null
      });
      return;
    }

    // Marks for this student across all exam subjects
    const marksRows = await query(`
      SELECT es.id as exam_subject_id, es.max_marks, es.pass_marks, es.exam_date,
             sub.name as subject_name, sub.code as subject_code,
             m.obtained_marks, m.correction_count, m.is_locked
      FROM exam_subjects es
      JOIN subjects sub ON es.subject_id = sub.id
      LEFT JOIN marks m ON es.id = m.exam_subject_id AND m.student_id = ?
      WHERE es.exam_id = ? AND es.class_id = ?
      ORDER BY sub.name ASC;
    `, [studentId, exam.id, student.class_id]);

    // Calculate totals and grades
    let totalMaxMarks = 0;
    let totalObtainedMarks = 0;
    let hasFailedAny = false;

    const subjectResults = [];
    for (const row of marksRows) {
      const maxMarks = row.max_marks || 100;
      const obtainedMarks = row.obtained_marks !== null ? row.obtained_marks : 0;
      const passMarks = row.pass_marks || 35;
      const percentage = (obtainedMarks / maxMarks) * 100;
      const isPass = obtainedMarks >= passMarks;
      if (!isPass) hasFailedAny = true;

      totalMaxMarks += maxMarks;
      totalObtainedMarks += obtainedMarks;

      const gradeInfo = await calculateGrade(schoolId!, percentage);

      subjectResults.push({
        subjectName: row.subject_name,
        subjectCode: row.subject_code,
        subject_name: row.subject_name,
        subject_code: row.subject_code,
        maxMarks,
        max_marks: maxMarks,
        passMarks,
        pass_marks: passMarks,
        obtainedMarks,
        obtained_marks: obtainedMarks,
        marks_obtained: obtainedMarks,
        percentage: Math.round(percentage * 10) / 10,
        grade: gradeInfo.grade,
        gradePoint: gradeInfo.grade_point,
        grade_point: gradeInfo.grade_point,
        remarks: gradeInfo.remarks,
        isPass,
        is_passed: isPass
      });
    }

    const overallPercentage = totalMaxMarks > 0 ? Math.round((totalObtainedMarks / totalMaxMarks) * 1000) / 10 : 0;
    const overallGrade = await calculateGrade(schoolId!, overallPercentage);

    // Attendance stats for student
    const attStats = await queryOne(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN calculated_status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN calculated_status = 'half_day' THEN 1 ELSE 0 END) as half_days
      FROM student_attendance
      WHERE student_id = ?;
    `, [studentId]);

    const totalAttDays = attStats?.total_days || 0;
    const effectiveAtt = (attStats?.present_days || 0) + ((attStats?.half_days || 0) * 0.5);
    const attendancePercentage = totalAttDays > 0 ? Math.round((effectiveAtt / totalAttDays) * 100) : 100;

    res.json({
      school,
      student,
      exam,
      subjects: subjectResults,
      totalMaxMarks,
      total_max_marks: totalMaxMarks,
      totalObtainedMarks,
      total_obtained_marks: totalObtainedMarks,
      overallPercentage,
      overall_percentage: overallPercentage,
      overallGrade: overallGrade.grade,
      overall_grade: overallGrade.grade,
      remarks: hasFailedAny ? 'NEEDS IMPROVEMENT' : 'PASSED',
      summary: {
        totalMaxMarks,
        totalObtainedMarks,
        overallPercentage,
        overallGrade: overallGrade.grade,
        gradePoint: overallGrade.grade_point,
        resultStatus: hasFailedAny ? 'NEEDS IMPROVEMENT' : 'PASSED',
        attendancePercentage,
        totalAttDays,
        effectiveAtt
      }
    });
  } catch (err: any) {
    console.error('Generate report card error:', err);
    res.status(500).json({ error: 'Failed to generate report card' });
  }
});
