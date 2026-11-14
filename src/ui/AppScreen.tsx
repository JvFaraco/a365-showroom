import { useEffect, useRef, type ReactNode } from 'react'
import { getPart } from '../data/devices'
import { useShowroom, type ArmState } from '../store/showroomStore'
import { aiPhotoDataUrl } from '../three/common/textures'
import { Bell, Clock, Contacts, Devices, Grid, Home, HomePerson, LockClosed, LockOpen, Shield, Speaker, User } from './icons'
import { beep } from './audio'

const ARM: { id: ArmState; label: string; Icon: typeof LockOpen }[] = [
  { id: 'disarmed', label: 'Desarmado', Icon: LockOpen },
  { id: 'armed', label: 'Armado', Icon: LockClosed },
  { id: 'partial', label: 'Armado parcial', Icon: HomePerson },
]
const ARM_TEXT: Record<ArmState, string> = { disarmed: 'Todos os sensores estão desarmados.', armed: 'Todos os sensores estão ativos.', partial: 'Só o perímetro está ativo.' }
const TABS = [['Início', Home], ['Comandos', Grid], ['Equipamentos', Devices], ['Contatos', Contacts], ['Eventos', Clock]] as const

const LABEL = 'px-1 pb-1 text-[11px] text-slate-500'
const CARD = 'rounded-xl bg-[#f1f3f6] p-3'

/** Barra de status do celular: hora, sinal, 5G e bateria, com o entalhe no meio. Herda a cor do texto da tela. */
function StatusBar() {
  return (
    <div className="relative flex items-center justify-between px-7 pt-2.5 text-[11px] font-semibold">
      <span>17:50</span>
      <span className="flex items-center gap-1">
        <svg width="15" height="10" viewBox="0 0 15 10" aria-hidden fill="currentColor"><rect x="0" y="7" width="2.6" height="3" rx=".6" /><rect x="4" y="5" width="2.6" height="5" rx=".6" /><rect x="8" y="2.6" width="2.6" height="7.4" rx=".6" /><rect x="12" y="0" width="2.6" height="10" rx=".6" opacity=".35" /></svg>
        <span>5G</span>
        <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden><rect x=".5" y=".5" width="18" height="9" rx="2.6" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="11" height="6" rx="1.4" fill="currentColor" /><rect x="19.6" y="3.2" width="1.6" height="3.6" rx=".8" fill="currentColor" opacity=".45" /></svg>
      </span>
      <span className="absolute left-1/2 top-0 h-[22px] w-[132px] -translate-x-1/2 rounded-b-[14px] bg-black" />
    </div>
  )
}

/** Região clicável da tela = uma "parte" do aparelho Aplicativo. */
function Region({ id, interactive, children, className = '' }: { id: string; interactive: boolean; children: ReactNode; className?: string }) {
  const sel = useShowroom((s) => (interactive ? s.part : null))
  const hov = useShowroom((s) => (interactive ? s.hovered === id : false))
  const down = useRef<[number, number] | null>(null)
  const name = getPart('app', id)?.name
  return (
    <div
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? name : undefined}
      className={`relative rounded-xl transition-[opacity,outline-color,box-shadow] duration-base ease-out ${interactive ? 'cursor-pointer' : ''} ${className}`}
      style={{ opacity: sel && sel !== id ? 0.22 : 1, outline: hov || sel === id ? '2.5px solid #5B8CFF' : '2.5px solid transparent', outlineOffset: 2, boxShadow: hov ? '0 0 18px #5B8CFF99' : 'none' }}
      onPointerEnter={() => interactive && useShowroom.getState().setHovered(id)}
      onPointerLeave={() => { const s = useShowroom.getState(); if (interactive && s.hovered === id) s.setHovered(null) }}
      onPointerDown={(e) => { down.current = [e.clientX, e.clientY] }}
      onClick={(e) => {
        if (!interactive) return
        const d = down.current
        if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 6) return // foi arrasto (girar), não clique
        const s = useShowroom.getState()
        if (s.part !== id) { e.stopPropagation(); s.selectPart(id) }
      }}
    >
      {children}
    </div>
  )
}

const PENDING_TEXT: Record<ArmState, string> = { armed: 'Armando…', disarmed: 'Desarmando…', partial: 'Armando parcial…' }

