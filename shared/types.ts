export type UserRole = 'SUPER_ADMIN' | 'PRINCIPAL' | 'OFFICE' | 'CASHIER' | 'FACULTY' | 'STUDENT';

export interface SchoolBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  phone?: string;
  email?: string;
  address?: string;
  principalName?: string;
  receiptPrefix?: string;
}

export interface School {
  id: string;
  code: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'suspended';
  branding: SchoolBranding;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  userId: string;
  schoolId: string | null;
  schoolCode?: string;
  schoolName?: string;
  role: UserRole;
  mobileNumber?: string;
  email?: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  facultyId?: string;
  studentId?: string;
  admissionNumber?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
}

export interface LoginHistoryRecord {
  id: string;
  userId: string;
  schoolId: string | null;
  identifierEntered: string;
  status: 'success' | 'failed_password' | 'failed_user' | 'suspended';
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
