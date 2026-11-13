import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { useState } from 'react'
import { DEVICES, DEVICE_BY_ID, type DeviceId, type Vec3 } from '../../data/devices'
import { now, useShowroom } from '../../store/showroomStore'
import { DEVICE_COMPONENTS } from '../devices'
import { reducedMotion } from '../common/util'
import { compiledDevices } from '../common/registry'

export type Placement = { id: DeviceId; position: Vec3; rotation?: Vec3; scale?: number; key?: string }

// "Foto do kit": placa, fotossensor, módulo, sensor magnético, sirene, controle e app.
export const KIT_LAYOUT: Placement[] = [
  { id: 'placa', position: [-3.7, 0, -0.8], rotation: [0, 0.22, 0] },
  { id: 'fotossensor', position: [-2.25, 0, -0.5], rotation: [0, 0.12, 0] },
  { id: 'modulo', position: [-0.55, 0, 0.9], rotation: [0, 0.5, 0] },
  { id: 'magnetico', position: [0.75, 0, -0.9] },
  { id: 'sirene', position: [1.9, 0, -0.4], rotation: [-0.12, -0.1, 0] },
  { id: 'controle', position: [2.55, 0, 1.2], rotation: [-0.15, -0.2, 0] },
  { id: 'app', position: [3.6, 0, 0], rotation: [-0.1, -0.3, 0] },
]

// Em retrato (celular) os 7 em linha ficam minúsculos: duas fileiras, os altos atrás e os baixos na frente.
export const KIT_LAYOUT_PORTRAIT: Placement[] = [
  { id: 'placa', position: [-2.0, 0, -1.3], rotation: [0, 0.18, 0] },
  { id: 'fotossensor', position: [-0.55, 0, -1.3], rotation: [0, 0.1, 0] },
  { id: 'modulo', position: [-1.1, 0, 1.2], rotation: [0, 0.5, 0] },
  { id: 'magnetico', position: [0.45, 0, 1.3] },
  { id: 'sirene', position: [0.75, 0, -1.3], rotation: [-0.12, -0.08, 0] },
  { id: 'controle', position: [1.55, 0, 1.5], rotation: [-0.15, -0.2, 0] },
  { id: 'app', position: [2.05, 0, -1.3], rotation: [-0.1, -0.22, 0] },
]

const easeOutBack = (x: number) => { const c = 1.70158; const t = Math.min(1, Math.max(0, x)) - 1; return 1 + (c + 1) * t * t * t + c * t * t }

/** Um aparelho pousado no chão (y = 0), em escala relativa. Clicar leva a ele no showroom. */
export function Placed({ p, children }: { p: Placement; children?: React.ReactNode }) {
  const d = DEVICE_BY_ID[p.id]
  const s = p.scale ?? d.kitScale
  const C = DEVICE_COMPONENTS[p.id]
  const [hover, setHover] = useState(false)
  useCursor(hover)
  return (
    <group name={`kit:${p.id}`} position={[p.position[0], p.position[1] - d.bottom * s, p.position[2]]} rotation={p.rotation} scale={s}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true) }} onPointerOut={() => setHover(false)}
      onClick={(e) => { if (e.delta > 6) return; e.stopPropagation(); useShowroom.getState().setDevice(p.id) }}>
      {children ?? <C />}
    </group>
  )
}

/**
 * Os 7 aparelhos formando a foto do kit. `mode="enter"`: entram um a um (abertura);
 * `mode="gather"`: vêm de longe e se reúnem (encerramento).
 */
export function KitLineup({ mode }: { mode: 'enter' | 'gather' }) {
  const group = useRef<THREE.Group>(null!)
  const t0 = useRef(now())
  // os aparelhos do kit entram na cena junto com a carga fatiada (um por quadro)
  const mounted = useShowroom((st) => st.mounted)
  const portrait = useThree((s) => s.size.width / s.size.height < 0.8)
  const layout = portrait ? KIT_LAYOUT_PORTRAIT : KIT_LAYOUT
  useFrame(() => {
    // logo depois da carga o kit já está no lugar, igual à imagem de abertura (o crossfade não dá salto);
    // a entrada animada fica para quando a pessoa volta à abertura
    if (!useShowroom.getState().ready) t0.current = now() - 100
    const t = reducedMotion() ? 99 : now() - t0.current
    group.current.children.forEach((c, i) => {
      c.visible = compiledDevices.has(layout[i].id) // na carga, só aparece depois de compilado
      const k = easeOutBack((t - 0.4 - i * (mode === 'enter' ? 0.38 : 0.12)) / 0.9)
      if (mode === 'enter') {
        c.position.y = (1 - k) * 2.2
        c.scale.setScalar(Math.max(0.001, k))
        c.rotation.y = (1 - k) * 1.6
      } else {
        const p = layout[i].position
        c.position.set(p[0] * (1 - k) * 1.4, (1 - k) * 1.2, (1 - k) * 4)
        c.scale.setScalar(Math.max(0.001, 0.4 + 0.6 * k))
        c.rotation.y = (1 - k) * -1.2
      }
    })
  })
  return (
    <group ref={group}>
      {layout.map((p) => <group key={p.id}>{DEVICES.findIndex((d) => d.id === p.id) < mounted && <Placed p={p} />}</group>)}
    </group>
  )
}
