import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
// This fresh browser context contains only fixtures, never an existing user's browser profile.
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:5173/auth')
  const result = await page.evaluate(async () => (await import('/tests/backend-device-fixture.js')).runCacheFixture())
  assert.equal(result.beforeB, 1, 'same change ID must not enqueue twice')
  assert.equal(result.afterA, 0, 'purge waits for in-flight enqueue and removes its rows')
  assert.equal(result.afterB, result.beforeB, 'other owner outbox remains')
  assert.equal(result.keys.a, null); assert.equal(result.keys.aBackup, null)
  assert.equal(result.keys.b, 'preserve-b'); assert.equal(result.keys.similar, 'preserve-similar-prefix'); assert.equal(result.keys.unowned, 'preserve-unowned')
  console.log('PASS: isolated IndexedDB enqueue idempotency, in-flight purge, and exact owner cache boundaries')
} finally { await browser.close() }
