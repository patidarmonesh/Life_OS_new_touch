import { enqueueModuleChanges, getOutbox } from '../src/services/syncService.js'
import { clearOwnerDeviceCache } from '../src/services/privacyService.js'
export async function runCacheFixture() {
  localStorage.setItem('lifeos:v2:fixture-a:state', 'remove-a')
  localStorage.setItem('lifeos:v2:fixture-a:backup:1', 'remove-a-backup')
  localStorage.setItem('lifeos:v2:fixture-ab:state', 'preserve-similar-prefix')
  localStorage.setItem('lifeos:v2:fixture-b:state', 'preserve-b')
  localStorage.setItem('lifeos:legacy:quarantine', 'preserve-unowned')
  const previous = { study: { sessions: [] } }, next = { study: { sessions: [{ id: 'session-1', durationMinutes: 90 }] } }
  await enqueueModuleChanges('fixture-b', previous, next, 'change-b')
  await enqueueModuleChanges('fixture-b', previous, next, 'change-b')
  const beforeB = await getOutbox('fixture-b')
  const pendingA = enqueueModuleChanges('fixture-a', previous, next, 'change-a')
  const removed = await clearOwnerDeviceCache('fixture-a')
  await pendingA
  return { beforeB: beforeB.length, afterB: (await getOutbox('fixture-b')).length, afterA: (await getOutbox('fixture-a')).length, removed, keys: { a: localStorage.getItem('lifeos:v2:fixture-a:state'), aBackup: localStorage.getItem('lifeos:v2:fixture-a:backup:1'), b: localStorage.getItem('lifeos:v2:fixture-b:state'), similar: localStorage.getItem('lifeos:v2:fixture-ab:state'), unowned: localStorage.getItem('lifeos:legacy:quarantine') } }
}
