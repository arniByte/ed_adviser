// Сохраняет живые записи исходного ролика и добавляет сцену ценностей перед финалом.
const { execFileSync } = require('node:child_process')
const { mkdtempSync, rmSync, existsSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

const [original, output, browser = '/usr/bin/chromium'] = process.argv.slice(2)
if (
  !original ||
  !output ||
  !existsSync(original) ||
  path.resolve(original) === path.resolve(output)
) {
  throw new Error(
    'Укажи исходный ролик 74 с и другой путь для результата: node stitch-values.cjs source.mp4 result.mp4 [chromium]',
  )
}
const duration = Number(
  execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      original,
    ],
    { encoding: 'utf8' },
  ),
)
if (Math.abs(duration - 74) > 0.1)
  throw new Error('Нужен исходный ролик длительностью 74 с, до добавления сцены ценностей')
const temp = mkdtempSync(path.join(tmpdir(), 'chernovik-values-'))
try {
  const segment = path.join(temp, 'values.mp4')
  execFileSync(
    path.join(__dirname, 'node_modules/.bin/remotion'),
    [
      'render',
      'src/index.ts',
      'Values',
      segment,
      '--codec=h264',
      '--crf=18',
      '--concurrency=2',
      `--browser-executable=${browser}`,
      '--log=error',
    ],
    { cwd: __dirname, stdio: 'inherit' },
  )
  const filter = [
    '[0:v]trim=start=0:end=66,setpts=PTS-STARTPTS[v0]',
    '[1:v]fps=30,setpts=PTS-STARTPTS[v1]',
    '[0:v]trim=start=66:end=74,setpts=PTS-STARTPTS[v2]',
    '[v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[v]',
    '[0:a]atrim=start=0:end=66,asetpts=PTS-STARTPTS[a0]',
    '[0:a]atrim=start=60:end=68,asetpts=PTS-STARTPTS,volume=0.8[a1]',
    '[0:a]atrim=start=66:end=74,asetpts=PTS-STARTPTS[a2]',
    '[a0][a1]acrossfade=d=0.025:c1=tri:c2=tri[am]',
    '[am][a2]acrossfade=d=0.025:c1=tri:c2=tri,apad=whole_dur=82[a]',
  ].join(';')
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-threads',
      '2',
      '-i',
      original,
      '-threads',
      '2',
      '-i',
      segment,
      '-filter_complex_threads',
      '2',
      '-filter_threads',
      '2',
      '-filter_complex',
      filter,
      '-map',
      '[v]',
      '-map',
      '[a]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-threads',
      '2',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      '-t',
      '82',
      output,
    ],
    { stdio: 'inherit' },
  )
} finally {
  rmSync(temp, { recursive: true, force: true })
}
