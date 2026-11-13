import { useEffect, useRef } from 'react'
import './Orb.css'

export type OrbMood = 'idle' | 'listening' | 'thinking'

interface Props {
  mood?: OrbMood
  /** Громкость голоса от 0 до 1; читается на каждом кадре без перерисовки React. */
  level?: () => number
  className?: string
}

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

/**
 * Голос рисует узор, как песок на звучащей пластине: стоячие волны по радиусу и по
 * кругу складываются, и там, где они гасят друг друга, остаются светлые линии.
 * Чем громче голос, тем гуще и сложнее узор и тем шире диск.
 */
const FRAGMENT = `
precision highp float;
uniform vec2 uSize;
uniform float uTime;
uniform vec3 uColor;
uniform float uLevel;
uniform float uEnergy;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uSize) / min(uSize.x, uSize.y);
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  float loud = clamp(uLevel * 1.6, 0.0, 1.0);

  // Край диска дышит: шумом по окружности и громкостью.
  float edge = 0.3 + 0.07 * loud + 0.025 * (noise(vec2(angle * 1.5, uTime * 0.6)) - 0.5);
  float body = exp(-pow(radius / edge, 4.0));

  float density = 11.0 + 16.0 * loud + 4.0 * uEnergy;
  float a = cos(density * radius - uTime * 1.2) * cos(6.0 * angle + uTime * 0.25);
  float b = cos((density * 0.62) * radius + uTime * 0.8) * cos((4.0 + 4.0 * loud) * angle - uTime * 0.4);
  float pattern = mix(a, a + b, 0.35 + 0.65 * loud);

  // Узловые линии светлые, пучности — насыщенные.
  float fill = smoothstep(0.05, 0.75, abs(pattern));
  float core = exp(-pow(radius / 0.05, 2.0)) * (0.5 + loud);
  float ink = body * (0.28 + 0.72 * fill) + core;
  ink *= 0.85 + 0.3 * noise(uv * 9.0 + uTime * 0.2);
  float alpha = clamp(ink, 0.0, 1.0) * (0.55 + 0.35 * loud);

  gl_FragColor = vec4(uColor * alpha, alpha);
}
`

/** Доля от CSS-размера, в которой считается шейдер. Браузер растянет картинку сам. */
const RENDER_SCALE = 0.5

const MOODS: Record<OrbMood, { color: [number, number, number]; speed: number; energy: number }> = {
  idle: { color: [0.2, 0.2, 0.22], speed: 1, energy: 0 },
  listening: { color: [0.2, 0.47, 1], speed: 1.4, energy: 0.2 },
  thinking: { color: [0.45, 0.38, 0.95], speed: 3, energy: 1 },
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

export function Orb({ mood = 'idle', level, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const moodRef = useRef(mood)
  const levelRef = useRef(level)
  moodRef.current = mood
  levelRef.current = level

  useEffect(() => {
    const canvas = canvasRef.current!
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false })
    if (!gl) {
      canvas.dataset.fallback = 'true'
      return
    }

    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const uniform = (name: string) => gl.getUniformLocation(program, name)
    const uSize = uniform('uSize')
    const uTime = uniform('uTime')
    const uColor = uniform('uColor')
    const uLevel = uniform('uLevel')
    const uEnergy = uniform('uEnergy')

    const resize = () => {
      // Узор размытый по замыслу: полного разрешения экрана ему не нужно.
      const size = Math.round(canvas.clientWidth * RENDER_SCALE)
      if (canvas.width === size) return
      canvas.width = size
      canvas.height = size
      gl.viewport(0, 0, size, size)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const color = [...MOODS[moodRef.current].color]
    let time = Math.random() * 40
    let energy = 0
    let voice = 0
    let speed = 1
    let previous = performance.now()
    let frame = 0

    const draw = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05)
      previous = now
      const target = MOODS[moodRef.current]
      const ease = 1 - Math.exp(-dt * 4)
      for (let i = 0; i < 3; i++) color[i] += (target.color[i] - color[i]) * ease
      energy += (target.energy - energy) * ease
      speed += (target.speed - speed) * ease
      voice += ((levelRef.current?.() ?? 0) - voice) * (1 - Math.exp(-dt * 14))
      time += dt * speed

      gl.uniform2f(uSize, canvas.width, canvas.height)
      gl.uniform1f(uTime, time)
      gl.uniform3f(uColor, color[0], color[1], color[2])
      gl.uniform1f(uLevel, voice)
      gl.uniform1f(uEnergy, energy)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      if (!still && !document.hidden) frame = requestAnimationFrame(draw)
    }
    const resume = () => {
      cancelAnimationFrame(frame)
      previous = performance.now()
      frame = requestAnimationFrame(draw)
    }
    resume()
    document.addEventListener('visibilitychange', resume)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', resume)
      // Сам контекст не гасим: канвас переживает повторный запуск эффекта.
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [])

  return <canvas ref={canvasRef} className={`orb ${className}`} aria-hidden="true" />
}
