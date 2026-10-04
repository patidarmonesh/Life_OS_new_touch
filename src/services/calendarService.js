import { apiRequest } from './apiClient'
export const exportApprovedPlan = plan => apiRequest('calendar/export', { method: 'POST', body: { plan } })
export const schedulePlanReminders = plan => apiRequest('push/schedule', { method: 'POST', body: { plan } })
