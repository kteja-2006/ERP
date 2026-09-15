import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { authenticate, requireRole } from '../middlewares/auth.ts';
import { logAudit } from '../utils/audit.ts';

export const studentsRouter = Router();

// 1. List Students with filtering and search
studentsRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { classId, sectionId, status, search } = req.query;

    let sql = `
      SELECT s.*,
             sar.class_id, sar.section_id, sar.roll_number, sar.promotion_status,
             c.name as class_name, c.class_code,
             sec.name as section_name,
             u.mobile_number as user_mobile
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN student_academic_records sar ON s.id = sar.student_id
      LEFT JOIN classes c ON sar.class_id = c.id
      LEFT JOIN sections sec ON sar.section_id = sec.id
      WHERE (s.school_id = ? OR ? IS NULL)
    `;

    const params: any[] = [schoolId, schoolId];

    if (classId) {
      sql += ` AND sar.class_id = ?`;
      params.push(classId);
    }

    if (sectionId) {
      sql += ` AND sar.section_id = ?`;
      params.push(sectionId);
    }

    if (status) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (
        s.first_name LIKE ? OR
        s.last_name LIKE ? OR
        s.admission_number LIKE ? OR
        u.mobile_number LIKE ? OR
        s.guardian_mobile LIKE ?
      )`;
      const searchWild = `%${String(search).trim()}%`;
      params.push(searchWild, searchWild, searchWild, searchWild, searchWild);
    }

    sql += ` ORDER BY c.display_order ASC, sec.name ASC, sar.roll_number ASC, s.admission_number ASC`;

    const students = await query(sql, params);
    res.json({ students });
  } catch (err: any) {
    console.error('Fetch students error:', err);
    res.status(500).json({ error: 'Failed to fetch students list' });
  }
});

// 2. Check for Sibling Records via Mobile Number
studentsRouter.get('/check-guardian', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const mobile = req.query.mobile ? String(req.query.mobile).trim() : '';

    if (!mobile) {
      res.json({ siblings: [] });
      return;
    }

    const siblings = await query(`
      SELECT s.id, s.admission_number, s.first_name, s.last_name, s.guardian_name,
             c.name as class_name, sec.name as section_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN student_academic_records sar ON s.id = sar.student_id
      LEFT JOIN classes c ON sar.class_id = c.id
      LEFT JOIN sections sec ON sar.section_id = sec.id
      WHERE (u.mobile_number = ? OR s.guardian_mobile = ? OR s.father_mobile = ? OR s.mother_mobile = ?)
        AND s.school_id = ?
    `, [mobile, mobile, mobile, mobile, schoolId]);

    res.json({ siblings });
  } catch (err: any) {
    console.error('Check guardian error:', err);
    res.status(500).json({ error: 'Failed to check guardian records' });
  }
});

// 3. Preview Next Permanent Admission Number (YY + 3-digit Class ID + 3-digit Serial)
studentsRouter.get('/next-admission-preview', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const classId = req.query.classId ? String(req.query.classId) : '';

    const yearPrefix = new Date().getFullYear().toString().slice(-2); // e.g. "26"

    let classCodeFormatted = '001';
    if (classId) {
      const cls = await queryOne('SELECT class_code FROM classes WHERE id = ?', [classId]);
      if (cls && cls.class_code) {
        classCodeFormatted = cls.class_code.padStart(3, '0').slice(-3);
      }
    }

    // Check last serial from admission_sequences
    const seq = await queryOne(`
      SELECT last_serial FROM admission_sequences
      WHERE school_id = ? AND year_prefix = ? AND class_code = ?
    `, [schoolId, yearPrefix, classCodeFormatted]);

    const nextSerial = seq ? seq.last_serial + 1 : 1;
    const serialFormatted = nextSerial.toString().padStart(3, '0');
    const previewNumber = `${yearPrefix}${classCodeFormatted}${serialFormatted}`;

    res.json({
      yearPrefix,
      classCode: classCodeFormatted,
      serial: nextSerial,
      previewAdmissionNumber: previewNumber,
    });
  } catch (err: any) {
    console.error('Preview admission error:', err);
    res.status(500).json({ error: 'Failed to preview admission number' });
  }
});

// 4. Get Student 360 Full Profile
studentsRouter.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    let studentId = req.params.id;

    if (studentId === 'me' || studentId === 'undefined' || !studentId) {
      if (req.user?.role === 'STUDENT' && req.user.studentId) {
        studentId = req.user.studentId;
      } else {
        res.status(400).json({ error: 'Valid Student ID is required' });
        return;
      }
    }

    const student = await queryOne(`
      SELECT s.*,
             u.user_id, u.mobile_number as user_mobile, u.email as user_email,
             sar.class_id, sar.section_id, sar.roll_number, sar.promotion_status, sar.academic_year_id,
             c.name as class_name, c.class_code,
             sec.name as section_name,
             ay.name as academic_year_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN student_academic_records sar ON s.id = sar.student_id
      LEFT JOIN classes c ON sar.class_id = c.id
      LEFT JOIN sections sec ON sar.section_id = sec.id
      LEFT JOIN academic_years ay ON sar.academic_year_id = ay.id
      WHERE s.id = ? AND (s.school_id = ? OR ? IS NULL)
    `, [studentId, schoolId, schoolId]);

    if (!student) {
      res.status(404).json({ error: 'Student not found in this school' });
      return;
    }

    // Role-based privacy restriction:
    // If student is logged in, they can ONLY view their own profile!
    if (req.user!.role === 'STUDENT' && req.user!.studentId !== student.id) {
      res.status(403).json({ error: 'Unauthorized: Students can only view their own profile.' });
      return;
    }

    // Documents
    const documents = await query(`
      SELECT sd.*, dr.title as requirement_title, dr.description as requirement_description, dr.is_required
      FROM student_documents sd
      JOIN document_requirements dr ON sd.requirement_id = dr.id
      WHERE sd.student_id = ?
    `, [studentId]);

    // Fees Assignment Summary
    const feeAssignments = await query(`
      SELECT sfa.*, fs.term_name as fee_structure_name, fs.term_name as term
      FROM student_fee_assignments sfa
      JOIN fee_structures fs ON sfa.fee_structure_id = fs.id
      WHERE sfa.student_id = ?
    `, [studentId]);

    // Payments / Receipts
    const payments = await query(`
      SELECT p.*
      FROM payments p
      JOIN student_fee_assignments sfa ON p.student_fee_assignment_id = sfa.id
      WHERE sfa.student_id = ?
      ORDER BY p.created_at DESC
    `, [studentId]);

    // Siblings
    const siblings = await query(`
      SELECT s.id, s.admission_number, s.first_name, s.last_name, c.name as class_name
      FROM students s
      LEFT JOIN student_academic_records sar ON s.id = sar.student_id
      LEFT JOIN classes c ON sar.class_id = c.id
      WHERE s.school_id = ? AND s.id != ?
        AND (s.guardian_mobile = ? OR s.father_mobile = ?)
    `, [schoolId, studentId, student.guardian_mobile || student.user_mobile, student.guardian_mobile || student.user_mobile]);

    res.json({
      student,
      documents,
      feeAssignments,
      payments,
      siblings,
    });
  } catch (err: any) {
    console.error('Fetch student details error:', err);
    res.status(500).json({ error: 'Failed to fetch student profile' });
  }
});

// 5. New Student Admission (Office & Principal only)
studentsRouter.post('/admission', authenticate, requireRole(['OFFICE', 'PRINCIPAL']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      bloodGroup,
      admissionDate,
      previousSchool,
      fatherName,
      fatherMobile,
      fatherOccupation,
      motherName,
      motherMobile,
      guardianName,
      guardianMobile,
      addressLine1,
      city,
      state,
      postalCode,
      emergencyContact,
      classId,
      sectionId,
      academicYearId,
    } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !gender || !classId || !sectionId) {
      res.status(400).json({ error: 'Missing required admission fields (name, DOB, gender, class, section)' });
      return;
    }

    const effectiveMobile = guardianMobile || fatherMobile || motherMobile || '0000000000';

    const cls = await queryOne('SELECT class_code FROM classes WHERE id = ?', [classId]);
    const classCode = cls ? cls.class_code.padStart(3, '0').slice(-3) : '001';
    const yearPrefix = new Date().getFullYear().toString().slice(-2);

    let createdStudent: any = null;
    let generatedAdmissionNumber = '';
    let studentUserId = '';

    await transaction(async () => {
      // 1. Calculate next serial atomically
      const existingSeq = await queryOne(`
        SELECT last_serial FROM admission_sequences
        WHERE school_id = ? AND year_prefix = ? AND class_code = ?
      `, [schoolId, yearPrefix, classCode]);

      let newSerial = 1;
      if (existingSeq) {
        newSerial = existingSeq.last_serial + 1;
        await execute(`
          UPDATE admission_sequences
          SET last_serial = ?
          WHERE school_id = ? AND year_prefix = ? AND class_code = ?
        `, [newSerial, schoolId, yearPrefix, classCode]);
      } else {
        await execute(`
          INSERT INTO admission_sequences (school_id, year_prefix, class_code, last_serial)
          VALUES (?, ?, ?, 1)
        `, [schoolId, yearPrefix, classCode]);
      }

      generatedAdmissionNumber = `${yearPrefix}${classCode}${newSerial.toString().padStart(3, '0')}`;
      studentUserId = `STU${generatedAdmissionNumber}`;

      // 2. Create User Account
      const userUuid = 'usr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const defaultPassword = 'password123';
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);

      await execute(`
        INSERT INTO users (id, school_id, user_id, mobile_number, password_hash, role_id, status)
        VALUES (?, ?, ?, ?, ?, 'STUDENT', 'active')
      `, [userUuid, schoolId, studentUserId, effectiveMobile.trim(), passwordHash]);

      // 3. Create Student Master Record
      const studentUuid = 'stu-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      await execute(`
        INSERT INTO students (
          id, school_id, user_id, admission_number, first_name, middle_name, last_name,
          date_of_birth, gender, blood_group, admission_date, previous_school,
          father_name, father_mobile, father_occupation, mother_name, mother_mobile,
          guardian_name, guardian_mobile, address_line1, city, state, postal_code,
          emergency_contact, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, 'active'
        )
      `, [
        studentUuid, schoolId, userUuid, generatedAdmissionNumber, firstName.trim(), middleName ? middleName.trim() : null, lastName.trim(),
        dateOfBirth, gender, bloodGroup || null, admissionDate || new Date().toISOString().split('T')[0], previousSchool || null,
        fatherName || null, fatherMobile || null, fatherOccupation || null, motherName || null, motherMobile || null,
        guardianName || fatherName || motherName || 'Parent', effectiveMobile.trim(), addressLine1 || null, city || null, state || null, postalCode || null,
        emergencyContact || effectiveMobile.trim(),
      ]);

      // 4. Determine Roll Number for Section
      const rollRecord = await queryOne(`
        SELECT MAX(roll_number) as max_roll
        FROM student_academic_records
        WHERE school_id = ? AND class_id = ? AND section_id = ?
      `, [schoolId, classId, sectionId]);

      const nextRollNumber = rollRecord && rollRecord.max_roll ? rollRecord.max_roll + 1 : 1;

      // Get active academic year if not provided
      let effectiveAyId = academicYearId;
      if (!effectiveAyId) {
        const activeAy = await queryOne('SELECT id FROM academic_years WHERE school_id = ? AND is_active = 1', [schoolId]);
        effectiveAyId = activeAy ? activeAy.id : null;
      }

      if (effectiveAyId) {
        const sarUuid = 'sar-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        await execute(`
          INSERT INTO student_academic_records (id, school_id, student_id, academic_year_id, class_id, section_id, roll_number, promotion_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'enrolled')
        `, [sarUuid, schoolId, studentUuid, effectiveAyId, classId, sectionId, nextRollNumber]);
      }

      // 5. Initialize mandatory document placeholders
      const reqs = await query('SELECT id, title FROM document_requirements WHERE school_id = ?', [schoolId]);
      for (const r of reqs) {
        const docId = 'doc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        await execute(`
          INSERT INTO student_documents (id, school_id, student_id, requirement_id, file_url, file_name, status)
          VALUES (?, ?, ?, ?, '', 'Pending Submission', 'uploaded')
        `, [docId, schoolId, studentUuid, r.id]);
      }

      createdStudent = {
        id: studentUuid,
        userId: studentUserId,
        admissionNumber: generatedAdmissionNumber,
        firstName,
        lastName,
        rollNumber: nextRollNumber,
      };
    });

    // Write Audit Log
    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'CREATE_STUDENT_ADMISSION',
      module: 'students',
      recordId: createdStudent.id,
      newValue: { admissionNumber: generatedAdmissionNumber, userId: studentUserId },
      reason: `Admitted student ${firstName} ${lastName} into Class ID ${classId}`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Student admitted successfully with permanent admission number ${generatedAdmissionNumber}`,
      student: createdStudent,
      initialCredentials: {
        userId: studentUserId,
        password: 'password123',
      },
    });
  } catch (err: any) {
    console.error('Create admission error:', err);
    res.status(500).json({ error: err.message || 'Failed to process student admission' });
  }
});

