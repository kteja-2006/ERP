import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { authenticate, requireRole } from '../middlewares/auth.ts';
import { logAudit } from '../utils/audit.ts';

export const feesRouter = Router();

// Helper to generate sequential receipt number: YYYY-XXXXXX
async function getNextReceiptNumber(schoolId: string): Promise<string> {
  const currentYear = new Date().getFullYear().toString();
  const lastPayment = await queryOne(`
    SELECT receipt_number FROM payments
    WHERE school_id = ? AND receipt_number LIKE ?
    ORDER BY receipt_number DESC
    LIMIT 1;
  `, [schoolId, `${currentYear}-%`]);

  let nextSerial = 1;
  if (lastPayment && lastPayment.receipt_number) {
    const parts = lastPayment.receipt_number.split('-');
    if (parts.length === 2) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) {
        nextSerial = parsed + 1;
      }
    }
  }

  const paddedSerial = nextSerial.toString().padStart(6, '0');
  return `${currentYear}-${paddedSerial}`;
}

// 1. List Fee Structures by Class
feesRouter.get('/structures', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const structures = await query(`
      SELECT fs.*, c.name as class_name, ay.name as academic_year_name,
             (SELECT SUM(amount) FROM fee_structure_items fsi WHERE fsi.fee_structure_id = fs.id) as total_amount
      FROM fee_structures fs
      JOIN classes c ON fs.class_id = c.id
      JOIN academic_years ay ON fs.academic_year_id = ay.id
      WHERE fs.school_id = ?
      ORDER BY c.display_order ASC, fs.term_name ASC;
    `, [schoolId]);

    // Attach items
    for (const fs of structures) {
      fs.items = await query(`
        SELECT fsi.*, fc.name as category_name
        FROM fee_structure_items fsi
        JOIN fee_categories fc ON fsi.fee_category_id = fc.id
        WHERE fsi.fee_structure_id = ?;
      `, [fs.id]);
    }

    res.json({ structures });
  } catch (err: any) {
    console.error('Fetch fee structures error:', err);
    res.status(500).json({ error: 'Failed to fetch fee structures' });
  }
});

// 2. Get Student Fee Profile & Payment History
feesRouter.get('/student/:studentId', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    let { studentId } = req.params;

    if (studentId === 'me' || studentId === 'undefined' || !studentId) {
      if (req.user!.role === 'STUDENT' && req.user!.studentId) {
        studentId = req.user!.studentId;
      }
    }

    // Check student authorization
    if (req.user!.role === 'STUDENT') {
      const student = await queryOne('SELECT id FROM students WHERE user_id = ?;', [req.user!.id]);
      if (!student || student.id !== studentId) {
        res.status(403).json({ error: 'Unauthorized to view other students fee details' });
        return;
      }
    }

    const assignments = await query(`
      SELECT sfa.*, fs.term_name, c.name as class_name,
             (sfa.net_payable - sfa.paid_amount) as balance_due
      FROM student_fee_assignments sfa
      JOIN fee_structures fs ON sfa.fee_structure_id = fs.id
      JOIN classes c ON fs.class_id = c.id
      WHERE sfa.student_id = ? AND sfa.school_id = ?
      ORDER BY sfa.created_at DESC;
    `, [studentId, schoolId]);

    const payments = await query(`
      SELECT p.*, sfa.fee_structure_id, fs.term_name, u.user_id as cashier_code
      FROM payments p
      JOIN student_fee_assignments sfa ON p.student_fee_assignment_id = sfa.id
      JOIN fee_structures fs ON sfa.fee_structure_id = fs.id
      LEFT JOIN users u ON p.cashier_id = u.id
      WHERE sfa.student_id = ? AND p.school_id = ?
      ORDER BY p.created_at DESC;
    `, [studentId, schoolId]);

    res.json({ assignments, payments });
  } catch (err: any) {
    console.error('Fetch student fee error:', err);
    res.status(500).json({ error: 'Failed to fetch student fee details' });
  }
});

