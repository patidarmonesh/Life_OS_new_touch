import { apiRequest } from './apiClient.js'
export const getTimerLease = () => apiRequest('timer/lease')
export const claimTimerLease = options => apiRequest('timer/lease', { method: 'POST', body: { ...options, action: 'acquire' } })
export const renewTimerLease = options => apiRequest('timer/lease', { method: 'POST', body: { ...options, action: 'renew' } })
export const releaseTimerLease = options => apiRequest('timer/lease', { method: 'POST', body: { ...options, action: 'release' } })
