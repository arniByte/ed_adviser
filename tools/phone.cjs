// Аудит на телефоне: Pixel 7, реальная плотность, все экраны.
const { chromium, devices } = require('playwright')
;(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${__dirname}/../audio/question.wav`] })
  const c = await b.newContext({ ...devices['Pixel 7'], permissions: ['microphone'] })
  await c.addInitScript(() => { try { if (!localStorage.getItem('chernovik:profile:v1')) localStorage.setItem('chernovik:profile:v1', JSON.stringify({ stage: 'school', goals: ['admission'] })) } catch {} })
  const p = await c.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const shot = (n) => p.screenshot({ path: `out/ph-${n}.png` })
  const routes = (process.argv[2] || 'home,nav,voice,ask,library,progress,proofs,train').split(',')
  for (const r of routes) {
    if (r === 'home') { await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500); await shot('home') }
    if (r === 'nav') { await p.goto('http://localhost:5173/'); await p.waitForTimeout(800); await p.locator('.composer .nav-button').click(); await p.waitForTimeout(600); await shot('nav') }
    if (r === 'voice') { await p.goto('http://localhost:5173/#/ask'); await p.waitForTimeout(800); await p.getByRole('button', { name: 'Ответить голосом' }).click(); await p.waitForTimeout(2500); await shot('voice'); await p.getByRole('button', { name: 'Отмена' }).click() }
    if (r === 'ask') { await p.goto('http://localhost:5173/#/ask'); await p.waitForTimeout(600); await shot('ask-empty') }
    if (r === 'library') { await p.goto('http://localhost:5173/#/library'); await p.waitForTimeout(1200); await shot('library') }
    if (r === 'progress') { await p.goto('http://localhost:5173/#/progress'); await p.waitForTimeout(1000); await shot('progress') }
    if (r === 'proofs') { await p.goto('http://localhost:5173/#/proofs'); await p.waitForTimeout(1000); await shot('proofs') }
    if (r === 'train') { await p.goto('http://localhost:5173/#/train/job'); await p.waitForTimeout(1000); await shot('intro'); await p.getByRole('button', { name: /Начать/ }).click(); await p.waitForTimeout(900); await shot('case') }
  }
  console.log(errors.join('\n') || 'no errors')
  await b.close()
})()
