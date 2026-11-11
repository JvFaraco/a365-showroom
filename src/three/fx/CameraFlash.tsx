import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fxBasic } from '../common/materials'

/**
 * Pulso branco do flash (pega bloom). `power()` vai de 0 a 1.
 * Sem luz própria de propósito: mudar o número de luzes da cena faria todos os materiais recompilarem.
 */
export function CameraFlash({ power, ...props }: { power: () => number } & JSX.IntrinsicElements['group']) {
  const mesh = useRef<THREE.Mesh>(null!)
  const mat = useMemo(() => { const m = fxBasic('#ffffff', 0); m.blending = THREE.AdditiveBlending; return m }, [])
  useFrame(() => {
    const p = power()
    mat.opacity = p
    mat.color.setScalar(1 + p * 6)
    mesh.current.scale.setScalar(0.08 + p * 0.5)
  })
  return (
    <group {...props}>
      <mesh ref={mesh} material={mat} userData={{ fx: true }} raycast={() => null}><sphereGeometry args={[1, 24, 16]} /></mesh>
    </group>
  )
}
