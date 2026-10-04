import { db, HttpError } from './core.js'
import { materializeRemoteModules } from '../src/services/syncService.js'
import { initialState } from '../src/context/defaultState.js'
import { reportModel } from '../src/utils/reportModel.js'
import { dateRange } from '../src/domain/metrics/dates.js'
import { selectCoachingContext } from '../src/domain/coaching.js'

export async function ownedRecords(owner) {
  const records = []
  for (let offset = 0; ; offset += 1000) {
    const page = await db(`lifeos_records?owner_id=eq.${owner}&select=*&order=collection.asc,id.asc&limit=1000&offset=${offset}`)
    records.push(...page)
    if (page.length < 1000) break
    if (offset > 100000) throw new HttpError(413, 'Account exceeds the current sync batch limit. Export a backup and contact the operator.')
  }
  return records
}
export async function ownedReport(owner, requested, { includeCoaching = false } = {}) {
  const range = { startDate: requested?.range?.start, endDate: requested?.range?.end }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(range.endDate || '') || range.startDate > range.endDate || Date.parse(range.endDate) - Date.parse(range.startDate) > 366 * 86400_000) throw new HttpError(400, 'Choose a report range of up to one year.')
  try { dateRange(range.startDate, range.endDate) } catch { throw new HttpError(400, 'Invalid report date range.') }
  const records = await ownedRecords(owner)
  const state = materializeRemoteModules(records, initialState)
  const areas = [...new Set((requested.metrics || []).map(m => m.area))].filter(area => ['time', 'study', 'sleep', 'money', 'routines'].includes(area))
  const report = reportModel(state, range, areas)
  return includeCoaching ? { ...report, coaching: selectCoachingContext(state) } : report
}
export async function approvedOwnedPlan(owner, submitted) {
  if (!submitted?.id) throw new HttpError(400, 'An approved plan ID is required.')
  const state = materializeRemoteModules(await ownedRecords(owner), initialState)
  const plan = state.planning?.revisions?.find(p => p.id === submitted.id && p.revision === submitted.revision)
  if (!plan || plan.status !== 'approved') throw new HttpError(409, 'Sync the approved plan before exporting or scheduling reminders.', 'plan_not_synced')
  return plan
}
