import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api.ts';

export interface SchoolItem {
  id: string;
  code: string;
  name: string;
  subdomain: string;
  status: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  principal_name?: string;
  city?: string;
}

interface TenantContextType {
  activeSchoolCode: string;
  setActiveSchoolCode: (code: string) => void;
  availableSchools: SchoolItem[];
  currentSchool: SchoolItem | null;
  loading: boolean;
  refreshSchools: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSchoolCode, setActiveSchoolCodeState] = useState<string>(() => {
    return localStorage.getItem('erp_active_school') || 'aditya';
  });
  const [availableSchools, setAvailableSchools] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSchools = async () => {
    try {
      const res = await apiRequest<{ schools: SchoolItem[] }>('/api/schools/list');
      setAvailableSchools(res.schools || []);
    } catch (err) {
      console.error('Failed to load schools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSchools();
  }, []);

  const setActiveSchoolCode = (code: string) => {
    setActiveSchoolCodeState(code);
    localStorage.setItem('erp_active_school', code);
  };

  const currentSchool = availableSchools.find(s => s.code.toLowerCase() === activeSchoolCode.toLowerCase()) || null;

  return (
    <TenantContext.Provider
      value={{
        activeSchoolCode,
        setActiveSchoolCode,
        availableSchools,
        currentSchool,
        loading,
        refreshSchools,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
};
