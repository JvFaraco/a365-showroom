import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { polaroidTexture } from '../common/textures'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { stadiumGeometry } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { DetectionFan, LowPolyDog, LowPolyPerson } from '../fx/DetectionFan'
import { CameraFlash } from '../fx/CameraFlash'
import { REF_ON } from '../../dev/RefMode'

// ---------- medidas (frente em +Z). Corpo de 68 mm de largura e 137 de altura; a planta fecha um círculo: é tão
// funda quanto larga (68 mm). Com a base cinza (7 mm), 144 de altura. 1 unidade = 79 mm (a meia largura é 0,43). ----------
const mm = (v: number) => v / 79.07
const HW = 0.43, HD = HW // meia largura e meia profundidade: iguais
// planta: a frente é um meio-cilindro de raio 34 mm (a largura inteira); a traseira fecha a volta com cantos
// largos (~22 mm) e só um trecho quase reto no meio, onde fica a tampa das pilhas
const RC = HW, RB = mm(22)
const Y_TOP = 0.8, TOP_R = mm(10) // o topo desce para a traseira e as laterais em curva (~10 mm)
const Y0 = Y_TOP - mm(144) // fundo do aparelho (a altura h da ficha é medida a partir daqui)
const H = (h: number) => Y0 + mm(h)
const Y_BASE = H(7) // acima disto é corpo branco; abaixo, a base cinza
// compartimento das pilhas, na traseira: tampa de ~54 × 76 mm, de h ≈ 64 a 140
// a tampa (~54 mm) encaixa DENTRO de um aro do próprio corpo: sobra corpo branco dos lados e em cima
const BAY = { y0: H(64), y1: 0.645, hw: mm(24.5), floor: HD - 0.27 }
// pilha AA (50,5 × 14,5 mm): cilindro de ponta reta com o polo + saliente
const CELL = { r: mm(7.25), len: mm(50.5), y: (H(64) + 0.645) / 2, s: HD - 0.16 }
const CELL_X = [-0.193, 0, 0.193]
// ---------- Frente (pelas fotos na mão e de estúdio e pelo vídeo de fábrica da casca da frente) ----------
// Lente PIR: painel fosco grande (~53 × 42 mm, ~79% da largura), curvo como o corpo e ~3 mm para dentro dele. Em
// volta, a moldura: prateleira inclinada em cima, chanfros finos dos lados e, embaixo, o queixo, que volta em
// rampa até a borda de baixo (é onde fica o logo). O funil que leva até o sensor fica POR DENTRO, atrás da lente.
const LENS = { hw: mm(26.8), y0: H(31), y1: H(73), depth: mm(3), ledge: mm(6), bevel: mm(3), gap: mm(0.8), chin: H(12) }
// Câmera e LED: ficam num REBAIXO (uma curva para dentro do corpo), não numa peça saliente. O bolso tem forma de
// pera alongada (um pouco mais largo embaixo), paredes arredondadas e o fundo inclinado: raso em cima e mais
// fundo embaixo, de modo que a lente olha um pouco para baixo. A parede de baixo termina na prateleira da lente PIR.
const CAM = { y0: H(80), y1: H(130), rB: mm(15), rT: mm(11.5), d0: mm(2), d1: mm(10), wall: mm(4.5) }
/** Profundidade do fundo do bolso na altura y. */
const camFloor = (y: number) => CAM.d0 + (CAM.d1 - CAM.d0) * Math.min(1, Math.max(0, (CAM.y1 - y) / (CAM.y1 - CAM.y0)))
const CAM_TILT = Math.atan((CAM.d1 - CAM.d0) / (CAM.y1 - CAM.y0)) // inclinação do fundo (a normal aponta para a frente e para baixo)
/** Distância para dentro do contorno do bolso (positiva dentro): cápsula de raios diferentes em cima e embaixo. */
function camInside(x: number, y: number) {
  const px = Math.abs(x), py = y - (CAM.y0 + CAM.rB), h = CAM.y1 - CAM.rT - (CAM.y0 + CAM.rB)
  const b = (CAM.rB - CAM.rT) / h, a = Math.sqrt(1 - b * b), k = -px * b + py * a
  if (k < 0) return CAM.rB - Math.hypot(px, py)
  if (k > a * h) return CAM.rT - Math.hypot(px, py - h)
  return CAM.rB - (px * a + py * b)
}
const LENS_Y = H(116.5), LEDWIN_Y = H(99) // lente no alto do bolso; janela do LED no meio
const camAt = (y: number): [number, number, number] => [0, y, HD - camFloor(y)]
const CAM_ROT: [number, number, number] = [CAM_TILT, 0, 0]
// Capuz: rebaixo raso e suave em volta do bolso, com o alto em arco (mais largo que o bolso).
const HOOD = { top: H(133.5), hw: mm(18.6), deep: mm(2.6), shallow: mm(0.8) }
const LOGO_Y = H(19), LOGO_R = mm(5.6)
// placa de fixação na parede (cinza): ~31 × 67 mm, de h = 0 a 68, ~11 mm de espessura
const WALL = { hw: mm(15.5), top: H(67), plate: 0.045, rail: 0.085 }
const HINGE: [number, number, number] = [0, Y0, -(HD + 0.08)] // eixo horizontal no pé da placa: é ali que o sensor inclina
const UP = 0.22 // na vista explodida tudo sobe um pouco e a base cinza fica embaixo (é como ela "desce" sem entrar no pedestal)
const FAN_Y = Y0 - 0.01 // altura do chão da cena do PIR
const personX = (t: number) => -3.4 + seg(t, 2.5, 6.5) * 6.8
const dogX = (t: number) => -3.4 + seg(t, 8, 12) * 6.8
const PERSON_Z = 2.5

