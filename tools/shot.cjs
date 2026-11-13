const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
  const errors = []
  for (const [name, w, h] of [['m', 390, 844], ['d', 1280, 860]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    for (const route of process.argv.slice(2)) {
      await page.goto('http://localhost:5173/' + route)
      await page.waitForTimeout(1400)
      await page.screenshot({ path: `out/${name}-${route.replace(/[#/]/g, '') || 'home'}.png` })
    }
    await page.close()
  }
  console.log(errors.join('\n') || 'no errors')
  await browser.close()
})()
