import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db/database.ts';

export interface TenantData {
  id: string;
  code: string;
  name: string;
  subdomain: string;
  status: string;
  branding: {
    logoUrl?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    website?: string;
    principalName?: string;
    primaryColor: string;
    secondaryColor: string;
    receiptPrefix: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantData | null;
    }
  }
}

export async function tenantContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Check header
    let schoolCode = req.headers['x-school-code'] as string | undefined;

    // 2. Check query param (useful for development/testing and iframe preview)
    if (!schoolCode && req.query.school) {
      schoolCode = req.query.school as string;
    }

    // 3. Check hostname / subdomain (e.g. aditya.yourproduct.com or aditya.localhost)
    if (!schoolCode && req.hostname) {
      const parts = req.hostname.split('.');
      if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'app') {
        schoolCode = parts[0];
      }
    }

    // Default to 'aditya' for primary development if not explicitly specified and not superadmin route
    if (!schoolCode && !req.path.startsWith('/api/superadmin')) {
      schoolCode = 'aditya';
    }

    if (!schoolCode) {
      req.tenant = null;
      return next();
    }

    const school = await queryOne(`
      SELECT s.id, s.code, s.name, s.subdomain, s.status,
             ss.logo_url, ss.address_line1, ss.city, ss.state, ss.postal_code,
             ss.phone, ss.email, ss.website, ss.principal_name,
             ss.primary_color, ss.secondary_color, ss.receipt_prefix
      FROM schools s
      LEFT JOIN school_settings ss ON s.id = ss.school_id
      WHERE s.code = ? OR s.subdomain = ?
    `, [schoolCode.toLowerCase(), schoolCode.toLowerCase()]);

    if (!school) {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: `School '${schoolCode}' not found` });
        return;
      }
      req.tenant = null;
      return next();
    }

    if (school.status !== 'active') {
      res.status(403).json({ error: `School '${school.name}' is currently ${school.status}` });
      return;
    }

    req.tenant = {
      id: school.id,
      code: school.code,
      name: school.name,
      subdomain: school.subdomain,
      status: school.status,
      branding: {
        logoUrl: school.logo_url,
        address: school.address_line1,
        city: school.city,
        state: school.state,
        postalCode: school.postal_code,
        phone: school.phone,
        email: school.email,
        website: school.website,
        principalName: school.principal_name,
        primaryColor: school.primary_color || '#1e40af',
        secondaryColor: school.secondary_color || '#0f172a',
        receiptPrefix: school.receipt_prefix || 'RCP',
      }
    };

    next();
  } catch (err) {
    console.error('Tenant resolution error:', err);
    res.status(500).json({ error: 'Internal tenant resolution error' });
  }
}