/** Profundidade do contorno na posição x: para trás (cantos de raio RB) e para a frente (raio RC). */
const sBack = (x: number) => { const d = Math.abs(x) - (HW - RB); return d <= 0 ? HD : HD - RB + Math.sqrt(Math.max(0, RB * RB - d * d)) }
const sFront = (x: number) => { const d = Math.abs(x) - (HW - RC); return d <= 0 ? HD : HD - RC + Math.sqrt(Math.max(0, RC * RC - d * d)) }
/** Geometria extrudada no plano (x, s = −z) e posta de pé: a extrusão vira a altura. */
const upright = (g: THREE.BufferGeometry, y = 0) => { g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g }

/** Contorno do corpo visto de cima (x, s = −z), encolhido em `inset`: frente de raio RC, traseira de raio RB. */
function outline(inset: number) {
  const sh = new THREE.Shape()
  sh.absarc(HW - RB, HD - RB, RB - inset, 0, Math.PI / 2, false)
  sh.absarc(-(HW - RB), HD - RB, RB - inset, Math.PI / 2, Math.PI, false)
  sh.absarc(-(HW - RC), -(HD - RC), RC - inset, Math.PI, Math.PI * 1.5, false)
  sh.absarc(HW - RC, -(HD - RC), RC - inset, Math.PI * 1.5, Math.PI * 2, false)
  sh.closePath()
  return sh
}
/** Faixa que acompanha a curva da traseira entre x0 e x1 (tampa das pilhas, frisos). */
function backBand(x0: number, x1: number, height: number, proud: number, thick: number) {
  const sh = new THREE.Shape(), N = 24
  for (let i = 0; i <= N; i++) { const x = x0 + ((x1 - x0) * i) / N; i ? sh.lineTo(x, sBack(x) + proud) : sh.moveTo(x, sBack(x) + proud) }
  for (let i = N; i >= 0; i--) { const x = x0 + ((x1 - x0) * i) / N; sh.lineTo(x, sBack(x) + proud - thick) }
  sh.closePath()
  return new THREE.ExtrudeGeometry(sh, { depth: height, bevelEnabled: false })
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
/** Quanto a moldura da lente PIR afunda o corpo no ponto (x, y): 0 fora dela, LENS.depth no plano da lente. */
function lensRecess(x: number, y: number) {
  const top = 1 - smooth(LENS.y1 + LENS.gap, LENS.y1 + LENS.ledge, y) // prateleira inclinada, em cima
  const bot = Math.min(1, Math.max(0, (y - LENS.chin) / (LENS.y0 - LENS.gap - LENS.chin))) // queixo: rampa até a borda de baixo
  // dos lados: chanfro fino; no queixo, os vincos abrem até a largura do corpo
  const hw = LENS.hw + LENS.gap + LENS.bevel + (HW - LENS.hw - LENS.gap - LENS.bevel) * 0.9 * (1 - bot)
  return top * bot * smooth(0, LENS.bevel, hw - Math.abs(x)) * LENS.depth
}

/**
 * Frente escavada: devolve o z do ponto (x, y) depois dos rebaixos, que acompanham a curva do corpo: o capuz
 * (concha rasa em arco), o bolso da câmera e do LED dentro dele e a moldura rasa onde assenta a lente PIR.
 */
function frontCut(x: number, y: number, z: number) {
  const ax = Math.abs(x)
  const yArc = HOOD.top - HOOD.hw, yLedge = LENS.y1 + LENS.ledge
  // abaixo do arco os lados descem retos e, perto da prateleira, abrem até a largura dela
  const hw = HOOD.hw + (LENS.hw + LENS.bevel - HOOD.hw) * smooth(yLedge + mm(14), yLedge, y)
  const side = y >= yArc ? HOOD.hw - Math.hypot(ax, y - yArc) : hw - ax
  const deep = HOOD.shallow + (HOOD.deep - HOOD.shallow) * smooth(H(98), H(120), y)
  const hood = y > LENS.y1 + mm(2) ? smooth(0, mm(5), side) * deep : 0
  const cam = smooth(0, CAM.wall, camInside(x, y)) * camFloor(y)
  return z - Math.max(hood, cam, lensRecess(x, y))
}

/**
 * Casca do corpo: superfície paramétrica (volta do contorno × altura), com a borda do topo arredondada,
 * o lábio da base, o capuz e o rebaixo da frente escavados (com fundo e paredes de verdade) e o
 * compartimento das pilhas aberto atrás. Sai em duas metades (frente e corpo traseiro), que se separam
 * na vista explodida.
 */
function shellGeometry() {
  const ex = HW - RC, ez = HD - RC, bx = HW - RB, bz = HD - RB
  type Col = { cx: number; cz: number; nx: number; nz: number; r: number; bay: boolean; front: boolean }
  const cols: Col[] = []
  // cx vem em "fração" da meia largura do esqueleto (−1..1); frente usa RC, trás usa RB
  const col = (phi: number, fx: number, bay: boolean) => {
    const front = Math.sin(phi) > 1e-9 || (Math.abs(Math.sin(phi)) <= 1e-9 && frontSide)
    cols.push({ cx: fx * (front ? ex : bx), cz: front ? ez : -bz, nx: Math.cos(phi), nz: Math.sin(phi), r: front ? RC : RB, bay, front })
  }
  let frontSide = true
  const A = 48, C4 = 16, K = 12
  // frente: meio-cilindro (dois quartos de volta)
  for (let i = 0; i <= A; i++) col((i / A) * (Math.PI / 2), 1, false)
  for (let i = 0; i <= A; i++) col(Math.PI / 2 + (i / A) * (Math.PI / 2), -1, false)
  frontSide = false
  // traseira: o compartimento das pilhas abre de x = −BAY.hw a +BAY.hw, que cai nos cantos arredondados
  // (em φ = π + phiBay e 2π − phiBay); as paredes nascem das amostras duplicadas ali
  const phiBay = Math.acos((BAY.hw - bx) / RB)
  const nL = Math.max(2, Math.round((C4 * phiBay) / (Math.PI / 2))), nB = Math.max(2, C4 - nL), span = Math.PI / 2 - phiBay
  for (let i = 0; i <= nL; i++) col(Math.PI + (i / nL) * phiBay, -1, false)
  for (let i = 0; i <= nB; i++) col(Math.PI + phiBay + (i / nB) * span, -1, true)
  for (let i = 1; i < K; i++) col(Math.PI * 1.5, -1 + (2 * i) / K, true)
  for (let i = 0; i <= nB; i++) col(Math.PI * 1.5 + (i / nB) * span, 1, true)
  for (let i = 0; i <= nL; i++) col(Math.PI * 2 - phiBay + (i / nL) * phiBay, 1, false)

  // `fan`: tampa de cima ou de baixo, em leque: o anel (em `inset`) é puxado para o centro da planta (0..1)
  type Row = { y: number; inset: number; bay: boolean; fan?: number }
  const rows: Row[] = []
  // fundo (tampado pela faixa cinza) e lábio arredondado da base
  rows.push({ y: Y_BASE, inset: 0.032, bay: false, fan: 1 }, { y: Y_BASE, inset: 0.032, bay: false, fan: 0.5 }, { y: Y_BASE, inset: 0.032, bay: false })
  rows.push({ y: Y_BASE + 0.012, inset: 0.014, bay: false }, { y: Y_BASE + 0.03, inset: 0.004, bay: false })
  const yA = Y_BASE + 0.055, yB = Y_TOP - TOP_R, N = 132
  for (let i = 0; i <= N; i++) {
    const y = yA + ((yB - yA) * i) / N, next = yA + ((yB - yA) * (i + 1)) / N
    rows.push({ y, inset: 0, bay: y > BAY.y0 && y < BAY.y1 })
    // paredes de baixo e de cima do compartimento: a mesma altura duas vezes (fora e dentro)
    if (y < BAY.y0 && next >= BAY.y0) rows.push({ y: BAY.y0, inset: 0, bay: false }, { y: BAY.y0, inset: 0, bay: true })
    if (y < BAY.y1 && next >= BAY.y1) rows.push({ y: BAY.y1, inset: 0, bay: true }, { y: BAY.y1, inset: 0, bay: false })
  }
  // borda arredondada do topo, com o sulco fino da tampa de cima (a linha que dá a volta ~6 mm abaixo do topo)
  const aSeam = Math.asin(0.4), top = (a: number, groove = 0) => rows.push({ y: yB + TOP_R * Math.sin(a), inset: TOP_R * (1 - Math.cos(a)) + groove, bay: false })
  for (let k = 1; k <= 8; k++) {
    const a = (k / 8) * (Math.PI / 2), prev = ((k - 1) / 8) * (Math.PI / 2)
    if (prev < aSeam && a >= aSeam) { top(aSeam - 0.045); top(aSeam, 0.007); top(aSeam + 0.045) }
    if (Math.abs(a - aSeam) > 0.06) top(a)
  }
  rows.push({ y: Y_TOP, inset: TOP_R, bay: false, fan: 0.5 }, { y: Y_TOP, inset: TOP_R, bay: false, fan: 1 })

  const C = cols.length, R = rows.length
  const ZC = (HD - RC - (HD - RB)) / 2 // centro da planta, para onde as tampas convergem
  const pos = new Float32Array(C * R * 3), uv = new Float32Array(C * R * 2)
  rows.forEach((r, j) => cols.forEach((c, i) => {
    const rad = Math.max(0, c.r - r.inset)
    let x = c.cx + rad * c.nx
    let z = c.cz + rad * c.nz
    // tampas em leque: sem triângulos sobrepostos (eram eles que riscavam o topo visto de cima)
    if (r.fan) { x *= 1 - r.fan; z += (ZC - z) * r.fan }
    if (r.bay && c.bay) z = -BAY.floor
    else if (r.inset === 0 && c.nz > 0.05) z = frontCut(x, r.y, z)
    pos.set([x, r.y, z], (j * C + i) * 3)
    uv.set([(i / C) * 6, r.y * 2.5], (j * C + i) * 2) // UV contínuo para a micro-textura do plástico
  }))
  const all: number[] = [], fi: number[] = [], bi: number[] = []
  for (let j = 0; j < R - 1; j++) for (let i = 0; i < C; i++) {
    const i2 = (i + 1) % C, a = j * C + i, b = j * C + i2, c = a + C, d = b + C
    const tri = [a, c, b, b, c, d]
    all.push(...tri)
    ;(cols[i].front && cols[i2].front ? fi : bi).push(...tri)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(all)
  g.computeVertexNormals()
  // as duas metades compartilham os vértices e as normais; só o índice muda
  const half = (index: number[]) => { const h = new THREE.BufferGeometry(); for (const k of ['position', 'uv', 'normal']) h.setAttribute(k, g.getAttribute(k)); h.setIndex(index); return h }
  return { front: half(fi), back: half(bi) }
}

/** Painel que acompanha a curva da frente do corpo, `back` para dentro dela (lente PIR e a moldura escura atrás). */
function lensPanel(hw: number, y0: number, y1: number, back: number) {
  const g = new THREE.PlaneGeometry(hw * 2, y1 - y0, 28, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setXYZ(i, x, p.getY(i) + (y0 + y1) / 2, sFront(x) - back) }
  g.computeVertexNormals()
  return g
}

type Geo = ReturnType<typeof build>
let cache: Geo | null = null
function build() {
  const flat = { bevelEnabled: false, curveSegments: 24 }
  // faixa cinza da base: recuada, com o fundo arredondado
  const base = upright(new THREE.ExtrudeGeometry(outline(0.055), { depth: Y_BASE - Y0 - 0.04, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.025, bevelSegments: 5, curveSegments: 24 }), Y0 + 0.025)
  const baseSeam = upright(new THREE.ExtrudeGeometry(outline(0.034), { depth: 0.01, ...flat }), Y_BASE - 0.01)

  // funil por dentro, atrás da lente PIR: tronco de pirâmide aberto, da boca até o sensor. A frente do corpo é
  // bem curva (a lente dá a volta), então a boca é mais estreita que a lente e fica atrás dela em toda a largura
  const fhw = mm(18.5), zMouth = sFront(fhw) - LENS.depth - mm(2), zSensor = 0.11 + mm(6)
  const funnel = new THREE.CylinderGeometry(Math.SQRT2, 0.3 * Math.SQRT2, 1, 4, 1, true)
  funnel.rotateY(Math.PI / 4); funnel.rotateX(Math.PI / 2)
  funnel.scale(fhw, mm(19), zMouth - zSensor)
  funnel.translate(0, (LENS.y0 + LENS.y1) / 2, (zMouth + zSensor) / 2)

  // traseira: tampa curva, aba de alavanca no topo, presilhas embaixo e os frisos perto da base (dos dois lados)
  const coverH = BAY.y1 + 0.02 - (BAY.y0 - 0.012)
  const cover = upright(backBand(-(BAY.hw + 0.012), BAY.hw + 0.012, coverH, -0.001, 0.028), BAY.y0 - 0.012)
  // linha de junção em volta da tampa (embaixo e dos lados)
  const coverSeam = mergeGeometries([
    upright(backBand(-(BAY.hw + 0.016), BAY.hw + 0.016, 0.005, 0.0005, 0.01), BAY.y0 - 0.019),
    upright(backBand(-(BAY.hw + 0.016), -(BAY.hw + 0.012), coverH, 0.0005, 0.01), BAY.y0 - 0.012),
    upright(backBand(BAY.hw + 0.012, BAY.hw + 0.016, coverH, 0.0005, 0.01), BAY.y0 - 0.012),
  ])
  const latch = upright(backBand(-0.085, 0.085, 0.045, 0.012, 0.03), BAY.y1 + 0.02)
  const clipL = upright(backBand(-0.25, -0.15, 0.035, 0, 0.022), BAY.y0 - 0.047)
  const clipR = upright(backBand(0.15, 0.25, 0.035, 0, 0.022), BAY.y0 - 0.047)
  // placa de fixação na parede (vista por trás, o lado +x fica à esquerda): dois trilhos cinza em "Λ" aberto,
  // mais próximos no alto e mais afastados embaixo, sobre uma placa mais funda; os pés ficam na altura da base
  const TOP = WALL.top, w = WALL.hw
  const legA = new THREE.Shape() // lado +x: quase vertical
  legA.moveTo(0.045, TOP); legA.lineTo(w, TOP); legA.lineTo(w, Y0); legA.lineTo(0.1, Y0); legA.lineTo(0.07, Y0 + 0.25); legA.closePath()
  const legB = new THREE.Shape() // lado −x: a borda de dentro inclina para fora
  legB.moveTo(-0.035, TOP); legB.lineTo(-0.095, Y0 + 0.25); legB.lineTo(-0.115, Y0); legB.lineTo(-w, Y0); legB.lineTo(-w, TOP); legB.closePath()
  const railOpt = { depth: WALL.rail - 0.016, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3 }
  const rails = mergeGeometries([new THREE.ExtrudeGeometry(legA, railOpt), new THREE.ExtrudeGeometry(legB, railOpt)])
  // placa cinza entre os trilhos, com o entalhe retangular no alto
  const pl = new THREE.Shape()
  pl.moveTo(-w + 0.006, TOP - 0.01); pl.lineTo(-0.025, TOP - 0.01); pl.lineTo(-0.025, TOP - 0.04); pl.lineTo(0.035, TOP - 0.04); pl.lineTo(0.035, TOP - 0.01); pl.lineTo(w - 0.006, TOP - 0.01)
  pl.lineTo(w - 0.006, Y0 + 0.04); pl.lineTo(-w + 0.006, Y0 + 0.04); pl.closePath()
  const plate = new THREE.ExtrudeGeometry(pl, { depth: WALL.plate - 0.008, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 })
  // faixa de frisos verticais finos nas laterais, perto da base
  const fr: THREE.BufferGeometry[] = [], ribY = H(21), ribH = 0.12
  // trecho reto de cada lateral (entre o canto de trás e o da frente)
  for (const sx of [-1, 1]) for (let i = 1; i <= 29; i++) {
    const b = new THREE.BoxGeometry(0.006, ribH, 0.005)
    b.translate(sx * (HW + 0.001), ribY, -(HD - RB) + (i / 30) * (HD - RB + HD - RC))
    fr.push(b)
  }
  for (const sx of [-1, 1]) for (let i = 0; i <= 22; i++) {
    const phi = -0.9 + (i / 22) * 1.15 // de ~52° no canto de trás até ~14° na frente (antes da boca do rebaixo)
    if (Math.abs(phi) < 0.02) continue
    const front = phi >= 0, r = (front ? RC : RB) + 0.001
    const b = new THREE.BoxGeometry(0.005, ribH, 0.006)
    b.rotateY(Math.atan2(sx * Math.cos(phi), Math.sin(phi))) // o lado fino aponta para fora, na normal
    b.translate(sx * ((front ? HW - RC : HW - RB) + r * Math.cos(phi)), ribY, (front ? HD - RC : -(HD - RB)) + r * Math.sin(phi))
    fr.push(b)
  }
  const shell = shellGeometry()
  return {
    shellFront: shell.front, shellBack: shell.back, base, baseSeam, funnel, cover, coverSeam, latch, clipL, clipR, rails, plate,
    ribs: mergeGeometries(fr),
    // lente PIR: painel fosco, com um fundo claro atrás e um quadro escuro um pouco maior (a linha fina em volta)
    pirFrame: lensPanel(LENS.hw + mm(0.6), LENS.y0 - mm(0.6), LENS.y1 + mm(0.6), LENS.depth - 0.002),
    pirBack: lensPanel(LENS.hw, LENS.y0, LENS.y1, LENS.depth - 0.004),
    pirLens: lensPanel(LENS.hw, LENS.y0, LENS.y1, LENS.depth - 0.007),
    win: stadiumGeometry(mm(6.5), mm(14.5), 0.006, 0.003), // janela oval vertical do LED (~6,5 × 14,5 mm)
    cell: new THREE.CylinderGeometry(CELL.r, CELL.r, CELL.len, 32),
    spring: (() => { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 90; i++) { const t = i / 90; pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 12) * 0.035, t * 0.2, Math.sin(t * Math.PI * 12) * 0.035)) } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 72, 0.007, 4) })(),
  }
}
const G = () => (cache ??= build())

