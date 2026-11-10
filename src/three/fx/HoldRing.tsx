import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fxBasic } from '../common/materials'
import { useShowroom } from '../../store/showroomStore'

const SEG = 60

/** Anel de progresso dos 5 s (botão 190 e pânico), lido de `store.hold`. Plano XY. */
export function HoldRing({ radius = 0.2, ...props }: { radius?: number } & JSX.IntrinsicElements['group']) {
  const inst = useRef<THREE.InstancedMesh>(null!)
  const track = useMemo(() => fxBasic('#ffffff', 0.18), [])
  const mat = useMemo(() => fxBasic('#ff3b3b', 1), [])
  const geo = useMemo(() => new THREE.PlaneGeometry((2 * Math.PI * radius) / SEG * 1.15, radius * 0.16), [radius])
  const ready = useRef(false)
  useFrame(() => {
    const m = inst.current
    if (!ready.current) {
      const o = new THREE.Object3D()
      for (let i = 0; i < SEG; i++) {
        const a = Math.PI / 2 - (i / SEG) * Math.PI * 2
        o.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0)
        o.rotation.z = a - Math.PI / 2
        o.updateMatrix(); m.setMatrixAt(i, o.matrix)
      }
      m.instanceMatrix.needsUpdate = true
      ready.current = true
    }
    const s = useShowroom.getState()
    m.count = Math.round(s.hold * SEG)
    mat.color.set(s.holdMsg === 'ok' ? '#35d46a' : '#ff3b3b')
    m.visible = track.visible = s.hold > 0 || s.holding
  })
  return (
    <group {...props}>
      <mesh material={track} userData={{ fx: true }} raycast={() => null}><ringGeometry args={[radius * 0.92, radius * 1.08, 48]} /></mesh>
      <instancedMesh ref={inst} args={[geo, mat, SEG]} userData={{ fx: true }} raycast={() => null} position={[0, 0, 0.002]} />
    </group>
  )
}
