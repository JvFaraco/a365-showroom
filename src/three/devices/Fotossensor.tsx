import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { boxesGeometry, stadiumGeometry, type Block } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { DetectionFan, LowPolyPerson } from '../fx/DetectionFan'
import { CameraFlash } from '../fx/CameraFlash'
import { REF_ON } from '../../dev/RefMode'
import { ImageScreen, SabotageScreen } from '../../ui/AppScreen'

// ---------- medidas externas (frente em +Z). Corpo cilíndrico de 68 mm de diâmetro e 137 de altura: a planta é um
// círculo. Com a base cinza (7 mm), 144 de altura. 1 unidade = 79 mm (o raio é 0,43). ----------
const mm = (v: number) => v / 79.07
const HW = 0.43, HD = HW // meia largura e meia profundidade: iguais
// planta: círculo de raio 34 mm; a tampa das pilhas acompanha a curva de trás
const RC = HW, RB = HW
const Y_TOP = 0.8, TOP_R = mm(4) // topo plano, de borda arredondada curta (~4 mm)
const Y0 = Y_TOP - mm(144) // fundo do aparelho (a altura h da ficha é medida a partir daqui)
const H = (h: number) => Y0 + mm(h)
const SEAM_Y = H(137) // sulco fino em volta do corpo, perto do topo
const Y_BASE = H(7) // acima disto é corpo branco; abaixo, a base cinza
// compartimento das pilhas, na traseira: tampa de ~54 mm de largura, de h ≈ 68 até o sulco do topo
// a tampa encaixa DENTRO de um aro do próprio corpo: sobra corpo branco dos lados e em cima
const BAY = { y0: H(69), y1: 0.645, hw: mm(25.8), floor: HD - 0.27 }
// pilha AA (50,5 × 14,5 mm): cilindro de ponta reta com o polo + saliente
const COVER_TOP = H(136.5) // a tampa das pilhas sobe até o sulco fino que dá a volta no corpo, perto do topo
const CELL = { r: mm(7.25), len: mm(50.5), y: (BAY.y0 + BAY.y1) / 2, s: HD - 0.16 }
const CELL_X = [-0.193, 0, 0.193]
// ---------- Frente (medidas externas, conferidas com as fotos na mão e de estúdio) ----------
// Lente PIR: painel fosco grande (~50 × 43 mm), curvo como o corpo e ~9 mm para dentro dele. Em volta, a moldura:
// prateleira inclinada em cima, chanfros dos lados e, embaixo, o queixo, que volta em rampa até a borda de baixo
// (é onde fica o logo). O funil que leva até o sensor fica POR DENTRO, atrás da lente.
const LENS = { hw: mm(25), y0: H(27.7), y1: H(70.7), depth: mm(9), ledge: mm(6.5), bevel: mm(4), gap: mm(0.8), chin: H(11.5) }
// Câmera e LED ficam num capuz: um ressalto em forma de pera que nasce rente ao corpo no alto (h ≈ 131), sai até
// ~10 mm para fora logo acima da câmera (a "sobrancelha") e, daí para baixo, vira a borda de um bolso escavado. O fundo
// do bolso é inclinado: quase rente ao corpo na altura da câmera e ~15 mm para dentro embaixo, de modo que a janela
// do LED olha um pouco para baixo. O bolso é mais largo embaixo e termina na prateleira da lente PIR.
// Tudo em mm: dx a partir do eixo do aparelho, h a partir do fundo; o resultado é quanto a frente sai (+) ou entra (−).
const CAM = { y0: 67, y1: 119.5, rB: 15, rT: 12.3 } // contorno do bolso: cápsula de raios diferentes em cima e embaixo
/** Distância (mm) para dentro do contorno do bolso; positiva dentro. */
function camInside(dx: number, h: number) {
  const px = Math.abs(dx), py = h - (CAM.y0 + CAM.rB), len = CAM.y1 - CAM.rT - (CAM.y0 + CAM.rB)
  const b = (CAM.rB - CAM.rT) / len, a = Math.sqrt(1 - b * b), k = -px * b + py * a
  if (k < 0) return CAM.rB - Math.hypot(px, py)
  if (k > a * len) return CAM.rT - Math.hypot(px, py - len)
  return CAM.rB - (px * a + py * b)
}
const POCKET_SLOPE = 0.575 // inclinação do fundo do bolso (mm de profundidade por mm de altura)
/**
 * Fundo do bolso na altura h: raso junto à câmera, desce em rampa até ~15 mm e, embaixo, volta numa rampa contínua
 * (~9 mm em h 71) até a prateleira da lente PIR, sem ponte rente ao corpo entre os dois.
 */
