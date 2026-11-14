import { Suspense, lazy, useEffect, useRef, useState, type ComponentType } from 'react'
import { MotionConfig } from 'framer-motion'
import { Canvas, useThree } from '@react-three/fiber'
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
import { installGlTrace, reportGlTrace } from './dev/glTrace'
import { FORCE_DPR, FORCE_Q, FPS_MIN, PERF_HUD, perfBridge } from './dev/perf'
import { PerfHud } from './dev/PerfHud'

const Q = typeof location !== 'undefined' ? location.search : ''
// ?hq: mantém reflexo e pós-processamento completos mesmo se o FPS cair
const FORCE_HQ = Q.includes('hq')
// ?debug=1 (só em desenvolvimento): FPS, draw calls e triângulos
// ?debug=1: programas de shader e triângulos (vale também no build, para medir na máquina da apresentação);
// o painel do r3f-perf (FPS, draw calls) só entra em desenvolvimento
const DEBUG = Q.includes('debug')
// diagnóstico de carga: registra quem usa um programa de shader antes de ele terminar de compilar
if (DEBUG) {
  installGlTrace()
  const un = useShowroom.subscribe((st) => { if (st.ready) { un(); (window as unknown as { __glReport?: unknown }).__glReport = reportGlTrace() } })
}
const Perf = DEBUG && import.meta.env.DEV ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf }))) : null
const MAX_DPR = FORCE_DPR ?? (typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1)
// ?q=N fixa a qualidade (teste de fluidez): vale desde o primeiro quadro e desliga a qualidade adaptativa
if (FORCE_Q !== null) useShowroom.setState({ quality: FORCE_Q })

type DebugGL = { info: { programs: unknown[] | null } }
type DebugNode = { visible: boolean; children: DebugNode[]; isMesh?: boolean; count?: number; geometry?: { index: { count: number } | null; attributes: { position?: { count: number } } } }
/** Triângulos dos objetos visíveis da cena (conta a geometria; não depende de quantos passes o render faz). */
function visibleTriangles(root: DebugNode): number {
  if (!root.visible) return 0
  let n = 0
  if (root.isMesh && root.geometry) n += ((root.geometry.index?.count ?? root.geometry.attributes.position?.count ?? 0) / 3) * (root.count ?? 1)
  for (const c of root.children) n += visibleTriangles(c)
  return n
}
/** Liga o medidor de fluidez (`?perf=1`) aos controles da câmera e ao renderer. */
function PerfBridge() {
  const controls = useThree((s) => s.controls) as typeof perfBridge.controls
  const gl = useThree((s) => s.gl)
  useEffect(() => { perfBridge.controls = controls; perfBridge.gl = gl }, [controls, gl])
  return null
}

/** `?debug=1`: programas de shader (cada combinação de flags de material é um a mais) e triângulos visíveis. */
function ProgramCount() {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setInterval(() => {
      const w = window as unknown as { __gl?: DebugGL; __scene?: DebugNode }
      const tris = w.__scene ? Math.round(visibleTriangles(w.__scene)) : 0
      ;(window as unknown as { __debug?: object }).__debug = { programs: w.__gl?.info.programs?.length ?? 0, triangles: tris }
      if (el.current) el.current.textContent = `programas de shader: ${w.__gl?.info.programs?.length ?? '…'} · triângulos visíveis: ${tris.toLocaleString('pt-BR')}`
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
}).catch(() => { delete pending[name]; reloadStale() }))
/**
 * Aba aberta numa versão antiga: depois de uma publicação nova, os pacotes antigos somem do servidor e a cena que ainda
 * não tinha chegado não carrega (ficava tudo preto). Recarrega a página uma vez para pegar a versão nova.
 */
function reloadStale() {
  try {
    const last = Number(sessionStorage.getItem('stale-reload') || 0)
    if (Date.now() - last < 60_000) return // já recarregou há pouco: não entra em laço
    sessionStorage.setItem('stale-reload', String(Date.now()))
  } catch { /* sem sessionStorage: recarrega assim mesmo */ }
  window.location.reload()
}
if (typeof window !== 'undefined') window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); reloadStale() })
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
    if (dpr > 1 && FORCE_DPR === null) { setDpr(1); s.set({ quality: Math.max(1, s.quality) as 1 }) }
    else if (s.quality < 3) s.set({ quality: Math.max(2, s.quality + 1) as 2 | 3 })
  }
  return (
    <main className={`relative h-full w-full ${presenter ? 'presenter' : ''}`}>
      {/* eventSource no contêiner: arrastar por cima da tela do celular (Html) também gira a câmera */}
      <div ref={(el) => { container.current = el!; perfBridge.container = el }} className="absolute inset-0 isolate z-0">
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
          {FORCE_DPR === null && <AdaptiveDpr />}
          {!FORCE_HQ && !REF_ON && FORCE_Q === null && (
            <PerformanceMonitor flipflops={3} onDecline={decline} onFallback={() => useShowroom.getState().set({ quality: 3 })}
              {...(FPS_MIN !== null ? { bounds: (rr: number) => [FPS_MIN!, Math.max(FPS_MIN! + 5, rr > 100 ? 100 : 60)] as [number, number] } : {})} />
          )}
          {PERF_HUD && <PerfBridge />}
        </Canvas>
      </div>
      {/* a camada 2D respeita prefers-reduced-motion também nas animações do framer-motion */}
      <MotionConfig reducedMotion="user">{REF_ON ? <RefOverlay /> : <UI />}</MotionConfig>
      <PresenterMode />
      {DEBUG && <ProgramCount />}
      {PERF_HUD && <PerfHud />}
    </main>
  )
}
