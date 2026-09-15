import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { initSchema } from './server/db/schema.ts';
import { seedDatabase, ensureAcademicAndTimetableData, ensureExamAndAttendanceData, ensurePayrollAndAuditData } from './server/db/seed.ts';
import { tenantContext } from './server/middlewares/tenantContext.ts';
import { authRouter } from './server/routes/auth.ts';
import { schoolsRouter } from './server/routes/schools.ts';
import { studentsRouter } from './server/routes/students.ts';
import { documentsRouter } from './server/routes/documents.ts';
import { academicsRouter } from './server/routes/academics.ts';
import { attendanceRouter } from './server/routes/attendance.ts';
import { examsRouter } from './server/routes/exams.ts';
import { feesRouter } from './server/routes/fees.ts';
import { noticesRouter } from './server/routes/notices.ts';
import { payrollRouter } from './server/routes/payroll.ts';
import { auditRouter } from './server/routes/audit.ts';

const PORT = 3000;

async function startServer() {
  const app = express();

  // Basic Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Initialize Database Schema & Seed Data
  try {
    await initSchema();
    await seedDatabase();
    await ensureAcademicAndTimetableData();
    await ensureExamAndAttendanceData();
    await ensurePayrollAndAuditData();
    console.log('Database initialized, verified and seeded.');
  } catch (err) {
    console.error('Database initialization error:', err);
  }

  // Tenant Resolution Middleware for all requests
  app.use(tenantContext);

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      tenant: req.tenant ? req.tenant.code : 'platform_superadmin',
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/schools', schoolsRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/academics', academicsRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/exams', examsRouter);
  app.use('/api/fees', feesRouter);
  app.use('/api/notices', noticesRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/audit', auditRouter);

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`School ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
