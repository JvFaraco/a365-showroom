import { DEVICE_BY_ID, getPart } from '../data/devices'
import { useShowroom } from '../store/showroomStore'
import { Chevron } from './icons'

/** "Módulo de Comando › Antena", com Voltar para a vista inteira. */
export function Breadcrumb() {
  const device = useShowroom((s) => s.device)
  const partId = useShowroom((s) => s.part)
  const d = DEVICE_BY_ID[device]
  const part = getPart(device, partId)
  return (
    <nav aria-label="Você está em" className="pointer-events-auto flex min-w-0 items-center gap-2">
      {part && (
        <button className="btn glass shrink-0 !px-3" onClick={() => useShowroom.getState().selectPart(null)}>
          <Chevron dir="left" size={14} /> Voltar <span className="kbd hidden md:inline">ESC</span>
        </button>
      )}
      <div className="glass min-w-0 truncate rounded-xl px-3 py-1">
        <div className="truncate font-title text-[1.05em] font-semibold leading-tight">
          <button className={part ? 'text-white/85 underline-offset-4 hover:text-white hover:underline' : 'text-white'} onClick={() => useShowroom.getState().selectPart(null)}>{d.name}</button>
          {part && <><span className="mx-1.5 text-accent">›</span><span className="text-white">{part.name}</span></>}
        </div>
        {!part && <div className="truncate text-[0.8em] text-white/75">{d.tagline}</div>}
      </div>
    </nav>
  )
}
