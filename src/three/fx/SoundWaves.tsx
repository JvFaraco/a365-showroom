import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fxBasic } from '../common/materials'

/**
 * Ondas concêntricas pulsantes no plano XY (viradas para +Z).
 * `level()` devolve a amplitude (0 = sem ondas; 1..3 = alcance crescente).
 */
export function SoundWaves({ level, color = '#ff4040', count = 5, maxRadius = 1.1, arc = Math.PI * 2, speed = 0.55, ...props }: {
  level: () => number; color?: string; count?: number; maxRadius?: number; arc?: number; speed?: number
} & JSX.IntrinsicElements['group']) {
  const g = useRef<THREE.Group>(null!)
  const geo = useMemo(() => new THREE.RingGeometry(0.96, 1, 64, 1, -arc / 2 + Math.PI / 2, arc), [arc])
  const mats = useMemo(() => Array.from({ length: count }, () => fxBasic(color, 0)), [count, color])
  useFrame(({ clock }) => {
    const lv = level()
    for (let i = 0; i < count; i++) {
      const m = g.current.children[i] as THREE.Mesh
      const p = (clock.elapsedTime * speed + i / count) % 1
      const r = 0.25 + p * maxRadius * (0.55 + 0.45 * lv)
      m.scale.setScalar(r)
      mats[i].opacity = lv <= 0 ? 0 : (1 - p) * Math.min(1, 0.35 + lv * 0.22)
    }
  })
  return (
    <group ref={g} {...props}>
      {mats.map((m, i) => <mesh key={i} geometry={geo} material={m} userData={{ fx: true }} raycast={() => null} />)}
    </group>
  )
}