/** Alerta do PIR durante a ação: a pessoa está dentro do leque de 90°? */
function pirAlert() {
  const t = actionTime('pir')
  if (t < 2.5 || t > 6.5) return 0
  return Math.abs(personX(t)) < PERSON_Z ? 1 : 0
}

/**
 * Fotossensor: torre arredondada (laterais quase semicirculares) de topo plano com a borda arredondada.
 * Na frente, o capuz em arco e, dentro dele, o bolso escavado da câmera (lente e janela oval do LED); a lente PIR
 * grande e fosca logo abaixo, na sua moldura, e o logo no queixo; faixa cinza recuada na base. Atrás, a tampa curva das pilhas (3 AA) na
 * metade de cima e, na de baixo, o suporte de parede cinza: dois trilhos em Λ sobre uma placa com um parafuso. Frente em +Z.
 */
export function Fotossensor({ interactive = false, flash }: DeviceProps & { flash?: () => number }) {
  const tilt = useRef<THREE.Group>(null!)
  const cover = useRef<THREE.Group>(null!)
  const flip = useRef<THREE.Group>(null!)
  const pin = useRef<THREE.Mesh>(null!)
  const cellRefs = useRef<(THREE.Group | null)[]>([])
  const arrowPhase = useActionPhase('tampa-foto', [0.8, 1.5], true)
  const polaroid = useRef<THREE.Group>(null!)
  const person = useRef<THREE.Group>(null!)
  const dog = useRef<THREE.Group>(null!)
  const ruler = useRef<THREE.Group>(null!)
  const alertV = useRef(0)
  const g = G()
  // base e suporte de parede: o mesmo plástico cinza fosco
  const baseMat = useMemo(() => { const m = M.grey.clone(); m.color.set('#80848c'); return m }, [])
  const springMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b87333', roughness: 0.38, metalness: 1 }), [])
  const shellMat = useMemo(() => { const m = M.white.clone(); m.side = THREE.DoubleSide; return m }, [])
  const mountMat = useMemo(() => { const m = M.grey.clone(); m.color.set('#9a9ea6'); return m }, [])
  const lensBack = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e3e5e8', roughness: 0.7 }), [])
  const pirMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#f1f2f3', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true, opacity: 0.8, envMapIntensity: 1.4 }), [])
  const polMat = useMemo(() => new THREE.MeshBasicMaterial({ map: polaroidTexture(), toneMapped: false, side: THREE.DoubleSide }), [])
  const rulerMat = useMemo(() => fxBasic('#ffffff', 0.5), [])
  const bandMat = useMemo(() => fxBasic('#35d46a', 0.35), [])
  const pirPhase = useActionPhase('pir', [0, 3.1, 5.9, 9.5])
  const supPhase = useActionPhase('suporte')

  const flashPower = () => {
    if (flash) return flash()
    const t = actionTime('camera')
    return t < 0 ? 0 : bump(t, 0.55, 0.65, 0.75, 1.3)
  }

  useFrame((_, dt) => {
    if (!interactive) return
    // suporte: o sensor inclina para a frente e volta, girando no eixo horizontal do pé do suporte (que fica parado)
    const ts = actionTime('suporte')
    const amp = ts < 0 ? 0 : bump(ts, 0, 0.8, 7, 8)
    tilt.current.rotation.x = (0.09 - Math.cos(ts * 1.4) * 0.07) * amp
    ruler.current.visible = ts >= 0
    // tampa: o sensor vira de costas, a tampa solta pela aba de cima, inclina ~25° e sai para o lado;
    // o pino do anti-sabotagem salta e as 3 pilhas dão um leve salto, uma de cada vez, sem sair do compartimento
    const tt = actionTau('tampa-foto')
    // (no modo de referência a câmera já está atrás: o aparelho não vira)
    flip.current.rotation.y = tt < 0 || REF_ON ? 0 : seg(tt, 0, 0.8) * Math.PI
    const off = tt < 0 ? 0 : seg(tt, 2.0, 2.6)
    // "clic" ao fechar: a tampa assenta com um leve pulso
    const clic = tt >= 0 && tt < 1.5 ? bump(tt, 1.2, 1.35, 1.4, 1.5) * 0.015 : 0
    cover.current.rotation.x = -(tt < 0 ? 0 : seg(tt, 1.5, 2.0)) * 0.44
    cover.current.position.set(off * 0.72, -off * 0.08, -off * 0.4 + clic)
    pin.current.position.z = -(CELL.s + 0.06) - (tt < 0 ? 0 : seg(tt, 2.6, 2.8)) * 0.03
    for (let i = 0; i < 3; i++) {
      const c = cellRefs.current[i]
      if (c) c.position.z = -(tt < 0 ? 0 : bump(tt, 2.9 + i * 0.18, 3.1 + i * 0.18, 3.25 + i * 0.18, 3.5 + i * 0.18)) * 0.022
    }
    // câmera: polaroid voa para fora
    const tc = actionTime('camera')
    const k = tc < 0 ? 0 : bump(tc, 0.9, 2.0, 6.3, 6.9)
    // no aquecimento, os efeitos que só aparecem numa ação ficam visíveis uma vez, para compilar os shaders deles
    const warm = useShowroom.getState().warm
    polaroid.current.visible = warm || k > 0.001
    polaroid.current.position.set(k * 1.05, LENS_Y + k * 0.05, HD + 0.12 + k * 0.3)
    polaroid.current.scale.setScalar(0.05 + k * 0.95)
    polaroid.current.rotation.set(0, -0.25 * k, (1 - k) * 1.2 - 0.08)
    // PIR: pessoa dispara, cachorro não
    const tp = actionTime('pir')
    person.current.visible = warm || (tp > 2.3 && tp < 6.8)
    dog.current.visible = warm || (tp > 7.8 && tp < 12.3)
    if (tp >= 0) {
      person.current.position.x = personX(tp)
      person.current.position.y = FAN_Y + Math.abs(Math.sin(tp * 7)) * 0.03
      dog.current.position.x = dogX(tp)
      dog.current.position.y = FAN_Y + Math.abs(Math.sin(tp * 10)) * 0.04
    }
    alertV.current += (pirAlert() - alertV.current) * Math.min(1, dt * 10)
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'fotossensor', interactive }}>
      <group ref={flip}>
      <group position={HINGE}>
        <group ref={tilt}>
          <group position={[-HINGE[0], -HINGE[1], -HINGE[2]]}>
            {/* corpo: casca única com o rebaixo do capuz e o compartimento das pilhas; logo, frisos e berço */}
            {/* frente da casca: capuz, rebaixo do PIR, logo. Na vista explodida vai para a frente */}
            <ClickablePart follow="corpo" explode={[0, UP, 1.05]}>
              <mesh geometry={g.shellFront} material={shellMat} castShadow />
              {/* logo no queixo, deitado na rampa */}
              <LogoGroove r={LOGO_R} position={[0, LOGO_Y, HD - lensRecess(0, LOGO_Y) + 0.004]} rotation={[-0.16, 0, 0]} />
              {/* por dentro, atrás da lente PIR: o funil que leva até o sensor (aparece no Raio-X e no Explodir) */}
              <mesh geometry={g.funnel} material={shellMat} />
            </ClickablePart>
            {/* corpo traseiro: fica parado; leva os frisos, o parafuso lateral e o berço das pilhas */}
            <ClickablePart follow="corpo" explode={[0, UP, 0]}>
              <mesh geometry={g.shellBack} material={shellMat} castShadow />
              <mesh geometry={g.baseSeam} material={M.partition} />
              {/* cabeça de um parafuso pequeno na lateral, junto à base */}
              <mesh material={M.metal} position={[-(HW + 0.002), H(12), -0.15]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.022, 0.022, 0.012, 16]} /></mesh>
              <mesh geometry={g.ribs} material={M.white} />
              {/* emenda da tampa: sulco fino e sutil, um tom abaixo do branco */}
              <mesh geometry={g.coverSeam} material={M.whiteRelief} />
              {/* berço preto das pilhas: fundo, divisórias, molas no polo − e contatos no polo + */}
              <mesh material={M.chip} position={[0, CELL.y, -(BAY.floor + 0.012)]}><boxGeometry args={[BAY.hw * 2 - 0.01, BAY.y1 - BAY.y0 - 0.02, 0.012]} /></mesh>
              {[-0.098, 0.098].map((x) => <mesh key={x} material={M.chip} position={[x, CELL.y, -(BAY.floor + 0.05)]}><boxGeometry args={[0.008, CELL.len, 0.09]} /></mesh>)}
              {[1, -1].map((sy) => <mesh key={sy} material={M.chip} position={[0, CELL.y + sy * ((BAY.y1 - BAY.y0) / 2 - 0.012), -(BAY.floor + 0.07)]}><boxGeometry args={[BAY.hw * 2 - 0.02, 0.012, 0.13]} /></mesh>)}
              {CELL_X.map((x, i) => (
                <group key={x}>
                  {[0.008, 0.02].map((d) => (
                    <mesh key={d} material={M.metal} position={[x, CELL.y + (i % 2 ? 1 : -1) * (CELL.len / 2 + d + 0.006), -CELL.s]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.05 - d * 0.6, 0.006, 6, 20]} /></mesh>
                  ))}
                  <mesh material={M.metal} position={[x, CELL.y + (i % 2 ? -1 : 1) * (CELL.len / 2 + 0.034), -CELL.s]}><boxGeometry args={[0.09, 0.006, 0.09]} /></mesh>
                </group>
              ))}
            </ClickablePart>

            {/* a câmera e o LED ficam no fundo do bolso escavado na frente (não há peça saliente) */}
            {/* lente: círculo preto pequeno (~7 mm) com aro escuro, no alto do bolso */}
            <ClickablePart id="camera">
              <group position={camAt(LENS_Y)} rotation={CAM_ROT}>
                <mesh material={M.blackGloss} position={[0, 0, 0.001]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(4.6), mm(4.6), 0.012, 32]} /></mesh>
                <mesh material={M.lens} position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(3.5), mm(3.5), 0.008, 32]} /></mesh>
                {[0.014, 0.024].map((r) => <mesh key={r} material={M.greyDark} position={[0, 0, 0.0125]}><torusGeometry args={[r, 0.002, 6, 32]} /></mesh>)}
              </group>
            </ClickablePart>
            {/* janela oval vertical do LED, no meio do bolso; o flash acende dentro dela */}
            <ClickablePart id="flash">
              <group position={camAt(LEDWIN_Y)} rotation={CAM_ROT}>
                <mesh geometry={g.win} material={M.hole} position={[0, 0, -0.008]} />
                <mesh geometry={g.win} material={M.crystal} position={[0, 0, -0.004]} />
                <Led sample={(_, o) => { const p = flashPower(); o.color = '#fff6c8'; o.on = p * 3 }} baseColor="#123d22" position={[0, mm(3.4), 0.004]}>
                  <boxGeometry args={[0.03, 0.03, 0.003]} />
                </Led>
              </group>
            </ClickablePart>
            {/* LED verde, na parte de baixo da janela */}
            <ClickablePart id="led">
              <group position={camAt(LEDWIN_Y)} rotation={CAM_ROT}>
                <Led sample={(t, o) => {
                  const al = interactive ? alertV.current : 0
                  o.color = al > 0.5 ? '#ff2a2a' : '#27d455'
                  o.on = al > 0.5 ? 1 : t % 3 < 0.25 ? 0.9 : 0.25
                }} position={[0, -mm(3.4), 0.004]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.016, 0.016, 0.004, 16]} />
                </Led>
              </group>
            </ClickablePart>

            {/* lente PIR: painel fosco grande, branco-leitoso, curvo como o corpo e ~3 mm para dentro dele, com a linha fina em volta */}
            <ClickablePart id="pir">
              <mesh geometry={g.pirFrame} material={M.partition} />
              <mesh geometry={g.pirBack} material={lensBack} />
              <mesh geometry={g.pirLens} material={pirMat} />
            </ClickablePart>

            {/* ===== por dentro (pelos vídeos de fábrica): geometria simples, poucos segmentos, materiais que já existiam;
                sem etiquetas nem textos. O corpo traseiro (a calha branca) é a metade de trás da casca. ===== */}
            {/* placa principal: verde, vertical, ~50 × 85 mm, do meio do corpo para baixo; cabo flat à esquerda */}
            <ClickablePart id="placas">
              <mesh material={M.pcb} position={[0, H(50), 0.1]}><boxGeometry args={[mm(50), mm(85), 0.02]} /></mesh>
              <mesh material={M.chip} position={[-0.16, H(62), 0.116]}><boxGeometry args={[0.1, 0.1, 0.014]} /></mesh>
              <mesh material={M.chip} position={[0.17, H(22), 0.116]}><boxGeometry args={[0.08, 0.12, 0.014]} /></mesh>
              <mesh material={M.white} position={[-0.21, H(84), 0.135]}><boxGeometry args={[0.11, mm(34), 0.006]} /></mesh>
            </ClickablePart>
            {/* sensor PIR: cilindro metálico (~9 × 5 mm) com a janelinha escura, no fundo do funil, no meio da lente PIR */}
            <ClickablePart id="sensor-pir">
              <mesh material={M.metal} position={[0, H(52), 0.11 + mm(2.5)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(4.5), mm(4.5), mm(5), 14]} /></mesh>
              <mesh material={M.hole} position={[0, H(52), 0.11 + mm(5) + 0.001]}><planeGeometry args={[mm(3.6), mm(3.6)]} /></mesh>
            </ClickablePart>
            {/* módulo da câmera, no terço de cima: plaquinha verde com o LED, suporte branco e o tubo preto da lente
                (~8 mm), alinhado com a lente no fundo do bolso */}
            <ClickablePart id="modulo-camera">
              <mesh material={M.pcb} position={[0, H(104), 0.16]}><boxGeometry args={[mm(28), mm(24), 0.016]} /></mesh>
              <mesh material={M.white} position={[0, LEDWIN_Y, 0.176]}><boxGeometry args={[0.04, 0.05, 0.016]} /></mesh>
              <mesh material={M.white} position={[0, LENS_Y, 0.17 + mm(4)]}><boxGeometry args={[mm(20), mm(18), mm(8)]} /></mesh>
              <group position={[0, LENS_Y, 0.17 + mm(8)]} rotation={CAM_ROT}>
                <mesh material={M.chip} position={[0, 0, mm(3.5)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(4.5), mm(4.5), mm(7.5), 14]} /></mesh>
              </group>
            </ClickablePart>
            {/* antena: mola de cobre em pé, no centro, logo acima da base */}
            <ClickablePart id="antena">
              <mesh geometry={g.spring} material={springMat} position={[0, H(8), 0.2]} />
            </ClickablePart>

            {/* faixa cinza da base, um pouco recuada */}
            <ClickablePart id="base">
              <mesh geometry={g.base} material={baseMat} castShadow />
            </ClickablePart>

            {/* tampa das pilhas: curva, acompanhando o corpo; aba de alavanca no topo e duas presilhas embaixo */}
            <ClickablePart id="tampa-traseira">
              <group position={[0, BAY.y0, -HD]}>
                <group ref={cover}>
                  <group position={[0, -BAY.y0, HD]}>
                    <mesh geometry={g.cover} material={M.white} castShadow />
                    <mesh geometry={g.latch} material={M.white} />
                    <mesh geometry={g.clipL} material={M.white} />
                    <mesh geometry={g.clipR} material={M.white} />
                    <mesh material={M.hole} position={[0, BAY.y1 - 0.02, -(HD + 0.0075)]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.11, 0.016]} /></mesh>
                  </group>
                </group>
              </group>
            </ClickablePart>
            {/* 3 pilhas AA na vertical, lado a lado, com a polaridade alternada: corpo preto e faixa dourada no lado do +, sem marca nem texto */}
            <ClickablePart id="pilhas">
              {CELL_X.map((x, i) => (
                <group key={x} ref={(gr) => { cellRefs.current[i] = gr }}>
                  <group position={[x, CELL.y, -CELL.s]} rotation={[0, 0, i % 2 ? Math.PI : 0]}>
                    <mesh geometry={g.cell} material={M.black} />
                    <mesh material={M.gold} position={[0, CELL.len * 0.32, 0]}><cylinderGeometry args={[CELL.r + 0.0012, CELL.r + 0.0012, CELL.len * 0.36, 32, 1, true]} /></mesh>
                    <mesh material={M.metal} position={[0, CELL.len / 2 + 0.012, 0]}><cylinderGeometry args={[0.03, 0.03, 0.024, 16]} /></mesh>
                    <mesh material={M.metal} position={[0, CELL.len / 2 - 0.003, 0]}><cylinderGeometry args={[CELL.r - 0.012, CELL.r - 0.004, 0.006, 24]} /></mesh>
                    <mesh material={M.metal} position={[0, -CELL.len / 2 + 0.003, 0]}><cylinderGeometry args={[CELL.r - 0.004, CELL.r - 0.012, 0.006, 24]} /></mesh>
                    <mesh material={M.partition} position={[0, CELL.len / 2 - 0.05, 0]}><cylinderGeometry args={[CELL.r + 0.0008, CELL.r + 0.0008, 0.008, 32]} /></mesh>
                  </group>
                </group>
              ))}
            </ClickablePart>
            {/* pino do anti-sabotagem, no canto do compartimento: a tampa o mantém pressionado */}
            <ClickablePart follow="tampa-traseira" internal>
              <mesh ref={pin} material={M.grey} position={[0.098, BAY.y1 - 0.03, -(CELL.s + 0.06)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.014, 0.014, 0.04, 12]} /></mesh>
            </ClickablePart>
            {interactive && arrowPhase === 0 && (
              <Html position={[0, 0.92, -(HD + 0.1)]} center style={{ pointerEvents: 'none' }}>
                <div className="fx-tag -translate-y-7 text-center text-xs font-semibold text-accent">aba<div className="text-xl leading-none">▼</div></div>
              </Html>
            )}
          </group>
        </group>
      </group>

      {/* suporte de parede, preso à traseira (fica parado quando o sensor inclina): placa cinza com um parafuso
          perto de baixo e, sobre ela, os dois trilhos em Λ que passam da base do corpo */}
      <ClickablePart id="fixacao">
        <mesh geometry={g.plate} material={mountMat} position={[0, 0, -(HD + WALL.plate)]} castShadow />
        <mesh material={M.metal} position={[-0.01, H(14), -(HD + WALL.plate + 0.006)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.032, 0.032, 0.012, 20]} /></mesh>
        <mesh material={M.greyDark} position={[-0.01, H(14), -(HD + WALL.plate + 0.0125)]} rotation={[0, Math.PI, 0.6]}><planeGeometry args={[0.042, 0.008]} /></mesh>
        <mesh material={M.greyDark} position={[-0.01, H(14), -(HD + WALL.plate + 0.0126)]} rotation={[0, Math.PI, 0.6 + Math.PI / 2]}><planeGeometry args={[0.042, 0.008]} /></mesh>
      </ClickablePart>
      <ClickablePart id="suporte">
        <mesh geometry={g.rails} material={mountMat} position={[0, 0, -(HD + WALL.plate + WALL.rail)]} castShadow />
      </ClickablePart>

      </group>

      {interactive && (
        <>
          <CameraFlash power={flashPower} position={[0, LEDWIN_Y + 0.04, HD + 0.1]} />
          <group ref={polaroid} visible={false}>
            <mesh material={polMat} userData={{ fx: true }} raycast={() => null}><planeGeometry args={[0.8, 0.8]} /></mesh>
          </group>
          <DetectionFan position={[0, FAN_Y, HD - 0.1]} length={4.2} labels={pirPhase >= 0} alert={() => alertV.current}
            show={() => { const t = actionTime('pir'); return t < 0 ? 0 : bump(t, 0, 1.2, 13, 14) }} />
          <group ref={person} position={[0, FAN_Y, PERSON_Z]} visible={false}><LowPolyPerson scale={1.5} /></group>
          <group ref={dog} position={[0, FAN_Y, 2.0]} visible={false}><LowPolyDog scale={1.1} /></group>
          {pirPhase === 1 && alertBadge()}
          {pirPhase === 3 && (
            <Html position={[0, 0.2, 2.0]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-full bg-ok px-4 py-1.5 text-sm font-bold text-[#05210c]">Pet Immune ✓</div>
            </Html>
          )}
          <group ref={ruler} visible={false} position={[-0.95, 0, -0.78]}>
            <mesh material={rulerMat} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[0.02, 3.2, 0.02]} /></mesh>
            <mesh material={bandMat} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[0.12, 1.9, 0.01]} /></mesh>
            {supPhase >= 0 && (
              <>
                <Html position={[-0.1, 0.95, 0]} center style={{ pointerEvents: 'none' }}><div className="fx-tag rounded bg-black/70 px-2 text-sm font-semibold text-white">2,40 m</div></Html>
                <Html position={[-0.1, -0.95, 0]} center style={{ pointerEvents: 'none' }}><div className="fx-tag rounded bg-black/70 px-2 text-sm font-semibold text-white">2,10 m</div></Html>
                <Html position={[-0.1, -1.5, 0]} center style={{ pointerEvents: 'none' }}><div className="fx-tag text-xs text-white/70">altura do chão</div></Html>
              </>
            )}
          </group>
        </>
      )}
    </DeviceCtx.Provider>
  )
}

function alertBadge() {
  return (
    <Html position={[0, 1.0, PERSON_Z]} center style={{ pointerEvents: 'none' }}>
      <div className="fx-tag rounded-full bg-alert px-4 py-1.5 text-sm font-bold text-white">Movimento detectado</div>
    </Html>
  )
}
