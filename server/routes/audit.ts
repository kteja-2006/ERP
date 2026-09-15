import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/database.ts';
import { authenticate, requireRole } from '../middlewares/auth.ts';

export const auditRouter = Router();

// 1. Get Audit Logs (Principal and Super Admin)
auditRouter.get('/logs', authenticate, requireRole(['PRINCIPAL', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { module, action, limit = 50 } = req.query;

    let sql = `
      SELECT a.*, u.user_id as actor_user_id
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Super Admin can view all or filter by school, Principal is strictly bounded by their school
    if (req.user!.role !== 'SUPER_ADMIN' || schoolId) {
      sql += ` AND (a.school_id = ? OR a.school_id IS NULL)`;
      params.push(schoolId);
    }

    if (module) {
      sql += ` AND a.module = ?`;
      params.push(module);
    }

    if (action) {
      sql += ` AND a.action = ?`;
      params.push(action);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT ?;`;
    params.push(Number(limit) || 50);

    const logs = await query(sql, params);
    res.json({ logs });
  } catch (err: any) {
    console.error('Fetch audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// 2. Get Audit Statistics / Summary
auditRouter.get('/stats', authenticate, requireRole(['PRINCIPAL', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);

    const totalLogs = await queryOne(`
      SELECT COUNT(*) as count FROM audit_logs WHERE (school_id = ? OR ? IS NULL);
    `, [schoolId, schoolId]);

    const moduleCounts = await query(`
      SELECT module, COUNT(*) as count
      FROM audit_logs
      WHERE (school_id = ? OR ? IS NULL)
      GROUP BY module
      ORDER BY count DESC;
    `, [schoolId, schoolId]);

    res.json({
      totalLogs: totalLogs?.count || 0,
      byModule: moduleCounts,
    });
  } catch (err: any) {
    console.error('Fetch audit stats error:', err);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});
