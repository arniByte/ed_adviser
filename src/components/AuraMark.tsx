import type { Palette } from '../lib/aura'
import { Mark } from './Mark'
import { Aura } from './Aura'
import './AuraMark.css'

/** Знак на тёплом пятне: так начинается каждый главный экран. */
export function AuraMark({ size, palette = 'thermal' }: { size: number; palette?: Palette }) {
  return (
    <div className="aura-mark" style={{ width: size, height: size }}>
      <Aura className="aura-mark__glow" palette={palette} round bands={6} />
      <Mark size={size} />
    </div>
  )
}
