import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProgress } from '@react-three/drei'
import { IA_DURATION, IA_STEPS } from '../data/inAction'
import { DEVICE_BY_ID, SLOGAN, getPart } from '../data/devices'
import { useShowroom, type Scene } from '../store/showroomStore'
import { Breadcrumb } from './Breadcrumb'
import { DeviceDock } from './DeviceDock'
import { PartCard, CalloutLine } from './PartCard'
import { PartList } from './PartList'
import { ViewToggles } from './ViewToggles'
import { Fullscreen, OrsegupsLogo, Pause, Play, Sound } from './icons'
import { beep } from './audio'

const SCENES: { id: Scene; label: string }[] = [
  { id: 'showroom', label: 'Showroom' },
  { id: 'network', label: 'Sistema conectado' },
  { id: 'inaction', label: 'Em ação' },
  { id: 'outro', label: 'Encerramento' },
]

/** Carregamento: o logo é desenhado com o traço animado enquanto a cena prepara. */
export function Loader() {
  const { active } = useProgress()
  const [minDone, setMinDone] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMinDone(true), 1700); return () => clearTimeout(t) }, [])
  return (
    <AnimatePresence>
      {(active || !minDone) && (
        <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="fixed inset-0 z-50 grid place-items-center bg-ink" role="status" aria-label="Carregando">
          <div className="flex flex-col items-center gap-4">
            <OrsegupsLogo size={120} draw />
            <div className="font-title text-sm tracking-[0.3em] text-white/70">ALARME 365</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TopBar() {
  const scene = useShowroom((s) => s.scene)
  const sound = useShowroom((s) => s.sound)
  const presenter = useShowroom((s) => s.presenter)
  const set = useShowroom((s) => s.set)
  const togglePresenter = () => {
    set({ presenter: !presenter })
    if (!presenter) void document.documentElement.requestFullscreen?.().catch(() => {})
    else if (document.fullscreenElement) void document.exitFullscreen?.()
  }
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 p-3 md:p-5">
      <button className="pointer-events-auto flex items-center gap-2" aria-label="Alarme 365: voltar à abertura" onClick={() => useShowroom.getState().setScene('intro')}>
        <OrsegupsLogo size={34} />
        <span className="hidden font-title text-lg font-bold tracking-wide sm:inline">Alarme 365</span>
      </button>
      <nav aria-label="Cenas" className="glass pointer-events-auto flex max-w-[62vw] gap-1 overflow-x-auto rounded-full p-1">
        {SCENES.map((s) => (
          <button key={s.id} aria-current={scene === s.id} onClick={() => { beep(); useShowroom.getState().setScene(s.id) }}
            className={`btn whitespace-nowrap !border-transparent !px-3 !py-1.5 ${scene === s.id ? 'btn-on' : '!bg-transparent text-white/75'}`}>{s.label}</button>
        ))}
      </nav>
      <div className="pointer-events-auto flex gap-1">
        <button className="btn glass !p-2.5" aria-label={sound ? 'Desligar o som' : 'Ligar o som'} aria-pressed={sound} onClick={() => set({ sound: !sound })}><Sound size={18} on={sound} /></button>
        <button className={`btn glass !p-2.5 ${presenter ? 'btn-on' : ''}`} aria-label="Modo apresentação (P)" title="Modo apresentação (P)" aria-pressed={presenter} onClick={togglePresenter}><Fullscreen size={18} /></button>
      </div>
    </header>
  )
}

function HoverTag() {
  const device = useShowroom((s) => s.device)
  const hovered = useShowroom((s) => (s.scene === 'showroom' ? s.hovered : null))
  const [pos, setPos] = useState<[number, number]>([0, 0])
  useEffect(() => {
    const mv = (e: PointerEvent) => setPos([e.clientX, e.clientY])
    window.addEventListener('pointermove', mv)
    return () => window.removeEventListener('pointermove', mv)
  }, [])
  const p = getPart(device, hovered)
  if (!p) return null
  return (
    <div role="tooltip" className="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-[160%] whitespace-nowrap rounded-full border border-brand-glow bg-[#0b1126]/95 px-3 py-1 text-sm font-medium text-white shadow-lg shadow-brand/40"
      style={{ left: pos[0], top: pos[1] }}>{p.name}</div>
  )
}

function ShowroomUI() {
  const part = useShowroom((s) => s.part)
  const view = useShowroom((s) => s.view)
  const device = useShowroom((s) => s.device)
  const presenter = useShowroom((s) => s.presenter)
  return (
    <>
      <div className="pointer-events-none fixed left-14 right-3 top-[7rem] z-20 sm:left-[7.5rem] md:left-36 md:right-auto md:top-24 md:max-w-[36vw]"><Breadcrumb /></div>
      <div className="pointer-events-none fixed right-3 top-[4.5rem] z-20 flex md:right-5 md:top-24"><ViewToggles /></div>
      <PartList />
      <PartCard />
      <CalloutLine />
      <HoverTag />
      <DeviceDock />
      {!part && (
        <p className="pointer-events-none fixed inset-x-0 bottom-[5.8rem] z-10 px-4 text-center text-[0.8em] text-white/55 md:bottom-[7.2rem]">
          {view === 'manual' ? 'Clique num número para ver a parte de perto.'
            : view === 'exploded' ? 'Aparelho explodido: as partes internas também são clicáveis.'
            : view === 'xray' ? 'Raio-X: clique numa parte interna.'
            : `Arraste para girar · role para aproximar · clique numa parte do ${DEVICE_BY_ID[device].short.toLowerCase()} · duplo clique reseta`}
        </p>
      )}
      {presenter && !part && (
        <p className="pointer-events-none fixed bottom-1 right-3 z-10 hidden text-[10px] text-white/40 md:block">→ próxima · ← anterior · 1–7 aparelho · E explode · X raio-X · M manual · T tour · R reseta</p>
      )}
    </>
  )
}

function IntroUI() {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between py-[9vh] text-center">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6, duration: 0.9 }}>
        <h1 className="font-title text-[clamp(2.6rem,8vw,6rem)] font-bold leading-none tracking-tight text-white drop-shadow-[0_4px_30px_rgba(61,102,224,.7)]">Alarme <span className="text-accent">365</span></h1>
        <p className="mt-3 font-title text-[clamp(1rem,2.4vw,1.7rem)] text-white/85">{SLOGAN}</p>
      </motion.div>
      <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.6, duration: 0.6 }}
        className="btn btn-primary pointer-events-auto !px-8 !py-3.5 text-[1.05em] shadow-xl shadow-yellow-500/20" onClick={() => { beep(); useShowroom.getState().setScene('showroom') }}>
        Conhecer os equipamentos
      </motion.button>
    </div>
  )
}

