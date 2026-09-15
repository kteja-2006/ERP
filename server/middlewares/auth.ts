import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'school-erp-super-secret-production-key-2026';

export interface UserPayload {
  id: string;
  userId: string;
  schoolId: string | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload & {
        name?: string;
        studentId?: string;
        facultyId?: string;
        admissionNumber?: string;
      };
    }
  }
}

export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.erp_token) {
      token = req.cookies.erp_token;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    let decoded: UserPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    } catch (err) {
      res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
      return;
    }

    // Verify user exists and is active in database
    const user = await queryOne(`
      SELECT u.id, u.user_id, u.school_id, u.role_id, u.status
      FROM users u
      WHERE u.id = ?
    `, [decoded.id]);

    if (!user) {
      res.status(401).json({ error: 'User record no longer exists.' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: `User account is ${user.status}. Access denied.` });
      return;
    }

    // Strict multi-tenant isolation check:
    // If request has a tenant context, user must belong to that tenant (unless SUPER_ADMIN)
    if (req.tenant && user.role_id !== 'SUPER_ADMIN') {
      if (user.school_id !== req.tenant.id) {
        res.status(403).json({
          error: 'Cross-tenant security violation: You do not belong to this school.'
        });
        return;
      }
    }

    // Load additional student or faculty profile details
    let studentId: string | undefined;
    let facultyId: string | undefined;
    let admissionNumber: string | undefined;
    let name = user.user_id;

    if (user.role_id === 'STUDENT') {
      const student = await queryOne(`
        SELECT id, admission_number, first_name, last_name
        FROM students WHERE user_id = ?
      `, [user.id]);
      if (student) {
        studentId = student.id;
        admissionNumber = student.admission_number;
        name = `${student.first_name} ${student.last_name}`;
      }
    } else if (user.role_id === 'FACULTY') {
      const faculty = await queryOne(`
        SELECT id, first_name, last_name
        FROM faculty WHERE user_id = ?
      `, [user.id]);
      if (faculty) {
        facultyId = faculty.id;
        name = `${faculty.first_name} ${faculty.last_name}`;
      }
    } else if (user.role_id === 'PRINCIPAL') {
      name = 'Principal';
    } else if (user.role_id === 'OFFICE') {
      name = 'Office Admin';
    } else if (user.role_id === 'CASHIER') {
      name = 'School Cashier';
    } else if (user.role_id === 'SUPER_ADMIN') {
      name = 'Platform Super Admin';
    }

    req.user = {
      id: user.id,
      userId: user.user_id,
      schoolId: user.school_id,
      role: user.role_id,
      name,
      studentId,
      facultyId,
      admissionNumber,
    };

    next();
  } catch (err) {
    console.error('Authentication middleware error:', err);
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Unauthorized: Role '${req.user.role}' is forbidden from accessing this resource.`
      });
      return;
    }

    next();
  };
}
