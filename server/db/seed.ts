import bcrypt from 'bcryptjs';
import { queryOne, execute, transaction } from './database.ts';

export async function seedDatabase(): Promise<void> {
  const existingRole = await queryOne('SELECT id FROM roles LIMIT 1;');
  if (!existingRole) {
    await execute(`
      INSERT OR IGNORE INTO roles (id, name, description) VALUES
      ('SUPER_ADMIN', 'Super Admin', 'Platform administrator with multi-school control'),
      ('PRINCIPAL', 'Principal', 'School administrator with school-wide control'),
      ('OFFICE', 'Office Staff', 'Daily operations, admissions, attendance & document management'),
      ('CASHIER', 'Cashier', 'Fee collection, partial payments, receipts, refunds & daily closing'),
      ('FACULTY', 'Faculty', 'Assigned class teacher, marks entry & one-time correction'),
      ('STUDENT', 'Student', 'Student self-service portal, report card, attendance & fee receipts');
    `);
  }

  const existingSchool = await queryOne('SELECT id FROM schools LIMIT 1;');
  if (existingSchool) {
    await ensureAcademicAndTimetableData();
    await ensureExamAndAttendanceData();
    await ensurePayrollAndAuditData();
    return; // Schools already seeded
  }

  console.log('Seeding relational database for School ERP...');

  const passwordHash = bcrypt.hashSync('password123', 10);

  await transaction(async () => {
    // 1. Roles
    await execute(`
      INSERT INTO roles (id, name, description) VALUES
      ('SUPER_ADMIN', 'Super Admin', 'Platform administrator with multi-school control'),
      ('PRINCIPAL', 'Principal', 'School administrator with school-wide control'),
      ('OFFICE', 'Office Staff', 'Daily operations, admissions, attendance & document management'),
      ('CASHIER', 'Cashier', 'Fee collection, partial payments, receipts, refunds & daily closing'),
      ('FACULTY', 'Faculty', 'Assigned class teacher, marks entry & one-time correction'),
      ('STUDENT', 'Student', 'Student self-service portal, report card, attendance & fee receipts');
    `);

    // 2. Super Admin User
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status)
      VALUES ('usr-super-01', NULL, 'SUP001', '9999999999', 'superadmin@erp.com', '${passwordHash}', 'SUPER_ADMIN', 'active');
    `);

    // 3. School A - Aditya School
    const schA = 'sch-aditya';
    await execute(`
      INSERT INTO schools (id, code, name, subdomain, status)
      VALUES ('${schA}', 'aditya', 'Aditya Public School', 'aditya', 'active');

      INSERT INTO school_settings (school_id, logo_url, address_line1, city, state, postal_code, phone, email, website, principal_name, primary_color, secondary_color, receipt_prefix)
      VALUES ('${schA}', 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=128&auto=format&fit=crop&q=80', 'Road No. 12, Jubilee Hills', 'Hyderabad', 'Telangana', '500033', '+91 40 2355 7890', 'info@aditya.edu.in', 'https://aditya.yourproduct.com', 'Dr. K. V. Rao', '#1e40af', '#0f172a', 'ADY');
    `);

    // School A Academic Year
    const ayA = 'ay-aditya-2026';
    await execute(`
      INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_active, is_closed)
      VALUES ('${ayA}', '${schA}', '2026-27', '2026-06-01', '2027-04-30', 1, 0);
    `);

    // School A Classes
    const c10 = 'cls-a-10';
    const c9 = 'cls-a-9';
    const c8 = 'cls-a-8';
    await execute(`
      INSERT INTO classes (id, school_id, name, class_code, display_order) VALUES
      ('${c10}', '${schA}', 'Class 10', '010', 10),
      ('${c9}', '${schA}', 'Class 9', '009', 9),
      ('${c8}', '${schA}', 'Class 8', '008', 8);
    `);

    // School A Sections
    const s10A = 'sec-a-10-a';
    const s10B = 'sec-a-10-b';
    const s8A = 'sec-a-8-a';
    await execute(`
      INSERT INTO sections (id, school_id, class_id, name) VALUES
      ('${s10A}', '${schA}', '${c10}', 'A'),
      ('${s10B}', '${schA}', '${c10}', 'B'),
      ('${s8A}', '${schA}', '${c8}', 'A');
    `);

    // School A Subjects
    const subMath = 'sub-a-math';
    const subSci = 'sub-a-sci';
    const subEng = 'sub-a-eng';
    await execute(`
      INSERT INTO subjects (id, school_id, name, code, is_optional) VALUES
      ('${subMath}', '${schA}', 'Mathematics', 'MATH10', 0),
      ('${subSci}', '${schA}', 'Science', 'SCI10', 0),
      ('${subEng}', '${schA}', 'English', 'ENG10', 0);

      INSERT INTO class_subject_mappings (id, school_id, class_id, subject_id) VALUES
      ('csm-1', '${schA}', '${c10}', '${subMath}'),
      ('csm-2', '${schA}', '${c10}', '${subSci}'),
      ('csm-3', '${schA}', '${c10}', '${subEng}');
    `);

    // School A Users
    // Principal
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status)
      VALUES ('usr-a-adm001', '${schA}', 'ADM001', '9876500001', 'principal@aditya.edu.in', '${passwordHash}', 'PRINCIPAL', 'active');
    `);

    // Office
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status)
      VALUES ('usr-a-off001', '${schA}', 'OFF001', '9876500002', 'office@aditya.edu.in', '${passwordHash}', 'OFFICE', 'active');
    `);

    // Cashier
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status)
      VALUES ('usr-a-cas001', '${schA}', 'CAS001', '9876500003', 'cashier@aditya.edu.in', '${passwordHash}', 'CASHIER', 'active');
    `);

    // Faculty: Ramesh Kumar (Math 10-A)
    const uFac1 = 'usr-a-fac001';
    const fac1 = 'fac-a-01';
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status)
      VALUES ('${uFac1}', '${schA}', 'FAC001', '9876500004', 'ramesh@aditya.edu.in', '${passwordHash}', 'FACULTY', 'active');

      INSERT INTO faculty (id, school_id, user_id, employee_code, first_name, last_name, designation, department, joining_date, status)
      VALUES ('${fac1}', '${schA}', '${uFac1}', 'EMP001', 'Ramesh', 'Kumar', 'Senior PGT', 'Mathematics', '2021-06-01', 'active');

      INSERT INTO faculty_assignments (id, school_id, faculty_id, academic_year_id, class_id, section_id, subject_id)
      VALUES ('fa-1', '${schA}', '${fac1}', '${ayA}', '${c10}', '${s10A}', '${subMath}');
    `);

    // Students
    // Student 1: Rahul Verma (STU26001123, Class 10-A)
    const uStu1 = 'usr-a-stu01';
    const stu1 = 'stu-a-01';
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status)
      VALUES ('${uStu1}', '${schA}', 'STU26001123', '9876543210', 'rahul@gmail.com', '${passwordHash}', 'STUDENT', 'active');

      INSERT INTO students (id, school_id, user_id, admission_number, first_name, last_name, date_of_birth, gender, admission_date, father_name, father_mobile, city, state, status)
      VALUES ('${stu1}', '${schA}', '${uStu1}', '26001123', 'Rahul', 'Verma', '2011-04-15', 'Male', '2026-06-05', 'Sanjay Verma', '9876543210', 'Hyderabad', 'Telangana', 'active');

      INSERT INTO student_academic_records (id, school_id, student_id, academic_year_id, class_id, section_id, roll_number, promotion_status)
      VALUES ('sar-a-01', '${schA}', '${stu1}', '${ayA}', '${c10}', '${s10A}', 1, 'enrolled');
    `);

    // Student 2: Pooja Verma (STU26001124, Class 8-A, shares mobile 9876543210 with Rahul for mobile disambiguation test!)
    const uStu2 = 'usr-a-stu02';
    const stu2 = 'stu-a-02';
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status)
      VALUES ('${uStu2}', '${schA}', 'STU26001124', '9876543210', 'pooja@gmail.com', '${passwordHash}', 'STUDENT', 'active');

      INSERT INTO students (id, school_id, user_id, admission_number, first_name, last_name, date_of_birth, gender, admission_date, father_name, father_mobile, city, state, status)
      VALUES ('${stu2}', '${schA}', '${uStu2}', '26008012', 'Pooja', 'Verma', '2013-09-22', 'Female', '2026-06-05', 'Sanjay Verma', '9876543210', 'Hyderabad', 'Telangana', 'active');

      INSERT INTO student_academic_records (id, school_id, student_id, academic_year_id, class_id, section_id, roll_number, promotion_status)
      VALUES ('sar-a-02', '${schA}', '${stu2}', '${ayA}', '${c8}', '${s8A}', 5, 'enrolled');
    `);

    // Student 3: Amit Patel (STU26001125, Class 10-A)
    const uStu3 = 'usr-a-stu03';
    const stu3 = 'stu-a-03';
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status)
      VALUES ('${uStu3}', '${schA}', 'STU26001125', '9876543211', 'amit@gmail.com', '${passwordHash}', 'STUDENT', 'active');

      INSERT INTO students (id, school_id, user_id, admission_number, first_name, last_name, date_of_birth, gender, admission_date, father_name, father_mobile, city, state, status)
      VALUES ('${stu3}', '${schA}', '${uStu3}', '26010045', 'Amit', 'Patel', '2011-01-10', 'Male', '2026-06-05', 'Kishore Patel', '9876543211', 'Hyderabad', 'Telangana', 'active');

      INSERT INTO student_academic_records (id, school_id, student_id, academic_year_id, class_id, section_id, roll_number, promotion_status)
      VALUES ('sar-a-03', '${schA}', '${stu3}', '${ayA}', '${c10}', '${s10A}', 2, 'enrolled');
    `);

    // Fee categories
    const fcTuition = 'fc-a-tuition';
    const fcExam = 'fc-a-exam';
    const fcActivity = 'fc-a-act';
    const fcTransport = 'fc-a-trans';
    await execute(`
      INSERT INTO fee_categories (id, school_id, name, description, approval_status) VALUES
      ('${fcTuition}', '${schA}', 'Tuition Fee', 'Academic tuition fee per term', 'approved'),
      ('${fcExam}', '${schA}', 'Exam Fee', 'Examination and assessment fees', 'approved'),
      ('${fcActivity}', '${schA}', 'Activity Fee', 'Sports and co-curricular charges', 'approved'),
      ('${fcTransport}', '${schA}', 'Transport Fee', 'School bus transportation', 'approved');
    `);

    // Fee structure for Class 10
    const fs10Term1 = 'fs-a-10-t1';
    await execute(`
      INSERT INTO fee_structures (id, school_id, academic_year_id, class_id, term_name)
      VALUES ('${fs10Term1}', '${schA}', '${ayA}', '${c10}', '1st Term');

      INSERT INTO fee_structure_items (id, fee_structure_id, fee_category_id, amount) VALUES
      ('fsi-1', '${fs10Term1}', '${fcTuition}', 12000.00),
      ('fsi-2', '${fs10Term1}', '${fcExam}', 1500.00),
      ('fsi-3', '${fs10Term1}', '${fcActivity}', 1500.00);
    `);

    // Assign fee to Rahul Verma (Total: 15,000, Paid: 6,000, Remaining: 9,000)
    const sfa1 = 'sfa-a-rahul';
    await execute(`
      INSERT INTO student_fee_assignments (id, school_id, student_id, academic_year_id, fee_structure_id, total_amount, discount_amount, net_payable, paid_amount, status)
      VALUES ('${sfa1}', '${schA}', '${stu1}', '${ayA}', '${fs10Term1}', 15000.00, 0.00, 15000.00, 6000.00, 'partial');

      INSERT INTO payments (id, school_id, student_fee_assignment_id, receipt_number, amount_paid, payment_method, cashier_id, status)
      VALUES ('pay-a-01', '${schA}', '${sfa1}', '2026-000001', 6000.00, 'upi', 'usr-a-cas001', 'active');
    `);

    // Grading rules
    await execute(`
      INSERT INTO grading_rules (id, school_id, grade, min_percentage, max_percentage, grade_point, remarks) VALUES
      ('gr-1', '${schA}', 'A+', 90.0, 100.0, 10.0, 'Outstanding'),
      ('gr-2', '${schA}', 'A', 80.0, 89.99, 9.0, 'Excellent'),
      ('gr-3', '${schA}', 'B+', 70.0, 79.99, 8.0, 'Very Good'),
      ('gr-4', '${schA}', 'B', 60.0, 69.99, 7.0, 'Good'),
      ('gr-5', '${schA}', 'C', 50.0, 59.99, 6.0, 'Average'),
      ('gr-6', '${schA}', 'D', 35.0, 49.99, 5.0, 'Pass'),
      ('gr-7', '${schA}', 'F', 0.0, 34.99, 0.0, 'Fail');
    `);

    // Document Requirements
    const docReqAadhaar = 'dr-a-aadhaar';
    const docReqBirth = 'dr-a-birth';
    await execute(`
      INSERT INTO document_requirements (id, school_id, title, description, is_required) VALUES
      ('${docReqAadhaar}', '${schA}', 'Aadhaar Card', 'Copy of government issued Aadhaar card', 1),
      ('${docReqBirth}', '${schA}', 'Birth Certificate', 'Municipal Corporation birth certificate', 1);

      INSERT INTO student_documents (id, school_id, student_id, requirement_id, file_url, file_name, status)
      VALUES ('doc-a-01', '${schA}', '${stu1}', '${docReqAadhaar}', '/uploads/aadhaar_sample.pdf', 'aadhaar_rahul.pdf', 'approved');
    `);

    // Sample Notices
    await execute(`
      INSERT INTO notices (id, school_id, title, content, target_audience, published_by) VALUES
      ('nt-1', '${schA}', 'School Reopening & Orientation Schedule', 'School reopens for the new academic year 2026-27 on Monday. All students must report in full uniform.', 'all', 'usr-a-adm001'),
      ('nt-2', '${schA}', 'Class 10 Special Math Remedial Classes', 'Mathematics revision sessions will be conducted every Wednesday at 3:30 PM in Room 101.', 'class_specific', 'usr-a-fac001');
    `);

    // 4. School B - Narayana School (To demonstrate strict multi-tenant isolation!)
    const schB = 'sch-narayana';
    await execute(`
      INSERT INTO schools (id, code, name, subdomain, status)
      VALUES ('${schB}', 'narayana', 'Narayana Olympiad School', 'narayana', 'active');

      INSERT INTO school_settings (school_id, logo_url, address_line1, city, state, postal_code, phone, email, website, principal_name, primary_color, secondary_color, receipt_prefix)
      VALUES ('${schB}', 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=128&auto=format&fit=crop&q=80', 'Madhapur Main Road', 'Hyderabad', 'Telangana', '500081', '+91 40 2311 9900', 'info@narayana.edu.in', 'https://narayana.yourproduct.com', 'Mrs. M. V. Shailaja', '#047857', '#064e3b', 'NAR');
    `);

    // School B Users
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status) VALUES
      ('usr-b-adm002', '${schB}', 'ADM002', '9876500021', 'principal@narayana.edu.in', '${passwordHash}', 'PRINCIPAL', 'active'),
      ('usr-b-off002', '${schB}', 'OFF002', '9876500022', 'office@narayana.edu.in', '${passwordHash}', 'OFFICE', 'active'),
      ('usr-b-cas002', '${schB}', 'CAS002', '9876500023', 'cashier@narayana.edu.in', '${passwordHash}', 'CASHIER', 'active'),
      ('usr-b-fac003', '${schB}', 'FAC003', '9876500024', 'teacher@narayana.edu.in', '${passwordHash}', 'FACULTY', 'active'),
      ('usr-b-stu001', '${schB}', 'STU26002001', '9876500025', 'kiran@narayana.edu.in', '${passwordHash}', 'STUDENT', 'active');
    `);

    console.log('Database seeded successfully with multi-tenant data.');
  });

  await ensureAcademicAndTimetableData();
}

export async function ensureAcademicAndTimetableData(): Promise<void> {
  const schA = 'sch-aditya';
  const ayA = 'ay-aditya-2026';
  const c10 = 'cls-a-10';
  const s10A = 'sec-a-10-a';

  // 1. Ensure Rooms
  const existingRooms = await queryOne('SELECT id FROM rooms WHERE school_id = ? LIMIT 1;', [schA]);
  if (!existingRooms) {
    console.log('Seeding rooms for School A...');
    await execute(`
      INSERT INTO rooms (id, school_id, room_number, capacity, building) VALUES
      ('room-a-101', '${schA}', 'Room 101', 40, 'Main Academic Block'),
      ('room-a-102', '${schA}', 'Room 102', 40, 'Main Academic Block'),
      ('room-a-lab1', '${schA}', 'Science Lab 1', 35, 'Science Block'),
      ('room-a-labcs', '${schA}', 'Computer Lab', 30, 'Technology Wing');
    `);
  }

  // 2. Ensure Additional Subjects
  const existingSoc = await queryOne('SELECT id FROM subjects WHERE id = ?;', ['sub-a-soc']);
  if (!existingSoc) {
    console.log('Seeding subjects for School A...');
    await execute(`
      INSERT INTO subjects (id, school_id, name, code, is_optional) VALUES
      ('sub-a-soc', '${schA}', 'Social Studies', 'SOC10', 0),
      ('sub-a-cs', '${schA}', 'Computer Science', 'CS10', 1),
      ('sub-a-hin', '${schA}', 'Hindi', 'HIN10', 0);

      INSERT INTO class_subject_mappings (id, school_id, class_id, subject_id) VALUES
      ('csm-4', '${schA}', '${c10}', 'sub-a-soc'),
      ('csm-5', '${schA}', '${c10}', 'sub-a-cs'),
      ('csm-6', '${schA}', '${c10}', 'sub-a-hin');
    `);
  }

  // 3. Ensure Additional Faculty Members
  const existingFac2 = await queryOne('SELECT id FROM faculty WHERE id = ?;', ['fac-a-02']);
  const passwordHash = bcrypt.hashSync('password123', 10);
  if (!existingFac2) {
    console.log('Seeding additional faculty for School A...');
    await execute(`
      INSERT INTO users (id, school_id, user_id, mobile_number, email, password_hash, role_id, status) VALUES
      ('usr-a-fac002', '${schA}', 'FAC002', '9876500005', 'sita@aditya.edu.in', '${passwordHash}', 'FACULTY', 'active'),
      ('usr-a-fac003', '${schA}', 'FAC003', '9876500006', 'sunita@aditya.edu.in', '${passwordHash}', 'FACULTY', 'active'),
      ('usr-a-fac004', '${schA}', 'FAC004', '9876500007', 'srinivas@aditya.edu.in', '${passwordHash}', 'FACULTY', 'active');

      INSERT INTO faculty (id, school_id, user_id, employee_code, first_name, last_name, designation, department, joining_date, status) VALUES
      ('fac-a-02', '${schA}', 'usr-a-fac002', 'EMP002', 'Sita', 'Sharma', 'Senior PGT', 'Science', '2021-07-15', 'active'),
      ('fac-a-03', '${schA}', 'usr-a-fac003', 'EMP003', 'Sunita', 'Rao', 'TGT', 'English', '2022-04-10', 'active'),
      ('fac-a-04', '${schA}', 'usr-a-fac004', 'EMP004', 'K.', 'Srinivas', 'TGT', 'Social Sciences', '2020-08-01', 'active');

      INSERT INTO faculty_assignments (id, school_id, faculty_id, academic_year_id, class_id, section_id, subject_id) VALUES
      ('fa-2', '${schA}', 'fac-a-02', '${ayA}', '${c10}', '${s10A}', 'sub-a-sci'),
      ('fa-3', '${schA}', 'fac-a-03', '${ayA}', '${c10}', '${s10A}', 'sub-a-eng'),
      ('fa-4', '${schA}', 'fac-a-04', '${ayA}', '${c10}', '${s10A}', 'sub-a-soc');
    `);
  }

  // 4. Ensure Timetable entries
  const existingTimetable = await queryOne('SELECT id FROM timetables WHERE school_id = ? LIMIT 1;', [schA]);
  if (!existingTimetable) {
    console.log('Seeding timetable for Class 10-A...');
    await execute(`
      INSERT INTO timetables (id, school_id, academic_year_id, class_id, section_id, day_of_week, period_number, subject_id, faculty_id, room_id, start_time, end_time) VALUES
      ('tt-1', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Monday', 1, 'sub-a-math', 'fac-a-01', 'room-a-101', '09:00', '09:45'),
      ('tt-2', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Monday', 2, 'sub-a-sci', 'fac-a-02', 'room-a-101', '09:45', '10:30'),
      ('tt-3', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Monday', 3, 'sub-a-eng', 'fac-a-03', 'room-a-101', '10:45', '11:30'),
      ('tt-4', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Monday', 4, 'sub-a-soc', 'fac-a-04', 'room-a-101', '11:30', '12:15'),
      ('tt-5', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Monday', 5, 'sub-a-cs', 'fac-a-01', 'room-a-labcs', '13:00', '13:45'),
      ('tt-6', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Monday', 6, 'sub-a-sci', 'fac-a-02', 'room-a-lab1', '13:45', '14:30'),

      ('tt-7', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Tuesday', 1, 'sub-a-sci', 'fac-a-02', 'room-a-101', '09:00', '09:45'),
      ('tt-8', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Tuesday', 2, 'sub-a-math', 'fac-a-01', 'room-a-101', '09:45', '10:30'),
      ('tt-9', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Tuesday', 3, 'sub-a-soc', 'fac-a-04', 'room-a-101', '10:45', '11:30'),
      ('tt-10', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Tuesday', 4, 'sub-a-eng', 'fac-a-03', 'room-a-101', '11:30', '12:15'),
      ('tt-11', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Tuesday', 5, 'sub-a-hin', 'fac-a-03', 'room-a-101', '13:00', '13:45'),
      ('tt-12', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Tuesday', 6, 'sub-a-math', 'fac-a-01', 'room-a-101', '13:45', '14:30'),

      ('tt-13', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Wednesday', 1, 'sub-a-eng', 'fac-a-03', 'room-a-101', '09:00', '09:45'),
      ('tt-14', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Wednesday', 2, 'sub-a-math', 'fac-a-01', 'room-a-101', '09:45', '10:30'),
      ('tt-15', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Wednesday', 3, 'sub-a-sci', 'fac-a-02', 'room-a-101', '10:45', '11:30'),
      ('tt-16', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Wednesday', 4, 'sub-a-soc', 'fac-a-04', 'room-a-101', '11:30', '12:15'),
      ('tt-17', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Wednesday', 5, 'sub-a-cs', 'fac-a-01', 'room-a-labcs', '13:00', '13:45'),

      ('tt-18', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Thursday', 1, 'sub-a-math', 'fac-a-01', 'room-a-101', '09:00', '09:45'),
      ('tt-19', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Thursday', 2, 'sub-a-sci', 'fac-a-02', 'room-a-101', '09:45', '10:30'),
      ('tt-20', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Thursday', 3, 'sub-a-eng', 'fac-a-03', 'room-a-101', '10:45', '11:30'),
      ('tt-21', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Thursday', 4, 'sub-a-soc', 'fac-a-04', 'room-a-101', '11:30', '12:15'),

      ('tt-22', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Friday', 1, 'sub-a-soc', 'fac-a-04', 'room-a-101', '09:00', '09:45'),
      ('tt-23', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Friday', 2, 'sub-a-eng', 'fac-a-03', 'room-a-101', '09:45', '10:30'),
      ('tt-24', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Friday', 3, 'sub-a-math', 'fac-a-01', 'room-a-101', '10:45', '11:30'),
      ('tt-25', '${schA}', '${ayA}', '${c10}', '${s10A}', 'Friday', 4, 'sub-a-sci', 'fac-a-02', 'room-a-101', '11:30', '12:15');
    `);
  }
}

export async function ensureExamAndAttendanceData(): Promise<void> {
  const schA = 'sch-aditya';
  const ayA = 'ay-aditya-2026';
  const c10 = 'cls-a-10';
  const stu1 = 'stu-a-01'; // Rahul Verma
  const stu3 = 'stu-a-03'; // Amit Patel
  const fac1 = 'fac-a-01'; // Ramesh Kumar
  const uAdm = 'usr-a-adm001';

  // Ensure subjects exist
  const existingSoc = await queryOne('SELECT id FROM subjects WHERE id = ?;', ['sub-a-soc']);
  if (!existingSoc) {
    await execute(`
      INSERT OR IGNORE INTO subjects (id, school_id, name, code, is_optional) VALUES
      ('sub-a-soc', '${schA}', 'Social Studies', 'SOC10', 0);
      INSERT OR IGNORE INTO class_subject_mappings (id, school_id, class_id, subject_id) VALUES
      ('csm-4', '${schA}', '${c10}', 'sub-a-soc');
    `);
  }

  // 1. Exam & Papers
  await execute(`
    INSERT OR IGNORE INTO exams (id, school_id, academic_year_id, name, start_date, end_date)
    VALUES ('ex-mid-2026', '${schA}', '${ayA}', 'Mid-Term Examination 2026', '2026-09-01', '2026-09-10');

    INSERT OR IGNORE INTO exam_subjects (id, school_id, exam_id, class_id, subject_id, max_marks, pass_marks, exam_date) VALUES
    ('es-m-1', '${schA}', 'ex-mid-2026', '${c10}', 'sub-a-math', 100, 35, '2026-09-01'),
    ('es-m-2', '${schA}', 'ex-mid-2026', '${c10}', 'sub-a-sci', 100, 35, '2026-09-03'),
    ('es-m-3', '${schA}', 'ex-mid-2026', '${c10}', 'sub-a-eng', 100, 35, '2026-09-05'),
    ('es-m-4', '${schA}', 'ex-mid-2026', '${c10}', 'sub-a-soc', 100, 35, '2026-09-08');

    -- Seed Marks for Rahul Verma (Top performer: Math 94, Science 88, English 86, Soc 90)
    INSERT OR IGNORE INTO marks (id, school_id, exam_subject_id, student_id, obtained_marks, correction_count, is_locked, entered_by) VALUES
    ('mrk-r-1', '${schA}', 'es-m-1', '${stu1}', 94, 0, 0, '${uAdm}'),
    ('mrk-r-2', '${schA}', 'es-m-2', '${stu1}', 88, 0, 0, '${uAdm}'),
    ('mrk-r-3', '${schA}', 'es-m-3', '${stu1}', 86, 0, 0, '${uAdm}'),
    ('mrk-r-4', '${schA}', 'es-m-4', '${stu1}', 90, 0, 0, '${uAdm}');

    -- Seed Marks for Amit Patel
    INSERT OR IGNORE INTO marks (id, school_id, exam_subject_id, student_id, obtained_marks, correction_count, is_locked, entered_by) VALUES
    ('mrk-a-1', '${schA}', 'es-m-1', '${stu3}', 78, 0, 0, '${uAdm}'),
    ('mrk-a-2', '${schA}', 'es-m-2', '${stu3}', 82, 0, 0, '${uAdm}'),
    ('mrk-a-3', '${schA}', 'es-m-3', '${stu3}', 74, 0, 0, '${uAdm}'),
    ('mrk-a-4', '${schA}', 'es-m-4', '${stu3}', 80, 0, 0, '${uAdm}');
  `);

  // 2. Attendance Data for recent days
  const existingAtt = await queryOne('SELECT id FROM student_attendance WHERE student_id = ? LIMIT 1;', [stu1]);
  if (!existingAtt) {
    console.log('Seeding recent attendance records for Class 10 students...');
    const dates = [
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
      '2026-09-14'
    ];

    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      // Rahul Verma is present almost always, one half-day on 2026-09-07
      const rahulMorning = 'present';
      const rahulAfternoon = i === 5 ? 'absent' : 'present';
      const rahulCalc = i === 5 ? 'half_day' : 'present';

      // Amit Patel has one absent on 2026-09-04
      const amitMorning = i === 3 ? 'absent' : 'present';
      const amitAfternoon = i === 3 ? 'absent' : 'present';
      const amitCalc = i === 3 ? 'absent' : 'present';

      await execute(`
        INSERT INTO student_attendance (id, school_id, student_id, academic_year_id, date, morning_status, afternoon_status, calculated_status, recorded_by)
        VALUES ('att-r-${i}', '${schA}', '${stu1}', '${ayA}', '${d}', '${rahulMorning}', '${rahulAfternoon}', '${rahulCalc}', '${uAdm}');

        INSERT INTO student_attendance (id, school_id, student_id, academic_year_id, date, morning_status, afternoon_status, calculated_status, recorded_by)
        VALUES ('att-a-${i}', '${schA}', '${stu3}', '${ayA}', '${d}', '${amitMorning}', '${amitAfternoon}', '${amitCalc}', '${uAdm}');
      `);
    }

    // Faculty Attendance for recent days
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      await execute(`
        INSERT INTO faculty_attendance (id, school_id, faculty_id, date, status, recorded_by)
        VALUES ('fatt-1-${i}', '${schA}', '${fac1}', '${d}', 'present', '${uAdm}');
      `);
    }
  }

  await ensurePayrollAndAuditData();
}

export async function ensurePayrollAndAuditData(): Promise<void> {
  const schA = 'sch-aditya';
  const uAdm = 'usr-a-adm001';

  // 1. Ensure Salary Structures
  const existingStructure = await queryOne('SELECT id FROM salary_structures WHERE school_id = ? LIMIT 1;', [schA]);
  if (!existingStructure) {
    console.log('Seeding faculty salary structures...');
    await execute(`
      INSERT INTO salary_structures (id, school_id, faculty_id, basic_salary, allowances, deductions, net_salary) VALUES
      ('ss-a-01', '${schA}', 'fac-a-01', 45000.0, 12000.0, 4500.0, 52500.0),
      ('ss-a-02', '${schA}', 'fac-a-02', 48000.0, 13500.0, 4800.0, 56700.0),
      ('ss-a-03', '${schA}', 'fac-a-03', 38000.0, 9000.0, 3800.0, 43200.0),
      ('ss-a-04', '${schA}', 'fac-a-04', 39000.0, 9500.0, 3900.0, 44600.0);
    `);

    // 2. Ensure Salary Payment records (July & August paid, September pending)
    await execute(`
      INSERT INTO salary_payments (id, school_id, faculty_id, salary_month, basic_salary, allowances, deductions, net_payable, payment_method, reference_number, status, processed_by, paid_at) VALUES
      ('sp-a-01-07', '${schA}', 'fac-a-01', '2026-07', 45000.0, 12000.0, 4500.0, 52500.0, 'bank_transfer', 'NEFT-202607-001', 'paid', '${uAdm}', '2026-07-31 16:30:00'),
      ('sp-a-02-07', '${schA}', 'fac-a-02', '2026-07', 48000.0, 13500.0, 4800.0, 56700.0, 'bank_transfer', 'NEFT-202607-002', 'paid', '${uAdm}', '2026-07-31 16:30:00'),
      ('sp-a-01-08', '${schA}', 'fac-a-01', '2026-08', 45000.0, 12000.0, 4500.0, 52500.0, 'bank_transfer', 'NEFT-202608-001', 'paid', '${uAdm}', '2026-08-31 17:00:00'),
      ('sp-a-02-08', '${schA}', 'fac-a-02', '2026-08', 48000.0, 13500.0, 4800.0, 56700.0, 'bank_transfer', 'NEFT-202608-002', 'paid', '${uAdm}', '2026-08-31 17:00:00'),
      ('sp-a-01-09', '${schA}', 'fac-a-01', '2026-09', 45000.0, 12000.0, 4500.0, 52500.0, NULL, NULL, 'pending', '${uAdm}', NULL),
      ('sp-a-02-09', '${schA}', 'fac-a-02', '2026-09', 48000.0, 13500.0, 4800.0, 56700.0, NULL, NULL, 'pending', '${uAdm}', NULL),
      ('sp-a-03-09', '${schA}', 'fac-a-03', '2026-09', 38000.0, 9000.0, 3800.0, 43200.0, NULL, NULL, 'pending', '${uAdm}', NULL),
      ('sp-a-04-09', '${schA}', 'fac-a-04', '2026-09', 39000.0, 9500.0, 3900.0, 44600.0, NULL, NULL, 'pending', '${uAdm}', NULL);
    `);
  }

  // 3. Ensure Initial Audit Logs
  const existingAudit = await queryOne('SELECT id FROM audit_logs WHERE school_id = ? LIMIT 1;', [schA]);
  if (!existingAudit) {
    console.log('Seeding initial audit logs...');
    await execute(`
      INSERT INTO audit_logs (id, school_id, user_id, role_id, action, module, record_id, old_value, new_value, reason, ip_address, created_at) VALUES
      ('aud-01', '${schA}', '${uAdm}', 'PRINCIPAL', 'INITIALIZE_ACADEMIC_YEAR', 'ACADEMICS', 'ay-aditya-2026', NULL, '{"year": "2026-2027", "status": "active"}', 'Annual school academic session startup', '127.0.0.1', '2026-06-01 09:00:00'),
      ('aud-02', '${schA}', '${uAdm}', 'PRINCIPAL', 'APPROVE_ADMISSION', 'STUDENTS', 'stu-a-01', NULL, '{"student": "Rahul Verma", "class": "10-A"}', 'Admission documentation verified and approved', '127.0.0.1', '2026-06-15 11:30:00'),
      ('aud-03', '${schA}', 'usr-a-cas001', 'CASHIER', 'RECEIVE_FEE_PAYMENT', 'FEES', 'pay-a-01', NULL, '{"amount": 6000, "receipt": "2026-000001", "method": "upi"}', 'Term 1 tuition installment', '127.0.0.1', '2026-07-05 14:15:00'),
      ('aud-04', '${schA}', '${uAdm}', 'PRINCIPAL', 'CONFIGURE_SALARY_STRUCTURE', 'PAYROLL', 'ss-a-01', NULL, '{"faculty": "fac-a-01", "netSalary": 52500}', 'Annual compensation structure approval', '127.0.0.1', '2026-07-10 10:00:00'),
      ('aud-05', '${schA}', 'usr-a-fac001', 'FACULTY', 'ENTER_EXAM_MARKS', 'EXAMS', 'ex-a-midterm-2026', NULL, '{"subject": "MATH10", "count": 2}', 'Mid-Term Examination score submission', '127.0.0.1', '2026-09-12 16:45:00');
    `);
  }
}


