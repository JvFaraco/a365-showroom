import { DEVICE_BY_ID, hasInternal } from '../data/devices'
import { useShowroom, type View } from '../store/showroomStore'
import { beep } from './audio'
import { Explode, Play, Xray } from './icons'

/** Explodir, Raio-X e Tour. */
export function ViewToggles() {
  const view = useShowroom((s) => s.view)
  const tour = useShowroom((s) => s.tour)
  const device = useShowroom((s) => s.device)
  const st = useShowroom.getState
  const internal = hasInternal(DEVICE_BY_ID[device])
  // Explodir e Raio-X só aparecem quando o aparelho tem alguma parte interna para mostrar (a placa e o app não têm)
  const all: { v: View; label: string; key: string; Icon: typeof Explode }[] = [
    { v: 'exploded', label: 'Explodir', key: 'E', Icon: Explode },
    { v: 'xray', label: 'Raio-X', key: 'X', Icon: Xray },
  ]
  const items = internal ? all : []
  return (
    <div role="toolbar" aria-label="Modos de vista" className="glass pointer-events-auto flex gap-1 rounded-full p-1">
      {items.map(({ v, label, key, Icon }) => (
        <button key={v} aria-pressed={view === v} aria-label={label} title={`${label} (${key})`}
          onClick={() => { beep(); if (v === 'manual') st().selectPart(null); st().toggleView(v) }}
          className={`btn !border-transparent !px-3 ${view === v ? 'btn-on' : '!bg-transparent'}`}>
          <Icon size={16} /><span className="hidden lg:inline">{label}</span>
        </button>
      ))}
      <button aria-pressed={tour} title="Tour guiado (T)" onClick={() => { beep(); st().setTour(!tour) }}
        className={`btn !border-transparent !px-3 ${tour ? 'btn-primary' : '!bg-transparent'}`}>
        <Play size={14} /><span className="hidden lg:inline">{tour ? 'Parar tour' : 'Tour'}</span>
      </button>
    </div>
  )
}
