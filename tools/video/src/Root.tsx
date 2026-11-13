import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/unbounded/index.css'
import { Composition } from 'remotion'
import { Promo, FPS, DURATION } from './Promo'

export const Root = () => (
  <Composition id="Promo" component={Promo} durationInFrames={DURATION * FPS} fps={FPS} width={1920} height={1080} />
)
