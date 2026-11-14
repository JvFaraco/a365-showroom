import { Html } from '@react-three/drei'
import type { ActionId } from '../../data/devices'
import { useShowroom } from '../../store/showroomStore'
import { useActionPhase } from '../common/util'

/**
 * Etiqueta do anti-sabotagem durante a ação `id`: "fechado" enquanto a tampa aperta o pino e "aberto" quando ela sai e
 * o pino sobe (a partir de `openAt` segundos; no "Fechar"/"Recolocar" a ação volta e a etiqueta também).
 */
export function TamperTag({ id, openAt = 0.5, position }: { id: ActionId; openAt?: number; position: [number, number, number] }) {
  const on = useShowroom((s) => s.action?.id === id)
  const phase = useActionPhase(id, [openAt], true)
  if (!on) return null
  return (
    <group position={position}>
      <Html center style={{ pointerEvents: 'none' }}>
        <div className={`fx-tag rounded-full px-4 py-1.5 text-sm font-bold text-white ${phase === 0 ? 'bg-alert' : 'bg-black/75'}`}>
          {phase === 0 ? 'Tamper aberto: o pino subiu e o sistema avisa' : 'Tamper fechado: a tampa aperta o pino'}
        </div>
      </Html>
    </group>
  )
}
