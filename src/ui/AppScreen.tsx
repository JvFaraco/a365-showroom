import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getPart } from '../data/devices'
import { useShowroom, type ArmState } from '../store/showroomStore'
import { aiPhotoDataUrl } from '../three/common/textures'
import { PH } from '../data/inAction'
import { AlertCircle, Bell, Chevron, CircleX, Contacts, Home, HomePerson, LockClosed, LockOpen, Nodes, OrsegupsLogo, Shield, Speaker, User } from './icons'
import { beep } from './audio'

const ARM: { id: ArmState; label: string; Icon: typeof LockOpen }[] = [
  { id: 'disarmed', label: 'Desarmado', Icon: LockOpen },
  { id: 'armed', label: 'Armado', Icon: LockClosed },
  { id: 'partial', label: 'Armado parcial', Icon: HomePerson },
]
const ARM_TEXT: Record<ArmState, string> = { disarmed: 'Todos os sensores estão desarmados.', armed: 'Todos os sensores estão ativos.', partial: 'Só o perímetro está ativo.' }
// abas como no app de hoje (a arte antiga dizia Alarmes/Eventos)
const TABS = [['Início', Home], ['Comandos', LockClosed], ['Equipamentos', Nodes], ['Contatos', Contacts], ['Histórico', AlertCircle]] as const

// como no app: tema escuro, nome de cada seção por fora e cartões cinza-escuros; amarelo da marca na aba atual e nos
// botões de ação, azul no estado do alarme
const BG = 'bg-[#151618]'
const LABEL = 'px-1 pb-1 text-[11px] text-white/75'
const CARD = 'rounded-xl bg-[#26272b] p-3'
const ARM_BLUE = '#4d8dff'
type Ev = { Icon: typeof LockOpen; color: string; text: string; who: string; when: string }

