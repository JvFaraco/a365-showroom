import { useMemo } from 'react'
import * as THREE from 'three'
import { M } from './materials'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LOGO_RING, logoCut } from './logoShape'

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

let grooveGeo: THREE.BufferGeometry | null = null
/**
 * Sulcos do logo da marca (mesmo desenho da placa: `LOGO_RING` e `logoCut`), para raio de fora 1, y para cima. Os
 * sulcos seguem só a borda do desenho: o círculo de fora e o do miolo onde o corte não passa, e o contorno do corte
 * onde ele fica sobre o anel. Tudo numa geometria só.
 */
function logoGrooveGeometry() {
  if (grooveGeo) return grooveGeo
  const W = 0.02 // largura do sulco, para raio 1
  const STEP = 0.01 // passo da amostragem das bordas
  type P = [number, number]
  // logoCut está em coordenadas de tela (y para baixo): inverte o y
  const cut: P[] = logoCut(0, 0, 1).map(([x, y]) => [x, -y])
  const o: P = [LOGO_RING.outer[0], -LOGO_RING.outer[1]], h: P = [LOGO_RING.hole[0], -LOGO_RING.hole[1]]
  const inCut = ([x, y]: P) => {
    let inside = false
    for (let i = 0, j = cut.length - 1; i < cut.length; j = i++) {
      const [xi, yi] = cut[i], [xj, yj] = cut[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  const dist = ([x, y]: P, [cx, cy]: P) => Math.hypot(x - cx, y - cy)
  const onRing = (p: P) => dist(p, o) < 1 && dist(p, h) > LOGO_RING.holeR
  const circle = ([cx, cy]: P, r: number): P[] => {
    const n = Math.ceil((2 * Math.PI * r) / STEP)
    return Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r] as P)
  }
  const loop: P[] = [] // contorno do corte, fechado, com pontos a cada STEP
  cut.forEach((a, i) => {
    const b = cut[(i + 1) % cut.length], n = Math.max(1, Math.ceil(dist(a, b) / STEP))
    for (let k = 0; k < n; k++) loop.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  })
  // trechos de um contorno fechado em que `keep` vale; cada trecho leva um ponto a mais em cada ponta, até a borda
  const runs = (pts: P[], keep: (p: P) => boolean) => {
    const ok = pts.map(keep), n = pts.length, out: P[][] = []
    const s0 = ok.indexOf(false)
    if (s0 < 0) return [[...pts, pts[0]]]
    let cur: P[] | null = null
    for (let k = 1; k <= n; k++) {
      const i = (s0 + k) % n
      if (ok[i]) { if (!cur) cur = [pts[(i - 1 + n) % n]]; cur.push(pts[i]) }
      else if (cur) { cur.push(pts[i]); out.push(cur); cur = null }
    }
    return out
  }
  const paths = [...runs(circle(o, 1), (p) => !inCut(p)), ...runs(circle(h, LOGO_RING.holeR), (p) => !inCut(p)), ...runs(loop, onRing)]
  const geos = paths.filter((p) => p.length > 1).map((p) => {
    const curve = new THREE.CatmullRomCurve3(p.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal')
    return new THREE.TubeGeometry(curve, Math.max(4, Math.round(curve.getLength() / 0.025)), W, 6, false)
  })
  grooveGeo = mergeGeometries(geos)
  geos.forEach((g) => g.dispose())
  grooveGeo.scale(1, 1, 0.35)
  return grooveGeo
}

/**
 * Logo Orsegups feito só com sulcos finos, sem relevo alto e sem cor, no desenho da marca: o anel, o miolo e o corte
 * em curva. Aparece pela luz e pela sombra. Plano XY, virado para +Z; `r` = raio externo. `curve` dobra os sulcos
 * para acompanhar uma face curva: somam `curve · (x² + y²)` ao z (em unidades da cena).
 */
export function LogoGroove({ r = 0.3, material = M.logoLight, curve = 0, ...props }: { r?: number; material?: THREE.Material; curve?: number } & JSX.IntrinsicElements['group']) {
  const geo = useMemo(() => {
    const base = logoGrooveGeometry()
    if (!curve) return base
    const g = base.clone(), p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + curve * r * (p.getX(i) ** 2 + p.getY(i) ** 2))
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }, [r, curve])
  return (
    <group {...props}>
      <group scale={r}>
        <mesh geometry={geo} material={material} />
      </group>
    </group>
  )
}

/**
 * Logo da placa em canvas 2D: o anel de dentro e o braço de fora, separados pelo corte na cor do fundo (ver
 * `logoShape`). `r` é o raio de fora.
 */
export function logoPath2D(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, cut = '#1E398D') {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx + r * LOGO_RING.outer[0], cy + r * LOGO_RING.outer[1], r, 0, Math.PI * 2)
  ctx.arc(cx + r * LOGO_RING.hole[0], cy + r * LOGO_RING.hole[1], r * LOGO_RING.holeR, 0, Math.PI * 2, true)
  ctx.fill('evenodd')
  ctx.fillStyle = cut
  ctx.beginPath()
  logoCut(cx, cy, r).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
