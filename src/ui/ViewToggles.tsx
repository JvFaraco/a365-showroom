import { DEVICE_BY_ID, hasInternal } from '../data/devices'
import { useShowroom, type View } from '../store/showroomStore'
import { beep } from './audio'
import { Explode, Manual, Play, Xray } from './icons'

/** Explodir, Raio-X, Modo Manual e Tour. */
export function ViewToggles() {
  const view = useShowroom((s) => s.view)
  const tour = useShowroom((s) => s.tour)
  const device = useShowroom((s) => s.device)
  const st = useShowroom.getState
  const internal = hasInternal(DEVICE_BY_ID[device])
  const items: { v: View; label: string; key: string; Icon: typeof Explode; disabled?: boolean }[] = [
    { v: 'exploded', label: 'Explodir', key: 'E', Icon: Explode },
    { v: 'xray', label: 'Raio-X', key: 'X', Icon: Xray, disabled: !internal },
    { v: 'manual', label: 'Manual', key: 'M', Icon: Manual },
  ]
  return (
    <div role="toolbar" aria-label="Modos de vista" className="glass pointer-events-auto flex gap-1 rounded-full p-1">
      {items.map(({ v, label, key, Icon, disabled }) => (
        <button key={v} disabled={disabled} aria-pressed={view === v} title={disabled ? 'Este aparelho não tem partes internas' : `${label} (${key})`}
          onClick={() => { beep(); if (v === 'manual') st().selectPart(null); st().toggleView(v) }}
          className={`btn !border-transparent !px-3 ${view === v ? 'btn-on' : '!bg-transparent'} ${disabled ? 'opacity-35' : ''}`}>
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
