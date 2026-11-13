import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { DEVICE_BY_ID, getPart } from '../../data/devices'
import { useShowroom } from '../../store/showroomStore'
import { explodeAmt } from '../common/util'
import { partCenter } from '../common/registry'

/**
 * Linha-guia entre o card de informação (DOM, #part-card) e a parte selecionada (3D).
 * Projeta o centro da parte na tela a cada frame e move a linha SVG #callout-line.
 */
export function PartCallout() {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const line = document.getElementById('callout-line') as SVGLineElement | null
    const dot = document.getElementById('callout-dot') as SVGCircleElement | null
    if (!line || !dot) return
    const s = useShowroom.getState()
    const p = s.scene === 'showroom' ? getPart(s.device, s.part) : undefined
    const card = document.getElementById('part-card')
    if (!p || !card || s.action) { line.style.opacity = dot.style.opacity = '0'; return }
    partCenter(s.device, p.id, explodeAmt.v, v).project(camera)
    const x = (v.x * 0.5 + 0.5) * size.width, y = (-v.y * 0.5 + 0.5) * size.height
    const r = card.getBoundingClientRect()
    const desktop = size.width >= 768
    const cx = desktop ? r.left : r.left + r.width / 2
    const cy = desktop ? Math.min(Math.max(y, r.top + 24), r.bottom - 24) : r.top
    line.setAttribute('x1', String(x)); line.setAttribute('y1', String(y))
    line.setAttribute('x2', String(cx)); line.setAttribute('y2', String(cy))
    dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y))
    line.style.opacity = dot.style.opacity = v.z < 1 ? '1' : '0'
  })
  return null
}

const NUDGE = new THREE.Vector3(), P = new THREE.Vector3()
const DOT_GAP = 30, TAG_GAP = 26, COL_GAP = 34
type Pin = { x: number; y: number; ax: number; ay: number; on: boolean; ty: number }

/**
 * Modo Manual: posiciona os pinos numerados e os nomes da camada 2D (ui/ManualLayer). Projeta o
 * centro de cada parte na tela, afasta os pinos que cairiam um em cima do outro e empilha os nomes
 * em duas colunas ao lado do aparelho. Só recalcula quando a câmera ou a tela mudam; nada de estado
 * do React por frame.
 */
export function ManualPins() {
  const last = useRef({ key: '', layer: null as HTMLElement | null })
  const pins = useRef<Pin[]>([])
  useFrame(({ camera, size }) => {
    const layer = document.getElementById('manual-layer')
    if (!layer) { last.current.layer = null; return }
    const s = useShowroom.getState()
    const parts = DEVICE_BY_ID[s.device].parts
    const e = camera.matrixWorld.elements
    const key = `${s.device}|${size.width}x${size.height}|${explodeAmt.v.toFixed(3)}|${e[12].toFixed(3)},${e[13].toFixed(3)},${e[14].toFixed(3)},${e[0].toFixed(4)},${e[5].toFixed(4)},${e[10].toFixed(4)},${(camera as THREE.PerspectiveCamera).projectionMatrix.elements[12].toFixed(4)},${(camera as THREE.PerspectiveCamera).projectionMatrix.elements[13].toFixed(4)}`
    if (last.current.layer === layer && last.current.key === key) return
    last.current = { key, layer }
    const dots = layer.querySelectorAll<HTMLElement>('[data-dot]')
    const tags = layer.querySelectorAll<HTMLElement>('[data-tag]')
    const lines = layer.querySelectorAll<SVGLineElement>('[data-line]')
    if (dots.length !== parts.length) return
    const list = pins.current
    list.length = parts.length
    parts.forEach((p, i) => {
      partCenter(s.device, p.id, explodeAmt.v, P)
      if (p.pin) P.add(NUDGE.fromArray(p.pin))
      P.project(camera)
      const x = (P.x * 0.5 + 0.5) * size.width, y = (-P.y * 0.5 + 0.5) * size.height
      list[i] = { x, y, ax: x, ay: y, on: P.z < 1, ty: y }
    })
    // 1) pinos: afasta os pares que ficariam sobrepostos
    for (let it = 0; it < 6; it++) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]
        let dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy)
        if (d >= DOT_GAP) continue
        if (d < 0.01) { dx = 1; dy = j % 2 ? 0.6 : -0.6 }
        const n = Math.hypot(dx, dy), push = (DOT_GAP - d) / 2
        a.x -= (dx / n) * push; a.y -= (dy / n) * push
        b.x += (dx / n) * push; b.y += (dy / n) * push
      }
    }
    // 2) nomes: duas colunas fora do aparelho, sem sobreposição vertical
    let minX = Infinity, maxX = -Infinity
    for (const p of list) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x) }
    const mid = (minX + maxX) / 2
    const wide = size.width >= 768
    const colL = Math.max(minX - COL_GAP, 150), colR = Math.min(maxX + COL_GAP, size.width - 150)
    for (const side of [-1, 1]) {
      const col = list.map((p, i) => ({ p, i })).filter(({ p, i }) => (p.x < mid - 1 || (Math.abs(p.x - mid) <= 1 && i % 2 === 1) ? -1 : 1) === side).sort((a, b) => a.p.y - b.p.y)
      let shift = 0
      col.forEach(({ p }, k) => { p.ty = k ? Math.max(p.y, col[k - 1].p.ty + TAG_GAP) : p.y; shift += p.ty - p.y })
      shift = col.length ? shift / col.length : 0
      for (const { p, i } of col) {
        p.ty -= shift
        const cx = side < 0 ? colL : colR
        const tag = tags[i], line = lines[i]
        tag.style.transform = `translate(${cx.toFixed(1)}px, ${p.ty.toFixed(1)}px) translate(${side < 0 ? '-100%' : '0'}, -50%)`
        tag.style.opacity = p.on && wide ? '1' : '0'
        line.setAttribute('x1', p.x.toFixed(1)); line.setAttribute('y1', p.y.toFixed(1))
        line.setAttribute('x2', (cx - side * 3).toFixed(1)); line.setAttribute('y2', p.ty.toFixed(1))
        line.style.opacity = p.on ? '1' : '0'
      }
    }
    list.forEach((p, i) => {
      dots[i].style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`
      dots[i].style.opacity = p.on ? '1' : '0'
    })
  })
  return null
}
