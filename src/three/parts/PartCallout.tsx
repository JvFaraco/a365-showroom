import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
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

/** Modo Manual: todas as partes com pinos numerados e callouts, como num desenho técnico. */
export function ManualPins() {
  const device = useShowroom((s) => s.device)
  const show = useShowroom((s) => s.scene === 'showroom' && s.view === 'manual' && !s.part && s.ready)
  if (!show) return null
  const parts = DEVICE_BY_ID[device].parts
  return (
    <>
      {parts.map((p, i) => {
        const c = partCenter(device, p.id, 1, new THREE.Vector3())
        const left = c.x < -0.02 || (Math.abs(c.x) <= 0.02 && i % 2 === 1)
        return (
          <Html key={p.id} position={c} center zIndexRange={[30, 11]}>
            <button className="pin-label group relative block" aria-label={`${i + 1}. ${p.name}`}
              onClick={() => useShowroom.getState().selectPart(p.id)}>
              <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-brand-light text-xs font-bold text-white shadow-lg transition group-hover:scale-125 group-hover:bg-accent group-hover:text-ink">{i + 1}</span>
              <span className={`absolute top-1/2 flex -translate-y-1/2 items-center ${left ? 'right-full flex-row-reverse' : 'left-full'}`}>
                <span className="block h-px w-8 bg-white/70" />
                <span className="rounded bg-surface/90 px-2 py-0.5 text-xs font-medium text-white ring-1 ring-white/15 group-hover:ring-accent">{p.name}</span>
              </span>
            </button>
          </Html>
        )
      })}
    </>
  )
}
