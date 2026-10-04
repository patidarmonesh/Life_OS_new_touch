import { test, expect } from '@playwright/test'

const owner = 'browser-lock-fixture-owner'
const cacheKey = `lifeos:v2:${owner}:snapshot`
async function fixtureSession(context) {
  await context.route('**/api/session', route => route.fulfill({ json: { user: { id: owner, name: 'Fixture owner', email: '' }, csrf: 'fixture-csrf', capabilities: {}, integration: { state: 'unconfigured' } } }))
  await context.route('**/api/sync', route => route.fulfill({ status: 503, json: { error: 'Fixture keeps changes offline.', code: 'unconfigured' } }))
  await context.route('**/api/shares', route => route.fulfill({ json: { shares: [] } }))
  // Simulate offline sync while still serving this isolated test application's assets.
  await context.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }))
}

test('same-account tabs preserve the unsynced envelope and retry after writer closes', async ({ context, page }) => {
  await fixtureSession(context)
  await page.goto('/settings')
  const name = page.getByLabel('Name', { exact: true })
  await expect(name).toBeVisible()
  await name.fill('First tab unsynced edit')
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), cacheKey)
  expect(before.state.settings.profile.name).toBe('First tab unsynced edit')
  expect(before.pendingModuleChanges.length).toBeGreaterThan(0)

  const second = await context.newPage()
  await second.goto('/settings')
  await expect(second.getByRole('heading', { name: 'Workspace open in another tab' })).toBeVisible()
  await expect(second.getByLabel('Name', { exact: true })).toHaveCount(0)
  await second.getByRole('button', { name: 'Retry access', exact: true }).click()
  await expect(second.getByRole('heading', { name: 'Workspace open in another tab' })).toBeVisible()
  expect(await second.evaluate(key => JSON.parse(localStorage.getItem(key)), cacheKey)).toEqual(before)

  await page.close()
  await second.getByRole('button', { name: 'Retry access', exact: true }).click()
  await expect(second.getByLabel('Name', { exact: true })).toHaveValue('First tab unsynced edit')
  const resumed = await second.evaluate(key => JSON.parse(localStorage.getItem(key)), cacheKey)
  // Loading may append an explicit schema-normalization operation; prior unsynced
  // operations must remain intact and in order when the new writer acquires access.
  expect(resumed.pendingModuleChanges.slice(0, before.pendingModuleChanges.length)).toEqual(before.pendingModuleChanges)
  await second.getByLabel('Name', { exact: true }).fill('Second tab after handover')
  const after = await second.evaluate(key => JSON.parse(localStorage.getItem(key)), cacheKey)
  expect(after.state.settings.profile.name).toBe('Second tab after handover')
  expect(after.pendingModuleChanges.slice(0, before.pendingModuleChanges.length)).toEqual(before.pendingModuleChanges)
})

test('missing Web Locks blocks workspace initialization rather than enabling unsafe writes', async ({ context, page }) => {
  await fixtureSession(context)
  await context.addInitScript(() => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }))
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Protected workspace access unavailable' })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(key => localStorage.getItem(key), cacheKey)).toBeNull()
})
