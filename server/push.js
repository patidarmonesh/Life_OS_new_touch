import { config, db, filter, hash, HttpError, safeEqual, takeLease } from './core.js'
import { ownedRecords } from './context.js'
import { materializeRemoteModules } from '../src/services/syncService.js'
import { initialState } from '../src/context/defaultState.js'
import { dayBounds, localDate } from '../src/domain/metrics/dates.js'

export function validPushSubscription(value) {
  try {
    const url = new URL(value?.endpoint)
    const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname.endsWith('.push.services.mozilla.com') || url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com')
    return url.protocol === 'https:' && allowed && !url.port && !url.username && !url.password && /^[A-Za-z0-9_-]{80,160}$/.test(value?.keys?.p256dh || '') && /^[A-Za-z0-9_-]{16,32}$/.test(value?.keys?.auth || '')
  } catch { return false }
}
export async function savePush(owner, body) {
  if (!validPushSubscription(body.subscription)) throw new HttpError(400, 'Unsupported or invalid browser push subscription.')
  const subscription = { endpoint: body.subscription.endpoint, keys: { p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth } }
  const id = hash(subscription.endpoint)
  await db('lifeos_push_subscriptions?on_conflict=owner_id,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { owner_id: owner, id, subscription, enabled: body.enabled !== false } })
  return { id, status: body.enabled === false ? 'disabled' : 'subscribed' }
}
export async function scheduleReminders(owner, plan) {
  const planId = plan.originalRevisionId || plan.id
  await db(`lifeos_reminders?owner_id=eq.${owner}&plan_id=eq.${filter(planId)}&plan_revision=neq.${plan.revision}&status=eq.pending`, { method: 'PATCH', body: { status: 'cancelled' } })
  let count = 0
  for (const block of plan.blocks) {
    if (!block.pushReminder) continue
    const due = Date.parse(block.startAt) - (Number(block.reminderMinutes) || 0) * 60000
    if (due < Date.now() || due > Date.now() + 366 * 86400_000) continue
    await db('lifeos_reminders?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: { id: hash(`${owner}:${planId}:${plan.revision}:${block.id}:start`), owner_id: owner, plan_id: planId, plan_revision: plan.revision, block_id: block.id, due_at: new Date(due).toISOString(), title: 'Your planned block is due', url: `/plan?block=${encodeURIComponent(block.id)}`, status: 'pending' } })
    count += 1
  }
  return { status: 'scheduled', count }
}
export function inQuietHours(now, timezone, preferences = {}) {
  const start = preferences.pushQuietStart || '22:00', end = preferences.pushQuietEnd || '07:00'
  if (start === end) return false
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(now))
  return start < end ? parts >= start && parts < end : parts >= start || parts < end
}
async function pushSender() {
  const c = config()
  if (!c.vapidPublic || !c.vapidPrivate || !process.env.VAPID_SUBJECT) throw new HttpError(503, 'Web Push is not configured.', 'unconfigured')
  const { default: webpush } = await import('web-push')
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, c.vapidPublic, c.vapidPrivate)
  return webpush
}
export async function testPush(owner) {
  const push = await pushSender()
  const subscriptions = await db(`lifeos_push_subscriptions?owner_id=eq.${owner}&enabled=eq.true&select=*`)
  if (!subscriptions.length) throw new HttpError(409, 'Enable notifications on this device first.')
  let accepted = 0
  for (const sub of subscriptions) {
    try { await push.sendNotification(sub.subscription, JSON.stringify({ title: 'LifeOS test reminder', body: 'Tap to open Today.', url: '/', tag: 'lifeos-test' }), { TTL: 60 }); accepted += 1 }
    catch (error) { if ([404, 410].includes(error.statusCode)) await db(`lifeos_push_subscriptions?owner_id=eq.${owner}&id=eq.${sub.id}`, { method: 'DELETE' }) }
  }
  return { status: accepted ? 'accepted_by_push_service' : 'failed', accepted, message: 'Acceptance is not proof that a notification was displayed.' }
}
export async function runPushJobs(req) {
  if (!process.env.CRON_SECRET || !safeEqual(req.headers.authorization, `Bearer ${process.env.CRON_SECRET}`)) throw new HttpError(401, 'Unauthorized scheduler.')
  const release = await takeLease('push-scheduler', 120)
  try {
    const push = await pushSender()
    const jobs = await db(`lifeos_reminders?status=eq.pending&due_at=lte.${filter(new Date().toISOString())}&attempts=lt.5&order=due_at.asc&limit=100`)
    const ownerStates = new Map()
    let accepted = 0
    for (const job of jobs) {
      if (!ownerStates.has(job.owner_id)) ownerStates.set(job.owner_id, materializeRemoteModules(await ownedRecords(job.owner_id), initialState))
      const state = ownerStates.get(job.owner_id), timezone = state.settings.profile.timezone, preferences = state.settings.preferences
      const latest = (state.planning.revisions || []).filter(plan => (plan.originalRevisionId || plan.id) === job.plan_id && plan.status === 'approved').sort((a,b) => b.revision-a.revision)[0]
      if (!latest || latest.revision !== job.plan_revision) { await db(`lifeos_reminders?id=eq.${job.id}`, { method: 'PATCH', body: { status: 'cancelled' } }); continue }
      if (inQuietHours(Date.now(), timezone, preferences)) { await db(`lifeos_reminders?id=eq.${job.id}`, { method: 'PATCH', body: { status: 'suppressed_quiet_hours' } }); continue }
      const bounds = dayBounds(localDate(Date.now(), timezone), timezone)
      const daily = await db(`lifeos_reminders?owner_id=eq.${job.owner_id}&status=eq.accepted_by_push_service&delivered_at=gte.${filter(new Date(bounds.start).toISOString())}&delivered_at=lt.${filter(new Date(bounds.end).toISOString())}&select=id`)
      const budget = Math.max(0, Math.min(30, Number(preferences.pushDailyBudget ?? 10)))
      if (daily.length >= budget) { await db(`lifeos_reminders?id=eq.${job.id}`, { method: 'PATCH', body: { status: 'suppressed_budget' } }); continue }
      if (Date.now() - Date.parse(job.due_at) > 7200000) { await db(`lifeos_reminders?id=eq.${job.id}`, { method: 'PATCH', body: { status: 'expired' } }); continue }
      const subs = await db(`lifeos_push_subscriptions?owner_id=eq.${job.owner_id}&enabled=eq.true&select=*`)
      let sent = 0
      for (const sub of subs) {
        try { await push.sendNotification(sub.subscription, JSON.stringify({ title: job.title, body: 'Open LifeOS to check your plan and report what happened.', url: job.url, tag: job.id, reminderId: job.id, revision: job.plan_revision }), { TTL: 300 }); sent += 1 }
        catch (error) { if ([404, 410].includes(error.statusCode)) await db(`lifeos_push_subscriptions?owner_id=eq.${job.owner_id}&id=eq.${sub.id}`, { method: 'DELETE' }) }
      }
      accepted += sent
      await db(`lifeos_reminders?id=eq.${job.id}`, { method: 'PATCH', body: { attempts: job.attempts + 1, status: sent ? 'accepted_by_push_service' : job.attempts >= 4 ? 'failed' : 'pending', delivered_at: sent ? new Date().toISOString() : null, last_error: sent ? null : 'No push subscription accepted this reminder.' } })
    }
    return { processed: jobs.length, accepted }
  } finally { await release() }
}
