import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { fxBasic } from '../common/materials'

export const VIAS = ['1. Chip 4G', '2. Wi-Fi', '3. Ethernet'] as const

/**
 * As 3 vias de comunicação: feixes que saem de `from` até `to[i]`.
 * `state(i)` devolve: 0 oculto, 1 ativo (azul), 2 cortado (vermelho), 3 assumiu (verde).
 */
export function CommLinks({ from, to, state, labels = true }: {
  from: [number, number, number]; to: [number, number, number][]; state: (i: number) => 0 | 1 | 2 | 3; labels?: boolean
}) {
  const beams = useRef<THREE.Group>(null!)
  const data = useMemo(() => to.map((t) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...t)
    const mid = a.clone().lerp(b, 0.5); mid.y += 0.5
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
    return { curve, geo: new THREE.TubeGeometry(curve, 32, 0.018, 6), mat: fxBasic('#5b8cff', 0), dot: fxBasic('#ffffff', 0) }
  }), [from, to])
  const tags = useRef<(HTMLDivElement | null)[]>([])
  const P = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    data.forEach((d, i) => {
      const st = state(i)
      const col = st === 2 ? '#ff3b3b' : st === 3 ? '#35d46a' : '#5b8cff'
      d.mat.color.set(col)
      d.mat.opacity = st === 0 ? 0 : st === 2 ? 0.25 + 0.2 * Math.sin(clock.elapsedTime * 14) : 0.85
      const dot = beams.current.children[i * 2 + 1]
      d.curve.getPoint((clock.elapsedTime * 0.6 + i * 0.3) % 1, P)
      dot.position.copy(P)
      d.dot.opacity = st === 1 || st === 3 ? 1 : 0
      const el = tags.current[i]
      if (el) {
        el.style.opacity = st === 0 ? '0' : '1'
        el.style.borderColor = col
        el.dataset.st = String(st)
      }
    })
  })
  return (
    <group>
      <group ref={beams}>
        {data.flatMap((d, i) => [
          <mesh key={`b${i}`} geometry={d.geo} material={d.mat} userData={{ fx: true }} raycast={() => null} />,
          <mesh key={`d${i}`} material={d.dot} userData={{ fx: true }} raycast={() => null}><sphereGeometry args={[0.045, 12, 8]} /></mesh>,
        ])}
      </group>
      {labels && to.map((t, i) => (
        <Html key={i} position={t} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={(el) => { tags.current[i] = el }} className="fx-tag via-tag rounded-full border-2 bg-[#0b1126]/90 px-3 py-1 text-sm font-semibold text-white" style={{ opacity: 0, transition: 'opacity .3s' }}>
            {VIAS[i]}
          </div>
        </Html>
      ))}
    </group>
  )
}
