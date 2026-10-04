import { db, filter, HttpError, setCookie } from './core.js'
import { ownedRecords } from './context.js'
import { disconnect } from './google.js'

const sensitiveKeys = new Set(['apikey', 'geminiapikey', 'googleapikey', 'accesskey', 'accesstoken', 'refreshtoken', 'idtoken', 'tokencipher', 'accesscipher', 'refreshcipher', 'tokenhash', 'csrf', 'clientsecret', 'servicekey', 'servicerolekey', 'tokenencryptionkey', 'lifeosgooglesession'])
export function scrubCredentials(value) {
  if (Array.isArray(value)) return value.map(scrubCredentials)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitiveKeys.has(key.replace(/[^a-z]/gi, '').toLowerCase())).map(([key, item]) => [key, scrubCredentials(item)]))
}
export function validateDeleteRequest(body, owner) {
  if (body?.confirmation !== 'DELETE MY LIFEOS ACCOUNT' || body?.expectedOwnerId !== owner) throw new HttpError(400, 'Type DELETE MY LIFEOS ACCOUNT and confirm the current account before deletion.', 'confirmation_required')
}
export async function privacyExport(owner) {
  const profile = (await db(`lifeos_users?id=eq.${owner}&select=id,name,email,picture,created_at,source_revision`))?.[0]
  const records = await ownedRecords(owner)
  const shares = await db(`lifeos_shares?owner_id=eq.${owner}&select=id,payload,expires_at,revoked_at,created_at`)
  return scrubCredentials({ schemaVersion: 1, format: 'lifeos-cloud-privacy-export', exportedAt: new Date().toISOString(), owner: profile, records, staticShares: shares })
}
export async function privacyDelete(owner, body, res, dependencies = {}) {
  validateDeleteRequest(body, owner)
  const revoke = dependencies.disconnect || disconnect, storage = dependencies.storage || db
  // Revocation failure is explicit; retain data so deletion can be retried safely.
  await revoke(owner)
  const removed = await storage(`lifeos_users?id=eq.${filter(owner)}`, { method: 'DELETE' })
  if (!removed?.length) throw new HttpError(404, 'The signed-in LifeOS account no longer exists.')
  // Credentials, records, reminders, shares, quotas, sessions and timer leases cascade.
  // Transient worker leases have no FK; deleting these owner-specific keys is best-effort.
  for (const key of [`refresh:${owner}`, `calendar:${owner}`]) {
    try { await storage(`lifeos_leases?key=eq.${filter(key)}`, { method: 'DELETE' }) } catch { /* expired automatically by the lease predicate */ }
  }
  setCookie(res, 'lifeos_session', '', 0)
  return { status: 'deleted', ownerId: owner, message: 'LifeOS cloud records and sessions are deleted. Exported copies, local browser backups and Google Calendar events are not erased by this request.' }
}
