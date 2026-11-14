import type { Palette } from '../lib/aura'
import { Mark, type MarkMood } from './Mark'
import { Aura } from './Aura'
import './AuraMark.css'

/** Знак на тёплом пятне: так начинается каждый главный экран. */
export function AuraMark({
  size,
  palette = 'thermal',
  listen,
  mood,
}: {
  size: number
  palette?: Palette
  listen?: () => number
  mood?: MarkMood
}) {
  return (
    <div className="aura-mark" style={{ width: size, height: size }}>
      <Aura className="aura-mark__glow" palette={palette} round bands={0} fps={12} />
      <Mark size={size} listen={listen} mood={mood} />
    </div>
  )
}
