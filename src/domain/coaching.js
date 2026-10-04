import { addDays, assertDate, localDate } from './metrics/dates.js'
import { buildPlanningSummary } from './planning/index.js'

export const COACHING_LIMITS = { facts: 12, preferences: 8, activeExperiments: 2, memoryCharacters: 400, minimumTasks: 8, minimumCorrelationPairs: 21 }
const timestamp = now => new Date(now ?? Date.now()).toISOString()
const clean = (value, max, label) => {
  const text = String(value || '').trim()
  if (!text || text.length > max) throw new Error(`${label} must contain 1–${max} characters.`)
  return text
}
const newest = rows => [...rows].sort((a, b) => String(b.updatedAt || b.confirmedAt || '').localeCompare(String(a.updatedAt || a.confirmedAt || '')) || String(a.id).localeCompare(String(b.id)))

/** This mutator requires explicit confirmation; AI suggestions alone are never memory. */
export function saveCoachMemory(chat = {}, input, { now, id = input.id || crypto.randomUUID() } = {}) {
  if (input.confirmed !== true) throw new Error('Confirm this personal fact or preference before saving it.')
  if (!['fact', 'preference'].includes(input.kind)) throw new Error('Choose a fact or preference.')
  const text = clean(input.text, COACHING_LIMITS.memoryCharacters, 'Memory')
  const at = timestamp(now), old = (chat.coachingMemories || []).find(row => row.id === id)
  const memory = { id, kind: input.kind, text, status: 'confirmed', source: 'user-confirmed', confirmedAt: at, updatedAt: at,
    provenance: { method: old ? 'user-correction' : 'user-entry', previousConfirmationAt: old?.confirmedAt || null },
    revisions: old ? [...(old.revisions || []), { text: old.text, kind: old.kind, confirmedAt: old.confirmedAt }].slice(-10) : [] }
  return { ...chat, coachingMemories: [...(chat.coachingMemories || []).filter(row => row.id !== id), memory] }
}

export function changeMemoryStatus(chat = {}, id, status, { now } = {}) {
  if (!['rejected', 'deleted'].includes(status)) throw new Error('Choose reject or delete.')
  if (!(chat.coachingMemories || []).some(row => row.id === id)) throw new Error('Memory was not found.')
  return { ...chat, coachingMemories: chat.coachingMemories.map(row => row.id === id ? { ...row, status, updatedAt: timestamp(now), ...(status === 'deleted' ? { text: '', revisions: [] } : {}) } : row) }
}

export function saveWeeklyExperiment(chat = {}, input, { now, id = input.id || crypto.randomUUID() } = {}) {
  if (input.confirmed !== true) throw new Error('Review and confirm this experiment before starting it.')
  const title = clean(input.title, 160, 'Experiment'), successCriterion = clean(input.successCriterion, 400, 'Success criterion')
  assertDate(input.startDate); assertDate(input.reviewDate)
  if (input.reviewDate <= input.startDate) throw new Error('Choose a review date after the start date.')
  const active = (chat.weeklyExperiments || []).filter(row => row.status === 'active' && row.id !== id)
  if (active.length >= COACHING_LIMITS.activeExperiments) throw new Error('Review or end an existing experiment before starting another. At most two can be active.')
  const old = (chat.weeklyExperiments || []).find(row => row.id === id)
  if (old && old.status !== 'active') throw new Error('Completed or rejected experiments stay in history. Start a new experiment instead.')
  const at = timestamp(now)
  const experiment = { id, title, successCriterion, startDate: input.startDate, reviewDate: input.reviewDate, status: 'active', source: 'user-confirmed', confirmedAt: old?.confirmedAt || at, updatedAt: at, result: null, reviewNotes: '' }
  return { ...chat, weeklyExperiments: [...(chat.weeklyExperiments || []).filter(row => row.id !== id), experiment] }
}

export function reviewWeeklyExperiment(chat = {}, id, { status, result, reviewNotes = '' }, { now } = {}) {
  if (!['completed', 'rejected', 'deleted'].includes(status)) throw new Error('Choose a review outcome.')
  if (status === 'completed' && !['met', 'not-met', 'inconclusive'].includes(result)) throw new Error('Choose whether the success criterion was met, not met, or inconclusive.')
  if (String(reviewNotes).length > 600) throw new Error('Keep the review within 600 characters.')
  if (!(chat.weeklyExperiments || []).some(row => row.id === id)) throw new Error('Experiment was not found.')
  const at = timestamp(now)
  return { ...chat, weeklyExperiments: chat.weeklyExperiments.map(row => row.id === id ? { ...row, status, result: status === 'completed' ? result : null, reviewNotes: status === 'deleted' ? '' : String(reviewNotes).trim(), reviewedAt: at, updatedAt: at,
    ...(status === 'deleted' ? { title: '', successCriterion: '' } : {}) } : row) }
}

