import { useMemo } from 'react'
import * as THREE from 'three'
import { M } from './materials'

/**
 * Logo Orsegups em baixo-relevo: um círculo com um "swoosh" curvo em volta.
 * Fica no plano XY, virado para +Z. `r` é o raio do círculo.
 */
export function LogoRelief({ r = 0.3, material = M.whiteRelief, depth = 0.012, ...props }: { r?: number; material?: THREE.Material; depth?: number } & JSX.IntrinsicElements['group']) {
  const geos = useMemo(() => {
    const ring = new THREE.Shape()
    ring.absarc(0, 0, r, 0, Math.PI * 2, false)
    const hole = new THREE.Path()
    hole.absarc(0, 0, r * 0.8, 0, Math.PI * 2, true)
    ring.holes.push(hole)
    // swoosh: crescente que nasce à esquerda, passa por cima e afina à direita
    const sw = new THREE.Shape()
    const a0 = Math.PI * 1.05, a1 = -Math.PI * 0.42
    const N = 28
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = a0 + (a1 - a0) * t
      const rr = r * (1.38 - 0.04 * t)
      const p = [Math.cos(a) * rr - r * 0.02, Math.sin(a) * rr + r * 0.04]
      i === 0 ? sw.moveTo(p[0], p[1]) : sw.lineTo(p[0], p[1])
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, a = a0 + (a1 - a0) * t
      const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.2 + 0.015
      const rr = r * (1.38 - 0.04 * t - w)
      sw.lineTo(Math.cos(a) * rr - r * 0.02, Math.sin(a) * rr + r * 0.04)
    }
    const o = { depth, bevelEnabled: false, curveSegments: 40 }
    return [new THREE.ExtrudeGeometry(ring, o), new THREE.ExtrudeGeometry(sw, o)]
  }, [r, depth])
  return (
    <group {...props}>
      <mesh geometry={geos[0]} material={material} />
      <mesh geometry={geos[1]} material={material} />
    </group>
  )
}

let grooveGeos: THREE.BufferGeometry[] | null = null
function logoGrooveGeometries() {
  if (grooveGeos) return grooveGeos
  const W = 0.02 // largura do sulco, para raio 1
  const circle = (r: number, cx = 0, cy = 0) => {
    const g = new THREE.TorusGeometry(r, W, 6, 96)
    g.translate(cx, cy, 0)
    return g
  }
  // crescente: nasce em ponta no alto à esquerda, passa por cima e desce pela direita
  const pts: THREE.Vector3[] = []
  const a0 = (152 * Math.PI) / 180, a1 = (-78 * Math.PI) / 180, K = 40
  for (let i = 0; i <= K; i++) { const a = a0 + ((a1 - a0) * i) / K; pts.push(new THREE.Vector3(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0)) }
  for (let i = K; i >= 0; i--) {
    const t = i / K, a = a0 + (a1 - a0) * t
    const w = 0.02 + 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25)), 0.9)
    pts.push(new THREE.Vector3(Math.cos(a) * (0.9 - w), Math.sin(a) * (0.9 - w), 0))
  }
  const crescent = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.2), 200, W, 6, true)
  grooveGeos = [circle(1), circle(0.56, -0.1, -0.08), crescent]
  for (const g of grooveGeos) g.scale(1, 1, 0.35)
  return grooveGeos
}

/**
 * Logo Orsegups feito só com sulcos finos, sem relevo alto e sem cor: um círculo, o círculo interno
 * e o arco em crescente. Aparece pela luz e pela sombra. Plano XY, virado para +Z; `r` = raio externo.
 */
export function LogoGroove({ r = 0.3, material = M.logoGroove, ...props }: { r?: number; material?: THREE.Material } & JSX.IntrinsicElements['group']) {
  const geos = logoGrooveGeometries()
  return (
    <group {...props}>
      <group scale={r}>
        {geos.map((g, i) => <mesh key={i} geometry={g} material={material} />)}
      </group>
    </group>
  )
}

/** Logo da placa em canvas 2D: anel grosso com o "swoosh" recortado na cor do fundo. */
export function logoPath2D(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, cut = '#1E398D') {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.arc(cx - r * 0.02, cy + r * 0.03, r * 0.6, 0, Math.PI * 2, true)
  ctx.fill('evenodd')
  // swoosh: crescente que entra pela esquerda, passa por cima e afina à direita
  ctx.fillStyle = cut
  ctx.beginPath()
  const N = 40, a0 = Math.PI * 1.08, a1 = Math.PI * 1.95
  for (let i = 0; i <= N; i++) { const a = a0 + ((a1 - a0) * i) / N; ctx.lineTo(cx + r * 0.16 + Math.cos(a) * r * 0.98, cy + r * 0.3 + Math.sin(a) * r * 0.98) }
  for (let i = N; i >= 0; i--) { const t = i / N, a = a0 + (a1 - a0) * t; const w = 0.02 + 0.075 * Math.sin(Math.PI * Math.min(1, t * 1.6)); ctx.lineTo(cx + r * 0.16 + Math.cos(a) * r * (0.98 - w), cy + r * 0.3 + Math.sin(a) * r * (0.98 - w)) }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
