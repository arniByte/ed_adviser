/**
 * Демо-прогон: две тренировки подряд, чтобы показать память между сессиями.
 * node run.cjs <width> <height> <tag> [--video]
 */
const { chromium } = require('playwright')
const fs = require('fs')
const bank = require('./answers.json')
const [width = '390', height = '844', tag = 'm'] = process.argv.slice(2)
const video = process.argv.includes('--video')
const scale = video ? 1 : 2
const out = `${__dirname}/${tag}`
fs.mkdirSync(out, { recursive: true })

;(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({
    viewport: { width: +width, height: +height },
    deviceScaleFactor: scale,
    ...(video ? { recordVideo: { dir: out, size: { width: +width, height: +height } } } : {}),
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('page error:', e.message))
  const pause = (ms) => page.waitForTimeout(video ? ms : Math.min(ms, 500))
  let n = 0
  const shot = async (name, full = false) => { if (!video) await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full }) }
  const type = async (text) => {
    const field = page.locator('.composer__field')
    if (video) await field.pressSequentially(text, { delay: 14 }); else await field.fill(text)
    await pause(500)
    await field.press('Enter')
  }
  const reviewed = (count) => page.waitForFunction((c) => document.querySelectorAll('.feedback__after').length === c, count, { timeout: 70000 })
  const scrollTour = async () => {
    if (!video) return
    await page.evaluate(async () => {
      const top = document.querySelector('.feedback')?.getBoundingClientRect().top + window.scrollY - 90
      window.scrollTo({ top, behavior: 'smooth' })
      await new Promise((r) => setTimeout(r, 2600))
      const end = document.documentElement.scrollHeight - window.innerHeight
      const start = window.scrollY, t0 = performance.now(), dur = 5200
      await new Promise((done) => { const step = (t) => { const k = Math.min(1, (t - t0) / dur); window.scrollTo(0, start + (end - start) * k); k < 1 ? requestAnimationFrame(step) : done() }; requestAnimationFrame(step) })
    })
    await pause(1600)
  }
  const currentId = async (session) => page.evaluate(() => document.querySelector('.step__question')?.textContent)

  async function session(number) {
    await page.locator('.home__scenario', { hasText: 'Первая работа' }).click().catch(async () => { await page.goto('http://localhost:5173/#/train/job') })
    await pause(1800)
    await shot(`s${number}-intro`)
    await page.getByRole('button', { name: /Начать/ }).click()
    const total = await page.locator('.step__progress span').count()
    for (let i = 0; i < total; i++) {
      await pause(2200)
      const question = await page.locator('.step__question').innerText()
      const isProbe = (await page.locator('.step__head .caption').innerText()).toLowerCase().includes('возврат')
      const cases = require('/home/user/ed_adviser/knowledge/job/cases.json')
      const mistakes = require('/home/user/ed_adviser/knowledge/job/mistakes.json')
      if (isProbe) {
        const m = mistakes.find((x) => x.probe === question)
        await shot(`s${number}-probe`)
        await type(bank.probes[m.id]); await reviewed(1); await pause(700); await scrollTour()
        await shot(`s${number}-probe-feedback`, true)
      } else {
        const c = cases.find((x) => x.question === question && question.length > 0 && (cases.filter((y) => y.question === question).length === 1 || true))
        const situation = await page.locator('.step__situation').innerText().catch(() => '')
        const exact = cases.find((x) => x.situation === situation) || c
        const a = bank.cases[exact.id]
        const firstOfFirst = number === 1 && i === 0
        const leaveOpen = number === 1 && exact.zone === 'interview' && !firstOfFirst
        if (i === 0) await shot(`s${number}-case`)
        if (firstOfFirst) {
          await type(a.weak)
          if (!video) { await page.waitForTimeout(2600); await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-s1-streaming.png` }) }
          await reviewed(1); await pause(700); await scrollTour()
          await shot('s1-feedback-weak', true)
          await type(a.strong); await reviewed(2); await pause(700)
          if (video) { await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })); await pause(3500) }
          await shot('s1-feedback-second', true)
        } else {
          await type(leaveOpen ? a.weak : a.strong); await reviewed(1); await pause(700)
          if (video) { await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })); await pause(2600) }
        }
      }
      await page.getByRole('button', { name: /Следующий кейс|К итогам/ }).click()
    }
    await page.waitForSelector('.debrief__actions', { timeout: 70000 })
    await pause(4500)
    await shot(`s${number}-debrief`, true)
  }

  await page.goto('http://localhost:5173/')
  await pause(3500)
  await shot('home')
  await session(1)
  await page.getByRole('button', { name: /Карта прогресса/ }).click(); await pause(3500)
  await shot('progress-1', true)
  await page.goto('http://localhost:5173/#/'); await pause(3500)
  await shot('home-returning')
  await session(2)
  await page.getByRole('button', { name: /Сохранить разбор/ }).click(); await pause(3000)
  await shot('report', true)
  if (!video) {
    await page.emulateMedia({ media: 'print' })
    await page.pdf({ path: `${out}/report.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
    await page.emulateMedia({ media: 'screen' })
  }
  await page.goto('http://localhost:5173/#/progress'); await pause(4000)
  await shot('progress-2', true)
  await context.storageState({ path: `${out}/state.json` })
  await context.close(); await browser.close()
  console.log('done', fs.readdirSync(out).join(' '))
})()
