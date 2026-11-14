import { useEffect, useRef, useState } from 'react'
import { ACTIONS } from '../data/actions'
import { LED_STATES } from '../data/ledStates'
import { holdRef, now, useShowroom, type ArmState } from '../store/showroomStore'
import { beep } from './audio'
import { HomePerson, LockClosed, LockOpen } from './icons'

function HoldButton({ okText, label }: { okText: string; label: string }) {
  const msg = useShowroom((s) => s.holdMsg)
  const set = useShowroom((s) => s.set)
  const C = 2 * Math.PI * 34
  const arc = useRef<SVGCircleElement>(null)
  const secs = useRef<HTMLSpanElement>(null)
  // o progresso corre fora do React: o anel é atualizado direto no DOM, por rAF
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (arc.current) arc.current.style.strokeDashoffset = String(C * (1 - holdRef.v))
      if (secs.current) secs.current.textContent = holdRef.v > 0 ? `${(holdRef.v * 5).toFixed(1)} s` : ''
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [C])
  return (
    <div className="flex items-center gap-4">
      <button
        aria-label={`${label}: segure por 5 segundos`}
        className="relative grid h-24 w-24 shrink-0 touch-none select-none place-items-center rounded-full bg-alert/90 font-title text-lg font-bold text-white shadow-lg shadow-red-900/50 active:scale-95"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); if (msg !== 'ok') set({ holding: true, holdMsg: '' }) }}
        onPointerUp={() => set({ holding: false })}
        onPointerCancel={() => set({ holding: false })}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && msg !== 'ok') set({ holding: true, holdMsg: '' }) }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') set({ holding: false }) }}
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80" aria-hidden>
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="5" />
          <circle ref={arc} cx="40" cy="40" r="34" fill="none" stroke={msg === 'ok' ? 'hsl(128 53% 50%)' : '#fff'} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} />
        </svg>
        {label}
      </button>
      <div className="text-sm" aria-live="polite">
        {msg === 'ok' ? (
          <>
            <div className="font-semibold text-ok">{okText}</div>
            <button className="btn mt-2 !py-1 text-xs" onClick={() => { holdRef.v = 0; set({ holdMsg: '' }) }}>Repetir</button>
          </>
        ) : msg === 'solte' ? (
          <div className="font-semibold text-accent">Mantenha pressionado por 5 segundos</div>
        ) : (
          <div className="text-white/80">Segure o botão por <b>5 segundos</b>. <span ref={secs} className="text-white/60" /></div>
        )}
      </div>
    </div>
  )
}

