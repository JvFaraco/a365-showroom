import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Um bloquinho: [x, y, z, tamanho em x, em y, em z]. */
export type Block = [number, number, number, number, number, number]
/** Vários bloquinhos numa malha só (os componentes pequenos de uma placa, por cor): uma chamada de desenho. */
export function boxesGeometry(items: Block[]) {
  return mergeGeometries(items.map(([x, y, z, w, h, d]) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g }))
}

/** Sólido em forma de "estádio" (retângulo com pontas redondas), no plano XY, extrudado em +Z. */
export function stadiumGeometry(w: number, h: number, depth: number, bevel = 0.012) {
  const r = Math.min(w, h) / 2
  const s = new THREE.Shape()
  if (h >= w) {
    const y = h / 2 - r
    s.absarc(0, y, r, 0, Math.PI, false)
    s.absarc(0, -y, r, Math.PI, Math.PI * 2, false)
  } else {
    const x = w / 2 - r
    s.absarc(x, 0, r, -Math.PI / 2, Math.PI / 2, false)
    s.absarc(-x, 0, r, Math.PI / 2, Math.PI * 1.5, false)
  }
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 24 })
}

/** Setor de anel (botões em cruz do controle), no plano XY, extrudado em +Z. */
export function ringSectorGeometry(r0: number, r1: number, a0: number, a1: number, depth: number, bevel = 0.012) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r1, a0, a1, false)
  s.absarc(0, 0, r0, a1, a0, true)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 24 })
}

/** Retângulo de cantos redondos no plano XY, extrudado em +Z (centrado em Z). */
export function roundedRectGeometry(w: number, h: number, r: number, depth: number, bevel = 0.01) {
  const s = new THREE.Shape()
  const x = w / 2 - r, y = h / 2 - r
  s.absarc(x, y, r, 0, Math.PI / 2, false)
  s.absarc(-x, y, r, Math.PI / 2, Math.PI, false)
  s.absarc(-x, -y, r, Math.PI, Math.PI * 1.5, false)
  s.absarc(x, -y, r, Math.PI * 1.5, Math.PI * 2, false)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 16 })
  g.translate(0, 0, -depth / 2)
  return g
}

/** Sólido de revolução em torno do eixo Z (perfil dado como [raio, z]). */
export function latheZ(profile: [number, number][], segments = 72) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), segments)
  g.rotateX(Math.PI / 2)
  return g
}

/** Sólido de revolução em torno de Y, com o perfil suavizado por uma curva (nada de cilindro cru). */
export function smoothLatheY(profile: [number, number][], segments = 96, samples = 40) {
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)))
  return new THREE.LatheGeometry(curve.getPoints(samples), segments)
}

/** Igual, em torno de Z (perfil [raio, z]). */
export function smoothLatheZ(profile: [number, number][], segments = 96, samples = 40) {
  const g = smoothLatheY(profile, segments, samples)
  g.rotateX(Math.PI / 2)
  return g
}

/** Cabo ou fio com curva suave. */
export function wire(points: [number, number, number][], radius = 0.01, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed)
  return new THREE.TubeGeometry(curve, Math.max(16, points.length * 10), radius, 6, closed)
}

/** Aro em forma de estádio (contorno de cápsula), no plano XY, extrudado em +Z. */
export function stadiumRingGeometry(w: number, h: number, t: number, depth: number, bevel = 0.003) {
  const path = (ww: number, hh: number, target: THREE.Shape | THREE.Path, hole: boolean) => {
    const r = Math.min(ww, hh) / 2, x = ww / 2 - r
    if (!hole) { target.absarc(x, 0, r, -Math.PI / 2, Math.PI / 2, false); target.absarc(-x, 0, r, Math.PI / 2, Math.PI * 1.5, false) }
    else { target.absarc(-x, 0, r, Math.PI * 1.5, Math.PI / 2, true); target.absarc(x, 0, r, Math.PI / 2, -Math.PI / 2, true) }
    target.closePath()
  }
  const s = new THREE.Shape(); path(w, h, s, false)
  const hpath = new THREE.Path(); path(w - 2 * t, h - 2 * t, hpath, true)
  s.holes.push(hpath)
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 24 })
}
