import { db, filter, hash, HttpError, takeLease } from './core.js'
import { googleFetch } from './google.js'

const localDate = (instant, zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))
export function validateApprovedPlan(plan) {
  if (!plan || plan.status !== 'approved' || !plan.approvedAt || !plan.id || !Number.isInteger(plan.revision) || plan.revision < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(plan.localDate || '') || !Array.isArray(plan.blocks) || plan.blocks.length > 100) throw new HttpError(400, 'Export requires one explicitly approved date and revision.')
  try { new Intl.DateTimeFormat('en', { timeZone: plan.timezone }).format() } catch { throw new HttpError(400, 'Invalid plan timezone.') }
  const ids = new Set()
  for (const block of plan.blocks) {
    if (!block.id || ids.has(block.id) || !block.title || !Number.isFinite(Date.parse(block.startAt)) || !Number.isFinite(Date.parse(block.endAt)) || Date.parse(block.endAt) <= Date.parse(block.startAt) || Date.parse(block.endAt) - Date.parse(block.startAt) > 86400_000 || block.recurrence) throw new HttpError(400, 'Each block needs a unique ID, title and valid explicit interval; recurrence is not allowed.')
    if (localDate(block.startAt, plan.timezone) !== plan.localDate) throw new HttpError(400, 'Only the approved date can be exported.')
    if (localDate(new Date(Date.parse(block.endAt) - 1), plan.timezone) !== plan.localDate && !block.includeOvernight && !block.endsNextDay) throw new HttpError(400, 'Explicitly select an overnight block before exporting across the day boundary.')
    ids.add(block.id)
  }
  return plan
}
export const calendarEventId = (owner, planId, blockId) => `lifeos${hash(`${owner}\0${planId}\0${blockId}`)}`
export function matchesManagedBlock(event, plan, block) {
  const reminders = Number.isInteger(block.reminderMinutes) && block.reminderMinutes >= 0 && block.reminderMinutes <= 10080 ? [{ method: 'popup', minutes: block.reminderMinutes }] : []
  return event?.extendedProperties?.private?.lifeosRevision === String(plan.revision)
    && event.summary === String(block.title).slice(0, 300)
    && Date.parse(event.start?.dateTime) === Date.parse(block.startAt)
    && Date.parse(event.end?.dateTime) === Date.parse(block.endAt)
    && event.reminders?.useDefault === false
    && JSON.stringify(event.reminders?.overrides || []) === JSON.stringify(reminders)
}
export async function exportPlan(owner, rawPlan) {
  const plan = validateApprovedPlan(rawPlan)
  const planId = plan.originalRevisionId || plan.id
  const release = await takeLease(`calendar:${owner}`, 120)
  try {
    let connection = (await db(`lifeos_connections?owner_id=eq.${owner}&select=*`))?.[0]
    if (!connection?.scopes.includes('calendar.app.created')) throw new HttpError(409, 'Connect Google Calendar first.', 'calendar_not_connected')
    if (!connection.calendar_id) {
      const response = await googleFetch(owner, '/calendar/v3/calendars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: 'LifeOS Plan', timeZone: plan.timezone }) })
      if (!response.ok) throw new HttpError(502, 'Could not create the LifeOS calendar.')
      connection.calendar_id = (await response.json()).id
      await db(`lifeos_connections?owner_id=eq.${owner}`, { method: 'PATCH', body: { calendar_id: connection.calendar_id } })
    }
    const operations = []
    for (const block of plan.blocks) {
      const eventId = calendarEventId(owner, planId, block.id)
      const path = `/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`
      try {
        const existing = await googleFetch(owner, `${path}/${eventId}`)
        let current = existing.ok ? await existing.json() : null
        if (!existing.ok && existing.status !== 404) throw new HttpError(502, 'Google event lookup failed.')
        if (current && current.extendedProperties?.private?.lifeosOwner !== owner) throw new HttpError(409, 'This event is not managed by your LifeOS account.')
        const mapping = (await db(`lifeos_calendar_exports?owner_id=eq.${owner}&plan_id=eq.${filter(planId)}&block_id=eq.${filter(block.id)}&select=*`))?.[0]
        const sameRevision = matchesManagedBlock(current, plan, block)
        // A lost response after our successful PATCH changes the ETag too. Exact field parity
        // proves that retry has already applied; an unrelated external edit still needs review.
        if (current && mapping?.etag && mapping.etag !== current.etag && !sameRevision) throw new HttpError(409, 'This event was edited in Google Calendar. Review the external change before exporting.', 'external_change')
        if (mapping?.revision > plan.revision || Number(current?.extendedProperties?.private?.lifeosRevision) > plan.revision) throw new HttpError(409, 'A newer plan revision was exported already.')
        if (!sameRevision) {
          const event = { summary: String(block.title).slice(0, 300), start: { dateTime: block.startAt, timeZone: plan.timezone }, end: { dateTime: block.endAt, timeZone: plan.timezone },
            extendedProperties: { private: { lifeosOwner: owner, lifeosPlan: planId, lifeosBlock: block.id, lifeosRevision: String(plan.revision) } },
            reminders: { useDefault: false, overrides: Number.isInteger(block.reminderMinutes) && block.reminderMinutes >= 0 && block.reminderMinutes <= 10080 ? [{ method: 'popup', minutes: block.reminderMinutes }] : [] },
          }
          const response = await googleFetch(owner, current ? `${path}/${eventId}` : path, { method: current ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', ...(current?.etag ? { 'If-Match': current.etag } : {}) }, body: JSON.stringify(current ? event : { ...event, id: eventId }) })
          if (!response.ok) throw new HttpError(response.status === 412 ? 409 : 502, response.status === 412 ? 'The event changed while exporting. Review it before retrying.' : 'Google could not save this block.')
          current = await response.json()
        }
        await db('lifeos_calendar_exports?on_conflict=owner_id,plan_id,block_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { owner_id: owner, plan_id: planId, block_id: block.id, revision: plan.revision, event_id: eventId, etag: current.etag } })
        operations.push({ blockId: block.id, status: 'exported', eventId })
      } catch (error) { operations.push({ blockId: block.id, status: 'failed', eventId, error: error.message }) }
    }
    return { status: operations.every(op => op.status === 'exported') ? 'exported' : 'partial', operations }
  } finally { await release() }
}
