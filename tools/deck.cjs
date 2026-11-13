// Экспортирует презентацию в PDF и снимает превью слайдов.
const { chromium } = require('playwright')
;(async () => {
  const [src, pdf, shots] = process.argv.slice(2)
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto('file://' + src)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  await page.pdf({ path: pdf, width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true })
  const overflow = await page.evaluate(() => [...document.querySelectorAll('.slide')].map((s, i) => [i + 1, s.scrollHeight > s.clientHeight + 1, s.scrollWidth > s.clientWidth + 1]).filter((x) => x[1] || x[2]))
  console.log('overflowing slides:', JSON.stringify(overflow))
  await browser.close()
})()
