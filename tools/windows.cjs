// Крупные «окна» для презентации: приложение в окне 600×560 при двойной плотности,
// прокрученное к главному месту экрана. На слайде окно идёт 1:1, текст читается.
const { chromium } = require('playwright')
const path = require('path')
const bank = require('../demo/answers.json')
const cases = require('/home/user/ed_adviser/knowledge/job/cases.json')
const OUT = path.join(__dirname, '../win')
const U = 'http://localhost:5173/'
const W = { width: 600, height: 560 }
const which = process.argv.slice(2)
const want = (n) => !which.length || which.includes(n)

;(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${__dirname}/../audio/question.wav`] })
  const ctx = async (profile = { stage: 'student', goals: ['job'], about: '3 курс, ищу первую стажировку' }) => {
    const c = await b.newContext({ viewport: W, deviceScaleFactor: 2, storageState: path.join(__dirname, '../demo/m/state.json'), permissions: ['microphone'] })
    await c.addInitScript((p) => { try { if (p && !localStorage.getItem('chernovik:profile:v1')) localStorage.setItem('chernovik:profile:v1', JSON.stringify(p)) } catch {} }, profile)
    const p = await c.newPage()
    p.on('pageerror', (e) => console.log('error', e.message))
    return p
  }
  const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` })
  const top = (p, sel, off = 24) => p.evaluate(([s, o]) => { const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - o) }, [sel, off])
  const ask = async (p, q) => {
    const n = await p.locator('.exchange__after').count()
    await p.fill('textarea', q); await p.keyboard.press('Enter')
    await p.waitForFunction((n) => document.querySelectorAll('.exchange__after').length > n, n, { timeout: 90000 })
    await p.waitForTimeout(900)
  }

  if (want('home')) { const p = await ctx(); await p.goto(U); await p.mouse.move(300, 120); await p.waitForTimeout(1600); await shot(p, 'home') }
  if (want('welcome')) {
    const p = await ctx(null); await p.goto(U + '#/hello'); await p.waitForTimeout(900)
    await p.getByRole('button', { name: 'Студент' }).click(); await p.getByRole('button', { name: 'Первая работа' }).click()
    await p.fill('.welcome__about', '3 курс, ищу первую стажировку, боюсь собеседований'); await p.waitForTimeout(500)
    await top(p, '.welcome__step', 20); await p.waitForTimeout(300); await shot(p, 'welcome')
  }
  if (want('review')) {
    const p = await ctx(); await p.goto(U + '#/train/job'); await p.waitForTimeout(400)
    await p.getByRole('button', { name: /Начать/ }).click(); await p.waitForTimeout(800)
    const situation = await p.locator('.step__situation').innerText()
    const c = cases.find((x) => x.situation === situation)
    await shot(p, 'case')
    await p.locator('.composer__field').fill(bank.cases[c.id].weak); await p.locator('.composer__field').press('Enter')
    await p.waitForSelector('.feedback__after', { timeout: 60000 }); await p.waitForTimeout(1200)
    await top(p, '.feedback__answer', 16); await p.waitForTimeout(400); await shot(p, 'review')
    const m = p.locator('.mistake summary').first()
    if (await m.count()) { await m.click(); await p.waitForTimeout(300) }
    await top(p, '.feedback__after', 16); await p.waitForTimeout(400); await shot(p, 'review-after')
  }
  if (want('ask')) {
    const p = await ctx(); await p.goto(U + '#/ask'); await p.waitForTimeout(500)
    await ask(p, 'Как понять, что вакансия — развод?')
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); await shot(p, 'ask')
    await p.locator('button.cite').first().click(); await p.waitForTimeout(1600); await shot(p, 'proof')
  }
  if (want('web')) {
    const p = await ctx(); await p.goto(U + '#/ask'); await p.waitForTimeout(500)
    await p.fill('textarea', 'Найди в интернете, когда начинается приём документов в МГУ на бакалавриат'); await p.keyboard.press('Enter')
    await p.waitForFunction(() => document.querySelector('.thinking')?.textContent.includes('Сверяю'), null, { timeout: 40000 }).catch(() => {})
    await shot(p, 'web-status')
    await p.waitForSelector('.exchange__after', { timeout: 90000 }); await p.waitForTimeout(900)
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); await shot(p, 'web-answer')
    await p.locator('button.cite').first().click(); await p.waitForTimeout(1600); await shot(p, 'web-proof')
    await p.keyboard.press('Escape')
    await p.goto(U + '#/library'); await p.waitForTimeout(1400); await top(p, '.mybase', 20); await p.waitForTimeout(300); await shot(p, 'mybase')
  }
  if (want('proofs')) { const p = await ctx(); await p.goto(U + '#/proofs'); await p.waitForTimeout(600); await p.getByRole('button', { name: 'Проверить всю базу' }).click(); await p.waitForTimeout(1200); await top(p, '.proofs__root, .surface', 20).catch(() => {}); await shot(p, 'proofs') }
  if (want('progress')) { const p = await ctx(); await p.goto(U + '#/progress'); await p.waitForTimeout(1200); await top(p, '.map', 20); await p.waitForTimeout(300); await shot(p, 'progress') }
  if (want('returning')) { const p = await ctx(); await p.goto(U); await p.mouse.move(300, 400); await p.waitForTimeout(1600); await shot(p, 'returning') }
  if (want('voice')) { const p = await ctx(); await p.goto(U + '#/ask'); await p.waitForTimeout(600); await p.getByRole('button', { name: 'Ответить голосом' }).click(); await p.waitForTimeout(2600); await shot(p, 'voice') }
  if (want('report')) {
    const p = await ctx(); await p.goto(U + '#/progress'); await p.waitForTimeout(800)
    const id = await p.evaluate(() => JSON.parse(localStorage.getItem('chernovik:memory:v1')).sessions[0].id)
    await p.goto(U + '#/report/' + id); await p.waitForTimeout(1400); await top(p, '.doc', 10).catch(() => {}); await shot(p, 'report')
  }
  if (want('values')) { const p = await ctx(); await p.goto(U + '#/values'); await p.waitForTimeout(1600); await shot(p, 'values') }
  await b.close(); console.log('ok')
})()
