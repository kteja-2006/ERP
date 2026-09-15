export interface ApiError {
  error: string;
  multipleAccounts?: boolean;
  accounts?: any[];
  message?: string;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  schoolCode?: string
): Promise<T> {
  const token = localStorage.getItem('erp_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set X-School-Code if available
  const activeSchool = schoolCode || localStorage.getItem('erp_active_school') || 'aditya';
  if (activeSchool) {
    headers['X-School-Code'] = activeSchool;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || data.message || `Request failed with status ${response.status}`) as any;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