function LedPalette() {
  const led = useShowroom((s) => s.ledState)
  const setLed = useShowroom((s) => s.setLed)
  const timers = useRef<number[]>([])
  const [booting, setBooting] = useState(false)
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const boot = () => {
    timers.current.forEach(clearTimeout)
    setBooting(true); setLed('apagado')
    timers.current = [
      window.setTimeout(() => setLed('iniciando'), 500),
      window.setTimeout(() => setLed('sem-sinal'), 2700),
      window.setTimeout(() => { setLed('desarmado'); setBooting(false) }, 5400),
    ]
  }
  return (
    <div>
      <div className="grid max-h-[22vh] grid-cols-2 gap-1.5 overflow-y-auto pr-1 md:max-h-[34vh]">
        {LED_STATES.map((s) => (
          <button key={s.id} aria-pressed={led === s.id} onClick={() => { beep(); timers.current.forEach(clearTimeout); setBooting(false); setLed(s.id) }}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition ${led === s.id ? 'border-accent bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
            <span className="flex h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-white/30">
              {s.colors.map((c) => <span key={c} className="h-full flex-1" style={{ background: c }} />)}
            </span>
            <span><span className="block font-semibold leading-tight">{s.label}</span><span className="block leading-tight text-white/65">{s.meaning}</span></span>
          </button>
        ))}
      </div>
      <button className="btn btn-primary mt-2 w-full" onClick={boot} disabled={booting}>
        {booting ? 'Ligando: amarelo fixo → amarelo piscando → azul' : 'Ligar o módulo'}
      </button>
    </div>
  )
}

const ARM_BTN: { id: ArmState; label: string; Icon: typeof LockOpen }[] = [
  { id: 'disarmed', label: 'Desarmado', Icon: LockOpen }, { id: 'armed', label: 'Armado', Icon: LockClosed }, { id: 'partial', label: 'Armado parcial', Icon: HomePerson },
]
const LEVELS = ['Baixa', 'Média', 'Alta']

/** Controles da micro-animação ativa ("Ver em ação"). */
export function ActionPanel() {
  const action = useShowroom((s) => s.action)
  const sirenOn = useShowroom((s) => s.sirenOn)
  const sirenLevel = useShowroom((s) => s.sirenLevel)
  const shock = useShowroom((s) => s.shockLevel)
  const arm = useShowroom((s) => s.armState)
  const pending = useShowroom((s) => s.armPending)
  const photo = useShowroom((s) => s.appPhoto)
  const set = useShowroom((s) => s.set)
  if (!action) return null
  const a = ACTIONS[action.id]
  const knock = (strength: 1 | 2) => { beep('click'); set({ knock: { t0: now(), fired: strength + useShowroom.getState().shockLevel >= 4 } }) }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-title text-sm font-semibold text-accent">Em ação: {a.label}</span>
        <button className="btn !px-2.5 !py-1 text-xs" onClick={() => useShowroom.getState().stopAction()}>Fechar</button>
      </div>
      {action.id === 'led' && <LedPalette />}
      {action.id === 'sos190' && <HoldButton label="190" okText="Acionamento 190 enviado" />}
      {action.id === 'panico' && <HoldButton label="✱" okText="Pânico acionado" />}
      {action.id === 'som' && (
        <div className="space-y-2">
          <div className="flex gap-2" role="group" aria-label="Volume da sirene">
            {[1, 2, 3].map((n) => (
              <button key={n} aria-pressed={sirenLevel === n} className={`btn flex-1 ${sirenLevel === n ? 'btn-on' : ''}`} onClick={() => { beep(); set({ sirenLevel: n as 1 | 2 | 3 }) }}>Nível {n}</button>
            ))}
          </div>
          <button className="btn w-full" onClick={() => set({ sirenOn: !sirenOn })}>{sirenOn ? 'Silenciar' : 'Tocar de novo'}</button>
          <p className="text-xs text-white/60">Volume programável em 3 níveis, até 110 dB. O som do demo fica mudo até você ligar o áudio.</p>
        </div>
      )}
      {action.id === 'choque' && (
        <div className="space-y-2">
          <label className="block text-xs text-white/70">Sensibilidade: <b className="text-white">{LEVELS[shock - 1]}</b>
            <input type="range" min={1} max={3} step={1} value={shock} aria-label="Sensibilidade do sensor de choque"
              onChange={(e) => set({ shockLevel: Number(e.target.value) as 1 | 2 | 3 })} className="mt-1 w-full accent-[#F9E000]" />
          </label>
          <div className="flex gap-2">
            <button className="btn flex-1" onClick={() => knock(1)}>Batida leve</button>
            <button className="btn flex-1" onClick={() => knock(2)}>Batida forte</button>
          </div>
        </div>
      )}
      {action.id === 'alarme-geral' && (
        <div>
          <p className="mb-2 text-xs text-white/70">Toque num dos 3 ícones na tela do celular (ou aqui). O comando leva alguns segundos até o módulo confirmar; aí o LED muda.</p>
          <div className="flex gap-2">
            {ARM_BTN.map(({ id, label, Icon }) => (
              <button key={id} aria-label={label} aria-pressed={arm === id} className={`btn flex-1 ${arm === id ? 'btn-on' : ''} ${pending === id ? 'animate-pulse motion-reduce:animate-none' : ''}`} disabled={!!pending} onClick={() => { beep(); useShowroom.getState().requestArm(id) }}><Icon size={18} /></button>
            ))}
          </div>
        </div>
      )}
      {action.id === 'solicitar-imagem' && (
        <div>
          <p className="mb-2 text-xs text-white/70">Toque em "Solicitar imagem atualizada" na tela do celular (ou aqui). No demo leva ~4 s.</p>
          <button className="btn btn-primary w-full" disabled={photo === 'loading'} onClick={() => set({ appPhoto: 'loading' })}>
            {photo === 'loading' ? 'Solicitando…' : photo === 'done' ? 'Solicitar de novo' : 'Solicitar imagem atualizada'}
          </button>
        </div>
      )}
      {a.undo && (
        <button className="btn btn-primary w-full" disabled={!!action.undoAt} onClick={() => { beep('click'); useShowroom.getState().undoAction() }}>
          {action.undoAt ? `${a.undo}…` : a.undo}
        </button>
      )}
      {a.duration && !a.undo && (
        <div className="h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div key={action.t0} className="h-full w-full origin-left bg-accent" style={{ animation: `action-bar ${a.duration}s linear forwards` }} />
        </div>
      )}
    </div>
  )
}