function OutroUI() {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between py-[10vh] text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6, duration: 0.9 }} className="flex flex-col items-center">
        <OrsegupsLogo size={110} />
        <div className="mt-2 font-title text-3xl font-bold tracking-[0.2em] text-accent">ORSEGUPS</div>
        <p className="mt-3 font-title text-[clamp(1.1rem,2.6vw,1.9rem)] text-white">{SLOGAN}</p>
      </motion.div>
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6 }} className="btn glass pointer-events-auto" onClick={() => useShowroom.getState().setScene('intro')}>Recomeçar</motion.button>
    </div>
  )
}

function NetworkUI() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
      <div className="glass max-w-2xl rounded-2xl px-5 py-3 text-center text-[0.9em] text-white/85">
        <b className="font-title text-white">Sistema conectado.</b> Sensores, sirene e controle falam com o Módulo por radiofrequência. O Módulo fala com a nuvem por três vias: <b>Chip 4G, Wi-Fi e Ethernet</b>. Da nuvem, o aviso chega ao aplicativo e à Central.
        <span className="mt-1 block text-[0.85em] text-white/55">Clique num aparelho para abri-lo no showroom.</span>
      </div>
    </div>
  )
}

function InActionUI() {
  const t = useShowroom((s) => s.iaT)
  const playing = useShowroom((s) => s.iaPlaying)
  const set = useShowroom((s) => s.set)
  const cur = IA_STEPS.reduce((acc, s, i) => (t >= s.t ? i : acc), 0)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-3">
      <div className="glass pointer-events-auto w-full max-w-3xl rounded-2xl p-3 md:p-4">
        <div className="mb-2 flex items-center gap-3">
          <button className="btn btn-primary !p-3" aria-label={playing ? 'Pausar' : 'Reproduzir'} onClick={() => set(t >= IA_DURATION ? { iaT: 0, iaPlaying: true } : { iaPlaying: !playing })}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <p className="flex-1 text-[0.95em] text-white" aria-live="polite">
            {t === 0 && !playing ? 'Dê Play para ver o alarme em ação. Clique num aparelho para abri-lo no showroom.' : <><b className="text-accent">{cur + 1}.</b> {IA_STEPS[cur].text}</>}
          </p>
        </div>
        <div className="relative h-1.5 rounded-full bg-white/10"><div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(t / IA_DURATION) * 100}%` }} /></div>
        <ol className="mt-2 grid grid-cols-5 gap-1">
          {IA_STEPS.map((s, i) => (
            <li key={s.label}>
              <button onClick={() => set({ iaT: s.t + 0.01, iaPlaying: true })} aria-current={i === cur && t > 0}
                className={`w-full rounded-lg px-1 py-1 text-[0.7em] leading-tight transition ${i === cur && t > 0 ? 'bg-brand-light text-white' : 'text-white/60 hover:bg-white/10'}`}>{i + 1}. {s.label}</button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/** Toda a camada 2D, por cima do canvas. */
export function UI() {
  const scene = useShowroom((s) => s.scene)
  return (
    <>
      {scene !== 'intro' && <TopBar />}
      {scene === 'showroom' && <ShowroomUI />}
      {scene === 'intro' && <IntroUI />}
      {scene === 'outro' && <OutroUI />}
      {scene === 'network' && <NetworkUI />}
      {scene === 'inaction' && <InActionUI />}
    </>
  )
}
