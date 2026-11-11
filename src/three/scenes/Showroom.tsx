import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { DEVICES, DEVICE_BY_ID, type DeviceId } from '../../data/devices'
import { holdRef, now, useShowroom } from '../../store/showroomStore'
import { DEVICE_COMPONENTS } from '../devices'
import { ManualPins, PartCallout } from '../parts/PartCallout'
import { explodeAmt, reducedMotion } from '../common/util'
import { fxBasic } from '../common/materials'
import { deviceRoots, partCenter, warmBounds } from '../common/registry'

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)
const UP = new THREE.Vector3(0, 1, 0)

/** Linhas-guia da vista explodida: do lugar original de cada parte até onde ela foi parar. */
function ExplodeLines() {
  const device = useShowroom((s) => s.device)
  const ready = useShowroom((s) => s.ready)
  const group = useRef<THREE.Group>(null!)
  const mat = useMemo(() => fxBasic('#8fb4ff', 0), [])
  const items = useMemo(() => {
    if (!ready) return []
    const seen = new Set<string>()
    return DEVICE_BY_ID[device].parts.filter((p) => p.explode && Math.hypot(...p.explode) > 0.1).filter((p) => {
      const k = p.explode!.join()
      return seen.has(k) ? false : (seen.add(k), true)
    }).map((p) => {
      const dir = new THREE.Vector3(...p.explode!)
      const len = dir.length()
      dir.normalize()
      return { from: partCenter(device, p.id, 0, new THREE.Vector3()), dir, len, q: new THREE.Quaternion().setFromUnitVectors(UP, dir) }
    })
  }, [device, ready])
  useFrame(() => {
    const k = explodeAmt.v
    mat.opacity = k * 0.45
    group.current.visible = k > 0.02 && useShowroom.getState().scene === 'showroom'
    items.forEach((it, i) => {
      const m = group.current.children[i]
      if (!m) return
      m.position.copy(it.from).addScaledVector(it.dir, (it.len * k) / 2)
      m.scale.set(1, Math.max(0.001, it.len * k), 1)
    })
  })
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <mesh key={`${device}${i}`} material={mat} quaternion={it.q} userData={{ fx: true }} raycast={() => null}><cylinderGeometry args={[0.004, 0.004, 1, 5]} /></mesh>
      ))}
    </group>
  )
}

/** Progresso do botão segurado por 5 s (190 no módulo, ✱ no controle). Corre em `holdRef`, fora do React. */
function HoldDriver() {
  useFrame((_, dt) => {
    const s = useShowroom.getState()
    if (s.action?.id !== 'sos190' && s.action?.id !== 'panico') return
    if (s.holdMsg === 'ok') return
    if (s.holding) {
      holdRef.v = Math.min(1, holdRef.v + dt / 5)
      if (holdRef.v >= 1) s.set({ holding: false, holdMsg: 'ok' })
    } else if (holdRef.v > 0) {
      holdRef.v = Math.max(0, holdRef.v - dt * 1.6)
      if (s.holdMsg !== 'solte') s.set({ holdMsg: 'solte' })
    }
  })
  return null
}

/**
 * Os 7 aparelhos do showroom ficam sempre montados. Trocar de aparelho só muda `visible` e anima
 * a posição (o atual sai; o novo desliza, gira e pousa): nada é desmontado nem recompilado.
 */
export function ShowroomDevices() {
  const device = useShowroom((s) => s.device)
  const slots = useRef<Partial<Record<DeviceId, THREE.Group | null>>>({})
  const tr = useRef<{ cur: DeviceId; prev: DeviceId | null; t0: number }>({ cur: device, prev: null, t0: now() - 5 })
  if (tr.current.cur !== device) tr.current = { cur: device, prev: tr.current.cur, t0: now() }

  useFrame((_, dt) => {
    const s = useShowroom.getState()
    const on = s.scene === 'showroom'
    easing.damp(explodeAmt, 'v', on && (s.view === 'exploded' || s.view === 'manual') ? 1 : 0, 0.22, dt)
    const { cur, prev, t0 } = tr.current
    const t = reducedMotion() ? 9 : now() - t0
    for (const d of DEVICES) {
      const g = slots.current[d.id]
      if (!g) continue
      if (s.warm) { g.visible = true; g.position.set(0, 0, 0); g.rotation.y = 0; g.scale.setScalar(1); continue }
      if (d.id === cur) {
        const k = easeOut(t / 0.95)
        g.visible = on
        g.position.set((1 - k) * 5.5, Math.sin(k * Math.PI) * 0.5, 0)
        g.rotation.y = (1 - k) * -2.4
        g.scale.setScalar(0.6 + 0.4 * k)
      } else if (d.id === prev && t < 0.62) {
        const o = easeOut(t / 0.6)
        g.visible = on
        g.position.set(-o * 6, 0, 0)
        g.rotation.y = o * 1.5
        g.scale.setScalar(Math.max(0.001, 1 - o))
      } else g.visible = false
    }
  })

  return (
    <>
      {DEVICES.map((d) => {
        const C = DEVICE_COMPONENTS[d.id]
        return (
          <group key={d.id} ref={(g) => { slots.current[d.id] = g; if (g) deviceRoots[d.id] = g; }} visible={false}>
            <C interactive />
          </group>
        )
      })}
    </>
  )
}

/**
 * Aquecimento, atrás da tela de carregamento: por alguns frames os 7 aparelhos ficam visíveis e
 * selecionados (texturas sobem para a GPU; o contorno do hover compila), `gl.compile` fecha os
 * shaders e as caixas de todas as partes são calculadas. Depois disso nenhum clique compila nada.
 */
export function Warmup() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const frames = useRef(0)
  useFrame(() => {
    const s = useShowroom.getState()
    if (s.ready) return
    frames.current++
    if (frames.current === 3) { warmBounds(); gl.compile(scene, camera) }
    if (frames.current === 6) s.set({ warm: false })
    if (frames.current === 9) s.set({ ready: true })
  })
  useEffect(() => { ;(window as unknown as { __gl: unknown }).__gl = gl }, [gl])
  return null
}

/** Camada do showroom que depende da seleção: linhas da vista explodida, pinos, linha-guia e botão segurado. */
export function Showroom() {
  return (
    <>
      <ExplodeLines />
      <ManualPins />
      <PartCallout />
      <HoldDriver />
    </>
  )
}
