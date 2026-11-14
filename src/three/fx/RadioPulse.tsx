import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fxBasic } from '../common/materials'

const A = new THREE.Vector3(), B = new THREE.Vector3(), PA = new THREE.Vector3(), PB = new THREE.Vector3(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1)

/**
 * Sinal de rádio entre dois aparelhos: arcos pequenos de onda, como o desenho de sinal ")))", que viajam de `from`
 * até `to`. Cada arco fica sempre de frente para a câmera e abre na direção de quem recebe (anéis de lado viravam
 * tracinhos). `on()` liga/desliga sem remontar.
 *
 * Com `bursts` (instantes, em s, no relógio `time`), o sinal vira rajadas: em cada instante saem `count` arcos, um
 * atrás do outro, e cada um leva `travel` s até chegar. Assim a chegada do sinal coincide com a reação de quem recebe.
 */
export function RadioPulse({ from, to, color = '#5b8cff', on = () => true, count = 3, size = 0.12, speed = 0.8, bursts, time, travel = 0.4, gap = 0.12 }: {
  from: [number, number, number]; to: [number, number, number]; color?: string; on?: () => boolean; count?: number; size?: number; speed?: number
  bursts?: number[]; time?: () => number; travel?: number; gap?: number
}) {
  const g = useRef<THREE.Group>(null!)
  const geo = useMemo(() => new THREE.RingGeometry(0.8, 1, 20, 1, -0.75, 1.5), []) // arco de ~86°, aberto para +X
  const mats = useMemo(() => Array.from({ length: count }, () => fxBasic(color, 0)), [count, color])
  useFrame(({ clock, camera }) => {
    A.fromArray(from); B.fromArray(to)
    const active = on()
    // direção da viagem na tela: o arco gira em volta do eixo da câmera para abrir para lá
    PA.copy(A).project(camera); PB.copy(B).project(camera)
    const ang = Math.atan2(PB.y - PA.y, (PB.x - PA.x) * (camera as THREE.PerspectiveCamera).aspect)
    Q.setFromAxisAngle(Z, ang)
    for (let i = 0; i < count; i++) {
      const m = g.current.children[i] as THREE.Mesh
      let p: number, vis: boolean
      if (bursts && time) {
        // rajada: o arco i sai `i * gap` depois do início da rajada mais recente que ainda está no ar
        const now = time()
        p = -1
        for (const b of bursts) { const x = (now - b - i * gap) / travel; if (x >= 0 && x <= 1) p = x }
        vis = p >= 0
        if (!vis) p = 0
      } else {
        p = (clock.elapsedTime * speed + i / count) % 1
        vis = active
      }
      m.position.lerpVectors(A, B, p)
      m.quaternion.copy(camera.quaternion).multiply(Q)
      m.scale.setScalar(size * (0.7 + p * 0.6))
      // na rajada, aparece logo e some ao chegar (o meio do caminho é o mais visível)
      mats[i].opacity = vis ? (bursts ? Math.min(1, p * 6) * (1 - p * p) : Math.sin(p * Math.PI)) * 0.85 : 0
    }
  })
  return (
    <group ref={g}>
      {mats.map((m, i) => <mesh key={i} geometry={geo} material={m} userData={{ fx: true }} raycast={() => null} />)}
    </group>
  )
}
