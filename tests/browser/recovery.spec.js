import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function local(page) {
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Continue on this device' }).click()
  await expect(page.locator('#main-content h1')).toBeVisible()
}
test('overlap correction and explicit overnight sleep agree across areas', async ({ page }) => {
  await local(page)
  await page.goto('/timeflow')
  await page.getByLabel('Selected date').fill('2026-10-01')
  async function record(name, category, start, end, overnight = false, drift = false) {
    await page.getByRole('button', { name: 'Log actual time', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Activity', { exact: true }).fill(name)
    await dialog.getByLabel('Category').selectOption(category)
    await dialog.getByLabel('Start', { exact: true }).fill(start)
    await dialog.getByLabel('End', { exact: true }).fill(end)
    if (overnight) await dialog.getByLabel('Ends next day').check()
    if (drift) await dialog.getByLabel('I consider this unwanted distraction').check()
    await dialog.getByRole('button', { name: 'Save actual activity' }).click()
    await expect(dialog).toHaveCount(0)
  }
  await record('Mathematics', 'Study', '10:00', '11:00')
  await record('Instagram', 'Social Media', '10:30', '11:30', false, true)
  await expect(page.getByRole('heading', { name: 'Resolve overlapping observations' })).toBeVisible()
  await page.getByRole('button', { name: 'Instagram', exact: true }).click()
  await expect(page.locator('.metric-card').filter({ hasText: /^Focus/ })).toContainText('30m')
  await expect(page.locator('.metric-card').filter({ hasText: /^Drift/ })).toContainText('1h')
  await page.reload()
  await page.getByLabel('Selected date').fill('2026-10-01')
  await expect(page.getByRole('heading', { name: 'Resolve overlapping observations' })).toHaveCount(0)
  await record('Overnight sleep', 'Sleep', '23:30', '07:00', true)
  await page.goto('/health')
  await page.getByLabel('Sleep wake date').fill('2026-10-02')
  await expect(page.locator('.metric-card').filter({ hasText: /^Reported sleep/ })).toContainText('7h 30m')
})

test('checksum backup survives an actual export, deletion and reviewed restore', async ({ page }, testInfo) => {
  await local(page)
  await page.goto('/finance')
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  await page.getByLabel('Amount', { exact: true }).fill('321.45')
  await page.getByLabel('Description', { exact: true }).fill('Restore drill purchase')
  await page.getByRole('button', { name: 'Confirm and save transaction' }).click()
  await page.goto('/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export full backup' }).click()
  const download = await downloadPromise, path = testInfo.outputPath('backup.json')
  await download.saveAs(path)
  const backup = JSON.parse(await readFile(path, 'utf8'))
  expect(backup.checksum.algorithm).toBe('SHA-256')
  expect(backup.data.finance.expenses).toHaveLength(1)
  await page.goto('/finance')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Restore drill purchase' })).toHaveCount(0)
  await page.goto('/settings')
  await page.getByLabel('Import backup for review').setInputFiles(path)
  await expect(page.getByRole('heading', { name: 'Migration dry run' })).toBeVisible()
  await page.getByRole('button', { name: 'Back up current data and import' }).click()
  await page.goto('/finance')
  await expect(page.getByRole('heading', { name: 'Restore drill purchase' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Restore drill purchase' })).toBeVisible()
})

test('both themes reflow at target widths and enlarged text; dialogs restore keyboard focus', async ({ page }) => {
  test.setTimeout(360000)
  await local(page)
  for (const theme of ['light', 'dark']) {
    await page.goto('/settings')
    await page.getByLabel('Theme', { exact: true }).selectOption(theme)
    for (const width of [320, 360, 390, 430, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      for (const route of ['/', '/plan', '/capture', '/insights', '/me']) {
        await page.goto(route)
        await expect(page.locator('#main-content h1')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme} ${width} ${route}`).toBeTruthy()
      }
    }
    await page.setViewportSize({ width: 320, height: 740 })
    for (const route of ['/', '/plan', '/capture', '/insights', '/me', '/settings']) {
      await page.goto(route)
      await expect(page.locator('#main-content h1')).toBeVisible()
      await page.evaluate(async () => { document.documentElement.style.fontSize = '200%'; await document.fonts.ready })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `200% ${theme} ${route}`).toBeTruthy()
    }
    await page.evaluate(() => document.documentElement.style.fontSize = '')
    await page.goto('/')
    await expect(page.locator('#main-content h1')).toBeVisible()
    await page.screenshot({ path: `docs/screenshots/today-${theme}-320.png`, fullPage: true })
  }
  await page.goto('/study')
  const trigger = page.getByRole('button', { name: 'Log session', exact: true })
  await trigger.click()
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Save session', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})


