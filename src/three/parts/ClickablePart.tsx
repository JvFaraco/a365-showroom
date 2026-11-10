import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import { easing } from 'maath'
import { ACTIONS } from '../../data/actions'
import { DEVICE_BY_ID, getPart } from '../../data/devices'
import { useShowroom } from '../../store/showroomStore'
import { explodeAmt, useDeviceCtx } from '../common/util'

type Tracked = { mat: THREE.Material & { opacity: number; emissive?: THREE.Color; emissiveIntensity?: number }; base: number; baseTransparent: boolean; baseDepthWrite: boolean; led: boolean; baseEmissive?: THREE.Color; baseEI?: number }

const GLOW = new THREE.Color('#2f66ff')

function isInternalObject(o: THREE.Object3D | null) {
  for (; o; o = o.parent) if (o.userData.internalPart) return true
  return false
}

/**
 * Envolve uma parte do aparelho: hover (contorno + cursor), clique (seleção), esmaecer quando
 * outra parte está selecionada, translucidez no Raio-X e deslocamento na vista explodida.
 * Sem `id` e com `follow`, é carcaça não clicável que acompanha a parte `follow`.
 * Na troca por .glb, basta envolver o nó de mesmo nome com este componente.
 */
export function ClickablePart({ id, follow, internal: internalProp, children }: { id?: string; follow?: string; internal?: boolean; children: ReactNode }) {
  const { deviceId, interactive } = useDeviceCtx()
  const data = getPart(deviceId, id ?? follow)
  const internal = internalProp ?? !!data?.internal
  const explode = data?.explode
  const group = useRef<THREE.Group>(null!)
  const tracked = useRef<Tracked[]>([])
  const fade = useRef({ v: 1, applied: -1, sel: false })
  const [hover, setHover] = useState(false)
  useCursor(hover)

  // materiais próprios da parte, para esmaecer sem afetar as outras
  useLayoutEffect(() => {
    const list: Tracked[] = []
    group.current.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || m.userData.fx) return
      const mat = (m.material as THREE.Material).clone() as Tracked['mat']
      m.material = mat
      list.push({
        mat, base: mat.opacity, baseTransparent: mat.transparent, baseDepthWrite: mat.depthWrite, led: !!m.userData.led,
        baseEmissive: mat.emissive?.clone(), baseEI: mat.emissiveIntensity,
      })
    })
    tracked.current = list
    return () => list.forEach((t) => t.mat.dispose())
  }, [])

  useFrame((_, dt) => {
    const g = group.current
    const s = useShowroom.getState()
    const active = interactive && s.scene === 'showroom' && s.device === deviceId
    const k = active ? explodeAmt.v : 0
    if (explode) g.position.set(explode[0] * k, explode[1] * k, explode[2] * k)

    let target = 1
    let sel = false
    if (active) {
      // durante uma micro-animação o aparelho inteiro volta a aparecer (salvo as que mostram o interior)
      const showAll = !!s.action && !ACTIONS[s.action.id].keepDim
      if (s.part && !showAll) { sel = !!id && s.part === id; target = sel ? 1 : 0.1 }
      else if (s.view === 'xray' && !internal) target = 0.16
    }
    const f = fade.current
    easing.damp(f, 'v', target, 0.18, dt)
    if (Math.abs(f.v - f.applied) > 0.004 || sel !== f.sel) {
      f.applied = f.v; f.sel = sel
      for (const t of tracked.current) {
        const o = t.base * f.v
        t.mat.opacity = o
        const tr = t.baseTransparent || f.v < 0.985
        if (t.mat.transparent !== tr) { t.mat.transparent = tr; t.mat.needsUpdate = true }
        t.mat.depthWrite = t.baseDepthWrite && f.v > 0.5
        if (!t.led && t.mat.emissive && t.baseEmissive) {
          if (sel) { const dark = t.baseEmissive.r + t.baseEmissive.g + t.baseEmissive.b < 0.01
            if (dark) { t.mat.emissive.copy(GLOW); t.mat.emissiveIntensity = 0.03 } }
          else { t.mat.emissive.copy(t.baseEmissive); t.mat.emissiveIntensity = t.baseEI ?? 1 }
        }
      }
    }
  })

  const clickable = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!interactive || !id) return false
    const s = useShowroom.getState()
    if (s.scene !== 'showroom') return false
    const open = s.view !== 'normal' || !!getPart(deviceId, s.part)?.internal
    if (internal) return open
    // com o interior à mostra, a parte interna atrás da carcaça tem prioridade
    if (s.view === 'xray' && e.intersections.some((i) => isInternalObject(i.object))) return false
    return true
  }

  const handlers = useMemo(() => (!interactive || !id ? {} : {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      if (!clickable(e)) return
      e.stopPropagation(); setHover(true); useShowroom.getState().setHovered(id)
    },
    onPointerOut: () => {
      setHover(false)
      const s = useShowroom.getState()
      if (s.hovered === id) s.setHovered(null)
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6 || !clickable(e)) return
      e.stopPropagation()
      const s = useShowroom.getState()
      if (s.part !== id) s.selectPart(id)
    },
  }), [interactive, id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Select enabled={hover}>
      <group ref={group} name={id ?? `shell:${follow ?? ''}`} userData={{ partId: id, internalPart: internal && !!id }} {...handlers}>
        {children}
      </group>
    </Select>
  )
}

export const partCount = (deviceId: keyof typeof DEVICE_BY_ID) => DEVICE_BY_ID[deviceId].parts.length
