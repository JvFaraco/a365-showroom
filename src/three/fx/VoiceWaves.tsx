import { SoundWaves } from './SoundWaves'

/** Ondas de voz: arcos que saem do alto-falante. Fica no plano XY, abrindo para +Y. */
export function VoiceWaves({ on, ...props }: { on: () => boolean } & JSX.IntrinsicElements['group']) {
  return (
    <group {...props}>
      <SoundWaves level={() => (on() ? 2 : 0)} color="#6aa2ff" count={4} arc={Math.PI * 0.7} maxRadius={1.3} speed={0.7} />
    </group>
  )
}
