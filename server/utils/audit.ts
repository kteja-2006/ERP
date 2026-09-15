import { execute } from '../db/database.ts';

export async function logAudit(params: {
  schoolId?: string | null;
  userId: string;
  roleId: string;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    const id = 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    await execute(`
      INSERT INTO audit_logs (id, school_id, user_id, role_id, action, module, record_id, old_value, new_value, reason, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      params.schoolId || null,
      params.userId,
      params.roleId,
      params.action,
      params.module,
      params.recordId || null,
      params.oldValue ? JSON.stringify(params.oldValue) : null,
      params.newValue ? JSON.stringify(params.newValue) : null,
      params.reason || null,
      params.ipAddress || null,
    ]);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
