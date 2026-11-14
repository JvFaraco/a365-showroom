import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { LedStateId } from '../../data/ledStates'
import { ModuloComando } from '../devices/ModuloComando'
import { fxBasic } from '../common/materials'

/**
 * Módulo em miniatura que aparece ao lado para mostrar a reação do LED a um comando. É o módulo 3D de verdade: balança
 * devagar (para não parecer uma imagem parada) e tem uma sombra suave embaixo, para assentar na cena.
 */
export function MiniModulo({ led, label = 'Módulo de Comando', ...props }: { led?: () => LedStateId | null; label?: string } & JSX.IntrinsicElements['group']) {
  const turn = useRef<THREE.Group>(null!)
  const shadow = useMemo(() => fxBasic('#000000', 0.35), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    turn.current.rotation.y = -0.3 + Math.sin(t * 0.55) * 0.35
    turn.current.position.y = Math.sin(t * 1.1) * 0.015
  })
  return (
    <group {...props}>
      <group scale={0.42} rotation={[0.42, 0, 0]}>
        <group ref={turn}>
          <ModuloComando ledOverride={led} />
        </group>
        <mesh material={shadow} position={[0, -0.62, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]} userData={{ fx: true }} raycast={() => null}><circleGeometry args={[1.25, 40]} /></mesh>
      </group>
      <Html position={[0, -0.48, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="fx-tag rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white/80">{label}</div>
      </Html>
    </group>
  )
}