function pocketFloor(h: number) {
  if (h >= 101.2) return -3.2 + Math.min(1, (h - 101.2) / 3) * 1.9
  if (h >= 81) return Math.max(-14.8, -3.2 - POCKET_SLOPE * (101.2 - h))
  // rampa de baixo: começa em h ≈ 78,5 (joelho suave de ±1,5 mm, sem vinco) e sobe 5,8 mm até h 71
  const x = 78.5 - h, w = 1.5
  const up = x <= -w ? 0 : x >= w ? x : ((x + w) * (x + w)) / (4 * w)
  return -14.8 + up * (5.8 / 7.5)
}
/** Ressalto do capuz (sem o bolso): o menor entre a sobrancelha, que desce do alto, e a borda inclinada do bolso. */
function hoodBoss(dx: number, h: number) {
  const brow = 0.83 * (130.8 - h) - (0.021 + 0.0015 * (128.2 - h)) * dx * dx
  const rim = 0.58 * (h - 96.9) * smooth(0, 4, 16.2 - Math.abs(dx))
  const k = 1.2, m = Math.min(brow, rim)
  return Math.max(0, m - k * Math.log(Math.exp(-(brow - m) / k) + Math.exp(-(rim - m) / k))) // mínimo suave: sem vinco
}
/** Quanto a frente sai (+) ou entra (−) do cilindro no capuz e no bolso da câmera, em mm. */
function hoodOffset(dx: number, h: number) {
  if (h < CAM.y0 || h > 131 || Math.abs(dx) > 17) return 0
  const boss = hoodBoss(dx, h), d = camInside(dx, h)
  const wall = 6.5 + 2.5 * smooth(100, 110, h) // largura da parede do bolso: mais aberta em cima, sob a sobrancelha
  return d <= 0 ? boss : boss + (pocketFloor(h) - boss) * Math.pow(smooth(0, wall, d), 0.8)
}
const hOf = (y: number) => (y - Y0) * 79.07 // altura em mm a partir do fundo
const CAM_H = 109.3, LEDWIN_H = 92.2 // centro da lente (no alto do bolso, sob a sobrancelha) e da janela do LED (na rampa)
const LENS_Y = H(CAM_H), LEDWIN_Y = H(LEDWIN_H)
const camAt = (h: number): [number, number, number] => [0, H(h), HD + mm(hoodOffset(0, h))]
const CAM_TILT = Math.atan(POCKET_SLOPE) // a rampa do bolso (a normal aponta para a frente e para baixo)
const CAM_ROT: [number, number, number] = [CAM_TILT, 0, 0]
const LOGO_Y = H(20.0), LOGO_R = mm(7.3) // logo de ~15 mm, abaixo do fim da rampa do queixo
// suporte de parede (cinza): ~31 × 67 mm, de h = 0 a 68; com os trilhos, afasta o corpo ~16 mm da parede
// Suporte de parede em duas peças (medidas externas): a LUVA faz parte da base cinza e sobe pela traseira até a borda da tampa das pilhas,
// com o encaixe em "Λ" (estreita para cima) e o parafuso de trava; a PLACA DE PAREDE é solta, vai parafusada na
// parede e tem a guia que entra na luva. As duas têm 31 mm de largura.
const ZC = (z: number) => (z - 50.9) / 79.07 // profundidade em mm a partir da parede → z do modelo
const WALL = { hw: mm(15.5), top: H(67.5), floor: ZC(11), back: ZC(3.5), plate0: ZC(0.5), plate1: ZC(2.3), guide: ZC(10) }
/** Meia largura do encaixe da luva na altura h (mm): 9 mm embaixo, ~3 mm no alto. */
const slotHW = (h: number) => mm(9.0 - 0.088 * h)
// articulação: eixo vertical no encaixe da peça de fixação da parede. O sensor é fixo no suporte (a luva da base) e
// os dois giram juntos, em pé, para a esquerda e para a direita; só a peça de fixação fica parada
const PAN: [number, number, number] = [0, Y0, WALL.floor]
const PCB_DZ = -0.17 // a placa principal fica ~5 mm atrás do eixo do aparelho; o funil vem da lente até o sensor, na frente dela
const BOARD = { y0: H(24), y1: H(128), hw: mm(27), z: PCB_DZ + 0.1 } // placa principal: da altura do funil até o topo
const UP = 0.22 // na vista explodida tudo sobe um pouco e a base cinza fica embaixo (é como ela "desce" sem entrar no pedestal)
const FAN_Y = Y0 - 0.01 // altura do chão da cena do PIR
const personX = (t: number) => -3.4 + seg(t, 2.5, 6.5) * 6.8
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
 * Frente esculpida: devolve o z do ponto (x, y) depois do capuz da câmera (que sai do corpo no alto e vira o bolso
 * escavado embaixo) e da moldura onde assenta a lente PIR.
 */
function frontCut(x: number, y: number, z: number) {
  const off = mm(hoodOffset(x * 79.07, hOf(y)))
  return off > 0 ? z + off : z - Math.max(-off, lensRecess(x, y))
}

/**
 * Casca do corpo: superfície paramétrica (volta do contorno × altura), com a borda do topo arredondada,
 * o lábio da base, o capuz da câmera e o rebaixo da lente esculpidos na frente e o
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
  // traseira: o compartimento das pilhas abre de x = −BAY.hw a +BAY.hw, na curva de trás
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
  // embaixo o corpo é aberto (o fundo é só o da base cinza): começa num lábio curto, já quase no raio cheio
  rows.push({ y: Y_BASE, inset: 0.006, bay: false })
  rows.push({ y: Y_BASE + 0.012, inset: 0.002, bay: false }, { y: Y_BASE + 0.03, inset: 0, bay: false })
  const yA = Y_BASE + 0.055, yB = Y_TOP - TOP_R, N = 132
  for (let i = 0; i <= N; i++) {
    const y = yA + ((yB - yA) * i) / N, next = yA + ((yB - yA) * (i + 1)) / N
    // sulco fino que dá a volta no corpo ~7 mm abaixo do topo (a emenda da tampa de cima)
    if (Math.abs(y - SEAM_Y) <= (yB - yA) / N / 2) { rows.push({ y: y - 0.004, inset: 0, bay: false }, { y, inset: 0.007, bay: false }, { y: y + 0.004, inset: 0, bay: false }); continue }
    rows.push({ y, inset: 0, bay: y > BAY.y0 && y < BAY.y1 })
    // paredes de baixo e de cima do compartimento: a mesma altura duas vezes (fora e dentro)
    if (y < BAY.y0 && next >= BAY.y0) rows.push({ y: BAY.y0, inset: 0, bay: false }, { y: BAY.y0, inset: 0, bay: true })
    if (y < BAY.y1 && next >= BAY.y1) rows.push({ y: BAY.y1, inset: 0, bay: true }, { y: BAY.y1, inset: 0, bay: false })
  }
  // borda arredondada do topo
  for (let k = 1; k <= 7; k++) { const a = (k / 7) * (Math.PI / 2); rows.push({ y: yB + TOP_R * Math.sin(a), inset: TOP_R * (1 - Math.cos(a)), bay: false }) }
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

/** Componente pequeno na frente da placa principal: x, altura (mm, como na ficha), largura e altura dele. */
const t = (x: number, h: number, w = 0.04, hh = 0.022): Block => [x, H(h), 0.116, w, hh, 0.012]

