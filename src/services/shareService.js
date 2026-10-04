import { apiRequest } from './apiClient'
export const SHAREABLE_MODULES = [{ key: 'time', label: 'Time' }, { key: 'study', label: 'Study' }, { key: 'sleep', label: 'Sleep' }, { key: 'money', label: 'Money' }, { key: 'routines', label: 'Routines' }]
export const createShareSnapshot = (payload, expiresInDays = payload.expiresInDays || 7) => apiRequest('shares', { method: 'POST', body: { payload, expiresInDays } })
export const getShares = () => apiRequest('shares')
export const revokeShare = id => apiRequest('shares/revoke', { method: 'POST', body: { id } })
export const readShare = token => apiRequest(`shares/read?token=${encodeURIComponent(token)}`)
const legacyDisabled = () => { throw new Error('Public source-file sharing is disabled. Create a minimized snapshot from Insights. Review existing public Drive permissions in Google Drive.') }
export const makeFilePublic = legacyDisabled
export const revokePublicAccess = legacyDisabled
export const generateShareLink = legacyDisabled
export const fetchPublicFileData = legacyDisabled
export const isFilePublic = () => false
export const getShareConfig = () => null
export const saveShareConfig = legacyDisabled
