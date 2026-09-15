import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, execute } from '../db/database.ts';
import { authenticate, generateToken, requireRole } from '../middlewares/auth.ts';
import { logAudit } from '../utils/audit.ts';

export const authRouter = Router();

// Mobile Account Lookup (for sibling/parent multi-student disambiguation)
authRouter.post('/mobile-lookup', async (req: Request, res: Response) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      res.status(400).json({ error: 'Mobile number is required' });
      return;
    }

    const schoolId = req.tenant ? req.tenant.id : null;
    const users = await query(`
      SELECT u.id, u.user_id, u.role_id,
             s.first_name, s.last_name, s.admission_number,
             c.name as class_name, sec.name as section_name
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN student_academic_records sar ON s.id = sar.student_id
      LEFT JOIN classes c ON sar.class_id = c.id
      LEFT JOIN sections sec ON sar.section_id = sec.id
      WHERE u.mobile_number = ? AND (u.school_id = ? OR ? IS NULL) AND u.status = 'active'
    `, [mobileNumber.trim(), schoolId, schoolId]);

    res.json({
      accounts: users.map(u => ({
        id: u.id,
        userId: u.user_id,
        role: u.role_id,
        name: u.first_name ? `${u.first_name} ${u.last_name}` : u.user_id,
        admissionNumber: u.admission_number,
        className: u.class_name,
        sectionName: u.section_name,
      }))
    });
  } catch (err: any) {
    console.error('Mobile lookup error:', err);
    res.status(500).json({ error: 'Failed to look up mobile accounts' });
  }
});

// Login by User ID or Mobile Number + Password
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password, loginType = 'userId', selectedUserId } = req.body;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Identifier and password are required' });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const schoolId = req.tenant ? req.tenant.id : null;

    let user: any = null;

    if (loginType === 'mobile') {
      const candidates = await query(`
        SELECT u.*, s.first_name, s.last_name, s.admission_number
        FROM users u
        LEFT JOIN students s ON u.id = s.user_id
        WHERE u.mobile_number = ? AND (u.school_id = ? OR ? IS NULL)
      `, [identifier.trim(), schoolId, schoolId]);

      if (candidates.length === 0) {
        // Log failed attempt
        await execute(`
          INSERT INTO login_history (id, school_id, identifier_entered, status, ip_address, user_agent)
          VALUES (?, ?, ?, 'failed_user', ?, ?)
        `, ['lh-' + Date.now(), schoolId, identifier, ip, userAgent]);
        res.status(401).json({ error: 'No account found with this mobile number' });
        return;
      }

      if (candidates.length > 1 && !selectedUserId) {
        // Disambiguation required
        res.status(300).json({
          multipleAccounts: true,
          message: 'Multiple student accounts found for this mobile number. Please select an account.',
          accounts: candidates.map(c => ({
            id: c.id,
            userId: c.user_id,
            role: c.role_id,
            name: c.first_name ? `${c.first_name} ${c.last_name}` : c.user_id,
            admissionNumber: c.admission_number,
          }))
        });
        return;
      }

      user = selectedUserId
        ? candidates.find(c => c.id === selectedUserId)
        : candidates[0];
    } else {
      // User ID Login
      user = await queryOne(`
        SELECT * FROM users
        WHERE user_id = ? AND (school_id = ? OR role_id = 'SUPER_ADMIN')
      `, [identifier.trim().toUpperCase(), schoolId]);
    }

    if (!user) {
      await execute(`
        INSERT INTO login_history (id, school_id, identifier_entered, status, ip_address, user_agent)
        VALUES (?, ?, ?, 'failed_user', ?, ?)
      `, ['lh-' + Date.now(), schoolId, identifier, ip, userAgent]);
      res.status(401).json({ error: 'Invalid User ID or credentials' });
      return;
    }

    if (user.status !== 'active') {
      await execute(`
        INSERT INTO login_history (id, school_id, user_id, identifier_entered, status, ip_address, user_agent)
        VALUES (?, ?, ?, ?, 'suspended', ?, ?)
      `, ['lh-' + Date.now(), user.school_id, user.id, identifier, ip, userAgent]);
      res.status(403).json({ error: `Account is ${user.status}. Please contact administration.` });
      return;
    }

    // Verify Password
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      await execute(`
        INSERT INTO login_history (id, school_id, user_id, identifier_entered, status, ip_address, user_agent)
        VALUES (?, ?, ?, ?, 'failed_password', ?, ?)
      `, ['lh-' + Date.now(), user.school_id, user.id, identifier, ip, userAgent]);
      res.status(401).json({ error: 'Invalid User ID or credentials' });
      return;
    }

    // Log successful login
    await execute(`
      INSERT INTO login_history (id, school_id, user_id, identifier_entered, status, ip_address, user_agent)
      VALUES (?, ?, ?, ?, 'success', ?, ?)
    `, ['lh-' + Date.now(), user.school_id, user.id, identifier, ip, userAgent]);

    // Generate JWT
    const token = generateToken({
      id: user.id,
      userId: user.user_id,
      schoolId: user.school_id,
      role: user.role_id,
    });

    res.cookie('erp_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Load additional user meta
    let name = user.user_id;
    let admissionNumber: string | undefined;
    let studentId: string | undefined;
    let facultyId: string | undefined;
    if (user.role_id === 'STUDENT') {
      const s = await queryOne('SELECT id, first_name, last_name, admission_number FROM students WHERE user_id = ?', [user.id]);
      if (s) {
        name = `${s.first_name} ${s.last_name}`;
        admissionNumber = s.admission_number;
        studentId = s.id;
      }
    } else if (user.role_id === 'FACULTY') {
      const f = await queryOne('SELECT id, first_name, last_name FROM faculty WHERE user_id = ?', [user.id]);
      if (f) {
        name = `${f.first_name} ${f.last_name}`;
        facultyId = f.id;
      }
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        userId: user.user_id,
        role: user.role_id,
        schoolId: user.school_id,
        name,
        admissionNumber,
        studentId,
        facultyId,
      },
      tenant: req.tenant,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login service failed' });
  }
});

