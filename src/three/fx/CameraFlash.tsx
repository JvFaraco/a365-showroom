import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fxBasic } from '../common/materials'

/** Pulso branco do flash (pega bloom). `power()` vai de 0 a 1. */
export function CameraFlash({ power, ...props }: { power: () => number } & JSX.IntrinsicElements['group']) {
  const mesh = useRef<THREE.Mesh>(null!)
  const light = useRef<THREE.PointLight>(null!)
  const mat = useMemo(() => { const m = fxBasic('#ffffff', 0); m.blending = THREE.AdditiveBlending; return m }, [])
  useFrame(() => {
    const p = power()
    mat.opacity = p
    mat.color.setScalar(1 + p * 6)
    mesh.current.scale.setScalar(0.08 + p * 0.5)
    light.current.intensity = p * 40
  })
  return (
    <group {...props}>
      <mesh ref={mesh} material={mat} userData={{ fx: true }} raycast={() => null}><sphereGeometry args={[1, 24, 16]} /></mesh>
      <pointLight ref={light} intensity={0} distance={8} color="#ffffff" />
    </group>
  )
}