/** Topo do app: perfil à esquerda, logo Orsegups no meio e o sino (com o ponto de aviso) à direita; o sino abre as notificações. */
function AppTop({ onBell }: { onBell?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3">
      <span className="grid h-8 w-8 place-items-center rounded-full border border-white/40 text-[12px] text-white/80"><User size={15} /></span>
      <OrsegupsLogo size={26} />
      <button aria-label="Notificações" tabIndex={onBell ? 0 : -1} className={`relative text-white/85 ${onBell ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={(e) => { if (!onBell) return; e.stopPropagation(); beep('ui'); onBell() }}>
        <Bell size={20} /><i className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#e03131]" />
      </button>
    </div>
  )
}

/**
 * Tela "Histórico de imagens" (tocar num fotossensor em Equipamentos): a zona, o botão de pedir uma imagem atualizada e as
 * fotos em grade, com a data embaixo. A imagem pedida entra no primeiro lugar: primeiro carregando, depois a foto.
 */
function ImageHistory({ photo, onBack }: { photo: 'idle' | 'loading' | 'done'; onBack: () => void }) {
  const old = ['hoje às 07:31', 'ontem às 20:26', 'ontem às 07:31', '12 nov às 15:14', '11 nov às 9:58', '11 nov às 15:17']
  const tiles = photo === 'idle' ? old : ['', ...old.slice(0, 5)]
  return (
    <div className={`absolute inset-0 z-[7] flex flex-col ${BG} text-white`}>
      <StatusBar />
      <div className="relative flex items-center justify-center px-4 pb-1 pt-4 text-[15px]">
        <button aria-label="Voltar" className="absolute left-4 cursor-pointer text-white/85" onClick={(e) => { e.stopPropagation(); beep('ui'); onBack() }}><Chevron dir="left" size={20} /></button>
        Histórico de imagens
      </div>
      <div className="text-center leading-tight"><div className="text-[12.5px] text-white/90">Sala de estar</div><div className="text-[9.5px] text-white/50">Partição 1</div></div>
      <button disabled={photo === 'loading'}
        onClick={(e) => { e.stopPropagation(); if (photo === 'loading') return; beep('ui'); useShowroom.getState().set({ appPhoto: 'loading' }) }}
        className="mx-5 mt-2.5 rounded-xl bg-[#F9E000] py-2 text-[12px] font-medium text-[#151618] disabled:opacity-70">
        {photo === 'loading' ? 'Solicitando…' : 'Solicitar imagem atualizada'}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2 px-2">
        {tiles.map((when, i) => (
          <div key={i} className="overflow-hidden rounded-xl bg-[#26272b]">
            <div className="relative h-[88px]">
              {when === '' && photo === 'loading' ? (
                <div className="grid h-full place-items-center bg-black/40">
                  <span className="h-6 w-6 rounded-full border-[3px] border-white/30 border-t-white" style={{ animation: 'spin 0.9s linear infinite' }} />
                </div>
              ) : (
                <img src={aiPhotoDataUrl(when === '')} alt="" width={240} height={180} className="h-full w-full object-cover" draggable={false} />
              )}
            </div>
            <div className="py-1 text-center text-[9.5px] text-white/75">{when === '' ? (photo === 'loading' ? 'solicitando…' : 'agora') : when}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Tela "Notificações" (o sino do topo), como no app: ponto de não lida, foto ou ícone, o patrimônio, o aviso, quem e quando. */
function Notifications({ onBack }: { onBack: () => void }) {
  const items: { thumb?: boolean; Icon?: typeof LockOpen; title: string; who: string; when: string }[] = [
    { thumb: true, title: 'Imagem do disparo', who: 'Sala de estar', when: 'hoje - 07:31' },
    { Icon: LockOpen, title: 'Desarme pelo aplicativo', who: 'por Você', when: 'hoje - 07:50' },
    { Icon: LockClosed, title: 'Arme (Ficar) pelo aplicativo', who: 'por Você', when: 'ontem - 23:56' },
    { Icon: Speaker, title: 'Disparo do sensor', who: 'Porta de entrada', when: 'ontem - 07:30' },
    { Icon: CircleX, title: 'Restauro de energia', who: '-', when: 'ontem - 11:44' },
  ]
  return (
    <div className={`absolute inset-0 z-[7] flex flex-col ${BG} text-white`}>
      <StatusBar />
      <div className="relative flex items-center justify-center px-4 pb-2 pt-4 text-[15px]">
        <button aria-label="Voltar" className="absolute left-4 cursor-pointer text-white/85" onClick={(e) => { e.stopPropagation(); beep('ui'); onBack() }}><Chevron dir="left" size={20} /></button>
        Notificações
      </div>
      <div className={`${CARD} mx-3 !p-0`}>
        {items.map(({ thumb, Icon, title, who, when }) => (
          <div key={title} className="relative flex gap-3 border-b border-white/10 px-3 py-2.5 last:border-0">
            <i className="absolute left-2 top-2 z-[1] h-2 w-2 rounded-full bg-[#e03131]" />
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg text-white/70">
              {thumb ? <img src={aiPhotoDataUrl(true)} alt="" width={80} height={60} className="h-full w-full object-cover" draggable={false} /> : Icon && <Icon size={20} />}
            </span>
            <span className="flex-1 leading-tight">
              <span className="block text-[9.5px] text-white/50">Minha casa</span>
              <span className="block text-[12px] text-white/90">{title}</span>
              <span className="block text-[10px] text-white/65">{who}</span>
              <span className="mt-0.5 block text-[9.5px] text-white/50">{when}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Menu de baixo, de ponta a ponta: a aba atual em amarelo. */
function AppNav({ active = 0 }: { active?: number }) {
  return (
    <div className={`grid grid-cols-5 border-t border-white/10 ${BG} px-1 pb-3 pt-1.5`}>
      {TABS.map(([label, Icon], i) => (
        <div key={label} className={`flex flex-col items-center gap-0.5 text-[8.5px] ${i === active ? 'text-[#F9E000]' : 'text-white/70'}`}>
          <Icon size={19} />{label}
        </div>
      ))}
    </div>
  )
}

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
  // na cena "Em ação" o celular acompanha o disparo, nos marcos da cena: desarmado, armado pelo controle, o aviso
  // "Disparo do sensor" (logo que a porta abre) e, por fim, a tela "Imagem" com a foto do disparo
  const iaPhase = useShowroom((s) => (s.scene === 'inaction' ? s.iaPhase : -1))
  const inAction = iaPhase >= 0
  const arm: ArmState = inAction ? (iaPhase >= PH.armed ? 'armed' : 'disarmed') : armState
  const action = useShowroom((s) => (interactive ? s.action?.id : undefined))
  const canArm = action === 'alarme-geral'
  const [notif, setNotif] = useState(false)

  // "Solicitar imagem atualizada": loader de ~4 s no demo
  useEffect(() => {
    if (photo !== 'loading') return
    const t = setTimeout(() => useShowroom.getState().set({ appPhoto: 'done' }), 4000)
    return () => clearTimeout(t)
  }, [photo])

  // eventos com os nomes e ícones do Histórico do app: nome do evento, quem fez (pessoa ou aparelho) e a hora.
  // Sem nome de pessoa: quem usou o app aparece como "Você"
  const armEv: Ev = arm === 'disarmed'
    ? { Icon: LockOpen, color: ARM_BLUE, text: 'Desarme', who: 'Você', when: 'hoje às 07:50' }
    : { Icon: LockClosed, color: '#ff5a5a', text: arm === 'armed' ? 'Arme' : 'Arme Parcial', who: 'Você', when: 'hoje às 07:50' }
  const events: Ev[] = iaPhase >= PH.armed
    ? [ // na cena "Em ação", a sequência de um disparo: o arme pelo controle, o disparo pelo magnético e a imagem
        ...(iaPhase >= PH.image ? [{ Icon: Shield, color: 'rgba(255,255,255,.7)', text: 'Imagem', who: 'Sala de estar', when: 'agora' }] : []),
        ...(iaPhase >= PH.alarm ? [{ Icon: Speaker, color: '#ff5a5a', text: 'Disparo', who: 'Porta de entrada', when: 'agora' }] : []),
        { Icon: LockClosed, color: '#ff5a5a', text: 'Arme', who: 'Controle remoto', when: 'agora' },
        { Icon: LockOpen, color: ARM_BLUE, text: 'Desarme', who: 'Você', when: 'hoje às 07:50' },
      ].slice(0, 3)
    : [
        armEv,
        { Icon: Shield, color: 'rgba(255,255,255,.7)', text: 'Imagem', who: 'Você', when: 'ontem às 20:28' },
        { Icon: Speaker, color: '#ff5a5a', text: 'Disparo', who: 'Porta de entrada', when: 'ontem às 07:30' },
      ]

  return (
    <div className={`relative flex h-[688px] w-[320px] select-none flex-col overflow-hidden rounded-[34px] ${BG} font-body text-white`} lang="pt-BR">
      {/* reflexo do vidro por cima da interface */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10" style={{ background: 'linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.07) 44%, rgba(255,255,255,0) 52%)' }} />
      {/* aviso do disparo, como a notificação do app: aparece quando a sirene toca */}
      {iaPhase >= PH.alarm && iaPhase < PH.image && (
        <div className="absolute inset-x-2 top-8 z-[6] flex items-center gap-2 rounded-2xl bg-[#e03131] px-3 py-2 text-white shadow-lg">
          <Bell size={18} />
          <div className="leading-tight"><div className="text-[12px] font-bold">Disparo do sensor</div><div className="text-[10.5px] opacity-90">Porta de entrada</div></div>
        </div>
      )}
      {/* tela "Imagem" (escura), como no app: a foto do fotossensor com a pessoa marcada */}
      {iaPhase >= PH.image && (
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
      {notif && <Notifications onBack={() => setNotif(false)} />}
      {action === 'solicitar-imagem' && <ImageHistory photo={photo} onBack={() => useShowroom.getState().stopAction()} />}
      <AppTop onBell={interactive ? () => setNotif(true) : undefined} />

      {/* saudação e, à direita, o botão SOS (só o contorno, como no app) */}
      <div className="flex items-center justify-between px-4 pt-2">
        <div className="text-[20px] font-light text-white/90">Olá!</div>
        <Region id="sos" interactive={interactive} className="!rounded-xl">
          <div className="rounded-xl bg-white/10 px-3 py-2 text-[14px] text-white/90">SOS</div>
        </Region>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 px-3 pt-1.5">

        <Region id="alarme-geral" interactive={interactive}>
          <div className={LABEL}>Alarme geral</div>
          <div className={CARD}>
            {pending ? (
              <>
                <div className="flex items-center gap-1.5 text-[14px] text-white/80">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 motion-reduce:animate-none" style={{ borderTopColor: ARM_BLUE }} />
                  {PENDING_TEXT[pending]}
                </div>
                <div className="text-[10.5px] text-white/55">Enviando o comando ao módulo…</div>
              </>
            ) : (
              <>
                <div className="text-[14px]" style={{ color: arm === 'disarmed' ? ARM_BLUE : arm === 'armed' ? '#ff5a5a' : '#ffa53a' }}>{ARM.find((a) => a.id === arm)!.label}</div>
                <div className="text-[10.5px] text-white/55">{ARM_TEXT[arm]}</div>
              </>
            )}
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[#323337] p-1">
              {ARM.map(({ id, label, Icon }) => (
                <button key={id} aria-label={label} aria-pressed={arm === id} tabIndex={canArm ? 0 : -1}
                  onClick={(e) => { if (!canArm) return; e.stopPropagation(); beep('ui'); useShowroom.getState().requestArm(id) }}
                  className={`grid h-9 place-items-center rounded-lg border-[1.5px] transition-colors duration-fast ease-out ${arm === id ? 'border-[#4d8dff] bg-[#1d2a44] text-[#4d8dff]' : pending === id ? 'animate-pulse border-[#4d8dff]/50 text-[#4d8dff] motion-reduce:animate-none' : 'border-transparent text-white/60'} ${canArm ? 'hover:border-[#4d8dff]' : ''}`}>
                  <Icon size={19} />
                </button>
              ))}
            </div>
          </div>
        </Region>

        <Region id="ultimas-imagens" interactive={interactive}>
          <div className={LABEL}>Últimas imagens</div>
          <div className="relative h-[150px] overflow-hidden rounded-xl bg-[#26272b]">
            {/* na cena "Em ação", antes do disparo a última imagem é a sala vazia (de manhã); depois chega a do disparo */}
            <img src={inAction ? (iaPhase >= PH.image ? aiPhotoDataUrl(true) : aiPhotoDataUrl(false, true)) : aiPhotoDataUrl(photo === 'done')} alt="Foto do fotossensor" width={480} height={360} className="h-full w-full object-cover" draggable={false} />
            {/* etiqueta da foto, no canto, escura como no app: de qual aparelho e quando */}
            <div className="absolute left-1.5 top-1.5 rounded-md bg-[#1d1e21]/90 px-1.5 py-0.5 leading-tight">
              <div className="text-[10px] text-white">Sala de estar</div>
              <div className="text-[8px] text-white/60">{photo === 'done' || iaPhase >= PH.image ? 'agora' : 'hoje às 07:31'}</div>
            </div>
            {photo === 'loading' && (
              <div className="absolute inset-0 grid place-items-center bg-black/60 text-white">
                <div className="flex flex-col items-center gap-2 text-[11px]">
                  <span className="h-7 w-7 rounded-full border-[3px] border-white/30 border-t-white" style={{ animation: 'spin 0.9s linear infinite' }} />
                  Solicitando imagem…
                </div>
              </div>
            )}
            {photo === 'done' && <div className="absolute bottom-5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Pessoa (100% de previsão)</div>}
            <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <i key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-white/90' : 'bg-white/45'}`} />)}
            </div>
          </div>
          {/* botão amarelo, como em "Histórico de imagens" do app */}
        </Region>

        <Region id="ultimos-eventos" interactive={interactive}>
          <div className={LABEL}>Últimos eventos</div>
          <div className={`${CARD} !py-1.5`}>
            {events.map(({ Icon, color, text, who, when }, i) => (
              <div key={i} className="flex items-center gap-2.5 border-b border-white/10 py-1 last:border-0">
                <span className="w-5 shrink-0" style={{ color }}><Icon size={16} /></span>
                <span className="flex-1 leading-tight"><span className="block text-[11.5px] text-white/90">{text}</span><span className="text-[9px] text-white/50">{who} · {when}</span></span>
              </div>
            ))}
          </div>
        </Region>
      </div>

      {/* menu de baixo: escuro, de ponta a ponta, com a aba atual em amarelo */}
      <Region id="menu" interactive={interactive} className="mt-1">
        <AppNav />
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
      <div className={`relative flex h-[300px] w-[320px] origin-top-left select-none flex-col overflow-hidden ${BG} font-body text-white`} style={{ transform: `scale(${scale})` }}>
        <StatusBar />
        {/* notificação do app: chega e sobe; o evento fica na lista */}
        <div className="absolute inset-x-2 top-8 z-10 flex items-center gap-2 rounded-2xl bg-[#e03131] px-3 py-2 text-white shadow-lg"
          style={{ animation: 'notif-out 0.7s 1.6s ease-in both' }}>
          <Bell size={18} />
          <div className="leading-tight"><div className="text-[12px] font-bold">Sabotagem</div><div className="text-[10.5px] opacity-90">Fotossensor · Sala de estar</div></div>
        </div>
        <AppTop />
        <div className="px-4 pt-3 text-[20px] font-light text-white/90">Olá!</div>
        <div className="flex flex-1 flex-col px-3 pt-3">
          <div className={LABEL}>Últimos eventos</div>
          {/* só o evento de sabotagem, entrando na lista */}
          <div className={`${CARD} flex items-center gap-2 !py-2 text-[12px]`}
            style={{ animation: 'screen-in 0.5s 2.0s cubic-bezier(.16,.84,.3,1) both' }}>
            <span className="text-[#ff5a5a]"><Shield size={16} /></span>
            <span className="flex-1 leading-tight"><span className="block text-[#ff5a5a]">Sabotagem</span><span className="text-[10.5px] text-white/55">Sala de estar · agora</span></span>
          </div>
        </div>
        <AppNav active={4} />
      </div>
    </div>
  )
}

