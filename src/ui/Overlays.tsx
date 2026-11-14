import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IA_DURATION, IA_STEPS } from '../data/inAction'
import { DEVICE_BY_ID, SLOGAN, getPart } from '../data/devices'
import { actionTau, ia, useShowroom, type Scene } from '../store/showroomStore'
import type { ActionId } from '../data/devices'
import { Breadcrumb } from './Breadcrumb'
import { DeviceDock } from './DeviceDock'
import { PartCard, CalloutLine } from './PartCard'
import { ManualLayer } from './ManualLayer'
import { PartList } from './PartList'
import { ViewToggles } from './ViewToggles'
import { Fullscreen, OrsegupsLogo, Pause, Play, Sound } from './icons'
import { beep } from './audio'

const SCENES: { id: Scene; label: string }[] = [
  { id: 'showroom', label: 'Showroom' },
  { id: 'inaction', label: 'Em ação' },
  { id: 'outro', label: 'Encerramento' },
]

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
      <button className="pointer-events-auto flex shrink-0 items-center gap-2" aria-label="Alarme 365: voltar à abertura" onClick={() => useShowroom.getState().setScene('intro')}>
        <OrsegupsLogo size={34} />
        <span className="hidden font-title text-lg font-bold tracking-wide sm:inline">Alarme 365</span>
      </button>
      {/* telas largas: abas; telas estreitas: as quatro cenas num seletor compacto (as abas não cabem em 390 px) */}
      <nav aria-label="Cenas" className="glass pointer-events-auto hidden min-w-0 gap-1 overflow-x-auto rounded-full p-1 lg:flex">
        {SCENES.map((s) => (
          <button key={s.id} aria-current={scene === s.id} onClick={() => { beep(); useShowroom.getState().setScene(s.id) }}
            className={`btn shrink-0 whitespace-nowrap !border-transparent !px-3 !py-1.5 ${scene === s.id ? 'btn-on' : '!bg-transparent text-white/75'}`}>{s.label}</button>
        ))}
      </nav>
      <label className="glass pointer-events-auto relative flex min-w-0 flex-1 items-center rounded-full sm:max-w-xs lg:hidden">
        <span className="sr-only">Cena</span>
        <select value={scene} onChange={(e) => { beep(); useShowroom.getState().setScene(e.target.value as Scene) }}
          className="scene-select min-h-[2.75rem] w-full min-w-0 appearance-none truncate rounded-full bg-transparent py-2 pl-4 pr-9 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {SCENES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 h-3.5 w-3.5 text-white/80" aria-hidden><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </label>
      <div className="pointer-events-auto flex shrink-0 gap-1">
        <button className="btn glass !p-2.5" aria-label={sound ? 'Desligar o som' : 'Ligar o som'} aria-pressed={sound} onClick={() => set({ sound: !sound })}><Sound size={18} on={sound} /></button>
        <button className={`btn glass !p-2.5 ${presenter ? 'btn-on' : ''}`} aria-label="Modo apresentação (P)" title="Modo apresentação (P)" aria-pressed={presenter} onClick={togglePresenter}><Fullscreen size={18} /></button>
      </div>
    </header>
  )
}

