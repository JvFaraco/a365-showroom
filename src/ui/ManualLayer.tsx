import { DEVICE_BY_ID } from '../data/devices'
import { useShowroom } from '../store/showroomStore'

/**
 * Modo Manual (camada 2D): um pino numerado por parte e, em telas largas, o nome de cada parte em
 * duas colunas ao lado do aparelho, ligado ao pino por uma linha. As posições são escritas direto
 * no DOM por three/parts/PartCallout (ManualPins), que afasta os pinos e empilha os nomes para
 * nenhum ficar em cima do outro. Em tela estreita ficam só os números (os nomes estão na lista de Partes).
 */
export function ManualLayer() {
  const device = useShowroom((s) => s.device)
  const show = useShowroom((s) => s.view === 'manual' && !s.part && s.ready)
  if (!show) return null
  const parts = DEVICE_BY_ID[device].parts
  const st = useShowroom.getState
  return (
    <div id="manual-layer" data-device={device} className="pointer-events-none fixed inset-0 z-[15] overflow-hidden">
      <svg className="absolute inset-0 hidden h-full w-full md:block" aria-hidden>
        {parts.map((p) => <line key={p.id} data-line stroke="rgba(255,255,255,0.55)" strokeWidth="1" style={{ opacity: 0 }} />)}
      </svg>
      {parts.map((p, i) => (
        <button key={p.id} data-dot aria-label={`${i + 1}. ${p.name}`} style={{ opacity: 0 }}
          onClick={() => st().selectPart(p.id)} onMouseEnter={() => st().setHovered(p.id)} onMouseLeave={() => st().setHovered(null)}
          className="pin-label absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-brand-light text-xs font-bold text-white shadow-lg transition-colors duration-fast ease-out hover:bg-accent hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-6 md:w-6">
          {i + 1}
        </button>
      ))}
      {parts.map((p) => (
        <button key={p.id} data-tag tabIndex={-1} aria-hidden style={{ opacity: 0 }}
          onClick={() => st().selectPart(p.id)} onMouseEnter={() => st().setHovered(p.id)} onMouseLeave={() => st().setHovered(null)}
          className="pin-label absolute left-0 top-0 hidden rounded bg-surface/90 px-2 py-0.5 text-xs font-medium text-white ring-1 ring-white/15 transition-shadow duration-fast ease-out hover:ring-accent md:block">
          {p.name}
        </button>
      ))}
    </div>
  )
}
