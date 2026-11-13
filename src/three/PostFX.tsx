import { useEffect } from 'react'
import { Bloom, EffectComposer, N8AO, Outline, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { KernelSize, ToneMappingMode } from 'postprocessing'
import { useShowroom } from '../store/showroomStore'
import { postFx } from './scenes/Showroom'

/**
 * Pós-processamento: AO em meia resolução (sulcos e aletas), bloom só nos emissivos (LEDs, flash,
 * anel de 5 s), contorno do hover, vinheta leve, ACES e SMAA. Sem DOF. Encolhe conforme `quality`.
 */
export default function PostFX() {
  const quality = useShowroom((s) => s.quality)
  useEffect(() => { postFx.ready = true }, [])
  const ao = <N8AO halfRes quality="performance" aoRadius={0.22} distanceFalloff={0.6} intensity={1.7} color="#05070f" />
  const bloom = <Bloom mipmapBlur luminanceThreshold={1.2} luminanceSmoothing={0.12} intensity={0.85} radius={0.7} />
  const outline = <Outline blur kernelSize={KernelSize.VERY_SMALL} edgeStrength={1.7} visibleEdgeColor={0x8fb0ff} hiddenEdgeColor={0x24409c} xRay={false} />
  const tone = <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  if (quality >= 3) return <EffectComposer key="q3" multisampling={0} autoClear={false}>{bloom}{outline}{tone}</EffectComposer>
  if (quality === 2) return (
    <EffectComposer key="q2" multisampling={0} autoClear={false}>
      {bloom}{outline}<Vignette eskil={false} offset={0.25} darkness={0.7} />{tone}<SMAA />
    </EffectComposer>
  )
  return (
    <EffectComposer key="q0" multisampling={0} autoClear={false}>
      {ao}{bloom}{outline}<Vignette eskil={false} offset={0.25} darkness={0.7} />{tone}<SMAA />
    </EffectComposer>
  )
}

