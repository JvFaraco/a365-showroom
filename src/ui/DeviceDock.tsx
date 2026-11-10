import { DEVICES, type DeviceId } from '../data/devices'
import { useShowroom } from '../store/showroomStore'
import { beep } from './audio'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const ICON: Record<DeviceId, JSX.Element> = {
  modulo: <g {...s}><path d="M4 21c0-4 5-6 12-6s12 2 12 6v2c0 2-5 4-12 4S4 25 4 23z" /><path d="M24 15l4-10" /><ellipse cx="16" cy="20" rx="5" ry="2" /></g>,
  fotossensor: <g {...s}><rect x="10" y="3" width="12" height="26" rx="5" /><circle cx="16" cy="9" r="2" /><rect x="12" y="15" width="8" height="7" rx="1" /></g>,
  magnetico: <g {...s}><rect x="9" y="4" width="7" height="24" rx="2.5" /><rect x="18" y="8" width="5" height="16" rx="2" /></g>,
  sirene: <g {...s}><circle cx="16" cy="16" r="11" /><circle cx="16" cy="16" r="6" /><path d="M16 24v1" /></g>,
  controle: <g {...s}><circle cx="16" cy="13" r="9" /><circle cx="16" cy="13" r="3" /><path d="M11 21l3 6h4l3-6" /></g>,
  placa: <g {...s}><rect x="7" y="3" width="18" height="26" rx="3" /><circle cx="16" cy="11" r="4" /><path d="M7 20h18M11 25h10" /></g>,
  app: <g {...s}><rect x="9" y="2" width="14" height="28" rx="3.5" /><path d="M14 26h4" /><rect x="12" y="8" width="8" height="6" rx="1" /></g>,
}

/** Seletor de aparelhos: faixa inferior com os 7 aparelhos. */
export function DeviceDock() {
  const device = useShowroom((st) => st.device)
  const hide = useShowroom((st) => !!st.part)
  return (
    <nav aria-label="Aparelhos" className={`pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-2 transition-opacity ${hide ? 'opacity-0 md:opacity-100' : ''}`}>
      <ul className={`glass flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1.5 ${hide ? 'pointer-events-none md:pointer-events-auto' : 'pointer-events-auto'}`}>
        {DEVICES.map((d, i) => (
          <li key={d.id}>
            <button
              aria-label={`${i + 1}. ${d.name}`} aria-current={device === d.id}
              onClick={() => { beep(); useShowroom.getState().setDevice(d.id) }}
              className={`flex w-[4.6rem] flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.68em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:w-24 md:text-[0.75em] ${device === d.id ? 'bg-brand-light text-white shadow-lg shadow-brand/50' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <svg viewBox="0 0 32 32" className="h-7 w-7 md:h-8 md:w-8" aria-hidden>{ICON[d.id]}</svg>
              <span className="leading-tight">{d.short}</span>
              <span className="kbd hidden opacity-60 md:inline">{i + 1}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
