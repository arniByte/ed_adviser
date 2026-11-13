/**
 * Загрузка страницы источника и приведение её к сравнимому тексту.
 * Одна и та же нормализация применяется к странице и к цитате, поэтому
 * неразрывные пробелы, мягкие переносы и HTML-сущности не мешают поиску.
 */
import { execFileSync } from 'node:child_process'

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  shy: '',
  thinsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  minus: '−',
  times: '×',
  laquo2: '«',
}

function decode(html: string): string {
  return html.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const value =
        code[1] === 'x' || code[1] === 'X'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
}

/** Единый вид текста для сравнения цитаты со страницей. */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[­​‌‍⁠﻿]/g, '')
    .replace(/[    ]/g, ' ')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export interface Page {
  status: number
  text: string
}

const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'accept-language': 'ru,en;q=0.8',
}

export async function fetchPage(url: string): Promise<Page> {
  const response = await fetch(url, {
    headers: HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  })
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('pdf') || url.endsWith('.pdf')) {
    const bytes = Buffer.from(await response.arrayBuffer())
    // Текст PDF достаёт pdftotext из poppler — он есть в большинстве Linux и в macOS через brew.
    const text = execFileSync('pdftotext', ['-q', '-', '-'], {
      input: bytes,
      maxBuffer: 64 * 1024 * 1024,
    }).toString()
    return { status: response.status, text: normalize(text) }
  }
  return { status: response.status, text: normalize(htmlToText(await response.text())) }
}

/** Проверяет, что цитата дословно есть на странице: без учёта регистра и пробелов. */
export function containsQuote(page: string, quote: string): boolean {
  return normalize(page).toLowerCase().includes(normalize(quote).toLowerCase())
}