// Current User Session
authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({
    user: req.user,
    tenant: req.tenant,
  });
});

// Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('erp_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Change Password
authRouter.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (!oldPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ error: 'All password fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'New password and confirm password do not match' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    const user = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) {
      res.status(400).json({ error: 'Incorrect old password' });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await execute('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user!.id]);

    await logAudit({
      schoolId: req.user!.schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'CHANGE_PASSWORD',
      module: 'auth',
      recordId: req.user!.id,
      reason: 'User self password update',
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Forgot Password - Request Mobile OTP
authRouter.post('/forgot-password/request-otp', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body; // User ID or Mobile
    if (!identifier) {
      res.status(400).json({ error: 'User ID or registered mobile number is required' });
      return;
    }

    const schoolId = req.tenant ? req.tenant.id : null;
    const user = await queryOne(`
      SELECT id, user_id, mobile_number FROM users
      WHERE (user_id = ? OR mobile_number = ?) AND (school_id = ? OR ? IS NULL)
    `, [identifier.trim().toUpperCase(), identifier.trim(), schoolId, schoolId]);

    if (!user) {
      res.status(404).json({ error: 'No matching user account found' });
      return;
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const otpId = 'otp-' + Date.now();
    await execute(`
      INSERT INTO password_reset_otps (id, user_id, otp_code, expires_at)
      VALUES (?, ?, ?, ?)
    `, [otpId, user.id, otpCode, expiresAt]);

    // Return the generated OTP in response for development and testing demonstration
    res.json({
      success: true,
      message: `OTP sent to mobile number ending in ****${user.mobile_number ? user.mobile_number.slice(-4) : '0000'}`,
      otpId,
      userId: user.id,
      debugOtp: otpCode, // Provided for instant demo testing
    });
  } catch (err: any) {
    console.error('Request OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Forgot Password - Verify OTP & Set New Password
authRouter.post('/forgot-password/reset', async (req: Request, res: Response) => {
  try {
    const { otpId, otpCode, newPassword, confirmPassword } = req.body;
    if (!otpId || !otpCode || !newPassword || !confirmPassword) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match' });
      return;
    }

    const otpRecord = await queryOne(`
      SELECT * FROM password_reset_otps
      WHERE id = ? AND used = 0
    `, [otpId]);

    if (!otpRecord) {
      res.status(400).json({ error: 'Invalid or already used OTP session' });
      return;
    }

    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      return;
    }

    if (otpRecord.otp_code !== otpCode.trim()) {
      await execute('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?', [otpId]);
      res.status(400).json({ error: 'Incorrect OTP code' });
      return;
    }

    // Mark OTP used
    await execute('UPDATE password_reset_otps SET used = 1 WHERE id = ?', [otpId]);

    // Update password
    const newHash = bcrypt.hashSync(newPassword, 10);
    await execute('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, otpRecord.user_id]);

    await logAudit({
      schoolId: req.tenant ? req.tenant.id : null,
      userId: otpRecord.user_id,
      roleId: 'AUTH_RECOVERY',
      action: 'RESET_PASSWORD_VIA_OTP',
      module: 'auth',
      recordId: otpRecord.user_id,
      reason: 'Password reset via verified mobile OTP',
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Login History
authRouter.get('/login-history', authenticate, async (req: Request, res: Response) => {
  try {
    const history = await query(`
      SELECT id, identifier_entered, status, ip_address, user_agent, created_at
      FROM login_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `, [req.user!.id]);

    res.json({ history });
  } catch (err: any) {
    console.error('Fetch login history error:', err);
    res.status(500).json({ error: 'Failed to fetch login history' });
  }
});

// Office Direct Student Password Reset (Section 11)
authRouter.post('/reset-student-password', authenticate, requireRole(['OFFICE', 'PRINCIPAL']), async (req: Request, res: Response) => {
  try {
    const { studentUserId, newPassword } = req.body;
    if (!studentUserId || !newPassword) {
      res.status(400).json({ error: 'Student User ID and new password are required' });
      return;
    }

    const studentUser = await queryOne(`
      SELECT id, user_id, school_id, role_id FROM users
      WHERE (id = ? OR user_id = ?) AND school_id = ? AND role_id = 'STUDENT'
    `, [studentUserId, studentUserId, req.user!.schoolId]);

    if (!studentUser) {
      res.status(404).json({ error: 'Student account not found in your school' });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await execute('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, studentUser.id]);

    await logAudit({
      schoolId: req.user!.schoolId,
      userId: req.user!.id,
      roleId: req.user!.role,
      action: 'ADMIN_RESET_STUDENT_PASSWORD',
      module: 'office',
      recordId: studentUser.id,
      reason: `Office reset password for student ${studentUser.user_id}`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Password reset successfully for student ${studentUser.user_id}` });
  } catch (err: any) {
    console.error('Admin reset student password error:', err);
    res.status(500).json({ error: 'Failed to reset student password' });
  }
});
