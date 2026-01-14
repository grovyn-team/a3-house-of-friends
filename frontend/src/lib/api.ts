export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('authToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (e: any) {
    throw new Error(`Network error. Please check your connection and try again.`);
  }

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.error || error.message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    if (response.status === 401) {
      localStorage.removeItem('authToken');
      throw new Error(errorMessage || 'Unauthorized. Please sign in again.');
    }

    if (response.status === 403) {
      throw new Error(errorMessage || 'Forbidden. You do not have permission to perform this action.');
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export const authAPI = {
  register: async (username: string, email: string, password: string, name: string, role?: 'admin' | 'staff' | 'chef') => {
    const data = await apiRequest<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, name, role }),
    });
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }
    return data;
  },

  login: async (username: string, password: string) => {
    const data = await apiRequest<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }
    return data;
  },

  getProfile: async () => {
    return apiRequest<any>('/auth/profile');
  },

  logout: () => {
    localStorage.removeItem('authToken');
  },
};

export const activitiesAPI = {
  getAll: async (enabledOnly = false) => {
    return apiRequest<any[]>(`/activities?enabled=${enabledOnly}`);
  },

  getById: async (id: string) => {
    return apiRequest<any>(`/activities/${id}`);
  },
};

export const sessionsAPI = {
  create: async (sessionData: any) => {
    return apiRequest<any>('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  },

  getById: async (id: string) => {
    return apiRequest<any>(`/sessions/${id}`);
  },

  getActive: async () => {
    return apiRequest<any[]>('/sessions');
  },

  getAll: async (limit = 100, offset = 0, status?: string) => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (status) {
      params.append('status', status);
    }
    return apiRequest<{ sessions: any[]; total: number; limit: number; offset: number }>(`/sessions/history?${params.toString()}`);
  },

  extend: async (id: string, additionalMinutes: number) => {
    return apiRequest<any>(`/sessions/${id}/extend`, {
      method: 'POST',
      body: JSON.stringify({ additionalMinutes }),
    });
  },

  end: async (id: string) => {
    return apiRequest<any>(`/sessions/${id}/end`, {
      method: 'POST',
    });
  },

  pause: async (id: string, reason?: string, pausedBy: 'customer' | 'admin' = 'customer') => {
    return apiRequest<any>(`/sessions/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify({ reason, pausedBy }),
    });
  },

  resume: async (id: string, resumedBy: 'customer' | 'admin' = 'customer') => {
    return apiRequest<any>(`/sessions/${id}/resume`, {
      method: 'POST',
      body: JSON.stringify({ resumedBy }),
    });
  },

  getByPhone: async (phone: string) => {
    return apiRequest<any[]>(`/sessions/phone/${phone}`);
  },

  createChallenge: async (challengeData: any) => {
    return apiRequest<any>('/sessions/challenge', {
      method: 'POST',
      body: JSON.stringify(challengeData),
    });
  },

  voteWinner: async (sessionId: string, winnerName: string, voterName: string) => {
    return apiRequest<any>(`/sessions/${sessionId}/vote-winner`, {
      method: 'POST',
      body: JSON.stringify({ winnerName, voterName }),
    });
  },

  selectWinner: async (sessionId: string, winnerName: string, selectedBy: 'admin' = 'admin') => {
    return apiRequest<any>(`/sessions/${sessionId}/select-winner`, {
      method: 'POST',
      body: JSON.stringify({ winnerName, selectedBy }),
    });
  },

  delete: async (id: string) => {
    return apiRequest<any>(`/sessions/${id}`, {
      method: 'DELETE',
    });
  },
};

export const ordersAPI = {
  getMenuItems: async (availableOnly = false) => {
    return apiRequest<any[]>(`/orders/menu?available=${availableOnly}`);
  },

  create: async (orderData: any) => {
    return apiRequest<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  getById: async (id: string) => {
    return apiRequest<any>(`/orders/${id}`);
  },

  getByPhone: async (phone: string) => {
    return apiRequest<any[]>(`/orders/phone/${phone}`);
  },

  getAll: async (limit = 100, offset = 0) => {
    return apiRequest<any[]>(`/orders?limit=${limit}&offset=${offset}`);
  },

  getPending: async () => {
    return apiRequest<any[]>('/orders/pending');
  },
  getPendingOrders: async () => {
    return apiRequest<any[]>('/orders/pending');
  },
  updateOrderStatus: async (orderId: string, data: { status?: string; estimatedReadyTime?: string }) => {
    return apiRequest<any>(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

export const queueAPI = {
  getQueue: async (service?: string) => {
    const query = service && service !== 'all' ? `?service=${service}` : '';
    return apiRequest<{ queue: any[]; stats: any }>(`/queue${query}`);
  },

  getStations: async (type?: string) => {
    const query = type && type !== 'all' ? `?type=${type}` : '';
    return apiRequest<{ stations: any[] }>(`/queue/stations${query}`);
  },

  getStats: async () => {
    return apiRequest<any>('/queue/stats');
  },

  // Approval methods
  getPendingApprovals: async () => {
    return apiRequest<any[]>('/queue/approvals');
  },

  approveCashPayment: async (reservationId: string, unitId?: string) => {
    return apiRequest<any>('/queue/approve', {
      method: 'POST',
      body: JSON.stringify({ reservationId, unitId }),
    });
  },

  rejectCashPayment: async (reservationId: string) => {
    return apiRequest<any>('/queue/reject', {
      method: 'POST',
      body: JSON.stringify({ reservationId }),
    });
  },

  // Waiting queue methods
  getWaitingQueue: async (activityId?: string) => {
    const query = activityId ? `?activityId=${activityId}` : '';
    return apiRequest<any[]>(`/queue/waiting${query}`);
  },

  processQueue: async (activityId: string) => {
    return apiRequest<any>('/queue/process', {
      method: 'POST',
      body: JSON.stringify({ activityId }),
    });
  },

  getQueueStatus: async (reservationId: string) => {
    return apiRequest<any>(`/queue/status/${reservationId}`);
  },

  assign: async (entryId: string, type: 'reservation' | 'order' | 'session') => {
    return apiRequest<any>('/queue/assign', {
      method: 'POST',
      body: JSON.stringify({ entryId, type }),
    });
  },

  remove: async (entryId: string, type: 'reservation' | 'order' | 'session') => {
    return apiRequest<any>('/queue/remove', {
      method: 'POST',
      body: JSON.stringify({ entryId, type }),
    });
  },
};

export const revenueAPI = {
  getData: async (params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return apiRequest<any>(`/revenue${query ? `?${query}` : ''}`);
  },
  exportData: async (startDate?: string, endDate?: string) => {
    const token = localStorage.getItem('authToken');
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    
    const query = queryParams.toString();
    const response = await fetch(`${API_BASE_URL}/revenue/export${query ? `?${query}` : ''}`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateRange = startDate && endDate 
      ? `${startDate}-to-${endDate}` 
      : new Date().toISOString().split('T')[0];
    a.download = `revenue-export-${dateRange}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

export const reservationsAPI = {
  create: async (reservationData: any) => {
    return apiRequest<any>('/reservations', {
      method: 'POST',
      body: JSON.stringify(reservationData),
    });
  },

  getById: async (id: string) => {
    return apiRequest<any>(`/reservations/${id}`);
  },

  confirm: async (reservationId: string, paymentId: string, unitId?: string) => {
    return apiRequest<any>(`/reservations/${reservationId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ reservationId, paymentId, unitId }),
    });
  },

  joinQueue: async (data: {
    activityId: string;
    duration: number;
    customerName: string;
    customerPhone: string;
    qrContext?: any;
    paymentId?: string;
    paymentStatus?: 'paid' | 'offline';
  }) => {
    return apiRequest<any>('/reservations/join-queue', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  exitQueue: async (reservationId: string) => {
    return apiRequest<any>('/reservations/exit-queue', {
      method: 'POST',
      body: JSON.stringify({ reservationId }),
    });
  },
};

export const paymentsAPI = {
  createOrder: async (paymentData: any) => {
    return apiRequest<any>('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  verify: async (verificationData: any) => {
    return apiRequest<any>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify(verificationData),
    });
  },

  markOffline: async (paymentData: any) => {
    return apiRequest<any>('/payments/offline', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },
};

export const inventoryAPI = {
  getCategories: async () => {
    return apiRequest<any[]>('/inventory/categories');
  },
  createCategory: async (categoryData: any) => {
    return apiRequest<any>('/inventory/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },
  updateCategory: async (id: string, categoryData: any) => {
    return apiRequest<any>(`/inventory/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },
  deleteCategory: async (id: string) => {
    return apiRequest<any>(`/inventory/categories/${id}`, {
      method: 'DELETE',
    });
  },
  getStats: async (params?: {
    categoryId?: string;
    type?: string;
    status?: string;
    search?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    
    const query = queryParams.toString();
    return apiRequest<{
      totalItems: number;
      equipment: number;
      consumables: number;
      lowStock: number;
    }>(`/inventory/stats${query ? `?${query}` : ''}`);
  },
  getItems: async (params?: {
    categoryId?: string;
    type?: string;
    status?: string;
    lowStock?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.lowStock) queryParams.append('lowStock', 'true');
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return apiRequest<any>(`/inventory/items${query ? `?${query}` : ''}`);
  },
  getItemById: async (id: string) => {
    return apiRequest<any>(`/inventory/items/${id}`);
  },
  createItem: async (itemData: any) => {
    return apiRequest<any>('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },
  updateItem: async (id: string, itemData: any) => {
    return apiRequest<any>(`/inventory/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    });
  },
  deleteItem: async (id: string) => {
    return apiRequest<any>(`/inventory/items/${id}`, {
      method: 'DELETE',
    });
  },
  bulkDeleteItems: async (ids: string[]) => {
    return apiRequest<any>('/inventory/items/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },
  exportItems: async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/inventory/items/export/csv`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  importItems: async (file: File) => {
    const token = localStorage.getItem('authToken');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/inventory/items/import/csv`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Import failed');
    }
    return response.json();
  },

  getAssignments: async (params?: {
    serviceInstanceId?: string;
    inventoryItemId?: string;
    active?: boolean;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.serviceInstanceId) queryParams.append('serviceInstanceId', params.serviceInstanceId);
    if (params?.inventoryItemId) queryParams.append('inventoryItemId', params.inventoryItemId);
    if (params?.active !== undefined) queryParams.append('active', params.active.toString());
    
    const query = queryParams.toString();
    return apiRequest<any[]>(`/inventory/assignments${query ? `?${query}` : ''}`);
  },
  assignEquipment: async (assignmentData: any) => {
    return apiRequest<any>('/inventory/assignments', {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    });
  },
  unassignEquipment: async (id: string) => {
    return apiRequest<any>(`/inventory/assignments/${id}/unassign`, {
      method: 'PUT',
    });
  },

  getMaintenanceLogs: async (params?: {
    inventoryItemId?: string;
    serviceInstanceId?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.inventoryItemId) queryParams.append('inventoryItemId', params.inventoryItemId);
    if (params?.serviceInstanceId) queryParams.append('serviceInstanceId', params.serviceInstanceId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return apiRequest<any>(`/inventory/maintenance${query ? `?${query}` : ''}`);
  },
  createMaintenanceLog: async (logData: any) => {
    return apiRequest<any>('/inventory/maintenance', {
      method: 'POST',
      body: JSON.stringify(logData),
    });
  },
  updateMaintenanceLog: async (id: string, logData: any) => {
    return apiRequest<any>(`/inventory/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(logData),
    });
  },

  getStockTransactions: async (params?: {
    inventoryItemId?: string;
    type?: string;
    reason?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.inventoryItemId) queryParams.append('inventoryItemId', params.inventoryItemId);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.reason) queryParams.append('reason', params.reason);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return apiRequest<any>(`/inventory/transactions${query ? `?${query}` : ''}`);
  },
  createStockTransaction: async (transactionData: any) => {
    return apiRequest<any>('/inventory/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  },

  getServiceInstanceDetails: async (id: string) => {
    return apiRequest<any>(`/inventory/service-instances/${id}`);
  },
  updateServiceInstance: async (id: string, instanceData: any) => {
    return apiRequest<any>(`/inventory/service-instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(instanceData),
    });
  },
};