type Geo = ReturnType<typeof build>
let cache: Geo | null = null
function build() {
  const flat = { bevelEnabled: false, curveSegments: 24 }
  // base cinza: tronco quase reto, rente ao corpo em cima e ~4 mm mais estreito embaixo
  // base fechada em cima: borda e um fundo rebaixado em prato onde o corpo assenta
  const base = new THREE.LatheGeometry([[0, 0], [29.6, 0], [30.0, 0.2], [31.6, 2], [32.8, 4], [33.8, 6.1], [33.8, 6.4], [33.3, 7.4], [31.8, 7.4], [30.6, 5.6], [29, 4.6], [0, 4.4]].map(([r, h]) => new THREE.Vector2(mm(r), Y0 + mm(h))), 64)
  // linha cinza entre o corpo e a base: só um aro fino na borda (uma chapa cheia parecia uma segunda base na vista explodida)
  const seamRing = outline(0.034); seamRing.holes.push(new THREE.Path(outline(0.034 + mm(2)).getPoints(64).reverse()))
  const baseSeam = upright(new THREE.ExtrudeGeometry(seamRing, { depth: 0.01, ...flat }), Y_BASE - 0.01)

  // funil por dentro, atrás da lente PIR: tronco de pirâmide aberto, da boca até o sensor. A frente do corpo é
  // bem curva (a lente dá a volta), então a boca é mais estreita que a lente e fica atrás dela em toda a largura
  const fhw = mm(18.5), zMouth = sFront(fhw) - LENS.depth - mm(2), zSensor = PCB_DZ + 0.11 + mm(6)
  const funnel = new THREE.CylinderGeometry(Math.SQRT2, 0.3 * Math.SQRT2, 1, 4, 1, true)
  funnel.rotateY(Math.PI / 4); funnel.rotateX(Math.PI / 2)
  funnel.scale(fhw, mm(19), zMouth - zSensor)
  funnel.translate(0, (LENS.y0 + LENS.y1) / 2, (zMouth + zSensor) / 2)

  // traseira: tampa curva, aba de alavanca no topo, presilhas embaixo e os frisos perto da base (dos dois lados)
  const coverH = COVER_TOP - (BAY.y0 - 0.012)
  const cover = upright(backBand(-(BAY.hw + 0.012), BAY.hw + 0.012, coverH, 0.0012, 0.03), BAY.y0 - 0.012)
  // linha de junção em volta da tampa (embaixo e dos lados); as linhas dos lados continuam até a base
  const coverSeam = mergeGeometries([
    upright(backBand(-(BAY.hw + 0.016), BAY.hw + 0.016, 0.005, 0.0005, 0.01), BAY.y0 - 0.019),
    upright(backBand(-(BAY.hw + 0.016), -(BAY.hw + 0.012), coverH, 0.0005, 0.01), BAY.y0 - 0.012),
    upright(backBand(BAY.hw + 0.012, BAY.hw + 0.016, coverH, 0.0005, 0.01), BAY.y0 - 0.012),
    upright(backBand(-(BAY.hw + 0.016), -(BAY.hw + 0.012), BAY.y0 - 0.019 - Y_BASE, 0.0005, 0.01), Y_BASE),
    upright(backBand(BAY.hw + 0.012, BAY.hw + 0.016, BAY.y0 - 0.019 - Y_BASE, 0.0005, 0.01), Y_BASE),
  ])
  const latch = upright(backBand(-0.085, 0.085, 0.04, 0.012, 0.03), COVER_TOP)
  const clipL = upright(backBand(-0.25, -0.15, 0.035, 0, 0.022), BAY.y0 - 0.047)
  const clipR = upright(backBand(0.15, 0.25, 0.035, 0, 0.022), BAY.y0 - 0.047)
  // luva do suporte (presa à base): bloco da largura do suporte que vai da traseira do corpo até o fundo do encaixe,
  // e os dois lábios em "Λ" por trás, que formam o encaixe onde entra a guia da placa de parede
  const w = WALL.hw, N = 16
  const core = new THREE.Shape()
  core.moveTo(-w, -WALL.floor)
  for (let i = 0; i <= N; i++) { const x = -w + (2 * w * i) / N; core.lineTo(x, sBack(x) - 0.008) }
  core.lineTo(w, -WALL.floor); core.closePath()
  const sleeveCore = upright(new THREE.ExtrudeGeometry(core, { depth: WALL.top - Y0, bevelEnabled: false }), Y0)
  const lip = (sx: number) => {
    const sh = new THREE.Shape()
    sh.moveTo(sx * w, Y0); sh.lineTo(sx * slotHW(0), Y0); sh.lineTo(sx * slotHW(67.5), WALL.top); sh.lineTo(sx * w, WALL.top); sh.closePath()
    const g = new THREE.ExtrudeGeometry(sh, { depth: WALL.floor - WALL.back, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 })
    g.translate(0, 0, WALL.back)
    return g
  }
  const sleeve = mergeGeometries([sleeveCore, lip(-1), lip(1)])
  // placa de parede (solta): chapa fina encostada na parede e a guia trapezoidal que entra no encaixe da luva
  const pl = new THREE.Shape()
  pl.moveTo(-w, H(1.3)); pl.lineTo(w, H(1.3)); pl.lineTo(w, H(68.7)); pl.lineTo(-w, H(68.7)); pl.closePath()
  const plateBack = new THREE.ExtrudeGeometry(pl, { depth: WALL.plate1 - WALL.plate0, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 })
  plateBack.translate(0, 0, WALL.plate0)
  const gd = new THREE.Shape(), gap = mm(0.8)
  gd.moveTo(-(slotHW(3) - gap), H(3)); gd.lineTo(slotHW(3) - gap, H(3)); gd.lineTo(slotHW(66) - gap, H(66)); gd.lineTo(-(slotHW(66) - gap), H(66)); gd.closePath()
  const guide = new THREE.ExtrudeGeometry(gd, { depth: WALL.guide - WALL.plate1, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 })
  guide.translate(0, 0, WALL.plate1)
  const plate = mergeGeometries([plateBack, guide])
  // faixa de frisos verticais em volta da metade de trás, perto da base (atrás do suporte de parede não há), passo ~2 mm
  const fr: THREE.BufferGeometry[] = [], ribY = H(23.75), ribH = mm(11.5)
  for (const sx of [-1, 1]) for (let i = 0; i <= 14; i++) {
    const phi = -1.1 + (i / 14) * 0.84 // de ~63° até ~15° atrás da linha da lateral
    const b = new THREE.BoxGeometry(mm(0.9), ribH, 0.006)
    b.rotateY(Math.atan2(sx * Math.cos(phi), Math.sin(phi))) // o lado fino aponta para fora, na normal
    b.translate(sx * (RC + 0.001) * Math.cos(phi), ribY, (RC + 0.001) * Math.sin(phi))
    fr.push(b)
  }
  const shell = shellGeometry()
  return {
    shellFront: shell.front, shellBack: shell.back, base, baseSeam, funnel, cover, coverSeam, latch, clipL, clipR, sleeve, plate,
    // componentes pequenos da placa principal, em volta do sensor PIR e dos CIs, como na placa real (sem texto nem etiqueta)
    smdTan: boxesGeometry([t(-0.12, 52), t(-0.12, 56), t(0.12, 52), t(0.12, 48), t(-0.06, 42, 0.022, 0.04), t(0, 42, 0.022, 0.04), t(0.06, 42, 0.022, 0.04), t(-0.26, 70), t(-0.26, 66), t(-0.05, 70)]),
    smdBlack: boxesGeometry([[0.18, H(66), 0.117, 0.07, 0.07, 0.014], [-0.2, H(30), 0.117, 0.06, 0.09, 0.014], t(0.24, 40), t(0.24, 44), t(0.24, 48)]),
    smdMetal: boxesGeometry([[0.05, H(64), 0.118, 0.07, 0.035, 0.016]]),
    smdGold: boxesGeometry([-0.125, -0.075, -0.025, 0.025, 0.075, 0.125].map((x) => [x, H(76), 0.112, 0.022, 0.022, 0.004] as Block)),
    ribs: mergeGeometries(fr),
    // lente PIR: painel fosco, com um fundo claro atrás e um quadro escuro um pouco maior (a linha fina em volta)
    pirFrame: lensPanel(LENS.hw + mm(0.6), LENS.y0 - mm(0.6), LENS.y1 + mm(0.6), LENS.depth - 0.002),
    pirBack: lensPanel(LENS.hw, LENS.y0, LENS.y1, LENS.depth - 0.004),
    pirLens: lensPanel(LENS.hw, LENS.y0, LENS.y1, LENS.depth - 0.007),
    win: stadiumGeometry(mm(6.4), mm(14.4), 0.006, 0.003), // janela oval vertical do LED (~6,4 × 14 mm)
    cell: new THREE.CylinderGeometry(CELL.r, CELL.r, CELL.len, 32),
    spring: (() => { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 90; i++) { const t = i / 90; pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 12) * 0.035, t * 0.2, Math.sin(t * Math.PI * 12) * 0.035)) } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 72, 0.007, 4) })(),
  }
}
const G = () => (cache ??= build())

