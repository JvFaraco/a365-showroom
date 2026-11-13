import { AnimatePresence, motion } from 'framer-motion'
import { ACTIONS, TOUR_SECONDS } from '../data/actions'
import { DEVICE_BY_ID, getPart } from '../data/devices'
import { useShowroom } from '../store/showroomStore'
import { ActionPanel } from './ActionPanel'
import { beep } from './audio'
import { Chevron, Close, Play } from './icons'

// entra em 250 ms e sai mais rápido (180 ms), como manda a regra "saída ≈ 75% da entrada"
const EASE_OUT = [0.2, 0, 0, 1] as const
const EASE_IN = [0.4, 0, 1, 1] as const

/** Card de informação da parte selecionada. No desktop fica ao lado; no celular vira bottom sheet. */
export function PartCard() {
  const device = useShowroom((s) => s.device)
  const partId = useShowroom((s) => s.part)
  const action = useShowroom((s) => s.action)
  const tour = useShowroom((s) => s.tour)
  const show = useShowroom((s) => s.scene === 'showroom')
  const d = DEVICE_BY_ID[device]
  const part = show ? getPart(device, partId) : undefined
  const idx = part ? d.parts.indexOf(part) : -1
  const st = useShowroom.getState
  // no celular o card é uma folha de baixo: entra subindo; no desktop fica ao lado e entra pela lateral
  const sheet = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div className="pointer-events-none fixed inset-x-2 bottom-2 z-30 flex items-end md:inset-x-auto md:bottom-4 md:right-5 md:top-[8.8rem] md:items-center">
    <AnimatePresence mode="wait">
      {part && (
        <motion.aside
          key={`${device}:${part.id}`}
          id="part-card"
          role="dialog"
          aria-label={`${part.name}: informações`}
          initial={sheet ? { opacity: 0, y: 24 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0, y: 0, transition: { duration: 0.25, ease: EASE_OUT } }}
          exit={{ opacity: 0, ...(sheet ? { y: 16 } : { x: 16 }), transition: { duration: 0.18, ease: EASE_IN } }}
          className="part-card glass pointer-events-auto max-h-[50vh] w-full overflow-y-auto rounded-2xl p-4 md:max-h-full md:w-[360px]"
        >
          <div className="mb-1 flex items-start justify-between gap-3">
            <div>
              <div className="text-[0.8em] uppercase tracking-wider text-white/60">{idx + 1} de {d.parts.length}{part.internal ? ' · parte interna' : ''}</div>
              <h2 className="font-title text-[1.35em] font-semibold leading-tight text-white">{part.name}</h2>
            </div>
            <button className="btn !p-2" aria-label="Voltar à vista inteira" onClick={() => st().selectPart(null)}><Close size={16} /></button>
          </div>

          <p className="text-[0.95em] text-white/85"><span className="mr-1 font-semibold text-brand-glow">O que é:</span>{part.what}</p>

          {part.facts.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Detalhes">
              {part.facts.map((f) => (
                <li key={f} className="rounded-lg border border-brand-glow/40 bg-brand/40 px-2.5 py-1 text-[0.85em] font-medium text-white">{f}</li>
              ))}
            </ul>
          )}

          {part.tip && (
            <p className="mt-2.5 rounded-lg border-l-4 border-accent bg-accent/10 px-3 py-2 text-[0.85em] text-white/90">
              <span className="font-semibold text-accent">Dica: </span>{part.tip}
            </p>
          )}

          {action ? <ActionPanel /> : part.action && (
            // em tela estreita o nome da ação vai para a linha de baixo, em vez de quebrar no meio
            <button className="btn btn-primary mt-3 w-full max-sm:flex-col max-sm:gap-0 max-sm:rounded-2xl" onClick={() => { beep(); st().set({ tour: false }); st().startAction(part.action!) }}>
              <span className="inline-flex items-center gap-2"><Play size={14} /> Ver em ação</span>
              <span className="font-normal opacity-70"><span className="max-sm:hidden">· </span>{ACTIONS[part.action].label}</span>
            </button>
          )}

          {/* tour: barra fina mostrando quando vem a próxima parte */}
          {tour && !action && (
            <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div className="h-full w-full origin-left bg-accent" style={{ animation: `action-bar ${TOUR_SECONDS}s linear forwards` }} />
            </div>
          )}
          <div className={`flex items-center justify-between gap-2 border-t border-white/10 pt-3 ${tour && !action ? 'mt-0 border-transparent' : 'mt-3'}`}>
            <button className="btn" aria-label="Parte anterior" onClick={() => st().stepPart(-1)}><Chevron dir="left" size={16} /> anterior</button>
            {tour && <span className="text-xs text-accent">Tour ligado</span>}
            <button className="btn" aria-label="Próxima parte" onClick={() => st().stepPart(1)}>próxima <Chevron size={16} /></button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
    </div>
  )
}

/** SVG em tela cheia com a linha-guia; os pontos são atualizados por three/parts/PartCallout. */
export function CalloutLine() {
  return (
    <svg className="pointer-events-none fixed inset-0 z-20 h-full w-full" aria-hidden>
      <line id="callout-line" stroke="#5B8CFF" strokeWidth="1.5" strokeDasharray="5 4" style={{ opacity: 0, transition: 'opacity var(--duration-base) var(--ease-out)' }} />
      <circle id="callout-dot" r="5" fill="#F9E000" stroke="#05070f" strokeWidth="2" style={{ opacity: 0, transition: 'opacity var(--duration-base) var(--ease-out)' }} />
    </svg>
  )
}
