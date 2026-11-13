/** Видео-демонстрация: справка голосом, тренировка, память, экспорт. node video.cjs <question.wav> */
const { chromium } = require('playwright')
const fs = require('fs')
const bank = require('./answers.json')
const cases = require('/home/user/ed_adviser/knowledge/job/cases.json')
const mistakes = require('/home/user/ed_adviser/knowledge/job/mistakes.json')
const out = `${__dirname}/video`
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true })
const SIZE = { width: 1280, height: 720 }

;(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${process.argv[2]}%noloop`] })
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1.5, permissions: ['microphone'] })
  const page = await context.newPage()
  // Кадры через CDP-скринкаст: в физических пикселях, то есть сразу 1920×1080.
  const cdp = await context.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = `${out}/${String(frames.length).padStart(6, '0')}.jpg`
    fs.writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ file, t: metadata.timestamp })
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  page.on('pageerror', (e) => console.log('page error:', e.message))
  const t0 = Date.now(); const log = (m) => console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', m)
  const pause = (ms) => page.waitForTimeout(ms)

  await page.goto('http://localhost:5173/')
  await page.addStyleTag({ content: `
    html { font-size: 118%; }
    #demo-caption { position: fixed; top: 0; left: 50%; transform: translateX(-50%); z-index: 200; height: 3.5rem; display: flex; align-items: center; gap: 10px; white-space: nowrap; font: 500 14px/1 'Inter Variable', system-ui, sans-serif; letter-spacing: -0.005em; color: rgba(17,17,19,.6); transition: opacity .4s; }
    #demo-caption b { color: #121214; font-weight: 600; }
    #demo-caption b:not(:last-child)::after { content: '—'; margin-left: 10px; font-weight: 400; color: rgba(18,18,20,.35); }` })
  await page.evaluate(() => { const el = document.createElement('div'); el.id = 'demo-caption'; document.body.append(el) })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080 })
  const caption = async (title, text = '') => { await page.evaluate(([a, b]) => { const el = document.getElementById('demo-caption'); el.style.opacity = 0; setTimeout(() => { el.innerHTML = b ? `<b>${a}</b><span>${b}</span>` : `<b>${a}</b>`; el.style.opacity = 1 }, 250) }, [title, text]); log(title) }
  const scrollTo = (target, ms = 2600) => page.evaluate(async ([target, ms]) => {
    const end = target === 'bottom' ? document.documentElement.scrollHeight - innerHeight : target === 'top' ? 0 : Math.max(0, document.querySelector(target).getBoundingClientRect().top + scrollY - 110)
    const start = scrollY, begin = performance.now()
    await new Promise((done) => { const step = (now) => { const k = Math.min(1, (now - begin) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, start + (end - start) * e); k < 1 ? requestAnimationFrame(step) : done() }; requestAnimationFrame(step) })
  }, [target, ms])
  const type = async (text, delay = 11) => { const field = page.locator('.composer__field'); await field.click(); await field.pressSequentially(text, { delay }); await pause(600); await field.press('Enter') }
  const reviewed = (count) => page.waitForFunction((c) => document.querySelectorAll('.feedback__after').length === c, count, { timeout: 70000 })
  const next = () => page.getByRole('button', { name: /Следующий кейс|К итогам/ }).click()

  await caption('Знакомство', 'три вопроса — и советы под тебя'); await pause(2600)
  await page.getByRole('button', { name: 'Студент' }).click(); await pause(900)
  await page.getByRole('button', { name: 'Первая работа' }).click(); await pause(900)
  await page.locator('.welcome__about').pressSequentially('3 курс, Ставрополь, ищу первую стажировку', { delay: 22 }); await pause(900)
  await page.getByRole('button', { name: /Готово/ }).click(); await pause(1200)
  await caption('Черновик', 'AI-тренажёр для абитуриента и стажёра'); await page.mouse.move(640, 200); await pause(3400)
  await page.evaluate(() => document.querySelector('.deck__track').scrollBy({ left: 300, behavior: 'smooth' })); await pause(1400)
  await page.evaluate(() => document.querySelector('.deck__track').scrollBy({ left: -300, behavior: 'smooth' })); await pause(1400)

  await caption('Справка', 'вопрос голосом')
  await page.locator('.tabs__tab', { hasText: 'Справка' }).click(); await pause(2200)
  await page.getByRole('button', { name: 'Ответить голосом' }).click(); await pause(5600)
  await page.getByRole('button', { name: 'Готово' }).click()
  await page.waitForFunction(() => document.querySelector('.composer__field')?.value.length > 10, null, { timeout: 30000 }); await pause(1500)
  await page.locator('.composer__field').press('Enter')
  await caption('Справка', 'ответ по базе знаний')
  await page.waitForSelector('.exchange__after', { timeout: 60000 }); await pause(2600)
  await caption('Пруф', 'сноска открывает цитату и три проверки')
  await page.locator('button.cite').first().click(); await pause(5200)
  await page.keyboard.press('Escape'); await pause(900)
  await scrollTo('.sources', 1800); await page.locator('.sources__head').click(); await pause(2600)

  await caption('Интернет', 'нет в базе — найдёт и проверит цитаты')
  await type('Хочу поступить в МПГУ в Ставрополе. Что для этого нужно сделать?')
  await page.waitForFunction(() => document.querySelectorAll('.exchange__after').length === 2, null, { timeout: 90000 }); await pause(1500)
  await scrollTo('.ask__anchor:nth-child(2)', 1600); await pause(3000)
  await caption('Пруф из интернета', 'сервер нашёл цитату на странице')
  await page.locator('.ask__anchor:nth-child(2) button.cite').first().click(); await pause(4200)
  await caption('Моя база', 'сохраняем — наставник будет опираться дальше')
  await page.getByRole('button', { name: 'Сохранить в мою базу' }).click().catch(() => log('no save button')); await pause(2200)
  await page.keyboard.press('Escape'); await pause(800)

  await caption('Тренажёр', 'сценарий «Первая работа»')
  await page.goto('http://localhost:5173/#/'); await pause(1600)
  await page.locator('.deck__card', { hasText: 'Первая работа' }).click(); await pause(3800)
  await page.getByRole('button', { name: /Начать/ }).click(); await pause(600)
  const total = await page.locator('.step__progress span').count()
  for (let i = 0; i < total; i++) {
    const situation = await page.locator('.step__situation').innerText()
    const item = cases.find((c) => c.situation === situation); const a = bank.cases[item.id]
    if (i === 0) {
      await caption('Кейс с подвохом', 'отвечаем слабо'); await pause(4200)
      await type(a.weak)
      await caption('Разбор', 'верно · улучшить · пример')
      await reviewed(1); await pause(1200)
      await scrollTo('.feedback', 1400); await pause(2200); await scrollTo('.block--example', 3200); await pause(2600)
      await caption('Разбор', 'оценка, типовая ошибка, источники'); await scrollTo('bottom', 2600); await pause(3600)
      await caption('Вторая попытка', 'наставник сравнит с первой')
      await type(a.strong); await reviewed(2); await pause(900); await scrollTo('.feedback:last-of-type', 1500); await pause(3200); await scrollTo('bottom', 2600); await pause(2400)
    } else {
      if (i === 1) await caption('Ещё три кейса', 'разные зоны сценария')
      await pause(2200)
      const weak = item.zone === 'interview'
      await type(weak ? a.weak : a.strong, 5); await reviewed(1); await pause(700); await scrollTo('.feedback', 1100); await pause(1500); await scrollTo('bottom', 1700); await pause(1500)
    }
    await next(); await pause(700)
  }
  await caption('Итог тренировки', 'пробел и план на вечер')
  await page.waitForSelector('.debrief__actions', { timeout: 70000 }); await pause(4800); await scrollTo('bottom', 2600); await pause(2400)

  await caption('Карта прогресса', 'размытая точка — слабая зона')
  await page.getByRole('button', { name: /Карта прогресса/ }).click(); await pause(2600); await scrollTo('.map:nth-of-type(2)', 1800); await pause(3600); await scrollTo('bottom', 2400); await pause(2600)

  await caption('Память', 'наставник помнит прошлую ошибку')
  await page.goto('http://localhost:5173/#/'); await pause(4200)
  await page.locator('.home__back').click(); await pause(4400)
  await page.getByRole('button', { name: /Начать/ }).click(); await pause(600)
  await caption('Возврат к ошибке', 'контрольный вопрос'); await pause(4000)
  const question = await page.locator('.step__question').innerText()
  const mistake = mistakes.find((m) => m.probe === question)
  if (mistake) { await type(bank.probes[mistake.id]); await reviewed(1); await pause(900); await scrollTo('.feedback', 1300); await pause(2800); await scrollTo('bottom', 2400); await pause(3000) }
  else log('no probe shown')

  await caption('Экспорт', 'разбор для PDF и заметок')
  await page.goto('http://localhost:5173/#/progress'); await pause(900); await scrollTo('bottom', 1200); await pause(900)
  await page.locator('a.row[href^="#/report/"]').first().click(); await pause(3200); await scrollTo('.doc__case', 2600); await pause(2400); await scrollTo('.doc__sources', 4200); await pause(2600)

  await caption('Пруфы', 'проверка всей базы')
  await page.locator('.tabs__tab', { hasText: 'База' }).click(); await pause(3200)
  await page.getByRole('link', { name: 'как это работает' }).click(); await pause(2400)
  await page.getByRole('button', { name: 'Проверить всю базу' }).click(); await pause(3600)

  await caption('Черновик', 'сначала — начерно'); await page.locator('.tabs__tab', { hasText: 'Тренажёр' }).click(); await pause(3800)
  await cdp.send('Page.stopScreencast')
  const end = Date.now() / 1000
  await context.close(); await browser.close()
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`
  fs.writeFileSync(`${out}/list.txt`, list)
  require('child_process').execSync(`ffmpeg -v error -y -f concat -safe 0 -i ${out}/list.txt -vf "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" -c:v libx264 -crf 22 -preset slow -movflags +faststart ${out}/demo.mp4`)
  log('done ' + fs.readdirSync(out).join(' '))
})()
