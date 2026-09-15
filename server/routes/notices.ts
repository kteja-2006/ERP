import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../db/database.ts';
import { authenticate, requireRole } from '../middlewares/auth.ts';
import { logAudit } from '../utils/audit.ts';

export const noticesRouter = Router();

// 1. Get Notices for Current User / Tenant
noticesRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const userRole = req.user!.role;
    let sql = `
      SELECT n.*, u.user_id as publisher_code,
             c.name as class_name, s.name as section_name
      FROM notices n
      LEFT JOIN users u ON n.published_by = u.id
      LEFT JOIN classes c ON n.target_class_id = c.id
      LEFT JOIN sections s ON n.target_section_id = s.id
      WHERE n.school_id = ?
    `;
    const params: any[] = [schoolId];

    // Filter by target audience depending on role
    if (userRole === 'STUDENT') {
      sql += ` AND (n.target_audience = 'all' OR n.target_audience = 'students')`;
    } else if (userRole === 'FACULTY') {
      sql += ` AND (n.target_audience = 'all' OR n.target_audience = 'faculty')`;
    }

    sql += ` ORDER BY n.created_at DESC LIMIT 50;`;

    const notices = await query(sql, params);
    res.json({ notices });
  } catch (err: any) {
    console.error('Fetch notices error:', err);
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

// 2. Create Notice (Principal, Office, Super Admin)
noticesRouter.post('/', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { title, content, targetAudience = 'all', targetClassId, targetSectionId } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' });
      return;
    }

    const noticeId = 'nt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    await execute(`
      INSERT INTO notices (id, school_id, title, content, target_audience, target_class_id, target_section_id, published_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      noticeId,
      schoolId,
      title.trim(),
      content.trim(),
      targetAudience,
      targetClassId || null,
      targetSectionId || null,
      req.user!.id,
    ]);

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'CREATE_NOTICE',
      module: 'NOTICES',
      recordId: noticeId,
      newValue: { title, targetAudience },
      ipAddress: req.ip,
    });

    const created = await queryOne('SELECT * FROM notices WHERE id = ?;', [noticeId]);
    res.status(201).json({ notice: created, message: 'Notice published successfully' });
  } catch (err: any) {
    console.error('Publish notice error:', err);
    res.status(500).json({ error: 'Failed to publish notice' });
  }
});

// 3. Delete Notice
noticesRouter.delete('/:id', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { id } = req.params;

    const notice = await queryOne('SELECT * FROM notices WHERE id = ? AND school_id = ?;', [id, schoolId]);
    if (!notice) {
      res.status(404).json({ error: 'Notice not found' });
      return;
    }

    await execute('DELETE FROM notices WHERE id = ?;', [id]);

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'DELETE_NOTICE',
      module: 'NOTICES',
      recordId: id,
      oldValue: { title: notice.title },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Notice deleted successfully' });
  } catch (err: any) {
    console.error('Delete notice error:', err);
    res.status(500).json({ error: 'Failed to delete notice' });
  }
});