/** Alerta do PIR durante a ação: a pessoa está dentro do leque de 90°? */
function pirAlert() {
  if (sensDetect()) return 1
  const t = actionTime('pir')
  if (t < 2.5 || t > 6.5) return 0
  return Math.abs(personX(t)) < PERSON_Z ? 1 : 0
}

// ---------- ação "Ajustar a sensibilidade" ----------
// Uma pessoa vai e volta numa linha fixa na frente do sensor. O leque mostra até onde o PIR percebe movimento em cada
// nível (sem medida: só a proporção). Na alta e na média ele a alcança; na baixa ela passa sem disparar.
const SENS_REACH = [0.55, 0.78, 1] // fração do leque cheio, por nível
const FAN_LEN = 4.2, FAN_Z = HD - 0.1, SENS_Z = FAN_Z + 2.65
const sensX = (t: number) => Math.sin(t * 0.9) * 2.0
function sensDetect() {
  const t = actionTime('sensibilidade')
  if (t < 1.2) return false
  const x = sensX(t), dz = SENS_Z - FAN_Z
  const reach = FAN_LEN * SENS_REACH[useShowroom.getState().pirLevel - 1]
  return Math.abs(x) < dz && Math.hypot(x, dz) < reach
}

// ---------- mão da ação "Mexer no sensor" (efeito, fora do aparelho) ----------
// Pegada de garrafa pela direita, na altura da lente PIR: a palma encosta no lado direito do corpo, os dedos dão a
// volta pela frente (é o que aparece de frente) e o polegar fica atrás. O antebraço sai para trás e para a direita, na
// manga. Tudo em cápsulas, juntado numa malha só (pele) mais a manga. Eixo do corpo na origem; mão de tamanho real
// (palma ~85 mm).
const HAND_Y = -0.36
const HAND_OUT = new THREE.Vector3(0.75, 0.05, -0.4).normalize() // por onde a mão chega e vai embora
function handGeometries() {
  const skin: THREE.BufferGeometry[] = []
  const at = (r: number, phi: number, y: number) => new THREE.Vector3(r * Math.cos(phi), y, r * Math.sin(phi))
  const up = new THREE.Vector3(0, 1, 0)
  const capsule = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const d = b.clone().sub(a)
    const g = new THREE.CapsuleGeometry(r, Math.max(0.002, d.length()), 4, 10)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize()))
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
    g.deleteAttribute('uv')
    skin.push(g)
  }
  const PHI_W = -0.55, PHI_K = 0.6 // palma: do pulso (lado de trás) até os nós dos dedos (lado da frente)
  const fingers = [
    { y: 0.25, r: 0.1, len: 0.92 }, // indicador
    { y: 0.07, r: 0.105, len: 1.02 }, // médio
    { y: -0.1, r: 0.1, len: 0.95 }, // anelar
    { y: -0.26, r: 0.088, len: 0.76 }, // mínimo
  ]
  for (const f of fingers) {
    // ossos da palma: cápsulas grossas lado a lado formam a palma curva; os nós dos dedos saltam um pouco
    capsule(at(HW + 0.13, PHI_W + 0.05, f.y * 0.8), at(HW + 0.13, PHI_K, f.y), 0.12)
    // falanges: três segmentos seguindo a curva do corpo, mais finos para a ponta
    const rr = HW + f.r + 0.012
    let phi = PHI_K
    ;[0.45, 0.3, 0.25].forEach((k, i) => {
      const dphi = (f.len * k) / rr
      capsule(at(rr, phi, f.y), at(rr, phi + dphi, f.y), f.r * (1 - i * 0.07))
      phi += dphi
    })
  }
  // polegar: sai da base da palma e sobe pela traseira
  capsule(at(HW + 0.19, PHI_W - 0.02, 0.06), at(HW + 0.14, PHI_W - 0.3, 0.19), 0.14)
  capsule(at(HW + 0.14, PHI_W - 0.3, 0.19), at(HW + 0.115, PHI_W - 0.48, 0.33), 0.115)
  capsule(at(HW + 0.115, PHI_W - 0.48, 0.33), at(HW + 0.105, PHI_W - 0.56, 0.46), 0.1)
  // pulso e antebraço: tangente ao corpo no pulso, abrindo para fora
  const w = at(HW + 0.2, PHI_W - 0.08, 0)
  const dir = new THREE.Vector3(Math.sin(PHI_W), 0, -Math.cos(PHI_W)).multiplyScalar(0.5)
    .add(new THREE.Vector3(Math.cos(PHI_W), 0, Math.sin(PHI_W)).multiplyScalar(0.85)).setY(-0.1).normalize()
  capsule(w, w.clone().addScaledVector(dir, 1.0), 0.24)
  // manga: tubo fechado de tecido, do meio do antebraço para fora
  const sleeve = new THREE.CylinderGeometry(0.29, 0.32, 2.4, 18)
  sleeve.translate(0, 1.2, 0)
  sleeve.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir))
  sleeve.translate(...w.clone().addScaledVector(dir, 0.62).toArray())
  sleeve.deleteAttribute('uv')
  return { skin: mergeGeometries(skin)!, sleeve }
}

