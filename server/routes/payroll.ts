import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../db/database.ts';
import { authenticate, requireRole } from '../middlewares/auth.ts';
import { logAudit } from '../utils/audit.ts';

export const payrollRouter = Router();

// 1. Get Faculty Salary Structures
payrollRouter.get('/structures', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const facultyList = await query(`
      SELECT f.id as faculty_id, f.first_name, f.last_name, f.employee_code, f.designation, f.department,
             ss.id as structure_id,
             COALESCE(ss.basic_salary, 0) as basic_salary,
             COALESCE(ss.allowances, 0) as allowances,
             COALESCE(ss.deductions, 0) as deductions,
             COALESCE(ss.net_salary, 0) as net_salary,
             ss.updated_at
      FROM faculty f
      LEFT JOIN salary_structures ss ON f.id = ss.faculty_id
      WHERE f.school_id = ? AND f.status = 'active'
      ORDER BY f.first_name ASC;
    `, [schoolId]);

    res.json({ structures: facultyList });
  } catch (err: any) {
    console.error('Fetch salary structures error:', err);
    res.status(500).json({ error: 'Failed to fetch salary structures' });
  }
});

// 2. Set / Update Salary Structure for Faculty
payrollRouter.post('/structures', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { facultyId, basicSalary, allowances = 0, deductions = 0 } = req.body;
    if (!facultyId || basicSalary === undefined || basicSalary < 0) {
      res.status(400).json({ error: 'Valid faculty ID and non-negative basic salary are required' });
      return;
    }

    const basic = Number(basicSalary);
    const allow = Number(allowances);
    const ded = Number(deductions);
    const net = Math.max(0, basic + allow - ded);

    const existing = await queryOne('SELECT id FROM salary_structures WHERE faculty_id = ?;', [facultyId]);

    if (existing) {
      await execute(`
        UPDATE salary_structures
        SET basic_salary = ?, allowances = ?, deductions = ?, net_salary = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?;
      `, [basic, allow, ded, net, existing.id]);
    } else {
      const structId = 'ss-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      await execute(`
        INSERT INTO salary_structures (id, school_id, faculty_id, basic_salary, allowances, deductions, net_salary)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `, [structId, schoolId, facultyId, basic, allow, ded, net]);
    }

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'UPDATE_SALARY_STRUCTURE',
      module: 'PAYROLL',
      recordId: facultyId,
      newValue: { basic, allowances: allow, deductions: ded, netSalary: net },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Salary structure updated successfully' });
  } catch (err: any) {
    console.error('Update salary structure error:', err);
    res.status(500).json({ error: 'Failed to update salary structure' });
  }
});

// 3. Get Monthly Payroll Disbursements
payrollRouter.get('/disbursements', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { month } = req.query;

    let sql = `
      SELECT sp.*, f.first_name, f.last_name, f.employee_code, f.designation, f.department
      FROM salary_payments sp
      JOIN faculty f ON sp.faculty_id = f.id
      WHERE sp.school_id = ?
    `;
    const params: any[] = [schoolId];

    if (month) {
      sql += ` AND sp.salary_month = ?`;
      params.push(month);
    }

    sql += ` ORDER BY sp.created_at DESC;`;

    const disbursements = await query(sql, params);
    res.json({ disbursements });
  } catch (err: any) {
    console.error('Fetch disbursements error:', err);
    res.status(500).json({ error: 'Failed to fetch payroll disbursements' });
  }
});

// 4. Generate Monthly Payroll Batch
payrollRouter.post('/generate-month', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { month } = req.body; // e.g. "2026-09"

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'Valid salary month in YYYY-MM format required (e.g. 2026-09)' });
      return;
    }

    // Get all faculty with an active salary structure
    const structures = await query(`
      SELECT ss.*, f.first_name, f.last_name
      FROM salary_structures ss
      JOIN faculty f ON ss.faculty_id = f.id
      WHERE ss.school_id = ? AND f.status = 'active';
    `, [schoolId]);

    if (structures.length === 0) {
      res.status(400).json({ error: 'No faculty salary structures found. Please define salary structures first.' });
      return;
    }

    let createdCount = 0;
    for (const s of structures) {
      const existing = await queryOne(`
        SELECT id FROM salary_payments WHERE faculty_id = ? AND salary_month = ?;
      `, [s.faculty_id, month]);

      if (!existing) {
        const payId = 'sp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
        await execute(`
          INSERT INTO salary_payments (
            id, school_id, faculty_id, salary_month, basic_salary, allowances, bonuses, deductions, advances,
            net_payable, status, processed_by
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 'pending', ?);
        `, [
          payId,
          schoolId,
          s.faculty_id,
          month,
          s.basic_salary,
          s.allowances,
          s.deductions,
          s.net_salary,
          req.user!.id,
        ]);
        createdCount++;
      }
    }

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'GENERATE_MONTHLY_PAYROLL',
      module: 'PAYROLL',
      newValue: { month, createdCount },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Generated payroll records for ${createdCount} faculty for month ${month}`,
      createdCount,
    });
  } catch (err: any) {
    console.error('Generate payroll error:', err);
    res.status(500).json({ error: 'Failed to generate payroll batch' });
  }
});

