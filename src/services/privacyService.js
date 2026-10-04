import { apiRequest, setApiSession } from './apiClient.js'
import { clearOwnerOutbox } from './syncService.js'
export const exportAccountData = () => apiRequest('privacy/export')
export async function deleteAccountData(confirmation, expectedOwnerId) {
  const result = await apiRequest('privacy/delete', { method: 'POST', body: { confirmation, expectedOwnerId } })
  setApiSession(null)
  return result
}
export async function clearOwnerDeviceCache(ownerId) {
  if (typeof ownerId !== 'string' || !ownerId) throw new Error('Choose the account whose device data should be removed.')
  await clearOwnerOutbox(ownerId)
  const prefix = `lifeos:v2:${encodeURIComponent(ownerId)}:`
  const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix))
  keys.forEach(key => localStorage.removeItem(key))
  return { status: 'cleared', ownerId, removedLocalKeys: keys.length }
}
