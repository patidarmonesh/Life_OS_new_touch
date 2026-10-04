import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 320, height: 740 } })
await page.goto('http://127.0.0.1:5173/auth'); await page.getByRole('button', { name: 'Continue on this device' }).click()
for (const route of ['/goals','/brain','/settings','/wrapped','/ai','/focus','/readings','/decisions','/crm','/meditations','/wisdom','/health']) {
 await page.goto('http://127.0.0.1:5173'+route); await page.locator('main h1').waitFor(); await page.waitForTimeout(300)
 const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > window.innerWidth+1).map(e => ({tag:e.tagName,text:e.textContent.slice(0,65),width:Math.round(e.getBoundingClientRect().width),style:e.getAttribute('style')})).slice(0,8))
 console.log(route,JSON.stringify(overflow))
}
await browser.close()
