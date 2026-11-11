import { Suspense, lazy, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, Outline, SMAA, Selection, ToneMapping, Vignette } from '@react-three/postprocessing'
import { KernelSize, ToneMappingMode } from 'postprocessing'
import { useShowroom } from './store/showroomStore'
import { CameraRig } from './three/CameraRig'
import { Stage } from './three/Stage'
import { Intro } from './three/scenes/Intro'
import { Showroom, ShowroomDevices, Warmup } from './three/scenes/Showroom'
import { Network } from './three/scenes/Network'
import { InAction } from './three/scenes/InAction'
import { Outro } from './three/scenes/Outro'
import { Loader, UI } from './ui/Overlays'
import { PresenterMode } from './ui/PresenterMode'
import { REF_ON, RefCamera, RefOverlay } from './dev/RefMode'

const Q = typeof location !== 'undefined' ? location.search : ''
// ?hq: mantém reflexo e pós-processamento completos mesmo se o FPS cair
const FORCE_HQ = Q.includes('hq')
// ?debug=1 (só em desenvolvimento): FPS, draw calls e triângulos
const DEBUG = import.meta.env.DEV && Q.includes('debug')
const Perf = DEBUG ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf }))) : null
const MAX_DPR = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1

function Scenes() {
  const scene = useShowroom((s) => s.scene)
  switch (scene) {
    case 'intro': return <Intro />
    case 'showroom': return <Showroom />
    case 'network': return <Network />
    case 'inaction': return <InAction />
    case 'outro': return <Outro />
  }
}

/**
 * Pós-processamento: AO em meia resolução (sulcos e aletas), bloom só nos emissivos (LEDs, flash,
 * anel de 5 s), contorno do hover, vinheta leve, ACES e SMAA. Sem DOF. Encolhe conforme `quality`.
 */
function PostFX() {
  const quality = useShowroom((s) => s.quality)
  const ao = <N8AO halfRes quality="performance" aoRadius={0.22} distanceFalloff={0.6} intensity={1.7} color="#05070f" />
  const bloom = <Bloom mipmapBlur luminanceThreshold={1.2} luminanceSmoothing={0.12} intensity={0.85} radius={0.7} />
  const outline = <Outline blur kernelSize={KernelSize.VERY_SMALL} edgeStrength={3.2} visibleEdgeColor={0x6f9bff} hiddenEdgeColor={0x24409c} xRay={false} />
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

export default function App() {
  const container = useRef<HTMLDivElement>(null!)
  const presenter = useShowroom((s) => s.presenter)
  const [dpr, setDpr] = useState(MAX_DPR)
  // qualidade adaptativa: primeiro cai o DPR (mínimo 1); depois sai o AO; por último, o reflexo
  const decline = () => {
    const s = useShowroom.getState()
    if (dpr > 1) { setDpr(1); s.set({ quality: Math.max(1, s.quality) as 1 }) }
    else if (s.quality < 3) s.set({ quality: Math.max(2, s.quality + 1) as 2 | 3 })
  }
  return (
    <div className={`relative h-full w-full ${presenter ? 'presenter' : ''}`}>
      {/* eventSource no contêiner: arrastar por cima da tela do celular (Html) também gira a câmera */}
      <div ref={container} className="absolute inset-0 isolate z-0">
        <Canvas
          eventSource={container} eventPrefix="client"
          dpr={dpr} camera={{ fov: 32, near: 0.05, far: 120, position: [0, 2.6, 15] }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          aria-label="Showroom 3D dos equipamentos do Alarme 365"
        >
          <Suspense fallback={null}>
            <Selection>
              <Stage />
              {/* os 7 aparelhos do showroom ficam montados o tempo todo */}
              <ShowroomDevices />
              <Scenes />
              {REF_ON ? <RefCamera /> : <CameraRig />}
              <PostFX />
              <Warmup />
            </Selection>
            {Perf && <Perf position="bottom-right" />}
          </Suspense>
          <AdaptiveDpr />
          {!FORCE_HQ && !REF_ON && <PerformanceMonitor flipflops={3} onDecline={decline} onFallback={() => useShowroom.getState().set({ quality: 3 })} />}
        </Canvas>
      </div>
      {REF_ON ? <RefOverlay /> : <UI />}
      <PresenterMode />
      <Loader />
    </div>
  )
}
