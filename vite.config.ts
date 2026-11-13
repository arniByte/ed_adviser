import type { IncomingMessage } from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * В разработке обслуживает /api теми же обработчиками, что и Vercel в продакшене:
 * каждый файл в папке api экспортирует объект с методом fetch(Request) → Response.
 */
function localApi(): Plugin {
  const readBody = async (req: IncomingMessage) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks)
  }

  return {
    name: 'local-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''))
      server.middlewares.use('/api', async (req, res) => {
        try {
          const name = (req.url ?? '').split('?')[0].replace(/[^a-z]/g, '')
          const module = await server.ssrLoadModule(`/api/${name}.ts`)
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
          const response: Response = await module.default.fetch(
            new Request(`http://localhost${req.originalUrl}`, {
              method: req.method,
              headers: req.headers as Record<string, string>,
              body: hasBody ? await readBody(req) : undefined,
            }),
          )
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          if (response.body) {
            for await (const chunk of response.body) res.write(chunk)
          }
          res.end()
        } catch (error) {
          server.ssrFixStacktrace(error as Error)
          console.error(error)
          res.statusCode = 500
          res.end()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
  build: { target: 'es2022' },
})
