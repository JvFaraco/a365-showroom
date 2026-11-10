import * as THREE from 'three'

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