// 3. Cashier Fee Payment Collection (POS Point-of-Sale)
feesRouter.post('/collect', authenticate, requireRole(['CASHIER', 'OFFICE', 'PRINCIPAL', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const { studentFeeAssignmentId, amountPaid, paymentMethod, referenceNumber, notes } = req.body;

    const numericAmount = parseFloat(amountPaid);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: 'Valid payment amount greater than zero is required' });
      return;
    }

    if (!['cash', 'upi', 'card'].includes(paymentMethod)) {
      res.status(400).json({ error: 'Valid payment method (cash, upi, card) is required' });
      return;
    }

    const sfa = await queryOne(`
      SELECT sfa.*, s.first_name, s.last_name, s.admission_number, fs.term_name
      FROM student_fee_assignments sfa
      JOIN students s ON sfa.student_id = s.id
      JOIN fee_structures fs ON sfa.fee_structure_id = fs.id
      WHERE sfa.id = ? AND sfa.school_id = ?;
    `, [studentFeeAssignmentId, schoolId]);

    if (!sfa) {
      res.status(404).json({ error: 'Fee assignment not found' });
      return;
    }

    const balanceDue = sfa.net_payable - sfa.paid_amount;
    if (numericAmount > balanceDue) {
      res.status(400).json({ error: `Amount cannot exceed remaining balance due of ₹${balanceDue.toFixed(2)}` });
      return;
    }

    let receiptNumber = '';
    let paymentId = '';

    await transaction(async () => {
      receiptNumber = await getNextReceiptNumber(schoolId);
      paymentId = 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

      // Insert payment record
      await execute(`
        INSERT INTO payments (id, school_id, student_fee_assignment_id, receipt_number, amount_paid, payment_method, reference_number, notes, cashier_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active');
      `, [paymentId, schoolId, studentFeeAssignmentId, receiptNumber, numericAmount, paymentMethod, referenceNumber || null, notes || null, req.user!.id]);

      // Update student_fee_assignments
      const newPaidAmount = sfa.paid_amount + numericAmount;
      const newStatus = newPaidAmount >= sfa.net_payable ? 'paid' : 'partial';

      await execute(`
        UPDATE student_fee_assignments
        SET paid_amount = ?, status = ?
        WHERE id = ?;
      `, [newPaidAmount, newStatus, studentFeeAssignmentId]);
    });

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'COLLECT_FEE_PAYMENT',
      module: 'FEES',
      recordId: paymentId,
      newValue: {
        receiptNumber,
        studentName: `${sfa.first_name} ${sfa.last_name}`,
        admissionNo: sfa.admission_number,
        amount: numericAmount,
        paymentMethod
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: `Payment of ₹${numericAmount.toFixed(2)} received successfully`,
      receiptNumber,
      paymentId
    });
  } catch (err: any) {
    console.error('Fee collection error:', err);
    res.status(500).json({ error: err.message || 'Failed to process fee collection' });
  }
});

