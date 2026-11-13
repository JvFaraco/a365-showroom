import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { mat as makeMat } from './materials'

export type LedOut = { color: string; on: number }

/**
 * LED emissivo (com bloom). `sample` é chamado a cada frame e preenche cor + intensidade (0..1).
 */
export function Led({ sample, children, boost = 3.2, baseColor = '#111318', ...props }: { sample: (t: number, out: LedOut) => void; children?: ReactNode; boost?: number; baseColor?: string } & JSX.IntrinsicElements['mesh']) {
  const mesh = useRef<THREE.Mesh>(null!)
  const mat = useMemo(() => makeMat({ color: baseColor, emissive: '#000000', roughness: 0.3, toneMapped: false }), [baseColor])
  const out = useRef<LedOut>({ color: '#000000', on: 0 })
  const last = useRef('')
  useFrame(({ clock }) => {
    const o = out.current
    sample(clock.elapsedTime, o)
    const m = mesh.current.material as THREE.MeshStandardMaterial
    if (o.color !== last.current) { m.emissive.set(o.color); last.current = o.color }
    m.emissiveIntensity = o.on * boost
  })
  return (
    <mesh ref={mesh} material={mat} userData={{ led: true }} {...props}>
      {children}
    </mesh>
  )
}
