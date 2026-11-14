import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fxBasic } from '../common/materials'

const A = new THREE.Vector3(), B = new THREE.Vector3()

/**
 * Sinal de rádio entre dois aparelhos: pontinhos de luz que viajam de `from` até `to`, aparecendo e sumindo nas
 * pontas (antes eram anéis grandes, que poluíam a cena). `on()` liga/desliga sem remontar.
 */
export function RadioPulse({ from, to, color = '#5b8cff', on = () => true, count = 3, size = 0.22, speed = 0.8 }: {
  from: [number, number, number]; to: [number, number, number]; color?: string; on?: () => boolean; count?: number; size?: number; speed?: number
}) {
  const g = useRef<THREE.Group>(null!)
  const geo = useMemo(() => new THREE.SphereGeometry(1, 12, 8), [])
  const mats = useMemo(() => Array.from({ length: count }, () => fxBasic(color, 0)), [count, color])
  useFrame(({ clock }) => {
    A.fromArray(from); B.fromArray(to)
    const active = on()
    for (let i = 0; i < count; i++) {
      const m = g.current.children[i] as THREE.Mesh
      const p = (clock.elapsedTime * speed + i / count) % 1
      m.position.lerpVectors(A, B, p)
      m.scale.setScalar(size * 0.2)
      mats[i].opacity = active ? Math.sin(p * Math.PI) * 0.85 : 0
    }
  })
  return (
    <group ref={g}>
      {mats.map((m, i) => <mesh key={i} geometry={geo} material={m} userData={{ fx: true }} raycast={() => null} />)}
    </group>
  )
}
