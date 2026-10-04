import { test, expect } from '@playwright/test'
const routes = ['/', '/plan', '/capture', '/insights', '/me', '/timeflow', '/study', '/health', '/finance', '/habits', '/journal', '/goals', '/brain', '/settings', '/wrapped', '/ai', '/focus', '/readings', '/decisions', '/crm', '/meditations', '/wisdom']
test('retained routes render on a narrow phone with no horizontal overflow', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/auth'); await page.getByRole('button', { name: /Continue on this device/i }).click()
  await expect(page.locator('main')).toBeVisible()
  for (const route of routes) {
    await page.goto(route); await expect(page.locator('#main-content h1')).toBeVisible(); await expect(page.getByText('Something went wrong', { exact: false })).toHaveCount(0)
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `overflow on ${route}`).toBeTruthy()
  }
  expect(errors).toEqual([])
})
test('local workflow persists a reviewed money capture, actual time and goals across reload', async ({ page }) => {
  await page.goto('/auth'); await page.getByRole('button', { name: /Continue on this device/i }).click()
  await page.goto('/finance'); await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  await page.getByLabel('Amount', { exact: true }).fill('1250.00'); await page.getByLabel('Description', { exact: true }).fill('Reviewed bill')
  await page.getByRole('button', { name: 'Confirm and save transaction' }).click()
  await expect(page.getByRole('heading', { name: 'Reviewed bill' })).toBeVisible(); await page.reload(); await expect(page.getByRole('heading', { name: 'Reviewed bill' })).toBeVisible()
  await page.goto('/settings'); await page.getByLabel('Hours per eligible day').fill('4'); await page.getByRole('button', { name: 'Save goal version' }).click()
  await page.goto('/study'); await page.getByRole('button', { name: 'Log session', exact: true }).click(); await page.getByLabel('Subject', { exact: true }).fill('Mathematics'); await page.getByLabel('Duration in minutes').fill('90'); await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await expect(page.locator('.metric-grid')).toContainText('37.5%'); await page.reload(); await expect(page.locator('.metric-grid')).toContainText('37.5%')
  await page.screenshot({ path: 'docs/screenshots/study-mobile.png', fullPage: true })
})

