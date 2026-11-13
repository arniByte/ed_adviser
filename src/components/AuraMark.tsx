import type { Palette } from '../lib/aura'
import { AsciiMark } from './AsciiMark'
import { Aura } from './Aura'
import './AuraMark.css'

/** Знак на тёплом пятне: так начинается каждый главный экран. */
export function AuraMark({ size, palette = 'thermal' }: { size: number; palette?: Palette }) {
  return (
    <div className="aura-mark" style={{ width: size, height: size }}>
      <Aura className="aura-mark__glow" palette={palette} round bands={6} />
      <AsciiMark size={size} playful tint />
    </div>
  )
}
