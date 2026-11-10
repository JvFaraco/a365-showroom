import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, Outline, SMAA, Selection, ToneMapping, Vignette } from '@react-three/postprocessing'
import { KernelSize, ToneMappingMode } from 'postprocessing'
import { useShowroom } from './store/showroomStore'
import { CameraRig } from './three/CameraRig'
import { Intro } from './three/scenes/Intro'
import { Showroom } from './three/scenes/Showroom'
import { Network } from './three/scenes/Network'
import { InAction } from './three/scenes/InAction'
import { Outro } from './three/scenes/Outro'
import { Loader, UI } from './ui/Overlays'
import { PresenterMode } from './ui/PresenterMode'

// ?hq na URL: mantém reflexo e pós-processamento completos mesmo se o FPS cair
const FORCE_HQ = typeof location !== 'undefined' && location.search.includes('hq')

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

/** Pós-processamento: bloom nos LEDs e no flash, contorno do hover, vinheta e SMAA. */
function PostFX() {
  const lowPerf = useShowroom((s) => s.lowPerf)
  const outline = <Outline blur kernelSize={KernelSize.VERY_SMALL} edgeStrength={3.2} visibleEdgeColor={0x6f9bff} hiddenEdgeColor={0x24409c} xRay={false} />
  const bloom = <Bloom mipmapBlur luminanceThreshold={1.15} luminanceSmoothing={0.15} intensity={0.9} radius={0.7} />
  const tone = <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  return lowPerf ? (
    <EffectComposer key="low" multisampling={0} autoClear={false}>{bloom}{outline}{tone}</EffectComposer>
  ) : (
    <EffectComposer key="high" multisampling={0} autoClear={false}>
      {bloom}{outline}
      <Vignette eskil={false} offset={0.25} darkness={0.75} />
      {tone}
      <SMAA />
    </EffectComposer>
  )
}

export default function App() {
  const container = useRef<HTMLDivElement>(null!)
  const presenter = useShowroom((s) => s.presenter)
  return (
    <div className={`relative h-full w-full ${presenter ? 'presenter' : ''}`}>
      {/* eventSource no contêiner: arrastar por cima da tela do celular (Html) também gira a câmera */}
      <div ref={container} className="absolute inset-0 isolate z-0">
        <Canvas
          eventSource={container} eventPrefix="client"
          dpr={[1, 2]} camera={{ fov: 32, near: 0.1, far: 120, position: [0, 2.6, 15] }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          aria-label="Showroom 3D dos equipamentos do Alarme 365"
        >
          <Suspense fallback={null}>
            <Selection>
              <Scenes />
              <CameraRig />
              <PostFX />
            </Selection>
          </Suspense>
          <AdaptiveDpr pixelated />
          {!FORCE_HQ && <PerformanceMonitor flipflops={3} onDecline={() => useShowroom.getState().set({ lowPerf: true })} onFallback={() => useShowroom.getState().set({ lowPerf: true })} />}
        </Canvas>
      </div>
      <UI />
      <PresenterMode />
      <Loader />
    </div>
  )
}
