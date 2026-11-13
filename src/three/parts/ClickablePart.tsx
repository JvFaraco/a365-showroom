import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import { easing } from 'maath'
import { ACTIONS } from '../../data/actions'
import { getPart } from '../../data/devices'
import { useShowroom } from '../../store/showroomStore'
import { explodeAmt, useDeviceCtx } from '../common/util'
import { FRES_KEY, fresnelPatch } from '../common/materials'
import { registerPart } from '../common/registry'

type Mat = THREE.Material & { opacity: number; emissive?: THREE.Color; emissiveIntensity?: number; isMeshStandardMaterial?: boolean }
type Tracked = { mat: Mat; base: number; baseDepthWrite: boolean; led: boolean; baseEmissive?: THREE.Color; baseEI?: number; fres: { value: number } }

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
export function ClickablePart({ id, follow, internal: internalProp, explode: explodeProp, children }: { id?: string; follow?: string; internal?: boolean; explode?: [number, number, number]; children: ReactNode }) {
  const { deviceId, interactive } = useDeviceCtx()
  const data = getPart(deviceId, id ?? follow)
  const internal = internalProp ?? !!data?.internal
  // carcaças (`follow`) podem ter o próprio deslocamento na vista explodida
  const explode = explodeProp ?? data?.explode
  const group = useRef<THREE.Group>(null!)
  const tracked = useRef<Tracked[]>([])
  const fade = useRef({ v: 1, f: 0, applied: -1, fApplied: -1, sel: false })
  const [hover, setHover] = useState(false)
  // só o aparelho ativo recebe eventos; os outros 6 ficam montados, mas invisíveis e inertes
  const current = useShowroom((s) => interactive && s.scene === 'showroom' && s.device === deviceId)
  const warm = useShowroom((s) => interactive && s.warm)
  useCursor(hover && current)

  // materiais próprios da parte, para esmaecer sem afetar as outras. Ficam sempre "transparent",
  // com opacidade 1: assim esmaecer, Raio-X e voltar ao normal nunca trocam de programa de shader.
  useLayoutEffect(() => {
    const list: Tracked[] = []
    group.current.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || m.userData.fx) return
      const mat = (m.material as THREE.Material).clone() as Mat
      const t: Tracked = {
        mat, base: mat.opacity, baseDepthWrite: mat.depthWrite, led: !!m.userData.led,
        baseEmissive: mat.emissive?.clone(), baseEI: mat.emissiveIntensity, fres: { value: 0 },
      }
      // vale também para os aparelhos das outras cenas: assim todos usam os mesmos programas de shader
      mat.transparent = true
      if (mat.isMeshStandardMaterial) { mat.onBeforeCompile = fresnelPatch.bind(t) as never; mat.customProgramCacheKey = FRES_KEY }
      m.material = mat
      list.push(t)
    })
    tracked.current = list
    const off = interactive ? registerPart(deviceId, { group: group.current, id, explode, internal }) : undefined
    return () => { off?.(); list.forEach((t) => t.mat.dispose()) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    if (!interactive) return
    const g = group.current
    const s = useShowroom.getState()
    const active = s.scene === 'showroom' && s.device === deviceId
    const k = active ? explodeAmt.v : 0
    if (explode) g.position.set(explode[0] * k, explode[1] * k, explode[2] * k)

    let target = 1, fres = 0
    let sel = false
    if (active) {
      // durante uma micro-animação o aparelho inteiro volta a aparecer (salvo as que mostram o interior)
      const showAll = !!s.action && !ACTIONS[s.action.id].keepDim
      if (s.part && !showAll) { sel = !!id && s.part === id; if (!sel) { target = 0.05; fres = 0.1 } }
      else if (s.view === 'xray' && !internal && !showAll) { target = 0.12; fres = 0.9 }
    }
    const f = fade.current
    easing.damp(f, 'v', target, 0.18, dt)
    easing.damp(f, 'f', fres, 0.18, dt)
    if (Math.abs(f.v - f.applied) > 0.004 || Math.abs(f.f - f.fApplied) > 0.004 || sel !== f.sel) {
      f.applied = f.v; f.fApplied = f.f; f.sel = sel
      for (const t of tracked.current) {
        t.mat.opacity = t.base * f.v
        t.mat.depthWrite = t.baseDepthWrite && f.v > 0.5
        t.fres.value = f.f
        if (!t.led && t.mat.emissive && t.baseEmissive) {
          const dark = t.baseEmissive.r + t.baseEmissive.g + t.baseEmissive.b < 0.01
          if (sel && dark) { t.mat.emissive.copy(GLOW); t.mat.emissiveIntensity = 0.03 }
          else { t.mat.emissive.copy(t.baseEmissive); t.mat.emissiveIntensity = t.baseEI ?? 1 }
        }
      }
    }
  })

  const clickable = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const s = useShowroom.getState()
    const open = s.view !== 'normal' || !!getPart(deviceId, s.part)?.internal
    if (internal) return open
    // com o interior à mostra, a parte interna atrás da carcaça tem prioridade
    if (s.view === 'xray' && e.intersections.some((i) => isInternalObject(i.object))) return false
    return true
  }

  const handlers = useMemo(() => (!current || !id ? {} : {
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
  }), [current, id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Select enabled={(hover && current) || (warm && !!id)}>
      <group ref={group} name={id ?? `shell:${follow ?? ''}`} userData={{ partId: id, internalPart: internal && !!id }} {...handlers}>
        {children}
      </group>
    </Select>
  )
}
