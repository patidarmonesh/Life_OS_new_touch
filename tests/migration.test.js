import test from 'node:test'
import assert from 'node:assert/strict'
import { createBackup, restoreBackup, verifyBackup, migrateState, quarantineSyntheticHealth } from '../src/domain/migration.js'
import { buildDailySummary } from '../src/domain/metrics/index.js'

const now = '2026-10-03T12:00:00+05:30'
const fixture = () => ({
  settings: { profile: { timezone: 'Asia/Kolkata' }, preferences: { dailyStudyGoal: 4 } },
  timeflow: { entries: [{ id: 'timed', date: '2026-10-02', start: '10:00', end: '11:00', category: 'Study', studySessionId: 'linked' }, { id: 'bad', date: '2026-10-02', start: '23:30', end: '07:00', category: 'Sleep' }] },
  study: { sessions: [{ id: 'linked', date: '2026-10-02', durationMinutes: 60 }, { id: 'duration', date: '2026-10-01', durationMinutes: 45, notes: 'Historical duration only' }] },
  health: { bodyLogs: [{ id: 'mixed', date: '2026-10-02', weight: 72.5, waist: 80, notes: 'Manual measurements', createdAt: '2026-10-02T08:00:00Z', source: 'smartwatch', steps: 9000, sleepHours: 8, avgHeartRate: 64, spo2: 98 }] },
  gamification: { xp: 500, inventory: ['retained historical item'] }, journal: { entries: [{ id: 'j', content: 'Keep private original content' }] },
})

test('backup checksum verifies and rollback restores the exact original including removed modules', async () => {
  const original = fixture()
  const backup = await createBackup(original, { ownerId: 'owner', createdAt: now })
  assert.equal(backup.checksum.algorithm, 'SHA-256')
  assert.match(backup.checksum.value, /^[0-9a-f]{64}$/)
  assert.equal(await verifyBackup(JSON.stringify(backup)), true)
  assert.deepEqual(await restoreBackup(backup), original)
  const restored = await restoreBackup(backup)
  restored.gamification.xp = 0
  assert.equal(backup.data.gamification.xp, 500)
})

test('changed backup content is rejected and no partial restoration is returned', async () => {
  const backup = await createBackup(fixture())
  backup.data.study.sessions[0].durationMinutes = 100
  await assert.rejects(restoreBackup(backup), /checksum does not match/)
  await assert.rejects(restoreBackup({ data: fixture() }), /Unsupported backup/)
})

test('quarantine preserves manually entered fields and creation metadata in reused simulator rows', () => {
  const original = fixture().health
  const result = quarantineSyntheticHealth(original)
  const cleaned = result.health.bodyLogs[0]
  assert.equal(cleaned.weight, 72.5)
  assert.equal(cleaned.waist, 80)
  assert.equal(cleaned.notes, 'Manual measurements')
  assert.equal(cleaned.createdAt, original.bodyLogs[0].createdAt)
  assert.equal(cleaned.source, 'smartwatch')
  assert.equal(cleaned.sleepHours, undefined)
  assert.equal(cleaned.steps, undefined)
  assert.equal(result.quarantine[0].fields.sleepHours, 8)
  assert.deepEqual(result.quarantine[0].originalRecord, original.bodyLogs[0])
  assert.equal(original.bodyLogs[0].steps, 9000)
  assert.deepEqual(quarantineSyntheticHealth(result.health).health, result.health)
})

test('migration is immutable and idempotent with stable identity, repair and duration-only retention', () => {
  const original = fixture(), before = structuredClone(original)
  const first = migrateState(original, { now })
  const second = migrateState(first.state, { now: '2026-10-04T00:00:00Z' })
  assert.deepEqual(original, before)
  assert.equal(first.changed, true)
  assert.equal(second.changed, false)
  assert.deepEqual(second.state, first.state)
  assert.equal(first.report.linkedDuplicateCount, 1)
  assert.equal(first.report.repair[0].id, 'timeflow:bad')
  assert.equal(first.report.durationOnlyCount, 1)
  assert.equal(first.state.timeflow.entries[0].canonicalActivityId, first.state.study.sessions[0].canonicalActivityId)
  assert.equal(first.state.study.sessions[1].startAt, undefined)
  assert.equal(first.state.timeflow.entries[1].startAt, undefined)
  assert.equal(first.state.timeflow.entries.length, original.timeflow.entries.length)
  assert.equal(first.state.settings.studyGoalHistory[0].minutes, 240)
  assert.equal(first.state.settings.studyGoalHistory[0].historicalTargetUnknown, true)
  assert.deepEqual(first.state.gamification, original.gamification)
  const day = buildDailySummary(first.state, '2026-10-02', { now })
  assert.equal(day.study.minutes.value, 60)
  assert.equal(day.sleep.minutes.value, null)
})

test('synthetic canonical sleep is quarantined without removing its original episode', () => {
  const result = migrateState({ health: { sleepEpisodes: [{ id: 'simulated', date: '2026-10-02', source: 'synthetic', durationMinutes: 500, notes: 'preserved' }] } }, { now })
  assert.equal(result.state.health.sleepEpisodes.length, 1)
  assert.equal(result.state.health.sleepEpisodes[0].notes, 'preserved')
  assert.equal(result.state.health.sleepEpisodes[0].durationMinutes, undefined)
  assert.equal(result.state.health.quarantine[0].fields.durationMinutes, 500)
})
