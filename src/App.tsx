import { Suspense, lazy, useEffect, useRef, useState, type ComponentType } from 'react'
import { MotionConfig } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { Selection } from '@react-three/postprocessing'
import { useShowroom } from './store/showroomStore'
import { CameraRig } from './three/CameraRig'
import { Stage } from './three/Stage'
import { Intro } from './three/scenes/Intro'
import { Boot, Showroom, ShowroomDevices } from './three/scenes/Showroom'
import { UI } from './ui/Overlays'
import { PresenterMode } from './ui/PresenterMode'
import { REF_ON, RefCamera, RefOverlay } from './dev/RefMode'

const Q = typeof location !== 'undefined' ? location.search : ''
// ?hq: mantém reflexo e pós-processamento completos mesmo se o FPS cair
const FORCE_HQ = Q.includes('hq')
// ?debug=1 (só em desenvolvimento): FPS, draw calls e triângulos
const DEBUG = import.meta.env.DEV && Q.includes('debug')
const Perf = DEBUG ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf }))) : null
const MAX_DPR = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1

/** `?debug=1`: quantos programas de shader existem (cada combinação de flags de material é um a mais). */
function ProgramCount() {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setInterval(() => {
      const gl = (window as unknown as { __gl?: { info: { programs: unknown[] | null } } }).__gl
      if (el.current) el.current.textContent = `programas de shader: ${gl?.info.programs?.length ?? '…'}`
    }, 500)
    return () => clearInterval(t)
  }, [])
  return <div ref={el} className="pointer-events-none fixed bottom-1 left-2 z-50 font-mono text-xs text-white/80" />
}

// Divisão de código: o pós-processamento e as cenas "Em ação" e "Encerramento" saem do pacote inicial.
// O import é dinâmico e quem avisa a chegada é o store (atualização síncrona). Não usamos React.lazy aqui:
// dentro do Canvas, com os quadros pesados da carga, o Suspense não retomava a renderização.
type ChunkName = 'PostFX' | 'InAction' | 'Outro'
const chunkCache: Partial<Record<ChunkName, ComponentType>> = {}
const pending: Partial<Record<ChunkName, Promise<void>>> = {}
const LOADERS: Record<ChunkName, () => Promise<ComponentType>> = {
  PostFX: () => import('./three/PostFX').then((m) => m.default),
  InAction: () => import('./three/scenes/InAction').then((m) => m.InAction),
  Outro: () => import('./three/scenes/Outro').then((m) => m.Outro),
}
const loadChunk = (name: ChunkName) => (pending[name] ??= LOADERS[name]().then((C) => {
  chunkCache[name] = C
  useShowroom.setState((s) => ({ chunks: s.chunks + 1 }))
}))
if (typeof window !== 'undefined') {
  // o pós-processamento começa a baixar junto com o resto; as duas cenas, em tempo ocioso depois da carga
  void loadChunk('PostFX')
  const un = useShowroom.subscribe((s) => {
    if (!s.ready) return
    un()
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 800))
    idle(() => { void loadChunk('InAction'); void loadChunk('Outro') })
  })
}
/** Mostra o componente de um pacote assim que ele chega (e pede o pacote, se ninguém pediu ainda). */
function Chunk({ name }: { name: ChunkName }) {
  useShowroom((s) => s.chunks)
  const C = chunkCache[name]
  if (!C) void loadChunk(name)
  return C ? <C /> : null
}

function Scenes() {
  const scene = useShowroom((s) => s.scene)
  switch (scene) {
    case 'intro': return <Intro />
    case 'showroom': return <Showroom />
    // cenas carregadas à parte: o código chega em segundo plano logo depois da carga
    case 'inaction': return <Chunk name="InAction" />
    case 'outro': return <Chunk name="Outro" />
  }
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
    <main className={`relative h-full w-full ${presenter ? 'presenter' : ''}`}>
      {/* eventSource no contêiner: arrastar por cima da tela do celular (Html) também gira a câmera */}
      <div ref={container} className="absolute inset-0 isolate z-0">
        <Canvas
          eventSource={container} eventPrefix="client"
          dpr={dpr} camera={{ fov: 32, near: 0.05, far: 120, position: [0, 2.6, 15] }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          // em produção, o three não confere erro de shader: essa conferência (getProgramParameter/getShaderInfoLog)
          // obriga a esperar cada compilação e anula o compileAsync. Em `npm run dev` continua ligada.
          onCreated={({ gl }) => { gl.debug.checkShaderErrors = import.meta.env.DEV }}
          aria-label="Showroom 3D dos equipamentos do Alarme 365"
        >
          <Suspense fallback={null}>
            <Selection>
              <Stage />
              {/* os 7 aparelhos do showroom ficam montados o tempo todo */}
              <ShowroomDevices />
              <Scenes />
              {REF_ON ? <RefCamera /> : <CameraRig />}
              <Chunk name="PostFX" />
              <Boot />
            </Selection>
            {Perf && <Perf position="bottom-right" />}
          </Suspense>
          <AdaptiveDpr />
          {!FORCE_HQ && !REF_ON && <PerformanceMonitor flipflops={3} onDecline={decline} onFallback={() => useShowroom.getState().set({ quality: 3 })} />}
        </Canvas>
      </div>
      {/* a camada 2D respeita prefers-reduced-motion também nas animações do framer-motion */}
      <MotionConfig reducedMotion="user">{REF_ON ? <RefOverlay /> : <UI />}</MotionConfig>
      <PresenterMode />
      {DEBUG && <ProgramCount />}
    </main>
  )
}
