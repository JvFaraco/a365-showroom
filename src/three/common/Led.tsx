import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { explodeAmt, useDeviceCtx } from './util'
import { useShowroom } from '../../store/showroomStore'

export type LedOut = { color: string; on: number }

/**
 * LED emissivo (com bloom). `sample` é chamado a cada frame e preenche cor + intensidade (0..1).
 * `on`: onde o LED aparece. 'shell' é a janela na carcaça: o LED de verdade fica na placa, então, com o aparelho
 * explodido, a janela apaga. 'board' é o LED na placa: só acende quando o aparelho está explodido (de outro modo,
 * a luz já aparece na janela da carcaça).
 */
export function Led({ sample, children, boost = 3.2, baseColor = '#111318', on: where, ...props }: { sample: (t: number, out: LedOut) => void; children?: ReactNode; boost?: number; baseColor?: string; on?: 'shell' | 'board' } & JSX.IntrinsicElements['mesh']) {
  const { deviceId, interactive } = useDeviceCtx()
  const mesh = useRef<THREE.Mesh>(null!)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: baseColor, emissive: '#000000', roughness: 0.3, toneMapped: false }), [baseColor])
  const out = useRef<LedOut>({ color: '#000000', on: 0 })
  const last = useRef('')
  useFrame(({ clock }) => {
    const o = out.current
    sample(clock.elapsedTime, o)
    if (where && interactive) {
      const s = useShowroom.getState()
      const k = s.scene === 'showroom' && s.device === deviceId ? explodeAmt.v : 0
      o.on *= where === 'shell' ? 1 - k : k
    }
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