/**
 * Fotossensor: cilindro de topo plano com a borda arredondada. Na frente, o capuz da câmera (um ressalto em pera,
 * saliente em cima, que vira o bolso escavado da lente e da janela oval do LED); a lente PIR grande e fosca logo
 * abaixo, recuada na sua moldura, e o logo no queixo; base cinza embaixo. Atrás, a tampa curva das pilhas (3 AA) na
 * metade de cima e, na de baixo, o suporte de parede cinza: dois trilhos em Λ sobre uma placa com um parafuso. Frente em +Z.
 */
export function Fotossensor({ interactive = false, flash }: DeviceProps & { flash?: () => number }) {
  const tilt = useRef<THREE.Group>(null!)
  const cover = useRef<THREE.Group>(null!)
  const flip = useRef<THREE.Group>(null!)
  const cellRefs = useRef<(THREE.Group | null)[]>([])
  const arrowPhase = useActionPhase('tampa-foto', [0.8, 1.5], true)
  const person = useRef<THREE.Group>(null!)
  const walker = useRef<THREE.Group>(null!)
  const sensTag = useRef<HTMLDivElement>(null)
  const sensShow = useRef(0)
  const alertV = useRef(0)
  const hand = useRef<THREE.Group>(null!)
  const handG = useMemo(handGeometries, [])
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4a083', roughness: 0.6 }), [])
  const g = G()
  // base e suporte de parede: o mesmo plástico cinza fosco
  const baseMat = useMemo(() => { const m = M.grey.clone(); m.color.set('#acaca8'); return m }, [])
  // fundo da janela do LED: a plaquinha verde vista através do cristal (clone do preto do furo, mesma flag)
  const winBoard = useMemo(() => { const m = M.hole.clone(); m.color.set('#1f4d2b'); return m }, [])
  const springMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b87333', roughness: 0.38, metalness: 1 }), [])
  const shellMat = useMemo(() => { const m = M.white.clone(); m.side = THREE.DoubleSide; return m }, [])
  const lensBack = useMemo(() => new THREE.MeshStandardMaterial({ color: '#bfc4ca', roughness: 0.7 }), []) // janela translúcida, um pouco mais escura que o corpo (fotos)
  const pirMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#f1f2f3', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true, opacity: 0.8, envMapIntensity: 1.4 }), [])
  const pirPhase = useActionPhase('pir', [0, 3.1, 5.9])
  const camPhase = useActionPhase('camera', [1.0, 6.4])
  const sabPhase = useActionPhase('sabotagem', [1.7, 2.6, 8.6])
  const sensPhase = useActionPhase('sensibilidade')

  const flashPower = () => {
    if (flash) return flash()
    const t = actionTime('camera')
    return t < 0 ? 0 : bump(t, 0.55, 0.65, 0.75, 1.3)
  }

  useFrame((_, dt) => {
    if (!interactive) return
    // suporte: o fotossensor é fixo nele e os dois giram juntos para a esquerda e para a direita, sempre em pé (não
    // inclina), na articulação com a peça de fixação da parede, que fica parada
    const ts = actionTime('suporte')
    const amp = ts < 0 ? 0 : bump(ts, 0, 0.8, 7, 8)
    // sabotagem: a mão chega, pega o sensor pelo lado e o sacode para os lados (gira na articulação), e vai embora
    const tb = actionTime('sabotagem')
    const shake = tb < 0 ? 0 : bump(tb, 1.15, 1.45, 3.3, 3.7) * (Math.sin((tb - 1.15) * 10.5) * 0.12 + Math.sin((tb - 1.15) * 3.4) * 0.07)
    const pan = Math.sin(ts * 1.3) * 0.45 * amp + shake
    tilt.current.rotation.y = pan
    const ease = (x: number) => 1 - Math.pow(1 - x, 3)
    const away = tb < 0 ? 1 : Math.max(1 - ease(seg(tb, 0.1, 1.15)), Math.pow(seg(tb, 3.8, 4.8), 2))
    hand.current.visible = useShowroom.getState().warm || (tb >= 0 && away < 0.999)
    // a mão gira junto com o sensor, em volta da mesma articulação
    const hx = HAND_OUT.x * away * 2.2, hz = HAND_OUT.z * away * 2.2 - PAN[2], c = Math.cos(pan), sn = Math.sin(pan)
    hand.current.rotation.y = pan
    hand.current.position.set(hx * c + hz * sn, HAND_Y + HAND_OUT.y * away * 2.2, -hx * sn + hz * c + PAN[2])
    // troca das pilhas: o sensor vira de costas; aperta-se a aba de cima e a tampa abre pelo alto, girando nas
    // presilhas de baixo (~30°), e sai para cima e para trás. As 3 pilhas velhas saem uma a uma, as novas entram, a
    // tampa volta, fecha com um clique e o sensor vira de frente. Abrir a tampa não dispara nada (não há tamper)
    const tt = actionTime('tampa-foto')
    const sm = (x: number) => x * x * (3 - 2 * x)
    const at = (a: number, b: number) => (tt < 0 ? 0 : sm(seg(tt, a, b)))
    // (no modo de referência a câmera já está atrás: o aparelho não vira)
    flip.current.rotation.y = REF_ON ? 0 : (at(0, 0.8) - at(7.9, 8.7)) * Math.PI
    const press = tt < 0 ? 0 : bump(tt, 0.9, 1.0, 1.1, 1.2) // a aba de cima é apertada
    const clic = tt < 0 ? 0 : bump(tt, 7.3, 7.38, 7.44, 7.6) * 0.012
    const open = at(1.2, 1.9) * (1 - at(6.7, 7.3)), lift = at(2.0, 2.7) * (1 - at(5.9, 6.6))
    cover.current.rotation.x = -open * 0.52
    cover.current.position.set(0, -press * 0.012 + lift * 0.22, -lift * 0.5 + clic)
    for (let i = 0; i < 3; i++) {
      const c = cellRefs.current[i]
      if (!c) continue
      if (tt < 0) { c.position.set(0, 0, 0); continue }
      const d = i * 0.3
      if (tt < 4.3 + d) {
        // a velha sai: para trás (para fora do compartimento) e depois para o lado
        const o = seg(tt, 2.9 + d, 3.7 + d)
        c.position.set(sm(Math.max(0, o * 2 - 1)) * 1.9, 0, -sm(Math.min(1, o * 2)) * 0.35)
      } else {
        // a nova vem do outro lado e entra no lugar
        const n = seg(tt, 4.3 + d, 5.1 + d)
        c.position.set(-(1 - sm(Math.min(1, n * 2))) * 1.9, 0, -(1 - sm(Math.max(0, n * 2 - 1))) * 0.35)
      }
    }
    // no aquecimento, os efeitos que só aparecem numa ação ficam visíveis uma vez, para compilar os shaders deles
    const warm = useShowroom.getState().warm
    // PIR: a pessoa passa pelo campo e dispara
    const tp = actionTime('pir')
    person.current.visible = warm || (tp > 2.3 && tp < 6.8)
    if (tp >= 0) {
      person.current.position.x = personX(tp)
      person.current.position.y = FAN_Y + Math.abs(Math.sin(tp * 7)) * 0.03
    }
    alertV.current += (pirAlert() - alertV.current) * Math.min(1, dt * 10)
    // sensibilidade: o leque cresce ou encolhe suave conforme o nível; a pessoa vai e volta
    const tsn = actionTime('sensibilidade')
    const target = tsn < 0 ? 0 : SENS_REACH[useShowroom.getState().pirLevel - 1] * Math.min(1, tsn / 0.8)
    sensShow.current += (target - sensShow.current) * Math.min(1, dt * 6)
    walker.current.visible = warm || tsn >= 0
    if (tsn >= 0) {
      walker.current.position.x = sensX(tsn)
      walker.current.position.y = FAN_Y + Math.abs(Math.sin(tsn * 6)) * 0.03
      walker.current.rotation.y = Math.cos(tsn * 0.9) >= 0 ? 0 : Math.PI
    }
    const tag = sensTag.current
    if (tag) {
      const on = sensDetect()
      tag.textContent = tsn < 1.2 ? '' : on ? 'Movimento detectado' : 'Fora do alcance: não dispara'
      tag.style.background = on ? 'hsl(0 84% 60%)' : 'rgba(0,0,0,.65)'
      tag.style.opacity = tsn < 1.2 ? '0' : '1'
    }
  })

  // LED de status: azul (como no aparelho); pisca fraco em repouso e acende forte quando o PIR detecta
  const sampleStatus = (t: number, o: { color: string; on: number }) => {
    const al = interactive ? alertV.current : 0
    o.color = '#0f5bff'
    o.on = al > 0.5 ? 1 : t % 3 < 0.25 ? 0.9 : 0.25
  }

  return (
    <DeviceCtx.Provider value={{ deviceId: 'fotossensor', interactive }}>
      <group ref={flip}>
      <group position={PAN}>
        <group ref={tilt}>
          <group position={[-PAN[0], -PAN[1], -PAN[2]]}>
            {/* corpo: casca única com o rebaixo do capuz e o compartimento das pilhas; logo, frisos e berço */}
            {/* frente da casca: capuz, rebaixo do PIR, logo. Na vista explodida vai para a frente */}
            <ClickablePart follow="corpo" explode={[0, UP, 1.05]}>
              <mesh geometry={g.shellFront} material={shellMat} castShadow />
              {/* logo no queixo, deitado na rampa */}
              <LogoGroove r={LOGO_R} position={[0, LOGO_Y, HD - lensRecess(0, LOGO_Y) + 0.004]} rotation={[-0.5, 0, 0]} />
              {/* por dentro, atrás da lente PIR: o funil que leva até o sensor (aparece no Raio-X e no Explodir) */}
              <mesh geometry={g.funnel} material={shellMat} />
            </ClickablePart>
            {/* corpo traseiro: fica parado; leva os frisos, o parafuso lateral e o berço das pilhas */}
            <ClickablePart follow="corpo" explode={[0, UP, 0]}>
              <mesh geometry={g.shellBack} material={shellMat} castShadow />
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
                    <mesh key={d} material={M.metal} position={[x, CELL.y + (i % 2 ? -1 : 1) * (CELL.len / 2 + d + 0.006), -CELL.s]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.05 - d * 0.6, 0.006, 6, 20]} /></mesh>
                  ))}
                  <mesh material={M.metal} position={[x, CELL.y + (i % 2 ? 1 : -1) * (CELL.len / 2 + 0.034), -CELL.s]}><boxGeometry args={[0.09, 0.006, 0.09]} /></mesh>
                </group>
              ))}
            </ClickablePart>

            {/* a câmera e o LED ficam no bolso do capuz: a lente no alto, sob a sobrancelha; o LED na rampa */}
            {/* lente: círculo preto pequeno (~7 mm) com aro escuro, quase na vertical */}
            <ClickablePart id="camera">
              <group position={camAt(CAM_H)} rotation={[0.12, 0, 0]}>
                <mesh material={M.blackGloss} position={[0, 0, 0.001]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(4.3), mm(4.3), 0.012, 32]} /></mesh>
                <mesh material={M.lens} position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(3.5), mm(3.5), 0.008, 32]} /></mesh>
                {[0.014, 0.024].map((r) => <mesh key={r} material={M.greyDark} position={[0, 0, 0.0125]}><torusGeometry args={[r, 0.002, 6, 32]} /></mesh>)}
              </group>
            </ClickablePart>
            {/* janela oval vertical do LED, no meio do bolso: cristal com a plaquinha verde atrás; o flash (chip
                amarelo) fica na metade de baixo e acende dentro dela */}
            <ClickablePart id="flash">
              <group position={camAt(LEDWIN_H)} rotation={CAM_ROT}>
                <mesh geometry={g.win} material={winBoard} position={[0, 0, -0.008]} />
                <mesh geometry={g.win} material={M.crystal} position={[0, 0, -0.004]} />
                <Led sample={(_, o) => { const p = flashPower(); o.color = '#fff6c8'; o.on = p * 3 }} baseColor="#d8c040" position={[0, -mm(3.2), 0.004]}>
                  <boxGeometry args={[mm(3), mm(3), 0.003]} />
                </Led>
              </group>
            </ClickablePart>
            {/* LED de status azul, no alto da janela */}
            <ClickablePart id="led">
              <group position={camAt(LEDWIN_H)} rotation={CAM_ROT}>
                <Led on="shell" sample={sampleStatus} position={[0, mm(3.4), 0.004]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.016, 0.016, 0.004, 16]} />
                </Led>
              </group>
            </ClickablePart>

            {/* lente PIR: painel fosco grande, branco-leitoso, curvo como o corpo e ~9 mm para dentro dele, com a linha fina em volta */}
            <ClickablePart id="pir">
              <mesh geometry={g.pirFrame} material={M.partition} />
              <mesh geometry={g.pirBack} material={lensBack} />
              <mesh geometry={g.pirLens} material={pirMat} />
            </ClickablePart>

            {/* ===== por dentro (pelos vídeos de fábrica): geometria simples, poucos segmentos, materiais que já existiam;
                sem etiquetas nem textos. O corpo traseiro (a calha branca) é a metade de trás da casca. ===== */}
            {/* placa principal: verde, vertical, atrás do funil, da altura dele até perto do topo */}
            <ClickablePart id="placas">
              <group position={[0, 0, PCB_DZ]}>
              <mesh material={M.pcb} position={[0, (BOARD.y0 + BOARD.y1) / 2, 0.1]}><boxGeometry args={[BOARD.hw * 2, BOARD.y1 - BOARD.y0, 0.02]} /></mesh>
              <mesh material={M.chip} position={[-0.16, H(62), 0.116]}><boxGeometry args={[0.1, 0.1, 0.014]} /></mesh>
              <mesh material={M.chip} position={[0.17, H(32), 0.116]}><boxGeometry args={[0.08, 0.12, 0.014]} /></mesh>

              <mesh geometry={g.smdTan} material={M.smdTan} />
              <mesh geometry={g.smdBlack} material={M.chip} />
              <mesh geometry={g.smdMetal} material={M.metal} />
              <mesh geometry={g.smdGold} material={M.gold} />
              </group>
            </ClickablePart>
            {/* sensor PIR: cilindro metálico (~9 × 5 mm) com a janelinha escura, no fundo do funil, no meio da lente PIR */}
            <ClickablePart id="sensor-pir">
              <mesh material={M.metal} position={[0, H(49), PCB_DZ + 0.11 + mm(2.5)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(4.5), mm(4.5), mm(5), 14]} /></mesh>
              <mesh material={M.hole} position={[0, H(49), PCB_DZ + 0.11 + mm(5) + 0.001]}><planeGeometry args={[mm(3.6), mm(3.6)]} /></mesh>
            </ClickablePart>
            {/* módulo da câmera, pelo CAD: um suporte branco preso na frente da placa principal (abas laterais, paredes e
                uma frente com janela), com a plaquinha da câmera apoiada em dois pinos logo atrás do furo da lente (~14 mm,
                lente de ~7 mm; só ~8 mm de fundo até o furo) e, na janela de baixo, a plaquinha verde dos LEDs */}
            <ClickablePart id="modulo-camera">
              {([
                // frente: parte de cima (atrás do furo da lente) e travessa de baixo
                [0, 115.5, 33, 19, 68.5, 71], [0, 79, 33, 6, 68.5, 71],
                // paredes dos lados, da frente até as abas
                [-15, 100, 3, 50, 55, 71], [15, 100, 3, 50, 55, 71],
                // abas laterais e pés que encostam na placa principal
                [-21.5, 100, 11, 50, 55, 57], [21.5, 100, 11, 50, 55, 57], [-26, 100, 2, 50, 46.5, 55], [26, 100, 2, 50, 46.5, 55],
                // os dois pinos onde a plaquinha da câmera se apoia
                [-4.5, 115, 2, 12, 71, 75], [4.5, 115, 2, 12, 71, 75],
              ] as const).map(([x, h, w, hh, z0, z1]) => (
                <mesh key={`${x}-${h}-${z0}`} material={M.white} position={[mm(x), H(h), ZC((z0 + z1) / 2)]}><boxGeometry args={[mm(w), mm(hh), mm(z1 - z0)]} /></mesh>
              ))}
              {/* câmera: plaquinha verde, o suporte preto da lente e a lente, apontando para o furo do capuz */}
              <group position={[0, H(110), ZC(75)]} rotation={[0.12, 0, 0]}>
                <mesh material={M.pcb} position={[0, 0, mm(0.6)]}><boxGeometry args={[mm(14), mm(14), mm(1.2)]} /></mesh>
                <mesh material={M.chip} position={[0, 0, mm(1.2 + 1.75)]}><boxGeometry args={[mm(8.5), mm(8.5), mm(3.5)]} /></mesh>
                <mesh material={M.chip} position={[0, 0, mm(4.7 + 1.5)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(3.5), mm(3.5), mm(3), 20]} /></mesh>
                <mesh material={M.lens} position={[0, 0, mm(7.75)]}><circleGeometry args={[mm(2.4), 20]} /></mesh>
              </group>
              <group position={[0, H(93), BOARD.z + 0.01 + mm(23)]} rotation={CAM_ROT}>
                <mesh material={M.pcb}><boxGeometry args={[mm(24), mm(22), mm(1.6)]} /></mesh>
                {[-1, 1].map((sx) => <mesh key={sx} material={M.smdTan} position={[sx * mm(6), mm(5), mm(1)]}><boxGeometry args={[mm(2), mm(1.2), mm(0.8)]} /></mesh>)}
                <mesh material={M.chip} position={[mm(-5), mm(-6), mm(1)]}><boxGeometry args={[mm(4), mm(3), mm(0.9)]} /></mesh>
                {/* o LED de status de verdade fica aqui; com o aparelho explodido, é ele que acende (a janela da carcaça apaga) */}
                <Led on="board" sample={sampleStatus} position={[0, mm(3.4), mm(1)]}><boxGeometry args={[mm(2.5), mm(1.6), mm(1)]} /></Led>
              </group>
            </ClickablePart>
            {/* antena: mola de cobre soldada na borda de baixo da placa principal, pendurada até perto da base */}
            <ClickablePart id="antena">
              <mesh geometry={g.spring} material={springMat} position={[0, BOARD.y0 - 0.2, BOARD.z]} />
            </ClickablePart>

            {/* luva do suporte de parede: faz parte da base cinza; o encaixe em Λ e o parafuso de trava ficam atrás */}
            <ClickablePart id="suporte">
              <mesh geometry={g.sleeve} material={baseMat} castShadow />
              <group position={[0, H(25), WALL.floor - 0.001]} rotation={[0, Math.PI, 0]}>
                <mesh material={M.metal} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, mm(0.6)]}><cylinderGeometry args={[mm(3), mm(3), mm(1.2), 20]} /></mesh>
                <mesh material={M.greyDark} position={[0, 0, mm(1.25)]} rotation={[0, 0, 0.6]}><planeGeometry args={[mm(4), mm(0.7)]} /></mesh>
                <mesh material={M.greyDark} position={[0, 0, mm(1.26)]} rotation={[0, 0, 0.6 + Math.PI / 2]}><planeGeometry args={[mm(4), mm(0.7)]} /></mesh>
              </group>
            </ClickablePart>
            {/* faixa cinza da base, um pouco recuada */}
            <ClickablePart id="base">
              <mesh geometry={g.base} material={baseMat} castShadow />
              {/* linha da emenda com o corpo: fica com a base (não sobe junto com o corpo na vista explodida) */}
              <mesh geometry={g.baseSeam} material={M.partition} />
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
                    <mesh material={M.hole} position={[0, COVER_TOP - 0.04, -(HD + 0.0075)]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.11, 0.016]} /></mesh>
                  </group>
                </group>
              </group>
            </ClickablePart>
            {/* 3 pilhas AA na vertical, lado a lado, com a polaridade alternada: corpo preto e faixa dourada no lado do +, sem marca nem texto */}
            <ClickablePart id="pilhas">
              {CELL_X.map((x, i) => (
                <group key={x} ref={(gr) => { cellRefs.current[i] = gr }}>
                  <group position={[x, CELL.y, -CELL.s]} rotation={[0, 0, i % 2 ? 0 : Math.PI]}>
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
            {interactive && arrowPhase === 0 && (
              <Html position={[0, 0.92, -(HD + 0.1)]} center style={{ pointerEvents: 'none' }}>
                <div className="fx-tag -translate-y-7 text-center text-xs font-semibold text-accent">aba<div className="text-xl leading-none">▼</div></div>
              </Html>
            )}
          </group>
        </group>
      </group>

      {/* placa de parede (solta): fica parafusada na parede e parada quando o sensor gira; a guia entra no encaixe
          da luva. Na frente da guia, os dois furos dos parafusos da parede */}
      <ClickablePart id="fixacao">
        <group>
          <mesh geometry={g.plate} material={baseMat} castShadow />
          {[[13, 1.6], [55, 1]].map(([h, sx]) => (
            <group key={h} position={[0, H(h), WALL.guide + 0.004]} scale={[sx, 1, 1]}>
              <mesh material={M.hole}><circleGeometry args={[mm(3.4), 20]} /></mesh>
              <mesh material={M.metal} position={[0, 0, 0.001]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(2.6), mm(2.6), mm(0.6), 16]} /></mesh>
            </group>
          ))}
        </group>
      </ClickablePart>

      </group>

      {interactive && (
        <>
          <CameraFlash power={flashPower} position={[0, LEDWIN_Y + 0.04, HD + 0.1]} />
          {/* a foto chega no aplicativo: a tela "Imagem", com a pessoa marcada pela IA (como no app oficial) */}
          {camPhase === 0 && (
            <Html position={[-1.35, LENS_Y - 0.35, HD + 0.3]} center style={{ pointerEvents: 'none' }}>
              {/* o celular vem de longe até a frente, já com a tela "Imagem" do app aberta; a notificação passa por cima */}
              <div className="fx-tag overflow-hidden rounded-[24px] border-[5px] border-[#1b1d22] bg-[#0b0c10] shadow-2xl"
                style={{ animation: 'phone-in 0.9s cubic-bezier(.16,.84,.3,1) both' }}>
                <ImageScreen scale={0.6} />
              </div>
            </Html>
          )}
          {/* mão que mexe no sensor (gira junto com ele) */}
          <group ref={hand} visible={false}>
            <mesh geometry={handG.skin} material={skinMat} userData={{ fx: true }} raycast={() => null} castShadow />
            <mesh geometry={handG.sleeve} material={M.greyDark} userData={{ fx: true }} raycast={() => null} castShadow />
          </group>
          {(sabPhase === 0 || sabPhase === 1) && (
            <Html position={[0.3, 1.05, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag whitespace-nowrap rounded-full bg-alert px-4 py-1.5 text-sm font-bold text-white">Sabotagem detectada</div>
            </Html>
          )}
          {/* o aviso chega no aplicativo: notificação e o evento em "Últimos eventos" */}
          {sabPhase === 1 && (
            <Html position={[-1.2, 0.0, HD + 0.3]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag overflow-hidden rounded-[24px] border-[5px] border-[#1b1d22] bg-white shadow-2xl"
                style={{ animation: 'phone-in 0.9s cubic-bezier(.16,.84,.3,1) both' }}>
                <SabotageScreen scale={0.6} />
              </div>
            </Html>
          )}
          <DetectionFan position={[0, FAN_Y, HD - 0.1]} length={4.2} labels={pirPhase >= 0} alert={() => alertV.current}
            show={() => { const t = actionTime('pir'); return t < 0 ? sensShow.current : bump(t, 0, 1.2, 13, 14) }} />
          <group ref={walker} position={[0, FAN_Y, SENS_Z]} visible={false}><LowPolyPerson scale={1.5} /></group>
          {sensPhase === 0 && (
            <Html position={[0, 1.0, SENS_Z]} center style={{ pointerEvents: 'none' }}>
              <div ref={sensTag} className="fx-tag whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold text-white transition-colors" style={{ opacity: 0 }} />
            </Html>
          )}
          <group ref={person} position={[0, FAN_Y, PERSON_Z]} visible={false}><LowPolyPerson scale={1.5} /></group>
          {pirPhase === 1 && alertBadge()}
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