// 4. Get Printable Digital Receipt Voucher
feesRouter.get('/receipt/:receiptNumber', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const { receiptNumber } = req.params;

    const payment = await queryOne(`
      SELECT p.*,
             sfa.total_amount, sfa.discount_amount, sfa.net_payable, sfa.paid_amount as total_paid_to_date,
             s.first_name, s.last_name, s.admission_number, s.father_name,
             c.name as class_name, sec.name as section_name, sar.roll_number,
             fs.term_name,
             u.user_id as cashier_code
      FROM payments p
      JOIN student_fee_assignments sfa ON p.student_fee_assignment_id = sfa.id
      JOIN students s ON sfa.student_id = s.id
      JOIN student_academic_records sar ON s.id = sar.student_id
      JOIN classes c ON sar.class_id = c.id
      JOIN sections sec ON sar.section_id = sec.id
      JOIN fee_structures fs ON sfa.fee_structure_id = fs.id
      LEFT JOIN users u ON p.cashier_id = u.id
      WHERE p.receipt_number = ? AND p.school_id = ?;
    `, [receiptNumber, schoolId]);

    if (!payment) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    const school = await queryOne(`
      SELECT s.name as school_name, ss.logo_url, ss.address_line1, ss.city, ss.state, ss.phone, ss.receipt_prefix
      FROM schools s
      LEFT JOIN school_settings ss ON s.id = ss.school_id
      WHERE s.id = ?;
    `, [schoolId]);

    res.json({ payment, school });
  } catch (err: any) {
    console.error('Fetch receipt error:', err);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// 5. Cashier Today Summary & Daily Closing Register
feesRouter.get('/cashier/summary', authenticate, requireRole(['CASHIER', 'OFFICE', 'PRINCIPAL', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const today = new Date().toISOString().split('T')[0];

    // Get today's active transactions
    const transactions = await query(`
      SELECT p.*, s.first_name, s.last_name, s.admission_number, fs.term_name,
             u.user_id as cashier_code
      FROM payments p
      JOIN student_fee_assignments sfa ON p.student_fee_assignment_id = sfa.id
      JOIN students s ON sfa.student_id = s.id
      JOIN fee_structures fs ON sfa.fee_structure_id = fs.id
      LEFT JOIN users u ON p.cashier_id = u.id
      WHERE p.school_id = ? AND date(p.created_at) = ? AND p.status = 'active'
      ORDER BY p.created_at DESC;
    `, [schoolId, today]);

    let totalCash = 0;
    let totalUpi = 0;
    let totalCard = 0;

    for (const tx of transactions) {
      if (tx.payment_method === 'cash') totalCash += tx.amount_paid;
      else if (tx.payment_method === 'upi') totalUpi += tx.amount_paid;
      else if (tx.payment_method === 'card') totalCard += tx.amount_paid;
    }

    const totalCollection = totalCash + totalUpi + totalCard;

    // Check if daily closing performed
    const closing = await queryOne(`
      SELECT * FROM daily_closings
      WHERE school_id = ? AND closing_date = ? AND cashier_id = ?;
    `, [schoolId, today, req.user!.id]);

    res.json({
      today,
      summary: {
        totalCash,
        totalUpi,
        totalCard,
        totalCollection,
        transactionCount: transactions.length,
        isClosed: !!closing && closing.status === 'closed',
        closedAt: closing?.created_at || null
      },
      transactions
    });
  } catch (err: any) {
    console.error('Fetch cashier summary error:', err);
    res.status(500).json({ error: 'Failed to fetch cashier summary' });
  }
});

// 6. Perform Cashier Daily Closing
feesRouter.post('/cashier/daily-closing', authenticate, requireRole(['CASHIER', 'PRINCIPAL', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    const today = new Date().toISOString().split('T')[0];

    const existingClosing = await queryOne(`
      SELECT id FROM daily_closings
      WHERE school_id = ? AND closing_date = ? AND cashier_id = ?;
    `, [schoolId, today, req.user!.id]);

    if (existingClosing) {
      res.status(400).json({ error: 'Daily closing has already been executed for today' });
      return;
    }

    // Calculate today's cash, UPI, card totals
    const transactions = await query(`
      SELECT payment_method, amount_paid
      FROM payments
      WHERE school_id = ? AND cashier_id = ? AND date(created_at) = ? AND status = 'active';
    `, [schoolId, req.user!.id, today]);

    let cash = 0, upi = 0, card = 0;
    for (const tx of transactions) {
      if (tx.payment_method === 'cash') cash += tx.amount_paid;
      else if (tx.payment_method === 'upi') upi += tx.amount_paid;
      else if (tx.payment_method === 'card') card += tx.amount_paid;
    }

    const total = cash + upi + card;
    const closingId = 'dc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    await execute(`
      INSERT INTO daily_closings (id, school_id, closing_date, cashier_id, total_cash, total_upi, total_card, total_collection, net_collection, transaction_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed');
    `, [closingId, schoolId, today, req.user!.id, cash, upi, card, total, total, transactions.length]);

    await logAudit({
      schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'PERFORM_DAILY_CLOSING',
      module: 'FEES',
      recordId: closingId,
      newValue: { date: today, totalCollection: total, transactionsCount: transactions.length },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Daily closing executed successfully for ₹${total.toFixed(2)}` });
  } catch (err: any) {
    console.error('Daily closing error:', err);
    res.status(500).json({ error: 'Failed to complete daily closing' });
  }
});

// 7. Overall Fee Analytics for Principal / Super Admin
feesRouter.get('/overview', authenticate, async (req: Request, res: Response) => {
  try {
    const schoolId = req.user!.schoolId || (req.tenant ? req.tenant.id : null);
    if (!schoolId) {
      res.status(400).json({ error: 'School context required' });
      return;
    }

    const totals = await queryOne(`
      SELECT 
        SUM(net_payable) as total_assessed,
        SUM(paid_amount) as total_collected,
        SUM(net_payable - paid_amount) as total_due
      FROM student_fee_assignments
      WHERE school_id = ?;
    `, [schoolId]);

    const assessed = totals?.total_assessed || 0;
    const collected = totals?.total_collected || 0;
    const due = totals?.total_due || 0;
    const collectionPercentage = assessed > 0 ? Math.round((collected / assessed) * 100) : 0;

    res.json({
      assessed,
      collected,
      due,
      collectionPercentage
    });
  } catch (err: any) {
    console.error('Fee overview error:', err);
    res.status(500).json({ error: 'Failed to fetch fee overview' });
  }
});
