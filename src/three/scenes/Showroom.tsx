import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { DEVICE_BY_ID, type DeviceId } from '../../data/devices'
import { now, useShowroom } from '../../store/showroomStore'
import { DEVICE_COMPONENTS } from '../devices'
import { ManualPins, PartCallout } from '../parts/PartCallout'
import { Stage } from '../Stage'
import { explodeAmt, reducedMotion } from '../common/util'
import { fxBasic } from '../common/materials'

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)
const UP = new THREE.Vector3(0, 1, 0)

/** Linhas-guia da vista explodida: do lugar original de cada parte até onde ela foi parar. */
function ExplodeLines({ device }: { device: DeviceId }) {
  const group = useRef<THREE.Group>(null!)
  const mat = useMemo(() => fxBasic('#8fb4ff', 0), [])
  const items = useMemo(() => {
    const seen = new Set<string>()
    return DEVICE_BY_ID[device].parts.filter((p) => p.explode && Math.hypot(...p.explode) > 0.1).filter((p) => {
      const k = p.explode!.join()
      return seen.has(k) ? false : (seen.add(k), true)
    }).map((p) => {
      const dir = new THREE.Vector3(...p.explode!)
      const len = dir.length()
      return { from: new THREE.Vector3(...p.camera.target), dir: dir.clone().normalize(), len, q: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()) }
    })
  }, [device])
  useFrame(() => {
    const k = explodeAmt.v
    mat.opacity = k * 0.45
    group.current.visible = k > 0.02
    items.forEach((it, i) => {
      const m = group.current.children[i]
      m.position.copy(it.from).addScaledVector(it.dir, (it.len * k) / 2)
      m.scale.set(1, Math.max(0.001, it.len * k), 1)
    })
  })
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <mesh key={i} material={mat} quaternion={it.q} userData={{ fx: true }} raycast={() => null}><cylinderGeometry args={[0.004, 0.004, 1, 5]} /></mesh>
      ))}
    </group>
  )
}

/** Progresso do botão segurado por 5 s (190 no módulo, ✱ no controle). */
function HoldDriver() {
  useFrame((_, dt) => {
    const s = useShowroom.getState()
    if (s.action?.id !== 'sos190' && s.action?.id !== 'panico') return
    if (s.holdMsg === 'ok') return
    if (s.holding) {
      const hold = Math.min(1, s.hold + dt / 5)
      s.set(hold >= 1 ? { hold: 1, holding: false, holdMsg: 'ok' } : { hold })
    } else if (s.hold > 0) {
      s.set({ hold: Math.max(0, s.hold - dt * 1.6), holdMsg: 'solte' })
    }
  })
  return null
}

/** Showroom: o aparelho ativo no pedestal, com a troca animada (o atual sai, o novo desliza, gira e pousa). */
export function Showroom() {
  const device = useShowroom((s) => s.device)
  const [slots, setSlots] = useState<{ cur: DeviceId; prev: DeviceId | null; t0: number }>({ cur: device, prev: null, t0: now() - 5 })
  const curRef = useRef<THREE.Group>(null!)
  const prevRef = useRef<THREE.Group>(null)

  useEffect(() => {
    setSlots((s) => (s.cur === device ? s : { cur: device, prev: s.cur, t0: now() }))
  }, [device])
  useEffect(() => {
    if (!slots.prev) return
    const t = setTimeout(() => setSlots((s) => ({ ...s, prev: null })), 650)
    return () => clearTimeout(t)
  }, [slots])

  useFrame((_, dt) => {
    const s = useShowroom.getState()
    easing.damp(explodeAmt, 'v', s.view === 'exploded' || s.view === 'manual' ? 1 : 0, 0.22, dt)
    const t = reducedMotion() ? 9 : now() - slots.t0
    const k = easeOut(t / 0.95)
    curRef.current.position.set((1 - k) * 5.5, Math.sin(k * Math.PI) * 0.5, 0)
    curRef.current.rotation.y = (1 - k) * -2.4
    curRef.current.scale.setScalar(0.6 + 0.4 * k)
    if (prevRef.current) {
      const o = easeOut(t / 0.6)
      prevRef.current.position.set(-o * 6, 0, 0)
      prevRef.current.rotation.y = o * 1.5
      prevRef.current.scale.setScalar(Math.max(0.001, 1 - o))
    }
  })

  const Cur = DEVICE_COMPONENTS[slots.cur]
  const Prev = slots.prev ? DEVICE_COMPONENTS[slots.prev] : null
  const d = DEVICE_BY_ID[slots.cur]
  return (
    <>
      <Stage floorY={d.bottom - 0.2} pedestal />
      <group ref={curRef} key={slots.cur}>
        <Cur interactive />
        <ExplodeLines device={slots.cur} />
      </group>
      {Prev && <group ref={prevRef} key={`prev-${slots.prev}`}><Prev /></group>}
      <ManualPins />
      <PartCallout />
      <HoldDriver />
    </>
  )
}
