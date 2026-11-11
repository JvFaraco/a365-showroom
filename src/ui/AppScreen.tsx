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
      className={`relative rounded-xl transition-all duration-300 ${interactive ? 'cursor-pointer' : ''} ${className}`}
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

/** Tela inicial do aplicativo Alarme Orsegups, em React, renderizada dentro do celular 3D. */
export function AppScreen({ interactive }: { interactive: boolean }) {
  const arm = useShowroom((s) => s.armState)
  const photo = useShowroom((s) => s.appPhoto)
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
    <div className="relative flex h-[688px] w-[320px] select-none flex-col overflow-hidden rounded-[34px] bg-[#f3f5fa] font-body text-[#1b2233]" lang="pt-BR">
      {/* reflexo do vidro por cima da interface */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10" style={{ background: 'linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.16) 44%, rgba(255,255,255,0) 52%)' }} />
      {/* barra de status com o entalhe */}
      <div className="relative flex items-center justify-between px-7 pt-2.5 text-[11px] font-semibold"><span>17:50</span><span>5G ▮▮▮</span>
        <span className="absolute left-1/2 top-0 h-[22px] w-[132px] -translate-x-1/2 rounded-b-[14px] bg-black" />
      </div>

      {/* topo: ícone de perfil e, à direita, o sino e o botão SOS; a saudação vem embaixo */}
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-slate-400 text-slate-500"><User size={17} /></span>
        <div className="flex items-center gap-2 text-slate-600">
          <Bell size={19} />
          <Region id="sos" interactive={interactive} className="!rounded-full">
            <div className="rounded-full bg-[#e03131] px-4 py-1.5 font-title text-sm font-bold text-white shadow">SOS</div>
          </Region>
        </div>
      </div>
      <div className="px-4 pt-2 text-[21px] font-light text-slate-700">Olá!</div>

      <div className="flex flex-1 flex-col gap-2 px-3 pt-2">
        <Region id="alarme-geral" interactive={interactive}>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">Alarme geral</div>
            <div className="font-title text-[15px] font-semibold" style={{ color: arm === 'disarmed' ? '#2f6bff' : arm === 'armed' ? '#e03131' : '#e8890c' }}>{ARM.find((a) => a.id === arm)!.label}</div>
            <div className="text-[11px] text-slate-500">{ARM_TEXT[arm]}</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ARM.map(({ id, label, Icon }) => (
                <button key={id} aria-label={label} aria-pressed={arm === id} tabIndex={canArm ? 0 : -1}
                  onClick={(e) => { if (!canArm) return; e.stopPropagation(); beep('ui'); useShowroom.getState().setArm(id) }}
                  className={`grid h-10 place-items-center rounded-lg border-[1.5px] transition ${arm === id ? 'border-[#2f6bff] bg-[#eef3ff] text-[#2f6bff]' : 'border-slate-200 bg-white text-slate-400'} ${canArm ? 'hover:border-[#2f6bff]' : ''}`}>
                  <Icon size={20} />
                </button>
              ))}
            </div>
          </div>
        </Region>

        <Region id="ultimas-imagens" interactive={interactive}>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="mb-1.5 text-[11px] text-slate-500">Últimas imagens</div>
            <div className="relative h-[136px] overflow-hidden rounded-lg bg-slate-200">
              <img src={aiPhotoDataUrl(photo === 'done')} alt="Foto do fotossensor" className="h-full w-full object-cover" draggable={false} />
              {photo === 'loading' && (
                <div className="absolute inset-0 grid place-items-center bg-black/55 text-white">
                  <div className="flex flex-col items-center gap-2 text-[11px]">
                    <span className="h-7 w-7 rounded-full border-[3px] border-white/30 border-t-white" style={{ animation: 'spin 0.9s linear infinite' }} />
                    Solicitando imagem…
                  </div>
                </div>
              )}
              {photo === 'done' && <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Pessoa (100% de previsão)</div>}
            </div>
            <button tabIndex={action === 'solicitar-imagem' ? 0 : -1}
              onClick={(e) => { if (action !== 'solicitar-imagem' || photo === 'loading') return; e.stopPropagation(); beep('ui'); useShowroom.getState().set({ appPhoto: 'loading' }) }}
              className="mt-2 w-full rounded-lg bg-[#1E398D] py-2 text-[12px] font-semibold text-white">
              Solicitar imagem atualizada
            </button>
          </div>
        </Region>

        <Region id="ultimos-eventos" interactive={interactive}>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="mb-1 text-[11px] text-slate-500">Últimos eventos</div>
            {events.map(({ Icon, color, text }, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-[12px] last:border-0">
                <span style={{ color }}><Icon size={17} /></span>
                <span className="flex-1 font-medium">{text}</span>
              </div>
            ))}
          </div>
        </Region>
      </div>

      <Region id="menu" interactive={interactive} className="mx-2 mb-2">
        <div className="grid grid-cols-5 rounded-xl bg-white px-1 py-2 shadow-sm">
          {TABS.map(([label, Icon], i) => (
            <div key={label} className={`flex flex-col items-center gap-0.5 text-[8.5px] ${i === 0 ? 'font-semibold text-[#1E398D]' : 'text-slate-500'}`}>
              <Icon size={18} />{label}
            </div>
          ))}
        </div>
      </Region>
    </div>
  )
}
