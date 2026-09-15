import { getDb, saveDb } from './database.ts';

export async function initSchema(): Promise<void> {
  const db = await getDb();

  const ddl = `
    -- 1. Schools
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      subdomain TEXT NOT NULL UNIQUE,
      custom_domain TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. School Settings
    CREATE TABLE IF NOT EXISTS school_settings (
      school_id TEXT PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
      logo_url TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      principal_name TEXT,
      primary_color TEXT DEFAULT '#1e40af',
      secondary_color TEXT DEFAULT '#0f172a',
      receipt_prefix TEXT DEFAULT 'RCP',
      receipt_footer_text TEXT,
      report_card_header TEXT,
      report_card_footer TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Roles
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    );

    -- 4. Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      mobile_number TEXT,
      email TEXT,
      password_hash TEXT NOT NULL,
      role_id TEXT NOT NULL REFERENCES roles(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_users_school_uid ON users(school_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(school_id, mobile_number);

    -- 5. Login History
    CREATE TABLE IF NOT EXISTS login_history (
      id TEXT PRIMARY KEY,
      school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      identifier_entered TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed_password', 'failed_user', 'suspended')),
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at);

    -- 6. Password Reset OTPs
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      otp_code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Academic Years
    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      is_closed INTEGER NOT NULL DEFAULT 0,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, name)
    );

    -- 8. Classes
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      class_code TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, class_code),
      UNIQUE(school_id, name)
    );

    -- 9. Sections
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_id, name)
    );

    -- 10. Subjects
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      is_optional INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, code)
    );

    CREATE TABLE IF NOT EXISTS class_subject_mappings (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      UNIQUE(class_id, subject_id)
    );

    -- 11. Admission Sequence Tracking
    CREATE TABLE IF NOT EXISTS admission_sequences (
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      year_prefix TEXT NOT NULL,
      class_code TEXT NOT NULL,
      last_serial INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (school_id, year_prefix, class_code)
    );

    -- 12. Students Master
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
      admission_number TEXT NOT NULL,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
      blood_group TEXT,
      photo_url TEXT,
      national_id TEXT,
      admission_date TEXT NOT NULL,
      previous_school TEXT,
      father_name TEXT,
      father_mobile TEXT,
      father_occupation TEXT,
      mother_name TEXT,
      mother_mobile TEXT,
      guardian_name TEXT,
      guardian_mobile TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      emergency_contact TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transferred', 'graduated', 'left_school', 'suspended')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, admission_number)
    );
    CREATE INDEX IF NOT EXISTS idx_students_adm ON students(school_id, admission_number);

    -- 13. Student Academic Records
    CREATE TABLE IF NOT EXISTS student_academic_records (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
      roll_number INTEGER,
      promotion_status TEXT DEFAULT 'enrolled' CHECK (promotion_status IN ('enrolled', 'promoted', 'repeated', 'left_school')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, academic_year_id)
    );

    -- 14. Faculty Master
    CREATE TABLE IF NOT EXISTS faculty (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
      employee_code TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      designation TEXT,
      department TEXT,
      qualification TEXT,
      joining_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'resigned')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, employee_code)
    );

    -- 15. Faculty Assignments
    CREATE TABLE IF NOT EXISTS faculty_assignments (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      faculty_id TEXT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(faculty_id, academic_year_id, class_id, section_id, subject_id)
    );

    -- 16. Student Attendance
    CREATE TABLE IF NOT EXISTS student_attendance (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      morning_status TEXT NOT NULL CHECK (morning_status IN ('present', 'absent')),
      afternoon_status TEXT NOT NULL CHECK (afternoon_status IN ('present', 'absent')),
      calculated_status TEXT NOT NULL CHECK (calculated_status IN ('present', 'absent', 'half_day')),
      remarks TEXT,
      recorded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, date)
    );

    -- 17. Faculty Attendance
    CREATE TABLE IF NOT EXISTS faculty_attendance (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      faculty_id TEXT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day')),
      remarks TEXT,
      recorded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(faculty_id, date)
    );

    -- 18. Exams & Marks
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, academic_year_id, name)
    );

    CREATE TABLE IF NOT EXISTS exam_subjects (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      exam_date TEXT,
      max_marks REAL NOT NULL DEFAULT 100.0,
      pass_marks REAL NOT NULL DEFAULT 35.0,
      UNIQUE(exam_id, class_id, subject_id)
    );

    CREATE TABLE IF NOT EXISTS grading_rules (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      grade TEXT NOT NULL,
      min_percentage REAL NOT NULL,
      max_percentage REAL NOT NULL,
      grade_point REAL,
      remarks TEXT,
      UNIQUE(school_id, grade)
    );

    CREATE TABLE IF NOT EXISTS marks (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      exam_subject_id TEXT NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      obtained_marks REAL NOT NULL,
      correction_count INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      entered_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exam_subject_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS mark_corrections (
      id TEXT PRIMARY KEY,
      mark_id TEXT NOT NULL REFERENCES marks(id) ON DELETE CASCADE,
      old_value REAL NOT NULL,
      new_value REAL NOT NULL,
      reason TEXT NOT NULL,
      correction_type TEXT NOT NULL CHECK (correction_type IN ('teacher_one_time', 'principal_override')),
      performed_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 19. Rooms & Timetable
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      room_number TEXT NOT NULL,
      capacity INTEGER,
      building TEXT,
      UNIQUE(school_id, room_number)
    );

    CREATE TABLE IF NOT EXISTS timetables (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      day_of_week TEXT NOT NULL,
      period_number INTEGER NOT NULL,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      faculty_id TEXT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
      start_time TEXT,
      end_time TEXT,
      UNIQUE(academic_year_id, class_id, section_id, day_of_week, period_number)
    );

    -- 20. Fees, Payments & Refunds
    CREATE TABLE IF NOT EXISTS fee_categories (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending_approval', 'approved', 'rejected')),
      requested_by TEXT REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, name)
    );

    CREATE TABLE IF NOT EXISTS fee_structures (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      term_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(academic_year_id, class_id, term_name)
    );

    CREATE TABLE IF NOT EXISTS fee_structure_items (
      id TEXT PRIMARY KEY,
      fee_structure_id TEXT NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
      fee_category_id TEXT NOT NULL REFERENCES fee_categories(id) ON DELETE RESTRICT,
      amount REAL NOT NULL CHECK (amount >= 0),
      UNIQUE(fee_structure_id, fee_category_id)
    );

    CREATE TABLE IF NOT EXISTS student_fee_assignments (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      fee_structure_id TEXT NOT NULL REFERENCES fee_structures(id) ON DELETE RESTRICT,
      total_amount REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0.0,
      discount_reason TEXT,
      net_payable REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'waived')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, fee_structure_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_fee_assignment_id TEXT NOT NULL REFERENCES student_fee_assignments(id) ON DELETE RESTRICT,
      receipt_number TEXT NOT NULL,
      amount_paid REAL NOT NULL CHECK (amount_paid > 0),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card')),
      reference_number TEXT,
      notes TEXT,
      cashier_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'reversed', 'refunded')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, receipt_number)
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
      refund_amount REAL NOT NULL CHECK (refund_amount > 0),
      reason TEXT NOT NULL,
      reference_number TEXT,
      cashier_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_closings (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      closing_date TEXT NOT NULL,
      cashier_id TEXT NOT NULL REFERENCES users(id),
      total_cash REAL NOT NULL DEFAULT 0.0,
      total_upi REAL NOT NULL DEFAULT 0.0,
      total_card REAL NOT NULL DEFAULT 0.0,
      total_collection REAL NOT NULL DEFAULT 0.0,
      total_refunds REAL NOT NULL DEFAULT 0.0,
      net_collection REAL NOT NULL DEFAULT 0.0,
      transaction_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('draft', 'closed')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, closing_date, cashier_id)
    );

    -- 21. Salaries
    CREATE TABLE IF NOT EXISTS salary_structures (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      faculty_id TEXT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      basic_salary REAL NOT NULL,
      allowances REAL NOT NULL DEFAULT 0.0,
      deductions REAL NOT NULL DEFAULT 0.0,
      net_salary REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(faculty_id)
    );

    CREATE TABLE IF NOT EXISTS salary_payments (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      faculty_id TEXT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      salary_month TEXT NOT NULL,
      basic_salary REAL NOT NULL,
      allowances REAL NOT NULL DEFAULT 0.0,
      bonuses REAL NOT NULL DEFAULT 0.0,
      deductions REAL NOT NULL DEFAULT 0.0,
      advances REAL NOT NULL DEFAULT 0.0,
      net_payable REAL NOT NULL,
      payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'cheque', 'cash')),
      reference_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid')),
      processed_by TEXT REFERENCES users(id),
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(faculty_id, salary_month)
    );

    -- 22. Documents
    CREATE TABLE IF NOT EXISTS document_requirements (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      is_required INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, title)
    );

    CREATE TABLE IF NOT EXISTS student_documents (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      requirement_id TEXT NOT NULL REFERENCES document_requirements(id) ON DELETE CASCADE,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'under_review', 'approved', 'rejected')),
      remarks TEXT,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, requirement_id)
    );

    -- 23. Notices & Notifications
    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target_audience TEXT NOT NULL CHECK (target_audience IN ('all', 'students', 'faculty', 'class_specific')),
      target_class_id TEXT REFERENCES classes(id),
      target_section_id TEXT REFERENCES sections(id),
      published_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 24. Audit Log
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      role_id TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.run(ddl);
  saveDb();
}
