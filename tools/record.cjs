// Записывает короткие живые клипы приложения для мокапов в ролике.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const OUT = path.join(__dirname, '../video/public/clips')
const STATE = path.join(__dirname, '../demo/m/state.json')
const WAV = path.join(__dirname, '../audio/question.wav')
const which = process.argv.slice(2)

async function clip(name, fn, { state = false } = {}) {
  if (which.length && !which.includes(name)) return
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${WAV}%noloop`],
  })
  const dir = path.join(OUT, name + '-frames')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir)
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'],
    ...(state ? { storageState: STATE } : {}),
  })
  await context.addInitScript(() => { if (!localStorage.getItem('chernovik:profile:v1')) localStorage.setItem('chernovik:profile:v1', JSON.stringify({ stage: 'student', goals: ['job'] })) })
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log(name, 'error', e.message))
  // Скринкаст CDP отдаёт кадры в физических пикселях, в отличие от recordVideo.
  const cdp = await context.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = path.join(dir, String(frames.length).padStart(5, '0') + '.jpg')
    fs.writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ file, t: metadata.timestamp })
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await page.goto('about:blank')
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688 })
  const t0 = Date.now()
  await fn(page)
  await cdp.send('Page.stopScreencast')
  const end = Date.now() / 1000
  await context.close(); await browser.close()
  // Первый кадр — пустая страница до перехода: начинаем с первого настоящего.
  const real = frames.slice(1)
  const list = real.map((f, i) => `file '${f.file}'\nduration ${((real[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join('\n') + `\nfile '${real.at(-1).file}'\n`
  fs.writeFileSync(path.join(dir, 'list.txt'), list)
  require('child_process').execSync(`ffmpeg -v error -y -f concat -safe 0 -i ${dir}/list.txt -vf "fps=30,scale=780:1688:flags=lanczos,format=yuv420p" -c:v libx264 -crf 16 -preset slow ${OUT}/${name}.mp4`)
  fs.rmSync(dir, { recursive: true, force: true })
  console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + 's', real.length, 'frames')
}

const smoothScroll = (page, to, ms) => page.evaluate(async ([to, ms]) => {
  const target = typeof to === 'string' ? document.querySelector(to).getBoundingClientRect().top + scrollY - 90 : to === -1 ? document.documentElement.scrollHeight - innerHeight : to
  const start = scrollY, t0 = performance.now()
  await new Promise((done) => { const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; scrollTo(0, start + (target - start) * e); k < 1 ? requestAnimationFrame(step) : done() }; requestAnimationFrame(step) })
}, [to, ms])

;(async () => {
  await clip('home', async (page) => {
    await page.goto('http://localhost:5173/')
    await page.waitForTimeout(1600)
    await page.mouse.move(195, 200)
    await page.waitForTimeout(500)
    await page.evaluate(() => document.querySelector('.deck__track').scrollBy({ left: 280, behavior: 'smooth' }))
    await page.waitForTimeout(1300)
    await page.evaluate(() => document.querySelector('.deck__track').scrollBy({ left: -280, behavior: 'smooth' }))
    await page.waitForTimeout(1300)
    await page.locator('.deck__card', { hasText: 'Первая работа' }).click()
    await page.waitForTimeout(2200)
    await page.getByRole('button', { name: /Начать/ }).click()
    await page.waitForTimeout(2600)
  })

  await clip('answer', async (page) => {
    await page.goto('http://localhost:5173/#/train/job')
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Начать/ }).click()
    await page.waitForTimeout(1600)
    const situation = await page.locator('.step__situation').innerText()
    const cases = require('/home/user/ed_adviser/knowledge/job/cases.json')
    const bank = require('../demo/answers.json')
    const found = cases.find((c) => c.situation === situation)
    await page.locator('.composer__field').pressSequentially(bank.cases[found.id].weak, { delay: 34 })
    await page.waitForTimeout(400)
    await page.locator('.composer__field').press('Enter')
    await page.waitForSelector('.feedback__after', { timeout: 60000 })
    await page.waitForTimeout(800)
    await smoothScroll(page, -1, 4500)
    await page.waitForTimeout(1500)
  })

  await clip('ask', async (page) => {
    await page.goto('http://localhost:5173/#/ask')
    await page.waitForTimeout(1600)
    await page.getByRole('button', { name: /вакансия — развод/ }).click()
    await page.waitForSelector('.exchange__after', { timeout: 60000 })
    await page.waitForTimeout(900)
    await page.locator('button.cite').first().click()
    await page.waitForTimeout(3600)
  })

  await clip('web', async (page) => {
    await page.goto('http://localhost:5173/#/ask')
    await page.waitForTimeout(900)
    await page.locator('.composer__field').pressSequentially('хочу поступить в мпгу в ставрополе, что нужно сделать?', { delay: 30 })
    await page.locator('.composer__field').press('Enter')
    await page.waitForSelector('.exchange__after', { timeout: 90000 })
    await page.waitForTimeout(600)
    await page.evaluate(() => scrollTo({ top: 0 }))
    await page.waitForTimeout(400)
    await page.locator('button.cite').first().click()
    await page.waitForTimeout(2600)
    await page.getByRole('button', { name: 'Сохранить в мою базу' }).click()
    await page.waitForTimeout(1600)
  })

  await clip('memory', async (page) => {
    await page.goto('http://localhost:5173/')
    await page.waitForTimeout(2600)
    await page.locator('.tabs__tab', { hasText: 'Прогресс' }).click()
    await page.waitForTimeout(2200)
    await smoothScroll(page, 360, 2200)
    await page.waitForTimeout(600)
    await page.locator('.tabs__tab', { hasText: 'База' }).click()
    await page.waitForTimeout(2400)
  }, { state: true })

  await clip('voice', async (page) => {
    await page.goto('http://localhost:5173/#/train/onboarding')
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Начать/ }).click()
    await page.waitForTimeout(1400)
    await page.getByRole('button', { name: 'Ответить голосом' }).click()
    await page.waitForTimeout(5200)
  })
})()