/** Allowlist projection: never include conversation, diary/SMS text, rejected facts or histories. */
export function selectCoachingContext(state = {}, { now = Date.now(), timezone = state.settings?.profile?.timezone || 'Asia/Kolkata' } = {}) {
  const date = localDate(now, timezone), chat = state.aiChat || {}
  const memories = newest((chat.coachingMemories || []).filter(row => row.status === 'confirmed' && row.source === 'user-confirmed' && row.confirmedAt && typeof row.text === 'string' && row.text.trim()))
  const project = row => ({ id: String(row.id), text: row.text.slice(0, 400), source: 'user-confirmed', confirmedAt: row.confirmedAt })
  const facts = memories.filter(row => row.kind === 'fact').slice(0, COACHING_LIMITS.facts).map(project)
  const preferences = memories.filter(row => row.kind === 'preference').slice(0, COACHING_LIMITS.preferences).map(project)
  const experiments = newest((chat.weeklyExperiments || []).filter(row => row.status === 'active' && row.source === 'user-confirmed' && row.confirmedAt)).slice(0, 2).map(row => ({ id: String(row.id), title: String(row.title || '').slice(0, 160), successCriterion: String(row.successCriterion || '').slice(0, 400), startDate: row.startDate, reviewDate: row.reviewDate, reviewDue: row.reviewDate <= date, source: 'user-confirmed', confirmedAt: row.confirmedAt }))
  return { version: 1, asOfDate: date, timezone, facts, preferences, experiments, limits: COACHING_LIMITS, omittedConfirmedMemories: Math.max(0, memories.length - facts.length - preferences.length) }
}

const quantile = (values, p) => { const position = (values.length - 1) * p, lower = Math.floor(position); return values[lower] + (values[Math.ceil(position)] - values[lower]) * (position - lower) }

/** Comparable means an explicitly selected category/subject, not an AI-invented cluster. */
export function estimationPattern(state = {}, { category = 'Study', subject = null, now = Date.now(), timezone = state.settings?.profile?.timezone || 'Asia/Kolkata' } = {}) {
  const endDate = localDate(now, timezone), startDate = addDays(endDate, -89)
  const planning = state.planning || {}, revisions = planning.revisions || []
  const dates = [...new Set(revisions.map(row => row.localDate).filter(date => date >= startDate && date <= endDate))].sort()
  const samples = [], seen = new Set()
  for (const date of dates) {
    const summary = buildPlanningSummary(state, date, { now, timezone })
    const blocks = new Map(revisions.filter(row => row.localDate === date).flatMap(row => row.blocks || []).map(block => [block.id, block]))
    for (const row of summary.details) {
      const block = blocks.get(row.blockId)
      if (!block || String(block.category || '').toLowerCase() !== category.toLowerCase() || (subject != null && block.subject !== subject) || seen.has(row.blockId) || !row.due || row.outcome !== 'done' || row.timingUnknown || !(row.actualMinutes > 0) || !Number.isFinite(row.estimateRatio)) continue
      seen.add(row.blockId)
      samples.push({ blockId: row.blockId, date, ratio: row.estimateRatio })
    }
  }
  const ratios = samples.map(row => row.ratio).sort((a, b) => a - b), enough = ratios.length >= COACHING_LIMITS.minimumTasks
  return { status: enough ? 'observed' : 'insufficient-data', category, subject, range: { startDate, endDate }, timezone, sampleCount: ratios.length, minimumSamples: COACHING_LIMITS.minimumTasks,
    medianRatio: enough ? quantile(ratios, 0.5) : null, spreadIQR: enough ? quantile(ratios, 0.75) - quantile(ratios, 0.25) : null,
    sourceDates: [...new Set(samples.map(row => row.date))], blockIds: samples.map(row => row.blockId),
    explanation: enough ? 'Actual-to-planned duration for completed, explicitly linked comparable tasks; spread is interquartile range.' : 'At least eight completed comparable tasks with resolved timing are needed. Plans and unknown timings are not samples.' }
}

/** One observed pair per date, minimum 21 dates, no imputation or causal interpretation. */
export function correlationSummary(pairs = []) {
  const dates = new Map(), duplicated = new Set()
  for (const pair of pairs) {
    if (!Number.isFinite(pair.x) || !Number.isFinite(pair.y)) continue
    try { assertDate(pair.date) } catch { continue }
    if (dates.has(pair.date) && (dates.get(pair.date).x !== pair.x || dates.get(pair.date).y !== pair.y)) duplicated.add(pair.date)
    else dates.set(pair.date, pair)
  }
  const valid = [...dates.values()].filter(pair => !duplicated.has(pair.date)).sort((a, b) => a.date.localeCompare(b.date)).slice(-366)
  const meta = { sampleCount: valid.length, minimumSamples: 21, dates: valid.map(pair => pair.date), excludedConflictingDates: duplicated.size, interpretation: 'Association only; this does not establish cause and effect.' }
  if (valid.length < 21) return { ...meta, status: 'insufficient-data', value: null }
  const meanX = valid.reduce((sum, pair) => sum + pair.x, 0) / valid.length, meanY = valid.reduce((sum, pair) => sum + pair.y, 0) / valid.length
  const covariance = valid.reduce((sum, pair) => sum + (pair.x - meanX) * (pair.y - meanY), 0)
  const varianceX = valid.reduce((sum, pair) => sum + (pair.x - meanX) ** 2, 0), varianceY = valid.reduce((sum, pair) => sum + (pair.y - meanY) ** 2, 0)
  const denominator = Math.sqrt(varianceX * varianceY)
  if (!(denominator > 0) || !Number.isFinite(denominator)) return { ...meta, status: 'constant-or-invalid-series', value: null }
  return { ...meta, status: 'observed', value: Math.max(-1, Math.min(1, covariance / denominator)) }
}
