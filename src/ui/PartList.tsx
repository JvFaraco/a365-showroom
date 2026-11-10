import { AnimatePresence, motion } from 'framer-motion'
import { DEVICE_BY_ID } from '../data/devices'
import { useShowroom } from '../store/showroomStore'
import { Close, ListIcon } from './icons'

/** Painel lateral recolhível com as partes do aparelho. Funciona pelo teclado. */
export function PartList() {
  const device = useShowroom((s) => s.device)
  const part = useShowroom((s) => s.part)
  const open = useShowroom((s) => s.listOpen)
  const set = useShowroom((s) => s.set)
  const d = DEVICE_BY_ID[device]
  return (
    <div className="pointer-events-none fixed left-3 top-[4.5rem] z-30 md:left-5 md:top-24">
      <button className="btn glass pointer-events-auto" aria-expanded={open} aria-controls="part-list" onClick={() => set({ listOpen: !open })}>
        {open ? <Close size={16} /> : <ListIcon size={16} />} <span className="hidden sm:inline">Partes</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.nav id="part-list" aria-label={`Partes do ${d.name}`} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            className="glass pointer-events-auto mt-2 max-h-[52vh] w-60 overflow-y-auto rounded-2xl p-2">
            <ol>
              {d.parts.map((p, i) => (
                <li key={p.id}>
                  <button
                    aria-current={part === p.id}
                    aria-label={`${i + 1}. ${p.name}${p.internal ? ' (parte interna)' : ''}`}
                    onClick={() => { useShowroom.getState().selectPart(p.id); if (window.innerWidth < 768) set({ listOpen: false }) }}
                    onMouseEnter={() => useShowroom.getState().setHovered(p.id)} onMouseLeave={() => useShowroom.getState().setHovered(null)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${part === p.id ? 'bg-brand-light text-white' : 'text-white/85 hover:bg-white/10'}`}>
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold">{i + 1}</span>
                    <span className="flex-1">{p.name}</span>
                    {p.internal && <span className="rounded bg-white/10 px-1 text-[9px] uppercase tracking-wide text-white/60">interna</span>}
                  </button>
                </li>
              ))}
            </ol>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  )
}