function HoverTag() {
  const device = useShowroom((s) => s.device)
  const hovered = useShowroom((s) => (s.scene === 'showroom' ? s.hovered : null))
  const el = useRef<HTMLDivElement>(null)
  const pos = useRef<[number, number]>([0, 0])
  useEffect(() => {
    const mv = (e: PointerEvent) => {
      pos.current = [e.clientX, e.clientY]
      if (el.current) el.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -160%)`
    }
    window.addEventListener('pointermove', mv)
    return () => window.removeEventListener('pointermove', mv)
  }, [])
  const p = getPart(device, hovered)
  return (
    <div ref={el} role="tooltip" className="pointer-events-none fixed left-0 top-0 z-40 whitespace-nowrap rounded-full border border-brand-glow bg-surface/95 px-3 py-1 text-sm font-medium text-white shadow-lg shadow-brand/40"
      style={{ transform: `translate(${pos.current[0]}px, ${pos.current[1]}px) translate(-50%, -160%)`, opacity: p ? 1 : 0, transition: 'opacity var(--duration-fast) var(--ease-out)' }}>{p?.name ?? ''}</div>
  )
}

// avisos das micro-animações: toast centralizado logo abaixo da barra de modos, por cima da lista de Partes
const TOASTS: Partial<Record<ActionId, { at: number; until?: number; text: string }>> = {
  tamper: { at: 0.6, text: 'Tamper aberto: a alavanca saiu, o sistema avisa e não arma' },
}
function ActionToast() {
  const id = useShowroom((s) => s.action?.id)
  const el = useRef<HTMLDivElement>(null)
  const cfg = id ? TOASTS[id] : undefined
  useEffect(() => {
    if (!id || !cfg) return
    let raf = 0
    const tick = () => { if (el.current) { const t = actionTau(id); el.current.style.opacity = t >= cfg.at && t < (cfg.until ?? Infinity) ? '1' : '0' }; raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, cfg])
  if (!cfg) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[11.9rem] z-40 flex justify-center px-3 md:top-[10.2rem]">
      <div ref={el} role="status" className="flex max-w-full items-center gap-2 rounded-full bg-alert px-4 py-1.5 text-sm font-bold text-white shadow-lg shadow-black/40 transition-opacity duration-base ease-out" style={{ opacity: 0 }}>
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-white" style={{ animation: 'blink 0.6s steps(2) infinite' }} />
        {cfg.text}
      </div>
    </div>
  )
}

function ShowroomUI() {
  const part = useShowroom((s) => s.part)
  const view = useShowroom((s) => s.view)
  const device = useShowroom((s) => s.device)
  const presenter = useShowroom((s) => s.presenter)
  return (
    <>
      <h1 className="sr-only">Alarme 365: showroom dos equipamentos</h1>
      <div className="pointer-events-none fixed left-3 right-3 top-[8.1rem] z-20 md:left-36 md:right-auto md:top-24 md:max-w-[42vw]"><Breadcrumb /></div>
      <div className="pointer-events-none fixed right-3 top-[4.5rem] z-20 flex md:right-5 md:top-24"><ViewToggles /></div>
      <PartList />
      <PartCard />
      <CalloutLine />
      <ManualLayer />
      <HoverTag />
      <ActionToast />
      <DeviceDock />
      {!part && (
        <p className="pointer-events-none fixed inset-x-0 bottom-[5.4rem] z-10 px-4 text-center text-[0.8em] text-white/70 md:bottom-[7.2rem]">
          {view === 'manual' ? 'Clique num número para ver a parte de perto.'
            : view === 'exploded' ? 'Aparelho explodido: as partes internas também são clicáveis.'
            : view === 'xray' ? 'Raio-X: clique numa parte interna.'
            : <>
                <span className="hint-mouse">Arraste para girar · role para aproximar · clique numa parte {DEVICE_BY_ID[device].fem ? 'da' : 'do'} {DEVICE_BY_ID[device].short.toLowerCase()} · duplo clique reseta</span>
                <span className="hint-touch">Arraste para girar · pinça para aproximar · toque numa parte</span>
              </>}
        </p>
      )}
      {presenter && !part && (
        <p className="pointer-events-none fixed bottom-1 right-3 z-10 hidden text-xs text-white/60 md:block">→ próxima · ← anterior · 1–7 aparelho · E explode · X raio-X · T tour · R reseta</p>
      )}
    </>
  )
}

// na primeira vez (logo depois da carga) o título e o botão já estão no lugar, iguais aos da imagem de abertura;
// a entrada animada fica para quando a pessoa volta à abertura
let introSeen = false
function IntroUI() {
  const first = !introSeen
  useEffect(() => { introSeen = true }, [])
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between py-[9vh] text-center">
      <motion.div initial={first ? false : { opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6, duration: 0.9 }}>
        <h1 className="font-title text-[clamp(2.6rem,8vw,6rem)] font-bold leading-none tracking-tight text-white drop-shadow-[0_4px_30px_rgba(61,102,224,.7)]">Alarme <span className="text-accent">365</span></h1>
        <p className="mt-3 font-title text-[clamp(1rem,2.4vw,1.7rem)] text-white/85">{SLOGAN}</p>
      </motion.div>
      <motion.button initial={first ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.6, duration: 0.6 }}
        className="btn btn-primary pointer-events-auto !px-8 !py-3.5 text-[1.05em] shadow-xl shadow-yellow-500/20" onClick={() => { beep(); useShowroom.getState().setScene('showroom') }}>
        Conhecer os equipamentos
      </motion.button>
    </div>
  )
}

function OutroUI() {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between pb-[10vh] pt-[6vh] text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6, duration: 0.9 }} className="flex flex-col items-center">
        <OrsegupsLogo size={96} />
        <div className="mt-2 font-title text-3xl font-bold tracking-[0.2em] text-accent">ORSEGUPS</div>
        <p className="mt-3 font-title text-[clamp(1.1rem,2.6vw,1.9rem)] text-white">{SLOGAN}</p>
      </motion.div>
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6 }} className="btn glass pointer-events-auto" onClick={() => useShowroom.getState().setScene('intro')}>Recomeçar</motion.button>
    </div>
  )
}

function InActionUI() {
  const cur = useShowroom((s) => s.iaStep)
  const playing = useShowroom((s) => s.iaPlaying)
  const set = useShowroom((s) => s.set)
  const bar = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  // a barra de tempo é atualizada direto no DOM (o tempo corre em `ia.t`, fora do React)
  useEffect(() => {
    let raf = 0
    const tick = () => { if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, ia.t / IA_DURATION)})`; raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => { if (playing) setStarted(true) }, [playing])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-3">
      <div className="glass pointer-events-auto w-full max-w-3xl rounded-2xl p-3 md:p-4">
        <div className="mb-2 flex items-center gap-3">
          <button className="btn btn-primary !p-3" aria-label={playing ? 'Pausar' : 'Reproduzir'} onClick={() => { if (ia.t >= IA_DURATION) ia.t = 0; set({ iaPlaying: !playing }) }}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <p className="flex-1 text-[0.95em] text-white" aria-live="polite">
            {!started ? 'Dê Play para ver o alarme em ação. Clique num aparelho para abri-lo no showroom.' : <><b className="text-accent">{cur + 1}.</b> {IA_STEPS[cur].text}</>}
          </p>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10"><div ref={bar} className="absolute inset-0 origin-left rounded-full bg-accent" style={{ transform: 'scaleX(0)' }} /></div>
        <ol className="mt-2 grid grid-cols-5 gap-1">
          {IA_STEPS.map((s, i) => (
            <li key={s.label}>
              <button onClick={() => { ia.t = s.t + 0.01; set({ iaPlaying: true, iaStep: i }) }} aria-current={i === cur && started}
                className={`tap w-full rounded-lg px-1 py-1 text-xs leading-tight transition-colors duration-fast ease-out ${i === cur && started ? 'bg-brand-light text-white' : 'text-white/60 hover:bg-white/10'}`}>{i + 1}. {s.label}</button>
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
      {scene === 'inaction' && <InActionUI />}
    </>
  )
}
