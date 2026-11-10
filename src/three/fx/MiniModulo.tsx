import { Html } from '@react-three/drei'
import type { LedStateId } from '../../data/ledStates'
import { ModuloComando } from '../devices/ModuloComando'

/** Módulo em miniatura que aparece no canto para mostrar a reação do LED a um comando. */
export function MiniModulo({ led, label = 'Módulo de Comando', ...props }: { led?: () => LedStateId | null; label?: string } & JSX.IntrinsicElements['group']) {
  return (
    <group {...props}>
      <group scale={0.42} rotation={[0.5, -0.3, 0]}>
        <ModuloComando ledOverride={led} />
      </group>
      <Html position={[0, -0.42, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="fx-tag rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white/80">{label}</div>
      </Html>
    </group>
  )
}
