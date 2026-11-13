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
 * Кольцо из аэрографа: гауссов профиль вместо жёсткой линии, нажим меняется
 * по окружности, сверху зерно. От голоса расходится рябь внутри.
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

float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  for (int i = 0; i < 4; i++) { value += amplitude * noise(p); p *= 2.03; amplitude *= 0.5; }
  return value;
}

float soft(float distance, float width) { return exp(-pow(distance / width, 2.0)); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uSize) / min(uSize.x, uSize.y);
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  vec2 around = vec2(cos(angle), sin(angle));

  float wobble = fbm(around * 1.4 + uTime * 0.11) - 0.5;
  float ringRadius = 0.32 + wobble * (0.045 + 0.06 * uLevel + 0.03 * uEnergy);

  // Нажим: с одной стороны кольцо плотное, с другой почти исчезает.
  float pressure = fbm(around * 0.85 - uTime * 0.06 + 7.3);
  float width = mix(0.012, 0.062, clamp(pressure * 1.7 - 0.35, 0.0, 1.0)) * (1.0 + 0.5 * uLevel);

  float distanceToRing = radius - ringRadius;
  float ink = soft(distanceToRing, width) * (0.55 + 0.6 * pressure) + 0.16 * soft(distanceToRing, 0.1);

  float ripples = 0.0;
  for (int i = 1; i <= 3; i++) {
    float n = float(i);
    float r = ringRadius * 0.27 * n + 0.014 * sin(angle * (4.0 + 2.0 * n) + uTime * (1.3 + 0.35 * n));
    ripples += soft(radius - r, 0.032) * (0.6 - 0.12 * n);
  }
  ink += ripples * uLevel;

  ink *= 0.8 + 0.35 * fbm(uv * 7.0 + uTime * 0.05);
  float grain = hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5;
  float alpha = clamp(ink * (1.0 + grain * 0.4), 0.0, 1.0) * 0.7;

  gl_FragColor = vec4(uColor * alpha, alpha);
}
`

/** Доля от CSS-размера, в которой считается шейдер. Браузер растянет картинку сам. */
const RENDER_SCALE = 0.6

const MOODS: Record<OrbMood, { color: [number, number, number]; speed: number; energy: number }> = {
  idle: { color: [0.2, 0.2, 0.22], speed: 1, energy: 0 },
  listening: { color: [0.2, 0.47, 1], speed: 1.6, energy: 0.3 },
  thinking: { color: [0.36, 0.33, 0.52], speed: 5, energy: 1 },
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
      // Кольцо размытое по замыслу: полного разрешения экрана ему не нужно.
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