/** Tela inicial do aplicativo Alarme Orsegups, em React, renderizada dentro do celular 3D. */
export function AppScreen({ interactive }: { interactive: boolean }) {
  const armState = useShowroom((s) => s.armState)
  const pending = useShowroom((s) => (s.scene === 'inaction' ? null : s.armPending))
  const photo = useShowroom((s) => s.appPhoto)
  // na cena "Em ação" o celular acompanha o disparo: alarme armado, o aviso do disparo e, por fim, a tela "Imagem"
  const iaStep = useShowroom((s) => (s.scene === 'inaction' ? s.iaStep : -1))
  const arm: ArmState = iaStep >= 0 ? 'armed' : armState
  const action = useShowroom((s) => (interactive ? s.action?.id : undefined))
  const canArm = action === 'alarme-geral'

  // "Solicitar imagem atualizada": loader de ~4 s no demo
  useEffect(() => {
    if (photo !== 'loading') return
    const t = setTimeout(() => useShowroom.getState().set({ appPhoto: 'done' }), 4000)
    return () => clearTimeout(t)
  }, [photo])

  const events = [
    arm === 'disarmed'
      ? { Icon: LockOpen, color: '#2f6bff', text: 'Desarme' }
      : { Icon: LockClosed, color: '#e03131', text: arm === 'armed' ? 'Arme' : 'Arme parcial' },
    { Icon: Speaker, color: '#e03131', text: 'Disparo' },
    { Icon: Shield, color: '#e8890c', text: 'Alerta' },
  ]

  return (
    <div className="relative flex h-[688px] w-[320px] select-none flex-col overflow-hidden rounded-[34px] bg-white font-body text-[#1b2233]" lang="pt-BR">
      {/* reflexo do vidro por cima da interface */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10" style={{ background: 'linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.16) 44%, rgba(255,255,255,0) 52%)' }} />
      {/* aviso do disparo, como a notificação do app: aparece quando a sirene toca */}
      {iaStep === 3 && (
        <div className="absolute inset-x-2 top-8 z-[6] flex items-center gap-2 rounded-2xl bg-[#e03131] px-3 py-2 text-white shadow-lg">
          <Bell size={18} />
          <div className="leading-tight"><div className="text-[12px] font-bold">Disparo</div><div className="text-[10.5px] opacity-90">Movimento detectado · Sala de estar</div></div>
        </div>
      )}
      {/* tela "Imagem" (escura), como no app: a foto do fotossensor com a pessoa marcada */}
      {iaStep >= 4 && (
        <div className="absolute inset-0 z-[5] flex flex-col bg-[#0b0c10] text-white">
          <StatusBar />
          <div className="flex items-center gap-4 px-5 pt-5 text-[15px]"><span className="text-xl leading-none">‹</span><span className="flex-1">Imagem</span><span>⋮</span></div>
          <img src={aiPhotoDataUrl(true)} alt="Foto do fotossensor com a pessoa marcada" width={480} height={360} className="mt-10 h-[240px] w-full object-cover" draggable={false} />
          <div className="mx-auto mt-6 h-[3px] w-9 rounded bg-white/50" />
          <div className="mt-4 text-center text-[11px] leading-5 text-white/85">Hoje, agora<br />Detector de presença · 1 detecção<br /><span className="text-white/55">Sala de estar</span></div>
          <div className="mt-8 flex items-center justify-between px-6 text-white/70">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">‹</span>
            <span className="text-[11px] text-white/90">Pessoa (100% de previsão)</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">›</span>
          </div>
          <div className="mt-3 flex justify-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-white" /><i className="h-1.5 w-1.5 rounded-full bg-white/30" /><i className="h-1.5 w-1.5 rounded-full bg-white/30" /></div>
          <div className="mx-auto mb-2 mt-auto h-1 w-28 rounded bg-white/70" />
        </div>
      )}
      {/* barra de status com o entalhe */}
      <StatusBar />

      {/* topo: ícone de perfil e, à direita, o sino (com o ponto de aviso) e o botão SOS; a saudação vem embaixo */}
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-500"><User size={17} /></span>
        <div className="flex items-center gap-2.5 text-slate-600">
          <span className="relative"><Bell size={20} /><i className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#e03131] ring-2 ring-white" /></span>
          <Region id="sos" interactive={interactive} className="!rounded-full">
            <div className="rounded-full bg-[#e03131] px-4 py-1.5 font-title text-sm font-bold text-white shadow">SOS</div>
          </Region>
        </div>
      </div>
      <div className="px-4 pt-2 text-[21px] font-light text-slate-600">Olá!</div>

      {/* como no app: fundo branco, o nome de cada seção por fora e os cartões em cinza bem claro */}
      <div className="flex flex-1 flex-col gap-1.5 px-3 pt-1.5">
        <Region id="alarme-geral" interactive={interactive}>
          <div className={LABEL}>Alarme geral</div>
          <div className={CARD}>
            {pending ? (
              <>
                <div className="flex items-center gap-1.5 font-title text-[15px] font-semibold text-slate-600">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-[#2f6bff] motion-reduce:animate-none" />
                  {PENDING_TEXT[pending]}
                </div>
                <div className="text-[11px] text-slate-500">Enviando o comando ao módulo…</div>
              </>
            ) : (
              <>
                <div className="font-title text-[15px] font-semibold" style={{ color: arm === 'disarmed' ? '#2f6bff' : arm === 'armed' ? '#e03131' : '#e8890c' }}>{ARM.find((a) => a.id === arm)!.label}</div>
                <div className="text-[11px] text-slate-500">{ARM_TEXT[arm]}</div>
              </>
            )}
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[#e4e7ec] p-1">
              {ARM.map(({ id, label, Icon }) => (
                <button key={id} aria-label={label} aria-pressed={arm === id} tabIndex={canArm ? 0 : -1}
                  onClick={(e) => { if (!canArm) return; e.stopPropagation(); beep('ui'); useShowroom.getState().requestArm(id) }}
                  className={`grid h-10 place-items-center rounded-lg border-[1.5px] transition-colors duration-fast ease-out ${arm === id ? 'border-[#2f6bff] bg-white text-[#2f6bff]' : pending === id ? 'animate-pulse border-[#2f6bff]/50 bg-white/70 text-[#2f6bff] motion-reduce:animate-none' : 'border-transparent text-slate-500'} ${canArm ? 'hover:border-[#2f6bff]' : ''}`}>
                  <Icon size={20} />
                </button>
              ))}
            </div>
          </div>
        </Region>

        <Region id="ultimas-imagens" interactive={interactive}>
          <div className={LABEL}>Últimas imagens</div>
          <div className={`${CARD} !p-1.5`}>
            <div className="relative h-[142px] overflow-hidden rounded-lg bg-slate-200">
              <img src={aiPhotoDataUrl(photo === 'done')} alt="Foto do fotossensor" width={480} height={360} className="h-full w-full object-cover" draggable={false} />
              {/* etiqueta da foto, no canto: de qual aparelho e de onde */}
              <div className="absolute left-1.5 top-1.5 rounded-md bg-white/85 px-1.5 py-0.5 leading-tight shadow-sm">
                <div className="text-[10px] font-semibold text-slate-700">Fotossensor</div>
                <div className="text-[8.5px] text-slate-500">Sala de estar</div>
              </div>
              {photo === 'loading' && (
                <div className="absolute inset-0 grid place-items-center bg-black/55 text-white">
                  <div className="flex flex-col items-center gap-2 text-[11px]">
                    <span className="h-7 w-7 rounded-full border-[3px] border-white/30 border-t-white" style={{ animation: 'spin 0.9s linear infinite' }} />
                    Solicitando imagem…
                  </div>
                </div>
              )}
              {photo === 'done' && <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Pessoa (100% de previsão)</div>}
              <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => <i key={i} className={`h-1 w-1 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/50'}`} />)}
              </div>
            </div>
            <button tabIndex={action === 'solicitar-imagem' ? 0 : -1}
              onClick={(e) => { if (action !== 'solicitar-imagem' || photo === 'loading') return; e.stopPropagation(); beep('ui'); useShowroom.getState().set({ appPhoto: 'loading' }) }}
              className="mt-1.5 w-full rounded-lg bg-[#1E398D] py-2 text-[12px] font-semibold text-white">
              Solicitar imagem atualizada
            </button>
          </div>
        </Region>

        <Region id="ultimos-eventos" interactive={interactive}>
          <div className={LABEL}>Últimos eventos</div>
          <div className={`${CARD} !py-2`}>
            <div className="text-[11px] font-semibold text-slate-600">Hoje</div>
            {events.map(({ Icon, color, text }, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-slate-200 py-1 text-[12px] last:border-0">
                <span style={{ color }}><Icon size={16} /></span>
                <span className="flex-1 font-medium">{text}</span>
              </div>
            ))}
          </div>
        </Region>
      </div>

      {/* menu inferior: barra branca de ponta a ponta, com a aba atual em azul */}
      <Region id="menu" interactive={interactive} className="mt-1.5">
        <div className="grid grid-cols-5 border-t border-slate-200 bg-white px-1 pb-3 pt-1.5">
          {TABS.map(([label, Icon], i) => (
            <div key={label} className={`flex flex-col items-center gap-0.5 text-[8.5px] ${i === 0 ? 'font-semibold text-[#1E398D]' : 'text-slate-500'}`}>
              <Icon size={19} />{label}
            </div>
          ))}
        </div>
      </Region>
    </div>
  )
}

/**
 * Aviso de sabotagem do fotossensor (ação "Mexer no sensor"): a tela inicial do app em tamanho menor, com a
 * notificação vermelha no alto (como a do disparo na cena "Em ação") e o evento de sabotagem entrando em "Últimos eventos".
 * Desenhada em 320 px, como a tela do celular 3D, e reduzida pelo `scale`.
 */
export function SabotageScreen({ scale = 0.6 }: { scale?: number }) {
  return (
    <div style={{ width: 320 * scale, height: 300 * scale }} lang="pt-BR">
      <div className="relative flex h-[300px] w-[320px] origin-top-left select-none flex-col overflow-hidden bg-white font-body text-[#1b2233]" style={{ transform: `scale(${scale})` }}>
        <StatusBar />
        {/* notificação do app: chega e sobe; o evento fica na lista */}
        <div className="absolute inset-x-2 top-8 z-10 flex items-center gap-2 rounded-2xl bg-[#e03131] px-3 py-2 text-white shadow-lg"
          style={{ animation: 'notif-out 0.7s 1.6s ease-in both' }}>
          <Bell size={18} />
          <div className="leading-tight"><div className="text-[12px] font-bold">Sabotagem</div><div className="text-[10.5px] opacity-90">Fotossensor · Sala de estar</div></div>
        </div>
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-500"><User size={17} /></span>
          <div className="flex items-center gap-2.5 text-slate-600">
            <span className="relative"><Bell size={20} /><i className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#e03131] ring-2 ring-white" /></span>
            <div className="rounded-full bg-[#e03131] px-4 py-1.5 font-title text-sm font-bold text-white shadow">SOS</div>
          </div>
        </div>
        <div className="px-4 pt-2 text-[21px] font-light text-slate-600">Olá!</div>
        <div className="flex flex-1 flex-col gap-1.5 px-3 pt-3">
          <div className={LABEL}>Últimos eventos</div>
          <div className={`${CARD} !py-2`}>
            <div className="text-[11px] font-semibold text-slate-600">Hoje</div>
            {/* só o evento de sabotagem, entrando na lista */}
            <div className="-mx-1.5 mt-0.5 flex items-center gap-2 rounded-lg bg-[#e03131]/10 px-1.5 py-1.5 text-[12px]"
              style={{ animation: 'screen-in 0.5s 2.0s cubic-bezier(.16,.84,.3,1) both' }}>
              <span className="text-[#e03131]"><Shield size={16} /></span>
              <span className="flex-1 leading-tight"><span className="block font-semibold text-[#e03131]">Sabotagem</span><span className="text-[10.5px] text-slate-500">Fotossensor · Sala de estar</span></span>
              <span className="text-[10.5px] text-slate-500">agora</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-5 border-t border-slate-200 bg-white px-1 pb-3 pt-1.5">
          {TABS.map(([label, Icon], i) => (
            <div key={label} className={`flex flex-col items-center gap-0.5 text-[8.5px] ${i === 0 ? 'font-semibold text-[#1E398D]' : 'text-slate-500'}`}>
              <Icon size={19} />{label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