// 6. Update Student Information
studentsRouter.put('/:id', authenticate, requireRole(['OFFICE', 'PRINCIPAL']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const studentId = req.params.id;

    const current = await queryOne('SELECT * FROM students WHERE id = ? AND school_id = ?', [studentId, schoolId]);
    if (!current) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      bloodGroup,
      fatherName,
      fatherMobile,
      fatherOccupation,
      motherName,
      motherMobile,
      guardianName,
      guardianMobile,
      addressLine1,
      city,
      state,
      postalCode,
      emergencyContact,
      status,
    } = req.body;

    await execute(`
      UPDATE students SET
        first_name = COALESCE(?, first_name),
        middle_name = ?,
        last_name = COALESCE(?, last_name),
        date_of_birth = COALESCE(?, date_of_birth),
        gender = COALESCE(?, gender),
        blood_group = ?,
        father_name = ?,
        father_mobile = ?,
        father_occupation = ?,
        mother_name = ?,
        mother_mobile = ?,
        guardian_name = ?,
        guardian_mobile = ?,
        address_line1 = ?,
        city = ?,
        state = ?,
        postal_code = ?,
        emergency_contact = ?,
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND school_id = ?
    `, [
      firstName, middleName || null, lastName, dateOfBirth, gender, bloodGroup || null,
      fatherName || null, fatherMobile || null, fatherOccupation || null, motherName || null, motherMobile || null,
      guardianName || null, guardianMobile || null, addressLine1 || null, city || null, state || null, postalCode || null,
      emergencyContact || null, status,
      studentId, schoolId,
    ]);

    // If guardian mobile updated, update user mobile as well
    if (guardianMobile || fatherMobile) {
      const mob = guardianMobile || fatherMobile;
      await execute('UPDATE users SET mobile_number = ? WHERE id = ?', [mob, current.user_id]);
    }

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'UPDATE_STUDENT_PROFILE',
      module: 'students',
      recordId: studentId,
      oldValue: current,
      newValue: req.body,
      reason: 'Office updated student demographic details',
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Student details updated successfully' });
  } catch (err: any) {
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});
