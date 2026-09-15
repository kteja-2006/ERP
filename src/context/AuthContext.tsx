import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api.ts';
import { useTenant } from './TenantContext.tsx';

export interface UserSession {
  id: string;
  userId: string;
  role: 'SUPER_ADMIN' | 'PRINCIPAL' | 'OFFICE' | 'CASHIER' | 'FACULTY' | 'STUDENT';
  schoolId: string | null;
  name: string;
  admissionNumber?: string;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (identifier: string, password: string, loginType?: 'userId' | 'mobile', selectedUserId?: string) => Promise<any>;
  lookupMobile: (mobileNumber: string) => Promise<any[]>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  requestOtp: (identifier: string) => Promise<any>;
  resetPasswordWithOtp: (otpId: string, otpCode: string, newPass: string, confirmPass: string) => Promise<void>;
  changePassword: (oldPass: string, newPass: string, confirmPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { activeSchoolCode } = useTenant();

  const refreshUser = async () => {
    const token = localStorage.getItem('erp_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiRequest<{ user: UserSession }>('/api/auth/me', {}, activeSchoolCode);
      setUser(res.user);
    } catch (err) {
      console.warn('Session verification failed, clearing auth:', err);
      localStorage.removeItem('erp_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [activeSchoolCode]);

  const login = async (identifier: string, password: string, loginType: 'userId' | 'mobile' = 'userId', selectedUserId?: string) => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier,
        password,
        loginType,
        selectedUserId,
      }),
    }, activeSchoolCode);

    if (res.token) {
      localStorage.setItem('erp_token', res.token);
      setUser(res.user);
    }
    return res;
  };

  const lookupMobile = async (mobileNumber: string) => {
    const res = await apiRequest<{ accounts: any[] }>('/api/auth/mobile-lookup', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber }),
    }, activeSchoolCode);
    return res.accounts || [];
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' }, activeSchoolCode);
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('erp_token');
    setUser(null);
  };

  const requestOtp = async (identifier: string) => {
    return await apiRequest('/api/auth/forgot-password/request-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }, activeSchoolCode);
  };

  const resetPasswordWithOtp = async (otpId: string, otpCode: string, newPassword: string, confirmPassword: string) => {
    await apiRequest('/api/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify({ otpId, otpCode, newPassword, confirmPassword }),
    }, activeSchoolCode);
  };

  const changePassword = async (oldPassword: string, newPassword: string, confirmPassword: string) => {
    await apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
    }, activeSchoolCode);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        lookupMobile,
        logout,
        refreshUser,
        requestOtp,
        resetPasswordWithOtp,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
