import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { DEVICE_BY_ID, getPart } from '../../data/devices'
import { useShowroom } from '../../store/showroomStore'
import { explodeAmt } from '../common/util'

/**
 * Linha-guia entre o card de informação (DOM, #part-card) e a parte selecionada (3D).
 * Projeta o ponto da parte na tela a cada frame e move a linha SVG #callout-line.
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
    if (!p || !card || (s.action && s.action.id)) { line.style.opacity = dot.style.opacity = '0'; return }
    const e = p.explode ?? [0, 0, 0], k = explodeAmt.v
    v.set(p.camera.target[0] + e[0] * k, p.camera.target[1] + e[1] * k, p.camera.target[2] + e[2] * k).project(camera)
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

/** Modo Manual: todas as partes com pinos numerados e callouts, como num desenho técnico. */
export function ManualPins() {
  const device = useShowroom((s) => s.device)
  const show = useShowroom((s) => s.scene === 'showroom' && s.view === 'manual' && !s.part)
  if (!show) return null
  const parts = DEVICE_BY_ID[device].parts
  return (
    <>
      {parts.map((p, i) => {
        const e = p.explode ?? [0, 0, 0]
        const left = p.camera.target[0] + e[0] < -0.02 || (Math.abs(p.camera.target[0] + e[0]) <= 0.02 && i % 2 === 1)
        return (
          <Html key={p.id} position={[p.camera.target[0] + e[0], p.camera.target[1] + e[1], p.camera.target[2] + e[2]]} center zIndexRange={[30, 11]}>
            <button className="pin-label group relative block" aria-label={`${i + 1}. ${p.name}`}
              onClick={() => useShowroom.getState().selectPart(p.id)}>
              <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-brand-light text-[11px] font-bold text-white shadow-lg transition group-hover:scale-125 group-hover:bg-accent group-hover:text-ink">{i + 1}</span>
              <span className={`absolute top-1/2 flex -translate-y-1/2 items-center ${left ? 'right-full flex-row-reverse' : 'left-full'}`}>
                <span className="block h-px w-8 bg-white/70" />
                <span className="rounded bg-[#0b1126]/90 px-2 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/15 group-hover:ring-accent">{p.name}</span>
              </span>
            </button>
          </Html>
        )
      })}
    </>
  )
}
