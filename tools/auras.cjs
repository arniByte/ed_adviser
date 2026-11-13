// Рендерит ауры и большой знак для слайдов прямо кодом приложения через dev-сервер.
const { chromium } = require('playwright')
const fs = require('fs')
;(async () => {
  const out = process.argv[2]
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 600, height: 600 } })
  await p.goto('http://localhost:5173/')
  const list = [
    ['aura-thermal', 'thermal', 3, 7, false, 4.2],
    ['aura-pastel', 'pastel', 5, 6, false, 9.1],
    ['aura-mint', 'mint', 2, 6, false, 2.7],
    ['aura-dusk', 'dusk', 4, 8, false, 6.3],
    ['orb-thermal', 'thermal', 1, 6, true, 3.3],
  ]
  for (const [name, palette, seed, bands, round, t] of list) {
    const url = await p.evaluate(async ([palette, seed, bands, round, t]) => {
      const { paintAura } = await import('/src/lib/aura.ts')
      const c = document.createElement('canvas')
      c.width = c.height = 96
      const ctx = c.getContext('2d')
      const img = ctx.createImageData(96, 96)
      paintAura(img, t, { palette, seed, bands, round })
      ctx.putImageData(img, 0, 0)
      return c.toDataURL('image/png')
    }, [palette, seed, bands, round, t])
    fs.writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'))
  }
  await b.close()
  console.log('ok')
})()