/**
 * Foto nova do fotossensor (ação "Tirar uma foto"): a tela "Imagem" do app, escura, já aberta, com a notificação
 * passando por cima e saindo. Desenhada em 320 px e reduzida pelo `scale`.
 */
export function ImageScreen({ scale = 0.6 }: { scale?: number }) {
  return (
    <div style={{ width: 320 * scale, height: 400 * scale }} lang="pt-BR">
      <div className="relative flex h-[400px] w-[320px] origin-top-left select-none flex-col overflow-hidden bg-[#0b0c10] font-body text-white" style={{ transform: `scale(${scale})` }}>
        <StatusBar />
        <div className="absolute inset-x-2 top-8 z-10 flex items-center gap-2 rounded-2xl bg-[#26272b] px-3 py-2 text-white shadow-lg"
          style={{ animation: 'notif-out 0.7s 1.4s ease-in both' }}>
          <OrsegupsLogo size={18} />
          <div className="leading-tight"><div className="text-[12px] font-semibold">Imagem do disparo</div><div className="text-[10.5px] text-white/75">Sala de estar</div></div>
        </div>
        <div className="flex items-center gap-4 px-5 pt-4 text-[15px]"><span className="text-xl leading-none">‹</span><span className="flex-1">Imagem</span><span>⋮</span></div>
        <img src={aiPhotoDataUrl(true)} alt="Foto do fotossensor com a pessoa marcada" width={480} height={360} className="mt-6 h-[200px] w-full object-cover" draggable={false} />
        <div className="mx-auto mt-4 h-[3px] w-9 rounded bg-white/50" />
        <div className="mt-3 text-center text-[11px] leading-5 text-white/85">Hoje, agora<br />Detector de presença · 1 detecção<br /><span className="text-white/55">Sala de estar</span></div>
        <div className="mt-2 text-center text-[11px] text-white/90">Pessoa (100% de previsão)</div>
      </div>
    </div>
  )
}
