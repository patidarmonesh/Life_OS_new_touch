import { authenticate, bodyJson, capabilities, config, cookie, db, filter, hash, HttpError, randomToken, send, setCookie } from './core.js'
import { beginOAuth, disconnect, finishOAuth } from './google.js'
import { exportPlan, validateApprovedPlan } from './calendar.js'
import { assertShareReadable, sanitizeSnapshot } from './shares.js'
import { requestAi } from './ai.js'
import { runPushJobs, savePush, scheduleReminders, testPush } from './push.js'
import { approvedOwnedPlan, ownedRecords, ownedReport } from './context.js'
import { privacyDelete, privacyExport } from './privacy.js'

const collections = new Set(['finance','study','timeflow','health','habits','journal','wisdom','goals','decisions','crm','secondBrain','readings','meditations','settings','aiChat','planning','activities','tasks','plans','sleep','routines','transactions','captures','execution'])
export function validateMutation(body, owner) {
  if (body.ownerId !== owner) throw new HttpError(403, 'The queued change belongs to a different account.', 'owner_mismatch')
  if (!collections.has(body.collection) || typeof body.id !== 'string' || body.id.length > 160 || typeof body.recordId !== 'string' || body.recordId.length > 300 || !Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0 || !body.body || typeof body.body !== 'object' || Array.isArray(body.body)) throw new HttpError(400, 'Invalid record mutation.')
  const parents = Array.isArray(body.parents) ? body.parents : []
  if (parents.length > 20 || parents.some(p => !collections.has(p.collection) || typeof p.id !== 'string' || p.ownerId && p.ownerId !== owner)) throw new HttpError(400, 'Invalid parent references.')
  return { id: body.id, collection: body.collection, recordId: body.recordId, baseRevision: body.baseRevision, body: body.body, deleted: body.deleted === true, parents }
}
export default async function handler(req, res) {
  const url = new URL(req.url, config().origin)
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '')
  try {
    if (req.method === 'GET' && path === 'session') {
      const features = capabilities()
      if (!features.auth) return send(res, 200, { user: null, capabilities: features, integration: { state: 'unconfigured' } })
      let session
      try { session = await authenticate(req) } catch (error) { if (error.status === 401) return send(res, 200, { user: null, capabilities: features, integration: { state: 'disconnected' } }); throw error }
      const user = (await db(`lifeos_users?id=eq.${session.owner_id}&select=id,name,email,picture,source_revision`))?.[0]
      const connection = (await db(`lifeos_connections?owner_id=eq.${session.owner_id}&select=state,scopes,expires_at`))?.[0]
      return send(res, 200, { user, csrf: session.csrf, capabilities: features, integration: connection || { state: 'disconnected' } })
    }
    if (req.method === 'POST' && path === 'oauth/start') {
      if (req.headers.origin !== config().origin || req.headers['content-type']?.split(';')[0] !== 'application/json') throw new HttpError(403, 'Request verification failed.')
      const body = await bodyJson(req, 1000)
      return send(res, 200, await beginOAuth(req, res, body.purpose))
    }
    if (req.method === 'GET' && path === 'oauth/callback') return await finishOAuth(req, res, url)
    if (req.method === 'GET' && path === 'shares/read') {
      const token = url.searchParams.get('token') || ''
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(404, 'Shared report not found.')
      const share = (await db(`lifeos_shares?token_hash=eq.${hash(token)}&select=payload,expires_at,revoked_at`))?.[0]
      return send(res, 200, { payload: assertShareReadable(share) })
    }
    if (path === 'drive-proxy') throw new HttpError(410, 'Legacy public Drive sharing is disabled. Ask the owner for a snapshot link.', 'legacy_share_disabled')
    if (path === 'push/run' && req.method === 'GET') return send(res, 200, await runPushJobs(req))
    const session = await authenticate(req, req.method !== 'GET')
    const owner = session.owner_id
    if (path === 'privacy/export' && req.method === 'GET') return send(res, 200, await privacyExport(owner))
    if (path === 'privacy/delete' && req.method === 'POST') return send(res, 200, await privacyDelete(owner, await bodyJson(req, 2000), res))
    if (path === 'logout' && req.method === 'POST') {
      await db(`lifeos_sessions?token_hash=eq.${hash(cookie(req, 'lifeos_session'))}&owner_id=eq.${owner}`, { method: 'DELETE' })
      setCookie(res, 'lifeos_session', '', 0); return send(res, 200, { status: 'signed_out' })
    }
    if (path === 'google/disconnect' && req.method === 'POST') { await disconnect(owner); return send(res, 200, { state: 'disconnected' }) }
    if (path === 'timer/lease' && req.method === 'GET') return send(res, 200, { lease: (await db(`lifeos_timer_leases?owner_id=eq.${owner}&select=*`))?.[0] || null })
    if (path === 'timer/lease' && req.method === 'POST') {
      const body = await bodyJson(req, 2000)
      if (!['acquire', 'renew', 'release'].includes(body.action) || typeof body.timerId !== 'string' || !body.timerId || body.timerId.length > 160 || typeof body.deviceId !== 'string' || !body.deviceId || body.deviceId.length > 160 || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) throw new HttpError(400, 'Invalid timer lease request.')
      return send(res, 200, await db('rpc/lifeos_timer_lease', { method: 'POST', body: { p_owner: owner, p_timer: body.timerId, p_device: body.deviceId, p_revision: body.expectedRevision, p_action: body.action, p_takeover: body.takeover === true } }))
    }
    if (path === 'sync' && req.method === 'GET') {
      return send(res, 200, { records: await ownedRecords(owner) })
    }
    if (path === 'sync' && req.method === 'POST') {
      const mutation = validateMutation(await bodyJson(req), owner)
      return send(res, 200, await db('rpc/lifeos_apply_mutation', { method: 'POST', body: { p_owner: owner, p_mutation: mutation } }))
    }
    if (path === 'shares' && req.method === 'POST') {
      const body = await bodyJson(req)
      sanitizeSnapshot(body.payload)
      const computed = await ownedReport(owner, body.payload)
      if (computed.sourceRevision !== body.payload.sourceRevision) throw new HttpError(409, 'Sync your latest records before publishing this report.', 'snapshot_outdated')
      const payload = sanitizeSnapshot(computed)
      const days = Number(body.expiresInDays || 7)
      if (!Number.isInteger(days) || days < 1 || days > 30) throw new HttpError(400, 'Choose an expiry from 1 to 30 days.')
      const token = randomToken(), expiresAt = new Date(Date.now() + days * 86400_000).toISOString()
      const rows = await db('lifeos_shares', { method: 'POST', body: { owner_id: owner, token_hash: hash(token), payload, expires_at: expiresAt } })
      return send(res, 201, { id: rows[0].id, url: `${config().origin}/shared#${token}`, payload, expiresAt })
    }
    if (path === 'shares' && req.method === 'GET') return send(res, 200, { shares: await db(`lifeos_shares?owner_id=eq.${owner}&select=id,payload,expires_at,revoked_at,created_at&order=created_at.desc`) })
    if (path === 'shares/revoke' && req.method === 'POST') {
      const body = await bodyJson(req, 2000)
      const rows = await db(`lifeos_shares?owner_id=eq.${owner}&id=eq.${filter(body.id)}`, { method: 'PATCH', body: { revoked_at: new Date().toISOString() } })
      if (!rows.length) throw new HttpError(404, 'Share not found.')
      return send(res, 200, { status: 'revoked' })
    }
    if (['ai', 'gemini-proxy'].includes(path) && req.method === 'POST') return send(res, 200, await requestAi(owner, await bodyJson(req, 2_200_000)))
    if (path === 'calendar/export' && req.method === 'POST') return send(res, 200, await exportPlan(owner, await approvedOwnedPlan(owner, (await bodyJson(req)).plan)))
    if (path === 'push/subscribe' && req.method === 'POST') return send(res, 200, await savePush(owner, await bodyJson(req, 5000)))
    if (path === 'push/test' && req.method === 'POST') return send(res, 200, await testPush(owner))
    if (path === 'push/schedule' && req.method === 'POST') return send(res, 200, await scheduleReminders(owner, validateApprovedPlan(await approvedOwnedPlan(owner, (await bodyJson(req)).plan))))
    if (path === 'push/status' && req.method === 'GET') return send(res, 200, { jobs: await db(`lifeos_reminders?owner_id=eq.${owner}&select=id,due_at,status,attempts,last_error&order=due_at.desc&limit=50`) })
    throw new HttpError(404, 'API route not found.')
  } catch (error) {
    if (path === 'oauth/callback') {
      res.statusCode = 303; res.setHeader('Location', `${config().origin}/auth?error=${encodeURIComponent(error instanceof HttpError ? error.message : 'Google sign-in could not be verified. Please try again.')}`); res.setHeader('Cache-Control', 'no-store'); return res.end()
    }
    return send(res, error.status || 500, { error: error instanceof HttpError ? error.message : 'The service could not complete this request. Retry later.', code: error.code || 'server_error' })
  }
}
