import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../db/database.ts';
import { authenticate, requireRole } from '../middlewares/auth.ts';
import { logAudit } from '../utils/audit.ts';

export const documentsRouter = Router();

// 1. Get School Document Requirements
documentsRouter.get('/requirements', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const requirements = await query(`
      SELECT * FROM document_requirements
      WHERE school_id = ? OR ? IS NULL
      ORDER BY is_required DESC, title ASC
    `, [schoolId, schoolId]);

    res.json({ requirements });
  } catch (err: any) {
    console.error('Fetch document requirements error:', err);
    res.status(500).json({ error: 'Failed to fetch document requirements' });
  }
});

// 2. Add New Document Requirement (Office & Principal)
documentsRouter.post('/requirements', authenticate, requireRole(['OFFICE', 'PRINCIPAL']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { title, description, isRequired = true } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Requirement title is required' });
      return;
    }

    const id = 'dr-' + Date.now();
    await execute(`
      INSERT INTO document_requirements (id, school_id, title, description, is_required)
      VALUES (?, ?, ?, ?, ?)
    `, [id, schoolId, title.trim(), description || null, isRequired ? 1 : 0]);

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'CREATE_DOCUMENT_REQUIREMENT',
      module: 'documents',
      recordId: id,
      newValue: { title, isRequired },
      reason: 'Configured new school-wide document requirement',
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Document requirement added' });
  } catch (err: any) {
    console.error('Add document requirement error:', err);
    res.status(500).json({ error: 'Failed to add document requirement' });
  }
});

// 3. Get Student Documents
documentsRouter.get('/student/:studentId', authenticate, async (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;
    const documents = await query(`
      SELECT sd.*, dr.title as requirement_title, dr.description as requirement_description, dr.is_required,
             u.user_id as reviewer_user_id
      FROM student_documents sd
      JOIN document_requirements dr ON sd.requirement_id = dr.id
      LEFT JOIN users u ON sd.reviewed_by = u.id
      WHERE sd.student_id = ?
      ORDER BY dr.is_required DESC, sd.created_at DESC
    `, [studentId]);

    res.json({ documents });
  } catch (err: any) {
    console.error('Fetch student documents error:', err);
    res.status(500).json({ error: 'Failed to fetch student documents' });
  }
});

// 4. Upload/Attach Document for Student
documentsRouter.post('/upload', authenticate, async (req: Request, res: Response) => {
  try {
    const { studentId, requirementId, fileName, fileUrl = '/uploads/sample_doc.pdf' } = req.body;
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);

    if (!studentId || !requirementId || !fileName) {
      res.status(400).json({ error: 'studentId, requirementId, and fileName are required' });
      return;
    }

    // Role check: Students can only upload for themselves
    if (req.user!.role === 'STUDENT' && req.user!.studentId !== studentId) {
      res.status(403).json({ error: 'Unauthorized to upload documents for other students' });
      return;
    }

    const existing = await queryOne(`
      SELECT id FROM student_documents
      WHERE student_id = ? AND requirement_id = ?
    `, [studentId, requirementId]);

    if (existing) {
      await execute(`
        UPDATE student_documents SET
          file_name = ?,
          file_url = ?,
          status = 'under_review',
          remarks = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [fileName, fileUrl, existing.id]);
    } else {
      const docId = 'doc-' + Date.now();
      await execute(`
        INSERT INTO student_documents (id, school_id, student_id, requirement_id, file_url, file_name, status)
        VALUES (?, ?, ?, ?, ?, ?, 'under_review')
      `, [docId, schoolId, studentId, requirementId, fileUrl, fileName]);
    }

    res.json({ success: true, message: 'Document submitted for review' });
  } catch (err: any) {
    console.error('Upload document error:', err);
    res.status(500).json({ error: 'Failed to submit document' });
  }
});

// 5. Review (Approve/Reject) Document (Office & Principal)
documentsRouter.put('/:id/review', authenticate, requireRole(['OFFICE', 'PRINCIPAL']), async (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    const { status, remarks } = req.body;

    if (!['approved', 'rejected', 'under_review'].includes(status)) {
      res.status(400).json({ error: 'Status must be approved, rejected, or under_review' });
      return;
    }

    const doc = await queryOne('SELECT * FROM student_documents WHERE id = ?', [docId]);
    if (!doc) {
      res.status(404).json({ error: 'Document record not found' });
      return;
    }

    await execute(`
      UPDATE student_documents SET
        status = ?,
        remarks = ?,
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, remarks || null, req.user!.id, docId]);

    await logAudit({
      schoolId: doc.school_id,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'REVIEW_DOCUMENT',
      module: 'documents',
      recordId: docId,
      newValue: { status, remarks },
      reason: `Document marked as ${status}: ${remarks || 'Verified by admin'}`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Document marked as ${status}` });
  } catch (err: any) {
    console.error('Review document error:', err);
    res.status(500).json({ error: 'Failed to review document' });
  }
});
