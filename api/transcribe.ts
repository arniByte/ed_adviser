import { LIMITS } from '../core/protocol'
import { errorResponse, json, readJson } from '../server/http'
import { BadRequest } from '../server/mentor'
import { complete, MODELS } from '../server/openrouter'

export const config = { runtime: 'edge' }

const INSTRUCTION =
  'Запиши дословно, что говорит человек на этой записи. Язык — русский. Расставь знаки препинания. Верни только текст речи без пояснений и кавычек. Если речи нет, верни пустую строку.'

/** Принимает запись голоса в WAV (base64) и возвращает текст. */
export default async function handler(request: Request): Promise<Response> {
  try {
    const { audio } = await readJson<{ audio?: string }>(request, LIMITS.audioBytes)
    if (typeof audio !== 'string' || audio.length < 1000)
      throw new BadRequest('Запись слишком короткая')

    const text = await complete({
      model: MODELS.transcribe,
      maxTokens: 700,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: INSTRUCTION },
            { type: 'input_audio', input_audio: { data: audio, format: 'wav' } },
          ],
        },
      ],
    })
    return json({ text: text.slice(0, LIMITS.messageChars) })
  } catch (error) {
    return errorResponse(error)
  }
}
