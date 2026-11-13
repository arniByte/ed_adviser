/**
 * Загрузка страницы источника для скрипта пруфов: в отличие от сервера,
 * умеет читать PDF и ждёт долго.
 */
import { execFileSync } from 'node:child_process'
import { HEADERS, htmlToText, normalize } from '../../server/page-text.js'

export { containsQuote, htmlToText, normalize } from '../../server/page-text.js'

export interface Page {
  status: number
  text: string
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
