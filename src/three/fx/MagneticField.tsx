import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fxBasic } from '../common/materials'

/**
 * Linhas de campo magnético entre o corpo e o ímã. `strength()` 1 = fechadas, 0 = rompidas.
 * As linhas saem da origem para +X (largura `gap`), no plano XY.
 */
export function MagneticField({ strength, gap = 0.3, rows = 7, height = 1, ...props }: { strength: () => number; gap?: number; rows?: number; height?: number } & JSX.IntrinsicElements['group']) {
  const g = useRef<THREE.Group>(null!)
  const mat = useMemo(() => fxBasic('#6aa2ff', 0), [])
  const geos = useMemo(() => Array.from({ length: rows }, (_, i) => {
    const y = (i / (rows - 1) - 0.5) * height
    const bulge = ((i % 2) * 2 - 1) * 0.05
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, y, 0), new THREE.Vector3(gap / 2, y + bulge, 0.12), new THREE.Vector3(gap, y, 0))
    return new THREE.TubeGeometry(c, 12, 0.008, 5)
  }), [rows, gap, height])
  useFrame(({ clock }) => {
    const s = strength()
    mat.opacity = s * (0.55 + 0.35 * Math.sin(clock.elapsedTime * 6))
    g.current.scale.x = 1 + (1 - s) * 0.8
  })
  return (
    <group ref={g} {...props}>
      {geos.map((geo, i) => <mesh key={i} geometry={geo} material={mat} userData={{ fx: true }} raycast={() => null} />)}
    </group>
  )
}
