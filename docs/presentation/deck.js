// Режим показа: стрелки, пробел и клик листают слайды, элементы появляются по очереди.
// При печати в PDF скрипт ничего не меняет — каждая страница остаётся статичной.
;(() => {
  if (matchMedia('print').matches) return
  const slides = [...document.querySelectorAll('.slide')]
  if (!slides.length) return
  document.body.classList.add('present')
  // Печать из режима показа: на время печати возвращаем обычную ленту слайдов.
  addEventListener('beforeprint', () => document.body.classList.remove('present'))
  addEventListener('afterprint', () => document.body.classList.add('present'))

  // Порядок появления пунктов внутри слайда.
  for (const slide of slides) {
    slide
      .querySelectorAll(
        '.list li, .flow li, .card, .steps article, .numbers p, .kinds article, .arch__box, .facts p, .rewrite p',
      )
      .forEach((el, i) => el.style.setProperty('--n', i))
  }

  const fit = () => {
    const k = Math.min(innerWidth / 1280, innerHeight / 720)
    document.documentElement.style.setProperty('--fit', k)
  }
  fit()
  addEventListener('resize', fit)

  let current = Math.max(0, Math.min(slides.length - 1, Number(location.hash.slice(1)) - 1 || 0))
  const show = (index) => {
    current = Math.max(0, Math.min(slides.length - 1, index))
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === current))
    history.replaceState(null, '', `#${current + 1}`)
    hint.textContent = `${current + 1} / ${slides.length}`
  }
  const hint = document.createElement('p')
  hint.className = 'deck-hint'
  document.body.append(hint)

  addEventListener('keydown', (event) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) show(current + 1)
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) show(current - 1)
    else if (event.key === 'Home') show(0)
    else if (event.key === 'End') show(slides.length - 1)
    else return
    event.preventDefault()
  })
  addEventListener('click', (event) => {
    if (event.target.closest('a')) return
    show(event.clientX < innerWidth / 3 ? current - 1 : current + 1)
  })
  show(current)
})()