// 5. Disburse Salary Payment
payrollRouter.post('/pay/:id', authenticate, requireRole(['PRINCIPAL', 'OFFICE', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { id } = req.params;
    const { paymentMethod = 'bank_transfer', referenceNumber = '' } = req.body;

    const payment = await queryOne('SELECT * FROM salary_payments WHERE id = ? AND school_id = ?;', [id, schoolId]);
    if (!payment) {
      res.status(404).json({ error: 'Salary payment record not found' });
      return;
    }

    if (payment.status === 'paid') {
      res.status(400).json({ error: 'Salary has already been marked as paid' });
      return;
    }

    const refNo = referenceNumber.trim() || `SAL-${payment.salary_month}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await execute(`
      UPDATE salary_payments
      SET status = 'paid', payment_method = ?, reference_number = ?, paid_at = CURRENT_TIMESTAMP, processed_by = ?
      WHERE id = ?;
    `, [paymentMethod, refNo, req.user!.id, id]);

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'DISBURSE_SALARY',
      module: 'PAYROLL',
      recordId: id,
      newValue: { facultyId: payment.faculty_id, month: payment.salary_month, amount: payment.net_payable, paymentMethod, referenceNumber: refNo },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Salary payment disbursed successfully. Ref: ${refNo}` });
  } catch (err: any) {
    console.error('Disburse salary error:', err);
    res.status(500).json({ error: 'Failed to disburse salary payment' });
  }
});

// 6. Get Single Detailed Payslip
payrollRouter.get('/payslip/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { id } = req.params;

    const slip = await queryOne(`
      SELECT sp.*,
             f.first_name, f.last_name, f.employee_code, f.designation, f.department, f.joining_date,
             s.name as school_name, ss.logo_url, ss.address_line1, ss.city, ss.phone, ss.email as school_email
      FROM salary_payments sp
      JOIN faculty f ON sp.faculty_id = f.id
      JOIN schools s ON sp.school_id = s.id
      LEFT JOIN school_settings ss ON s.id = ss.school_id
      WHERE sp.id = ? AND (sp.school_id = ? OR ? IS NULL);
    `, [id, schoolId, schoolId]);

    if (!slip) {
      res.status(404).json({ error: 'Payslip not found' });
      return;
    }

    // Security check: If faculty, can only view own payslip
    if (req.user!.role === 'FACULTY') {
      const faculty = await queryOne('SELECT id FROM faculty WHERE user_id = ?;', [req.user!.id]);
      if (!faculty || faculty.id !== slip.faculty_id) {
        res.status(403).json({ error: 'Access forbidden: You can only view your own payslips' });
        return;
      }
    }

    res.json({ payslip: slip });
  } catch (err: any) {
    console.error('Fetch payslip error:', err);
    res.status(500).json({ error: 'Failed to fetch payslip' });
  }
});

// 7. Get My Payslips (For Faculty)
payrollRouter.get('/my', authenticate, requireRole(['FACULTY']), async (req: Request, res: Response) => {
  try {
    const faculty = await queryOne('SELECT id FROM faculty WHERE user_id = ?;', [req.user!.id]);
    if (!faculty) {
      res.status(404).json({ error: 'Faculty profile not found for user' });
      return;
    }

    const structure = await queryOne('SELECT * FROM salary_structures WHERE faculty_id = ?;', [faculty.id]);
    const payments = await query(`
      SELECT * FROM salary_payments WHERE faculty_id = ? ORDER BY salary_month DESC;
    `, [faculty.id]);

    res.json({
      structure: structure || null,
      payments,
    });
  } catch (err: any) {
    console.error('Fetch my payslips error:', err);
    res.status(500).json({ error: 'Failed to fetch payslips' });
  }
});
