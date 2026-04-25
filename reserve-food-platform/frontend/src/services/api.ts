const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions extends RequestInit {
  method?: HttpMethod;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || errorData.message || 'Request failed';
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<{ token: string; user: { id: number; name: string; email: string; userType: string; organizationName?: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { name: string; email: string; password: string; userType: string; organizationName?: string }) =>
    apiRequest<{ token: string; user: { id: number; name: string; email: string; userType: string; organizationName?: string } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  me: () => apiRequest<{ user: { id: number; name: string; email: string; userType: string; organizationName?: string } }>('/api/auth/me'),
};

// Donor API
export const donorApi = {
  getStats: (userId: number) => apiRequest<import('../types').DonorStats>(`/api/donor/stats/${userId}`),
  getListings: (userId: number, status?: string) =>
    apiRequest<import('../types').Listing[]>(`/api/donor/listings/${userId}${status ? `?status=${status}` : ''}`),
  getClaims: (userId: number) => apiRequest<import('../types').Claim[]>(`/api/donor/claims/${userId}`),
  getDeliveryTracking: (userId: number) => apiRequest<import('../types').Claim[]>(`/api/donor/delivery-tracking/${userId}`),
  createListing: (data: Record<string, unknown>) =>
    apiRequest<{ message: string; listingId: number }>('/api/donor/listings', { method: 'POST', body: JSON.stringify(data) }),
  updateListing: (id: number, data: Record<string, unknown>) =>
    apiRequest<{ message: string }>(`/api/donor/listings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteListing: (id: number) =>
    apiRequest<{ message: string }>(`/api/donor/listings/${id}`, { method: 'DELETE' }),
  getAnalytics: (userId: number) => apiRequest<Record<string, unknown>>(`/api/donor/analytics/${userId}`),
  getHistory: (userId: number) => apiRequest<Record<string, unknown>[]>(`/api/donor/history/${userId}`),
  getProfile: (userId: number) => apiRequest<import('../types').User>(`/api/donor/profile/${userId}`),
  updateProfile: (userId: number, data: Record<string, unknown>) =>
    apiRequest<{ message: string }>(`/api/donor/profile/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  submitVerification: (data: { businessName: string; businessType: string; fssaiNumber?: string; gstNumber?: string; description?: string; certificateDetails?: string; document?: File | null }) => {
    const formData = new FormData();
    formData.append('businessName', data.businessName);
    formData.append('businessType', data.businessType);
    if (data.fssaiNumber) formData.append('fssaiNumber', data.fssaiNumber);
    if (data.gstNumber) formData.append('gstNumber', data.gstNumber);
    if (data.description) formData.append('description', data.description);
    if (data.certificateDetails) formData.append('certificateDetails', data.certificateDetails);
    if (data.document) formData.append('document', data.document);

    const token = localStorage.getItem('token');
    return fetch(`${API_BASE}/api/donor/verification`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Request failed');
      }
      return res.json() as Promise<{ message: string; requestId: number }>;
    });
  },
  getVerificationStatus: () =>
    apiRequest<{ request: { id: number; status: string; businessName: string; businessType: string; fssaiNumber: string; gstNumber: string; description: string; certificateDetails: string; adminNotes: string; submittedAt: string; reviewedAt: string } | null; isVerified: boolean }>('/api/donor/verification'),
};

// NGO API
export const ngoApi = {
  getStats: (userId: number) => apiRequest<import('../types').NGOStats>(`/api/ngo/stats/${userId}`),
  getListings: (includeInactive = false) => apiRequest<import('../types').Listing[]>(`/api/ngo/listings${includeInactive ? '?includeInactive=1' : ''}`),
  getClaims: (userId: number) => apiRequest<import('../types').Claim[]>(`/api/ngo/claims/${userId}`),
  claimListing: (
    data:
      | { listingId: number; ngoId: number; scheduledTime?: string; deliveryMethod?: 'self-pickup' | 'platform-delivery'; ngoLatitude?: number | null; ngoLongitude?: number | null; paymentTransactionId?: string }
      | FormData
  ) => {
    if (data instanceof FormData) {
      const token = localStorage.getItem('token');
      return fetch(`${API_BASE}/api/ngo/claim`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: data,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Request failed');
        }
        return res.json() as Promise<{ message: string; claim: import('../types').Claim }>;
      });
    }

    return apiRequest<{ message: string; claim: import('../types').Claim }>('/api/ngo/claim', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getDeliveryQuote: (data: { listingId: number; ngoLatitude?: number | null; ngoLongitude?: number | null }) =>
    apiRequest<{
      listingId: number;
      foodName: string;
      deliveryDistance: number;
      deliveryFee: number;
      pricingModel: string;
      breakdown: {
        baseFare: number;
        baseDistanceKm: number;
        perKmRate: number;
        extraDistanceKm: number;
        distanceFare: number;
        totalFare: number;
      };
    }>('/api/ngo/delivery-quote', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getDeliveryTracking: (userId: number) => apiRequest<import('../types').Claim[]>(`/api/ngo/delivery-tracking/${userId}`),
  getHistory: (userId: number) => apiRequest<Record<string, unknown>[]>(`/api/ngo/history/${userId}`),
  getImpact: (userId: number) => apiRequest<Record<string, unknown>>(`/api/ngo/impact/${userId}`),
  getProfile: (userId: number) => apiRequest<import('../types').User>(`/api/ngo/profile/${userId}`),
  updateProfile: (userId: number, data: Record<string, unknown>) =>
    apiRequest<{ message: string }>(`/api/ngo/profile/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  submitVerification: (data: { businessName: string; businessType: string; fssaiNumber?: string; gstNumber?: string; description?: string; certificateDetails?: string; document?: File | null }) => {
    const formData = new FormData();
    formData.append('businessName', data.businessName);
    formData.append('businessType', data.businessType);
    if (data.fssaiNumber) formData.append('fssaiNumber', data.fssaiNumber);
    if (data.gstNumber) formData.append('gstNumber', data.gstNumber);
    if (data.description) formData.append('description', data.description);
    if (data.certificateDetails) formData.append('certificateDetails', data.certificateDetails);
    if (data.document) formData.append('document', data.document);

    const token = localStorage.getItem('token');
    return fetch(`${API_BASE}/api/ngo/verification`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Request failed');
      }
      return res.json() as Promise<{ message: string; requestId: number }>;
    });
  },
  getVerificationStatus: () =>
    apiRequest<{ request: { id: number; status: string; businessName: string; businessType: string; fssaiNumber: string; gstNumber: string; description: string; certificateDetails: string; adminNotes: string; submittedAt: string; reviewedAt: string } | null; isVerified: boolean }>('/api/ngo/verification'),
};

// Claims API
export const claimsApi = {
  confirm: (claimId: number) => apiRequest<{ message: string }>(`/api/claims/${claimId}/confirm`, { method: 'PATCH' }),
  reject: (claimId: number) => apiRequest<{ message: string }>(`/api/claims/${claimId}/reject`, { method: 'PATCH' }),
  collect: (claimId: number) => apiRequest<{ message: string }>(`/api/claims/${claimId}/collect`, { method: 'PATCH' }),
  cancel: (claimId: number, reason?: string) =>
    apiRequest<{ message: string }>(`/api/claims/${claimId}/cancel`, { method: 'PATCH', body: JSON.stringify({ cancelReason: reason }) }),
};

// Chat API
export const chatApi = {
  getConversations: (userId: number) => apiRequest<import('../types').Conversation[]>(`/api/chat/conversations/${userId}`),
  getMessages: (claimId: number) => apiRequest<import('../types').Message[]>(`/api/chat/messages/${claimId}`),
  sendMessage: (data: { claimId: number; receiverId: number; content: string; messageType?: string; imageUrl?: string }) =>
    apiRequest<import('../types').Message>('/api/chat/messages', { method: 'POST', body: JSON.stringify(data) }),
  markRead: (claimId: number) => apiRequest<{ message: string }>(`/api/chat/messages/${claimId}/read`, { method: 'PATCH' }),
};

// Reviews API
export const reviewsApi = {
  create: (data: { claimId: number; reviewerId: number; revieweeId: number; foodQuality: number; communication: number; timeliness: number; overall: number; comment?: string; isAnonymous?: boolean }) =>
    apiRequest<{ message: string; id: number }>('/api/reviews', { method: 'POST', body: JSON.stringify(data) }),
  getByClaim: (claimId: number) => apiRequest<import('../types').Review[]>(`/api/reviews/claim/${claimId}`),
  getByUser: (userId: number) => apiRequest<import('../types').Review[]>(`/api/reviews/user/${userId}`),
  getStats: (userId: number) => apiRequest<import('../types').ReviewStats>(`/api/reviews/user/${userId}/stats`),
  getPending: (userId: number) => apiRequest<import('../types').Claim[]>(`/api/reviews/pending/${userId}`),
};

// Notifications API
export const notificationsApi = {
  get: (userId: number, limit = 20, offset = 0) =>
    apiRequest<import('../types').Notification[]>(`/api/notifications/${userId}?limit=${limit}&offset=${offset}`),
  getUnreadCount: (userId: number) => apiRequest<{ count: number }>(`/api/notifications/${userId}/unread`),
  markRead: (id: number) => apiRequest<{ message: string }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: (userId: number) => apiRequest<{ message: string }>(`/api/notifications/${userId}/read-all`, { method: 'PATCH' }),
};

// Admin API
export const adminApi = {
  getStats: () => apiRequest<import('../types').AdminStats>('/api/admin/stats'),
  getDrivers: () => apiRequest<import('../types').User[]>('/api/admin/drivers'),
  getUsers: (params?: string) => apiRequest<{ users: import('../types').User[]; total: number }>(`/api/admin/users${params ? `?${params}` : ''}`),
  getPendingVerifications: () => apiRequest<import('../types').User[]>('/api/admin/pending-verifications'),
  verifyUser: (id: number) => apiRequest<{ message: string }>(`/api/admin/users/${id}/verify`, { method: 'PATCH' }),
  activateUser: (id: number, isActive: boolean) =>
    apiRequest<{ message: string }>(`/api/admin/users/${id}/activate`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  deleteUser: (id: number) => apiRequest<{ message: string }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  getListings: (params?: string) => apiRequest<{ listings: import('../types').Listing[]; total: number }>(`/api/admin/listings${params ? `?${params}` : ''}`),
  deleteListing: (id: number) => apiRequest<{ message: string }>(`/api/admin/listings/${id}`, { method: 'DELETE' }),
  getClaims: (params?: string) => apiRequest<{ claims: import('../types').Claim[]; total: number }>(`/api/admin/claims${params ? `?${params}` : ''}`),
  getClaimAnalytics: () => apiRequest<Record<string, unknown>>('/api/admin/claims/analytics'),
  getReviews: (params?: string) => apiRequest<{ reviews: import('../types').Review[]; total: number }>(`/api/admin/reviews${params ? `?${params}` : ''}`),
  deleteReview: (id: number) => apiRequest<{ message: string }>(`/api/admin/reviews/${id}`, { method: 'DELETE' }),
  getContactMessages: (params?: string) => apiRequest<{ messages: import('../types').ContactMessage[]; total: number }>(`/api/admin/contact-messages${params ? `?${params}` : ''}`),
  updateContactStatus: (id: number, status: string) =>
    apiRequest<{ message: string }>(`/api/admin/contact-messages/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getReportSummary: () => apiRequest<Record<string, unknown>>('/api/admin/reports/summary'),
  getImpactReport: () => apiRequest<Record<string, unknown>>('/api/admin/reports/impact'),
  getDeliveryTracking: () => apiRequest<import('../types').Claim[]>('/api/admin/delivery-tracking'),
  dispatchDriver: (claimId: number, driverId: number) =>
    apiRequest<{ message: string }>(`/api/admin/deliveries/${claimId}/dispatch`, { method: 'PATCH', body: JSON.stringify({ driverId }) }),
  reviewDeliveryPayment: (claimId: number, action: 'approve' | 'reject', adminNotes?: string) =>
    apiRequest<{ message: string; paymentStatus: string; deliveryStatus: string }>(`/api/admin/deliveries/${claimId}/payment-review`, {
      method: 'PATCH',
      body: JSON.stringify({ action, adminNotes }),
    }),
  getVerificationRequests: (status?: string) =>
    apiRequest<Array<{ id: number; userId: number; businessName: string; businessType: string; fssaiNumber: string; gstNumber: string; description: string; certificateDetails: string; status: string; adminNotes: string; submittedAt: string; reviewedAt: string; name: string; email: string; userType: string; organizationName: string; phone: string; city: string }>>(`/api/admin/verification-requests${status ? `?status=${status}` : ''}`),
  reviewVerification: (id: number, action: 'approve' | 'reject', adminNotes?: string) =>
    apiRequest<{ message: string }>(`/api/admin/verification-requests/${id}/review`, { method: 'PATCH', body: JSON.stringify({ action, adminNotes }) }),
};

// Driver API
export const driverApi = {
  getMyDeliveries: () => apiRequest<import('../types').Claim[]>('/api/driver/deliveries/me'),
  updateDeliveryStatus: (claimId: number, deliveryStatus: 'assigned' | 'in-transit' | 'delivered' | 'failed') =>
    apiRequest<{ message: string }>(`/api/driver/deliveries/${claimId}/status`, { method: 'PATCH', body: JSON.stringify({ deliveryStatus }) }),
  updateLocation: (claimId: number, lat: number, lng: number, progress?: number) =>
    apiRequest<{ message: string }>(`/api/driver/deliveries/${claimId}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ lat, lng, progress }),
    }),
};

// Support API
export const supportApi = {
  getImpactStats: () => apiRequest<import('../types').ImpactStats>('/api/support/impact-stats'),
  getGratitudeWall: () => apiRequest<import('../types').GratitudeEntry[]>('/api/support/gratitude-wall'),
  addGratitudeEntry: (data: { displayName: string; message?: string; amount?: number; tier?: string }) =>
    apiRequest<{ message: string }>('/api/support/gratitude-wall', { method: 'POST', body: JSON.stringify(data) }),
  sendContact: (data: { name: string; email: string; organization?: string; interestType?: string; subject?: string; message: string }) =>
    apiRequest<{ message: string }>('/api/support/contact', { method: 'POST', body: JSON.stringify(data) }),
};

// ML API
export const mlApi = {
  getForecast24h: () => apiRequest<{ forecast: import('../types').MLForecastHour[]; source: string }>('/api/ml/forecast/24h'),
  getForecastWeekly: () => apiRequest<{ forecast: import('../types').MLForecastDay[]; source: string }>('/api/ml/forecast/weekly'),
  getForecastSummary: () => apiRequest<import('../types').ForecastSummary>('/api/ml/forecast/summary'),
  getAreaForecast: () => apiRequest<{ areas: import('../types').AreaForecast[]; source: string }>('/api/ml/forecast/areas'),
  getDonorForecast: (donorId: number) => apiRequest<{ patterns: Record<string, unknown>[]; source: string }>(`/api/ml/forecast/donor/${donorId}`),
  getHeatmapDensity: () => apiRequest<number[][]>('/api/ml/maps/heatmap/density'),
  getHeatmapHistorical: () => apiRequest<number[][]>('/api/ml/maps/heatmap/historical'),
  getHeatmapSupplyDemand: () => apiRequest<{ supply: Record<string, unknown>[]; demand: Record<string, unknown>[] }>('/api/ml/maps/heatmap/supply-demand'),
  getHeatmapTemporal: (hour: number) => apiRequest<number[][]>(`/api/ml/maps/heatmap/temporal/${hour}`),
  getHealth: () => apiRequest<{ status: string; backend?: string }>('/api/ml/health'),
  getPeakHours: () => apiRequest<{ hours: { hour: number; count: number }[]; source: string }>('/api/ml/analytics/peak-hours'),
  getCategoryTrends: () => apiRequest<{ trends: Record<string, unknown>[]; source: string }>('/api/ml/analytics/category-trends'),
  getCategoryDistribution: () => apiRequest<{ distribution: import('../types').CategoryDistribution[]; source: string }>('/api/ml/analytics/category-distribution'),
  getDonorPatterns: () => apiRequest<{ donors: Record<string, unknown>[]; source: string }>('/api/ml/analytics/donor-patterns'),
  getDonorInsights: (userId: number) => apiRequest<{ insights: import('../types').AIInsight[]; count: number }>(`/api/ml/insights/donor/${userId}`),
  getNgoInsights: (userId: number) => apiRequest<{ insights: import('../types').AIInsight[]; count: number }>(`/api/ml/insights/ngo/${userId}`),
};
