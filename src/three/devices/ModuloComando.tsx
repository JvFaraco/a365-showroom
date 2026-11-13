import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { boxesGeometry, roundedRectGeometry, smoothLatheY, stadiumGeometry, wire, type Block } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import { LED_BY_ID, ledSample } from '../../data/ledStates'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { CommLinks } from '../fx/CommLinks'
import { VoiceWaves } from '../fx/VoiceWaves'
import { HoldRing } from '../fx/HoldRing'

// ---------- medidas (Y para cima, frente em +Z) ----------
// Ficha (1 unidade = 80 mm): planta quase redonda de 144 × 145 mm com a cauda; corpo com 38 mm de altura.
const BOTTOM = -0.4, SQUASH = 0.6 // o corpo foi modelado mais alto; SQUASH leva a altura a ~0,475 (38 mm)
const RF = 0.9 // raio de referência do corpo (72 mm)
const R_TOP = 0.855 // raio do topo, contando o ombro arredondado (~68 mm): o topo é largo, quase do tamanho do corpo
const YC = 0.39 // altura do topo (antes do achatamento): plano e nivelado
const TILT = 0 // o topo não é rampa: fica paralelo à base
const CAPSULE_Z = 0.66 // a cápsula do LED/190 fica na frente, perto da borda do topo
const PCB_Y = -0.08 // topo da placa
const VIAS_TO: [number, number, number][] = [[-1.5, 1.9, -0.6], [0, 2.3, -0.9], [1.5, 1.9, -0.6]]
const VIAS_FROM: [number, number, number] = [0, 0.2, 0]

const Y_SIDE = 0.04 // borda de baixo da tampa nos lados, onde a base cinza aparece (~21 mm do fundo)
const DEG = Math.PI / 180

const FOOT_T = 127 * DEG // os dois fechos de trás ficam a ~127° da frente, um de cada lado
const FOOT_OUT = [0.03, 0.05] // quanto a ponta do apoio da frente e dos de trás sai além do contorno dos arcos, no fundo

/**
 * Lateral da tampa. Sai do ombro do topo (raio R_TOP) e desce abrindo. Nos arcos ela é curta e quase reta: a borda
 * fica só um pouco mais larga que o topo. Nos três apoios ela continua até o fundo e abre mais: vista de cima, a
 * tampa tem três pontas (a da frente e as duas de trás). Devolve o raio na altura y.
 */
function wallR(t: number, y: number) {
  const [front, rear] = lidFeet(t), lf = Math.pow(1 - front, 1.5), lr = Math.pow(1 - rear, 1.5)
  // raio no fundo: ~77 mm na ponta da frente e ~79 mm nas de trás; nos arcos, o que dá ~71 mm na altura da borda
  const foot = 0.934 + FOOT_OUT[0] * lf + FOOT_OUT[1] * lr
  const s = Math.min(1, Math.max(0, (YC - y) / (YC - BOTTOM)))
  // nos apoios a lateral abre mais em cima e desce quase reta depois (perfil levemente abaulado)
  return R_TOP + (foot - R_TOP) * (s + 0.12 * Math.max(lf, lr) * Math.sin(Math.PI * s))
}

/**
 * Borda de baixo da tampa em volta do contorno: [raio, altura]. A tampa encosta no fundo em TRÊS pontos, que é onde
 * ficam os fechos: na frente (de frente, a tampa cobre tudo), atrás à esquerda e atrás à direita. Entre eles a borda
 * sobe em arco: nos dois lados, onde a base cinza aparece, e atrás, por onde saem a antena e os cabos. Como a
 * lateral é um cone, a borda dos arcos fica mais para dentro que os apoios.
 */
function lidRim(t: number): [number, number] {
  const [front, rear] = lidFeet(t), y = BOTTOM + (Y_SIDE - BOTTOM) * Math.min(front, rear)
  return [wallR(t, y), y]
}

/** Quanto a borda já subiu (0 no apoio, 1 no alto do arco), contando do apoio da frente e dos dois de trás. */
function lidFeet(t: number): [number, number] {
  const a = Math.abs(Math.atan2(Math.sin(t), Math.cos(t))) // 0 na frente, π atrás
  const clamp = (x: number) => Math.min(1, Math.max(0, x))
  // na frente a borda sobe até os lados em linha reta para quem olha de frente: um V largo, de ponta estreita e arredondada
  const front = Math.pow(clamp((Math.sin(Math.min(a, Math.PI / 2)) - Math.sin(8 * DEG)) / (Math.sin(75 * DEG) - Math.sin(8 * DEG))), 1.05)
  const rear = 1 - Math.pow(1 - clamp((Math.abs(a - FOOT_T) - 4 * DEG) / (30 * DEG)), 1.5)
  return [front, rear]
}

/** Raio da lateral da tampa na altura y. Abaixo da borda não há tampa. */
function lidRadiusAt(t: number, y: number) {
  return y <= lidRim(t)[1] ? Infinity : wallR(t, y)
}

/**
 * Tampa: UMA superfície. Topo plano e nivelado (disco de raio R_TOP), canto arredondado e lateral que desce,
 * abrindo pouco nos arcos e mais nos três apoios. A borda de baixo segue lidRim() e dobra para dentro (dá espessura à borda).
 * Devolve duas malhas que dividem os mesmos vértices: o topo (fosco) e a lateral (com brilho).
 */
function lidGeometry() {
  const NT = 180, NF = 5, NC = 6, NS = 10, C = 0.065 // colunas; anéis do topo, do canto e da lateral; raio do canto
  const pos: number[] = [], uv: number[] = [], idxTop: number[] = [], idxSide: number[] = []
  const W = 2 + NF + NC + NS
  for (let i = 0; i <= NT; i++) {
    const t = (i / NT) * Math.PI * 2, sn = Math.sin(t), cs = Math.cos(t)
    const [er, ey] = lidRim(t)
    let dr = lidRadiusAt(t, YC - 0.06) - R_TOP, dy = -0.06
    const dl = Math.hypot(dr, dy); dr /= dl; dy /= dl // direção da lateral ao sair do canto
    const put = (r: number, y: number) => { pos.push(r * sn, y, r * cs); uv.push(r * sn * 3, r * cs * 3) }
    for (let j = 0; j <= NF; j++) put((R_TOP - C) * Math.pow(j / NF, 0.8), YC)
    const r0 = R_TOP + C * dr, y0 = YC + C * dy
    for (let j = 1; j <= NC; j++) {
      const k = j / NC, a = (1 - k) * (1 - k), m = 2 * k * (1 - k), c = k * k
      put(a * (R_TOP - C) + m * R_TOP + c * r0, a * YC + m * YC + c * y0)
    }
    for (let j = 1; j <= NS; j++) { const k = j / NS, y = y0 + (ey - y0) * k; put(j === NS ? er : r0 + (lidRadiusAt(t, y) - lidRadiusAt(t, y0)), y) }
    put(er - 0.022, ey) // a borda dobra para dentro
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < W - 1; j++) {
    const a = i * W + j, b = a + W
    ;(j < NF + NC ? idxTop : idxSide).push(a, a + 1, b, b, a + 1, b + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex([...idxTop, ...idxSide])
  g.computeVertexNormals()
  // fecha a emenda: a primeira e a última coluna compartilham a normal
  const n = g.attributes.normal
  for (let j = 0; j < W; j++) {
    const a = j, b = NT * W + j
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize()
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z)
  }
  const part = (index: number[]) => { const p = new THREE.BufferGeometry(); for (const k of ['position', 'uv', 'normal']) p.setAttribute(k, g.attributes[k]); p.setIndex(index); return p }
  return { top: part(idxTop), side: part(idxSide) }
}

// Fundo (pelo vídeo de fábrica). Tudo em coordenadas do corpo, antes do achatamento em Y.
const Y_BOT = BOTTOM
// Visto por baixo, com a antena para cima: o bolsão fica NO MEIO (um nada para a esquerda) e é um rasgo aberto na
// borda de trás, por onde saem os cabos; a antena sai ao lado dele, à direita (−X); o furo pequeno fica à esquerda (+X).
const POCKET = { x0: -0.2, x1: 0.3, z1: -0.22, d: 0.3 } // bolsão fundo dos cabos, no meio: começa em z1 e vai até a borda de trás, aberto
const PLATE = { x0: POCKET.x0 + 0.03, x1: POCKET.x1 - 0.03, z0: -0.78, z1: POCKET.z1 + 0.02 } // moldura da grade de som, na face funda
const LABEL = { x0: -0.3, x1: 0.3, z0: 0.0, z1: 0.3 } // rebaixo raso da etiqueta (fica vazio)
const RJ = { x: 0.0, y: Y_BOT + 0.145 } // RJ45 deitado, na PAREDE DA FRENTE do bolsão, com a boca virada para dentro dele
const GRILLE = { x: (POCKET.x0 + POCKET.x1) / 2, z: -0.565, pitch: 0.054 } // grade de som: hexágono de furos na face funda do bolsão
const K_WALL = 0.933, K_FLOOR = 0.867 // base cinza: tambor redondo de ~67 mm de raio (fica recuado sob a aba da tampa) e fundo de ~62 mm
const ANT_X = -0.35 // a antena não fica no centro: sai num ressalto ao lado do bolsão, sob o arco de trás da tampa
/** Altura depois do achatamento do corpo (para o que fica fora do grupo achatado). */
const sq = (y: number) => BOTTOM + (y - BOTTOM) * SQUASH
const NET_Z = POCKET.z1 - 0.13, POW_X = POCKET.x1 - 0.15 // posição encaixada dos plugues
const JACK = { y: Y_BOT + POCKET.d * 0.5, z: -0.56 } // entrada da fonte na parede esquerda (+X), a meia altura

/**
 * Base cinza: tambor redondo, mais estreito que a tampa (fica recuado sob a aba dela), com frisos verticais (os sulcos caem em cima das fendas do fundo),
 * borda de baixo arredondada e fundo com o rebaixo da etiqueta. O bolsão dos cabos é um RASGO: abre no fundo e
 * atravessa a parede de trás até a borda, que é por onde os cabos saem. A parede sobe até passar da borda da tampa.
 */
function baseGeometry() {
  type P = [number, number, number]
  // perfil: [fração do raio, altura, quanto do sulco]
  const NT = 360, prof: P[] = [
    [0.9, 0.13, 0], [K_WALL, 0.11, 1], [K_WALL, 0.03, 1], [K_WALL, -0.05, 1], [K_WALL, -0.13, 1], [0.925, -0.21, 1], [0.912, -0.3, 0.6],
    [0.898, -0.36, 0], [0.884, -0.39, 0], [K_FLOOR, Y_BOT, 0], // afina para o fundo; os sulcos somem antes da borda de baixo: por baixo, o contorno é liso
  ]
  const NP = prof.length, yTop = Y_BOT + POCKET.d // yTop: a face funda do bolsão
  // os frisos somem na largura do bolsão (a borda da abertura é lisa) e voltam aos poucos dos dois lados dela
  const tA = Math.PI - Math.asin(POCKET.x1 / (RF * K_FLOOR)), tB = Math.PI - Math.asin(POCKET.x0 / (RF * K_FLOOR))
  const fade = (t: number) => THREE.MathUtils.smoothstep(Math.max(tA - t, t - tB), 0, 8 * DEG)
  // onde a tampa cobre a base (queixo, cauda e acima da borda), a parede recua para dentro dela
  const rad = (t: number, k: number, y: number, w: number) => Math.min(RF * (k - 0.025 * w * fade(t) * Math.pow(0.5 + 0.5 * Math.cos(60 * t), 2.5)), lidRadiusAt(t, y) - 0.014)
  // colunas da parede. Na largura do bolsão a parede só existe acima da face funda: as colunas "abertas" param nela
  type Col = { p: P[]; open: boolean; edge?: P }
  const lift = (p: P[], edge: P) => p.map((q) => (q[1] < yTop ? edge : q))
  const column = (t: number): Col | null => {
    const p = prof.map(([k, y, w]) => { const r = rad(t, k, y, w); return [r * Math.sin(t), y, r * Math.cos(t)] as P })
    const inside = Math.cos(t) > 0 ? 0 : p.filter(([x]) => x > POCKET.x0 && x < POCKET.x1).length
    if (inside === 0) return { p, open: false }
    if (inside < NP) return null // em cima do batente: dá lugar à coluna exata do batente
    const rc = rad(t, K_WALL, yTop, 1), edge: P = [rc * Math.sin(t), yTop, rc * Math.cos(t)]
    return { p: lift(p, edge), open: true, edge }
  }
  // batente do rasgo: coluna reta, no plano x = xb
  const jamb = (xb: number) => {
    const t = Math.PI - Math.asin(xb / (RF * K_WALL)), at = (r: number, y: number): P => [xb, y, -Math.sqrt(r * r - xb * xb)]
    return { p: prof.map(([k, y, w]) => at(rad(t, k, y, w), y)), edge: at(rad(t, K_WALL, yTop, 1), yTop) }
  }
  const j1 = jamb(POCKET.x1), j0 = jamb(POCKET.x0)
  const cols: Col[] = []
  for (let i = 0, where = 0; i <= NT; i++) {
    const c = column((i / NT) * Math.PI * 2)
    if (!c) continue
    if (where === 0 && c.open) { cols.push({ p: j1.p, open: false }, { p: lift(j1.p, j1.edge), open: true, edge: j1.edge }); where = 1 }
    if (where === 1 && !c.open) { cols.push({ p: lift(j0.p, j0.edge), open: true, edge: j0.edge }, { p: j0.p, open: false }); where = 2 }
    cols.push(c)
  }
  const pos: number[] = [], idx: number[] = []
  for (const c of cols) for (const q of c.p) pos.push(...q)
  for (let i = 0; i < cols.length - 1; i++) {
    if (cols[i].open !== cols[i + 1].open) continue // os dois lados do batente não se ligam
    for (let j = 0; j < NP - 1; j++) {
      if (cols[i].open && prof[j][1] < yTop) continue // abaixo da face funda não há parede
      const a = i * NP + j, b = a + NP; idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const wall = new THREE.BufferGeometry()
  wall.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wall.setIndex(idx); wall.computeVertexNormals()
  // fundo: os mesmos pontos da parede (sem fresta), com o rasgo do bolsão no contorno e o recorte da etiqueta
  const sh = new THREE.Shape()
  let first = true
  const to = (x: number, z: number) => { first ? sh.moveTo(x, z) : sh.lineTo(x, z); first = false }
  cols.forEach((c, i) => {
    if (c.open) return
    to(c.p[NP - 1][0], c.p[NP - 1][2])
    if (cols[i + 1]?.open) { to(POCKET.x1, POCKET.z1); to(POCKET.x0, POCKET.z1) }
  })
  const rect = (r: { x0: number; x1: number; z0: number; z1: number }) => { const h = new THREE.Path(); h.moveTo(r.x0, r.z0); h.lineTo(r.x1, r.z0); h.lineTo(r.x1, r.z1); h.lineTo(r.x0, r.z1); h.closePath(); return h }
  sh.holes.push(rect(LABEL))
  const floor = new THREE.ShapeGeometry(sh, 24)
  floor.rotateX(Math.PI / 2); floor.translate(0, Y_BOT, 0)
  const pl = (pw: number, ph: number, rot: P, at: P) => { const g = new THREE.PlaneGeometry(pw, ph); g.rotateX(rot[0]); g.rotateY(rot[1]); g.translate(...at); return g }
  // paredes e teto de um rebaixo fechado, virados para dentro
  const inner = (r: { x0: number; x1: number; z0: number; z1: number }, d: number) => {
    const w = r.x1 - r.x0, l = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, y = Y_BOT + d / 2
    return [
      pl(w, l, [Math.PI / 2, 0, 0], [cx, Y_BOT + d, cz]), // teto, virado para baixo
      pl(w, d, [0, 0, 0], [cx, y, r.z0]), pl(w, d, [0, Math.PI, 0], [cx, y, r.z1]), // paredes de trás e da frente
      pl(l, d, [0, Math.PI / 2, 0], [r.x0, y, cz]), pl(l, d, [0, -Math.PI / 2, 0], [r.x1, y, cz]), // paredes dos lados
    ]
  }
  // leque de triângulos de um polígono plano, virado para `face`
  const fan = (pts: P[], face: P) => {
    const v = pts.map((q) => new THREE.Vector3(...q)), f = new THREE.Vector3(...face), out: number[] = []
    for (let i = 1; i < v.length - 1; i++) {
      const tri = [v[0], v[i], v[i + 1]]
      if (new THREE.Vector3().subVectors(tri[1], tri[0]).cross(new THREE.Vector3().subVectors(tri[2], tri[0])).dot(f) < 0) tri.reverse()
      for (const q of tri) out.push(q.x, q.y, q.z)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.computeVertexNormals(); return g
  }
  // bolsão: parede da frente, face funda até a borda de trás e os dois lados, que vão até a parede de fora
  const cx = (POCKET.x0 + POCKET.x1) / 2
  const side = (xb: number, j: { p: P[]; edge: P }, face: P) => fan([[xb, Y_BOT, POCKET.z1], ...j.p.filter((q) => q[1] < yTop).reverse(), j.edge, [xb, yTop, POCKET.z1]], face)
  const pocket = [
    pl(POCKET.x1 - POCKET.x0, POCKET.d, [0, Math.PI, 0], [cx, Y_BOT + POCKET.d / 2, POCKET.z1]),
    fan([[cx, yTop, POCKET.z1], [POCKET.x1, yTop, POCKET.z1], ...cols.filter((c) => c.open).map((c) => c.edge!), [POCKET.x0, yTop, POCKET.z1]], [0, -1, 0]),
    side(POCKET.x1, j1, [-1, 0, 0]), side(POCKET.x0, j0, [1, 0, 0]),
  ]
  // moldura da grade de som: placa de cantos redondos, um degrau abaixo da face funda
  const plate = roundedRectGeometry(PLATE.x1 - PLATE.x0, PLATE.z1 - PLATE.z0, 0.07, 0.012, 0.004)
  plate.rotateX(Math.PI / 2); plate.translate((PLATE.x0 + PLATE.x1) / 2, yTop - 0.004, (PLATE.z0 + PLATE.z1) / 2)
  const parts = [wall, floor, ...pocket, plate, ...inner(LABEL, 0.018)]
  for (const g of parts) g.deleteAttribute('uv')
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))
}

/** Placa verde: redonda, com o recorte onde encaixa a caixinha do alto-falante. */
function pcbGeometry() {
  const s = new THREE.Shape()
  const R = 0.76, x0 = POCKET.x0 - 0.04, x1 = POCKET.x1 + 0.04, zc = -(POCKET.z1 + 0.06) // recorte retangular grande, sobre o bolsão
  // contorno no plano (x, -z): começa depois do recorte e dá a volta
  const a0 = Math.asin(x1 / R), a1 = Math.PI * 2 + Math.asin(x0 / R)
  for (let i = 0; i <= 80; i++) { const a = a0 + ((a1 - a0) * i) / 80; const x = Math.sin(a) * R, y = Math.cos(a) * R; i ? s.lineTo(x, y) : s.moveTo(x, y) }
  s.lineTo(x0, zc); s.lineTo(x1, zc); s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 4 })
  g.rotateX(Math.PI / 2) // deita: (x, y) → (x, -z)... o recorte fica atrás (−Z)
  g.scale(1, 1, -1)
  g.computeVertexNormals()
  // UV pela posição, para as trilhas não esticarem
  const p = g.attributes.position, uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.6 + 0.5, p.getZ(i) * 0.6 + 0.5)
  return g
}

// Componentes pequenos da placa, em grupos ordenados perto dos CIs (como na placa real, sem texto nem etiqueta):
// fileiras ao longo de x ou de z, na face de cima da placa.
const rowX = (x: number, z: number, n: number, dx = 0.045, w = 0.03, d = 0.016, h = 0.012): Block[] => Array.from({ length: n }, (_, i) => [x + i * dx, PCB_Y + h / 2, z, w, h, d] as Block)
const rowZ = (x: number, z: number, n: number, dz = 0.045, w = 0.016, d = 0.03, h = 0.012): Block[] => Array.from({ length: n }, (_, i) => [x, PCB_Y + h / 2, z + i * dz, w, h, d] as Block)
const ic = (x: number, z: number, w: number, d = w, h = 0.016): Block => [x, PCB_Y + h / 2, z, w, h, d]

/** Fio dentro do corpo achatado em Y: a seção é compensada para continuar redonda depois do achatamento. */
function roundWire(points: [number, number, number][], radius: number) {
  const g = wire(points.map(([x, y, z]) => [x, y * SQUASH, z]), radius)
  g.scale(1, 1 / SQUASH, 1)
  return g
}

type Geo = ReturnType<typeof build>
let cache: Geo | null = null
function build() {
  return {
    // capacitores (bege), resistores e CIs (pretos), cristal e bobina (metal) e os pontos de teste (dourados)
    smdTan: boxesGeometry([...rowX(0.08, -0.1, 4), ...rowX(0.08, 0.08, 5), ...rowZ(0.36, -0.1, 4), ...rowZ(-0.2, -0.12, 3), ...rowZ(0.46, -0.08, 3, 0.05), ...rowX(-0.3, 0.62, 4), ...rowX(0.2, 0.64, 3), ...rowZ(-0.6, 0.12, 4, 0.05)]),
    smdBlack: boxesGeometry([ic(0.2, -0.01, 0.1), ic(-0.1, 0.03, 0.05, 0.04), ic(0.66, 0.03, 0.05, 0.06), ic(-0.52, 0.02, 0.05, 0.04, 0.014), ...rowX(0.1, -0.045, 3), ...rowZ(0.3, -0.1, 3), ...rowX(-0.26, 0.58, 3), ...rowZ(0.6, 0.1, 2, 0.05)]),
    smdMetal: boxesGeometry([ic(0.33, 0.07, 0.07, 0.03, 0.018), ic(0.44, -0.22, 0.06, 0.06, 0.03)]),
    smdGold: boxesGeometry(rowZ(-0.66, 0.1, 6, 0.045, 0.022, 0.022, 0.004)),
    lid: lidGeometry(),
    base: baseGeometry(),
    slit: new THREE.BoxGeometry(0.016, 0.004, 0.075), // fenda de ventilação
    foot: new THREE.CylinderGeometry(0.07, 0.075, 0.02, 20),
    capsuleRim: roundedRectGeometry(0.345, 0.168, 0.066, 0.012, 0.004), // aro prateado fino em volta da tecla
    capsule: roundedRectGeometry(0.318, 0.141, 0.052, 0.014, 0.005), // tecla branca do botão (~29 × 14 mm com o aro)
    paddle: stadiumGeometry(0.17, 1.2, 0.05, 0.014),
    pcb: pcbGeometry(),
    cone: smoothLatheY([[0.185, 0.04], [0.175, 0.046], [0.155, 0.036], [0.11, 0.02], [0.06, 0.012], [0.03, 0.03]], 48, 24),
    magnet: smoothLatheY([[0.064, 0.012], [0.064, 0.03], [0.062, 0.044], [0.05, 0.05], [0.001, 0.05]], 32, 16),
    hole: new THREE.CircleGeometry(0.018, 10),
    // cabos e fios
    // coaxial do Wi-Fi: rabicho curto até a placa
    coaxA: wire([[-0.42, PCB_Y + 0.045, 0.13], [-0.5, PCB_Y + 0.07, 0.05], [-0.56, PCB_Y + 0.06, -0.05], [-0.52, PCB_Y + 0.03, -0.12]], 0.007),
    // coaxial do 4G: do cartão do chip até a rosca da antena, pelo braço da placa ao lado do recorte
    coaxB: wire([[0.0, PCB_Y + 0.05, 0.16], [-0.16, PCB_Y + 0.085, 0.02], [-0.345, PCB_Y + 0.075, -0.2], [-0.355, PCB_Y + 0.06, -0.45], [ANT_X, PCB_Y + 0.02, -0.652]], 0.007),
    // antena de fio do rádio dos sensores: acompanha a borda da placa
    yellow: wire([[-0.52, PCB_Y + 0.02, -0.42], [-0.63, PCB_Y + 0.06, -0.2], [-0.7, PCB_Y + 0.07, 0.05], [-0.66, PCB_Y + 0.06, 0.3], [-0.56, PCB_Y + 0.03, 0.46]], 0.009),
    spkA: wire([[0.0, 0.02, -0.27], [-0.08, 0.03, -0.2], [-0.2, PCB_Y + 0.03, -0.14], [-0.24, PCB_Y + 0.012, -0.1]], 0.007),
    spkB: wire([[0.07, 0.02, -0.27], [-0.01, 0.03, -0.19], [-0.13, PCB_Y + 0.03, -0.11], [-0.2, PCB_Y + 0.012, -0.06]], 0.007),
    micA: wire([[0.36, -0.2, -0.26], [0.4, -0.1, -0.2], [0.38, PCB_Y + 0.03, -0.12], [0.33, PCB_Y + 0.012, -0.08]], 0.006),
    micB: wire([[0.39, -0.2, -0.24], [0.44, -0.1, -0.17], [0.42, PCB_Y + 0.03, -0.1], [0.37, PCB_Y + 0.012, -0.05]], 0.006),
    batA: wire([[0.6, PCB_Y + 0.03, -0.02], [0.7, PCB_Y + 0.03, 0.1], [0.74, PCB_Y - 0.04, 0.22]], 0.008),
    batB: wire([[0.6, PCB_Y + 0.03, -0.06], [0.72, PCB_Y + 0.03, 0.06], [0.76, PCB_Y - 0.04, 0.18]], 0.008),
    // cabos de rede e da fonte: saem deitados pela abertura de trás do bolsão
    netCable: roundWire([[0, 0, -0.08], [0, -0.03, -0.45], [-0.02, -0.06, -0.9], [-0.1, -0.08, -1.7]], 0.03),
    powCable: roundWire([[0, 0, -0.16], [0, -0.03, -0.45], [0.03, -0.06, -0.8], [0.16, -0.08, -1.5]], 0.024),
    plugCable: wire([[0, 0, 0], [-0.03, 0, -0.2], [0, -0.03, -0.5], [0.5, -0.05, -0.95], [1.5, -0.05, -0.9], [2.6, -0.05, -0.6]], 0.03),
  }
}
const G = () => (cache ??= build())


/**
 * Módulo de Comando. Tampa branca numa superfície só, com topo plano; a lateral encosta no fundo em três pontos
 * (frente, trás à esquerda e trás à direita, onde ficam os fechos) e sobe em arco entre eles; botão do 190 na
 * frente, com o LED no centro; base cinza redonda, recuada sob a aba da tampa, com o bolsão dos cabos
 * no meio da borda de trás e a antena saindo ao lado dele (fora do centro).
 * Por dentro, a placa verde real: cartão do chip 4G, módulo Wi-Fi, rádio dos sensores,
 * alto-falante na caixinha cinza, microfone, LED e botão sob a cápsula, e a bateria por baixo.
 */
export function ModuloComando({ interactive = false, ledOverride }: DeviceProps & { ledOverride?: () => keyof typeof LED_BY_ID | null }) {
  const g = G()
  const root = useRef<THREE.Group>(null!)
  const lid = useRef<THREE.Group>(null!)
  const antenna = useRef<THREE.Group>(null!)
  const pressA = useRef<THREE.Group>(null!)
  const pressB = useRef<THREE.Group>(null!)
  const plug = useRef<THREE.Group>(null!)
  const cables = useRef<THREE.Group>(null!)
  const netRef = useRef<THREE.Group>(null!)
  const powRef = useRef<THREE.Group>(null!)
  const fins = useRef<THREE.InstancedMesh>(null!)
  const holes = useRef<THREE.InstancedMesh>(null!)
  const shieldHoles = useRef<THREE.InstancedMesh>(null!)
  const inited = useRef(false)
  const cableMat = useMemo(() => fxBasic('#2a2d35'), [])
  const apronMat = useMemo(() => { const m = M.white.clone(); m.side = THREE.DoubleSide; return m }, [])
  // o disco do topo é fosco; a lateral tem o brilho do plástico. Mesmo material (clones), só muda o acabamento
  const topMat = useMemo(() => { const m = M.white.clone(); m.side = THREE.DoubleSide; m.roughness = 0.62; m.clearcoat = 0.06; return m }, [])
  const viasPhase = useActionPhase('antena', [4, 7.5, 10])
  const audioPhase = useActionPhase('audio', [1.2])
  const batPhase = useActionPhase('bateria-modulo', [2.2])
  const sosActive = useActionPhase('sos190') >= 0
  const hold = {
    onPointerDown: (e: { stopPropagation: () => void }) => { if (sosActive) { e.stopPropagation(); useShowroom.getState().set({ holding: true, holdMsg: '' }) } },
    onPointerUp: () => { if (sosActive) useShowroom.getState().set({ holding: false }) },
    onPointerLeave: () => { if (sosActive) useShowroom.getState().set({ holding: false }) },
  }

  useFrame(() => {
    if (!inited.current && fins.current && holes.current && shieldHoles.current) {
      const o = new THREE.Object3D()
      // fendas curtas e estreitas (ventilação) em volta do contorno inteiro, no fundo, perto da borda
      let n = 0
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, r = RF * 0.8, x = Math.sin(a) * r, z = Math.cos(a) * r
        if (z < -0.4 && x > ANT_X - 0.14 && x < POCKET.x1 + 0.06) continue // atrás do bolsão e do ressalto da antena não há fenda
        o.position.set(x, Y_BOT - 0.0015, z); o.rotation.set(0, a, 0); o.scale.setScalar(1)
        o.updateMatrix(); fins.current.setMatrixAt(n++, o.matrix)
      }
      fins.current.count = n
      // grade de som: 37 furos redondos em hexágono, na moldura da face funda do bolsão, virados para quem olha o fundo
      n = 0
      const HS = GRILLE.pitch, rows = [4, 5, 6, 7, 6, 5, 4]
      rows.forEach((cnt, j) => {
        for (let i = 0; i < cnt; i++) {
          o.position.set(GRILLE.x + (i - (cnt - 1) / 2) * HS, Y_BOT + POCKET.d - 0.016, GRILLE.z + (j - 3) * HS * 0.866)
          o.rotation.set(Math.PI / 2, 0, 0); o.scale.setScalar(1.15)
          o.updateMatrix(); holes.current.setMatrixAt(n++, o.matrix)
        }
      })
      n = 0
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        o.position.set(-0.595 + i * 0.05, PCB_Y + 0.0465, -0.375 + j * 0.05); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(0.55)
        o.updateMatrix(); shieldHoles.current.setMatrixAt(n++, o.matrix)
      }
      for (const m of [fins, holes, shieldHoles]) m.current.instanceMatrix.needsUpdate = true
      for (const m of [fins, holes, shieldHoles]) m.current.computeBoundingBox()
      inited.current = true
    }
    if (!interactive) return
    const s = useShowroom.getState()
    // antena: desrosqueia, sai e volta
    const ta = actionTime('antena')
    const out = ta < 0 ? 0 : bump(ta, 0, 1.5, 2.1, 3.6)
    antenna.current.position.z = -out * 0.4
    antenna.current.rotation.z = -out * Math.PI * 2
    // a cápsula inteira afunda ~1 mm enquanto o 190 é segurado
    const down = s.holding && s.action?.id === 'sos190' ? -0.012 : 0
    pressA.current.position.y = pressB.current.position.y = down
    // tomada sai ("sem energia")
    const tb = actionTime('bateria-modulo')
    plug.current.visible = tb >= 0
    // o plugue da fonte solta de lado, sai pela abertura de trás do bolsão e fica à vista, ao lado do módulo
    const off = tb < 0 ? 0 : 1
    plug.current.position.set(POW_X - off * seg(tb, 0.6, 1.0) * 0.06 + off * seg(tb, 1.5, 2.1) * 0.9, sq(JACK.y), JACK.z - off * seg(tb, 1.0, 1.6) * 0.6)
    // cabos de rede e de energia entram no bolsão e encaixam
    const tc = actionTime('cabos')
    cables.current.visible = tc >= 0
    if (tc >= 0) {
      // o cabo de rede vem de trás, pela abertura do bolsão, e entra deitado no RJ45, que fica na parede da frente
      netRef.current.position.set(RJ.x, RJ.y, NET_Z - (1 - seg(tc, 0.3, 1.0)) * 0.75 - (1 - seg(tc, 1.0, 1.4)) * 0.16 + bump(tc, 1.35, 1.5, 1.55, 1.7) * 0.015)
      // o plugue da fonte vem de trás pelo mesmo caminho e entra de lado, na parede esquerda
      powRef.current.position.set(POW_X - (1 - seg(tc, 2.2, 2.8)) * 0.06 + bump(tc, 2.75, 2.9, 2.95, 3.1) * 0.01, JACK.y, JACK.z - (1 - seg(tc, 1.6, 2.2)) * 0.8)
      cables.current.position.z = -seg(tc, 4.6, 5.4) * 1.3
    }
    // abrir: vira de cabeça para baixo, desvira e a cúpula se solta e sobe, mostrando a placa
    const to = actionTau('abrir-modulo')
    root.current.rotation.z = to < 0 ? 0 : (seg(to, 0, 0.8) - seg(to, 1.2, 2.0)) * Math.PI
    const up = to < 0 ? 0 : seg(to, 2.1, 3.1)
    lid.current.position.set(0, up * 1.35, -up * 0.35)
    lid.current.rotation.x = -up * 0.35
  })

  const sampleLed = (t: number, out: { color: string; on: number }) => {
    const s = useShowroom.getState()
    let id = ledOverride?.() ?? s.ledState
    if (interactive) {
      if (actionTime('audio') >= 0) id = 'audio'
      else if (s.action?.id === 'sos190' && s.holdMsg === 'ok') id = 'sos'
    }
    ledSample(LED_BY_ID[id], t, out)
  }

  return (
    <DeviceCtx.Provider value={{ deviceId: 'modulo', interactive }}>
      <group ref={root}>
        {/* corpo na altura da ficha (38 mm; 41 com a cápsula do LED): tudo, menos a antena, é achatado em Y a partir do fundo */}
        <group position={[0, BOTTOM * (1 - SQUASH), 0]} scale={[1, SQUASH, 1]}>
        {/* ================= tampa branca (cúpula em concha) ================= */}
        <group ref={lid}>
          <ClickablePart id="tampa">
            {/* uma superfície só: topo plano, canto arredondado e lateral que encosta no fundo nos três fechos, com arcos entre eles */}
            <mesh geometry={g.lid.top} material={topMat} castShadow />
            <mesh geometry={g.lid.side} material={apronMat} castShadow />
            {/* os três fechos da tampa: na frente, atrás à esquerda e atrás à direita (de baixo, a aba branca com a fenda) */}
            {[0, FOOT_T, -FOOT_T].map((a) => (
              <group key={a} rotation={[0, a, 0]}>
                <RoundedBox args={[0.13, 0.014, lidRim(a)[0] - RF * K_FLOOR + 0.05]} radius={0.005} smoothness={2} position={[0, Y_BOT - 0.004, (lidRim(a)[0] + RF * K_FLOOR - 0.05) / 2 - 0.004]} material={M.white} />
                <mesh material={M.hole} position={[0, Y_BOT - 0.0115, RF * K_FLOOR + 0.03]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.07, 0.016]} /></mesh>
              </group>
            ))}
            <group position={[0, YC, 0]} rotation={[TILT, 0, 0]}>
              <LogoGroove r={0.4} position={[0.02, 0.003, -0.1]} rotation={[-Math.PI / 2, 0, 0]} />
              {/* por dentro: bloco do guia de luz com furo de parafuso, ganchos e ressalto quadrado */}
              <RoundedBox args={[0.34, 0.08, 0.17]} radius={0.03} smoothness={3} position={[0, -0.06, CAPSULE_Z]} material={M.white} />
              <mesh material={M.hole} position={[0.0, -0.101, CAPSULE_Z]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.022, 16]} /></mesh>
              <RoundedBox args={[0.1, 0.07, 0.1]} radius={0.015} smoothness={2} position={[0.66, -0.065, 0.1]} material={M.white} />
              {[0.6, 1.9, 2.9, 3.9, 5.2].map((a) => (
                <RoundedBox key={a} args={[0.09, 0.07, 0.03]} radius={0.01} smoothness={2} position={[Math.sin(a) * 0.7, -0.065, Math.cos(a) * 0.7]} rotation={[0, a, 0]} material={M.white} />
              ))}
            </group>
          </ClickablePart>

          {/* botão do 190: tecla branca rente à tampa, com aro prateado fino; o LED é o ponto no centro dela */}
          <ClickablePart id="botao-sos">
            <group position={[0, YC, 0]} rotation={[TILT, 0, 0]}>
              <group position={[0, -0.008, CAPSULE_Z]}>
                <mesh geometry={g.capsuleRim} material={M.chrome} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} />
                <group ref={pressA} {...hold}>
                  <mesh geometry={g.capsule} material={M.white} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} />
                  {/* guia de luz: pino de cristal que leva a luz do LED da placa até o ponto no centro da tecla */}
                  <mesh material={M.crystal} position={[0, -0.215, 0]}><cylinderGeometry args={[0.03, 0.03, 0.4, 14]} /></mesh>
                </group>
                {interactive && <HoldRing radius={0.26} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} />}
              </group>
            </group>
          </ClickablePart>
          <ClickablePart id="led">
            <group position={[0, YC, 0]} rotation={[TILT, 0, 0]}>
              <group position={[0, -0.008, CAPSULE_Z]}>
                <group ref={pressB} {...hold}>
                  {/* LED: ponto pequeno e forte no centro da tecla (escuro quando apagado) */}
                  <Led sample={sampleLed} boost={9} baseColor="#14161b" position={[0, 0.0152, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.028, 24]} /></Led>
                </group>
              </group>
            </group>
          </ClickablePart>
        </group>

        {/* ================= antena tipo pá: conector rosqueado e articulação ================= */}
        </group>
        <ClickablePart id="antena">
          <group position={[ANT_X, BOTTOM + (-0.14 - BOTTOM) * SQUASH, -0.692]}>
            <mesh material={M.gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.04]}><cylinderGeometry args={[0.048, 0.048, 0.1, 20]} /></mesh>
            <group ref={antenna}>
              {[0, 1, 2, 3].map((i) => (
                <mesh key={i} material={M.gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1 - i * 0.022]}><cylinderGeometry args={[0.06, 0.06, 0.012, 6]} /></mesh>
              ))}
              <mesh material={M.white} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.25]}><capsuleGeometry args={[0.058, 0.1, 6, 20]} /></mesh>
              {/* articulação: junta com pino, logo depois do conector */}
              <group position={[0, 0, -0.36]}>
                <mesh material={M.white} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.07, 0.06, 6, 20]} /></mesh>
                <mesh material={M.metal} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.022, 0.022, 0.215, 12]} /></mesh>
                <mesh material={M.groove} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.071, 0.004, 6, 32]} /></mesh>
                <group rotation={[-0.62, 0, 0]}>
                  <mesh geometry={g.paddle} material={M.white} position={[0, 0.66, -0.025]} castShadow />
                  <mesh material={M.groove} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.062, 0.004, 6, 32]} /></mesh>
                </group>
              </group>
            </group>
          </group>
        </ClickablePart>
        <group position={[0, BOTTOM * (1 - SQUASH), 0]} scale={[1, SQUASH, 1]}>

        {/* ================= base cinza: tambor redondo recuado sob a tampa, fendas na borda, pés, rebaixos ================= */}
        <ClickablePart id="base">
          <mesh geometry={g.base} material={M.grey} castShadow />
          <instancedMesh ref={fins} args={[g.slit, M.hole, 60]} />
        </ClickablePart>
        <ClickablePart follow="base">
          {/* pés redondos e baixos, perto da borda */}
          {[0, 2.25, -2.25].map((a) => <mesh key={a} geometry={g.foot} material={M.grey} position={[Math.sin(a) * 0.6, Y_BOT - 0.01, Math.cos(a) * 0.6]} />)}
          {/* furo pequeno, à esquerda do bolsão */}
          <mesh material={M.hole} position={[0.38, Y_BOT - 0.001, -0.47]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.022, 14]} /></mesh>
          {/* ressalto da rosca da antena: bloco de face plana na borda de trás, à direita do bolsão; aparece sob o arco de trás da tampa */}
          <RoundedBox args={[0.16, 0.341, 0.122]} radius={0.03} smoothness={3} position={[ANT_X, -0.2255, -0.723]} material={M.grey} />
          {/* duas travas cinza, em lados opostos, que prendem a placa */}
          {[-1, 1].map((sx) => (
            <RoundedBox key={sx} args={[0.07, 0.07, 0.2]} radius={0.02} smoothness={3} position={[sx * 0.74, PCB_Y + 0.01, -0.1]} material={M.grey} />
          ))}
        </ClickablePart>

        {/* grade de som: furos em hexágono na face funda do bolsão; de baixo, é o que mais aparece */}
        <ClickablePart id="alto-falante">
          <instancedMesh ref={holes} args={[g.hole, M.hole, 37]} />
        </ClickablePart>
        {/* RJ45: conector deitado (fica soldado embaixo da placa); só a boca aparece, na parede da frente do bolsão, virada
            para dentro dele. Os contatos dourados ficam no alto da boca e as duas linguetas metálicas embaixo */}
        <ClickablePart id="ethernet">
          <mesh material={M.metal} position={[RJ.x, RJ.y, POCKET.z1 - 0.012]}><boxGeometry args={[0.2, 0.25, 0.03]} /></mesh>
          <mesh material={M.hole} position={[RJ.x, RJ.y - 0.01, POCKET.z1 - 0.0275]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.15, 0.17]} /></mesh>
          <mesh material={M.gold} position={[RJ.x, RJ.y + 0.06, POCKET.z1 - 0.028]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.11, 0.025]} /></mesh>
          {[-0.055, 0.055].map((dx) => <mesh key={dx} material={M.metal} position={[RJ.x + dx, RJ.y - 0.115, POCKET.z1 - 0.034]}><boxGeometry args={[0.035, 0.03, 0.02]} /></mesh>)}
        </ClickablePart>
        {/* entrada da fonte: jack redondo na parede esquerda do bolsão, a meia altura, voltado para o lado; fenda pequena acima */}
        <ClickablePart id="fonte">
          <mesh material={M.chip} position={[POCKET.x1 - 0.015, JACK.y, JACK.z]}><boxGeometry args={[0.03, 0.1, 0.11]} /></mesh>
          <mesh material={M.hole} position={[POCKET.x1 - 0.031, JACK.y, JACK.z]} rotation={[0, -Math.PI / 2, 0]} scale={[1, 1 / SQUASH * 0.72, 1]}><circleGeometry args={[0.026, 16]} /></mesh>
          <mesh material={M.hole} position={[POCKET.x1 - 0.001, JACK.y + 0.085, JACK.z]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[0.07, 0.014]} /></mesh>
        </ClickablePart>

        {/* ================= interior ================= */}
        <ClickablePart id="placa-principal">
          <mesh geometry={g.pcb} material={M.pcb} position={[0, PCB_Y, 0]} />
          {/* placa limpa: verde liso, poucos componentes grandes. RJ45 (caixa metálica) no fundo do recorte e o jack
              da fonte (caixa preta) ao lado dele, alinhados com o bolsão do fundo */}
          <mesh material={M.metal} position={[RJ.x, RJ.y, POCKET.z1 + 0.075]}><boxGeometry args={[0.2, 0.25, 0.15]} /></mesh>
          <mesh material={M.chip} position={[POCKET.x1 + 0.07, PCB_Y - 0.12, JACK.z]}><boxGeometry args={[0.12, 0.2, 0.12]} /></mesh>
          {/* área de energia: bobinas e chips pequenos */}
          {[[0.5, -0.36], [0.62, -0.26], [0.56, -0.16]].map(([x, z], i) => (
            <RoundedBox key={i} args={[0.075, 0.045, 0.075]} radius={0.012} smoothness={2} position={[x, PCB_Y + 0.022, z]} material={M.chip} />
          ))}
          {/* pinos dourados de teste em fileira, dois parafusos pretos e a etiqueta lisa */}
          {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} material={M.gold} position={[-0.6 + i * 0.03, PCB_Y + 0.012, 0.02 - i * 0.012]}><cylinderGeometry args={[0.007, 0.007, 0.03, 6]} /></mesh>)}
          {[[0.02, 0.0], [0.02, -0.12]].map(([x, z], i) => <mesh key={i} material={M.chip} position={[x, PCB_Y + 0.008, z]}><cylinderGeometry args={[0.03, 0.03, 0.016, 12]} /></mesh>)}
          <mesh material={M.white} position={[-0.42, PCB_Y + 0.002, -0.52]} rotation={[-Math.PI / 2, 0, 0.6]}><planeGeometry args={[0.13, 0.08]} /></mesh>
          <mesh material={M.chip} position={[-0.29, PCB_Y + 0.012, -0.05]}><boxGeometry args={[0.09, 0.022, 0.09]} /></mesh>
          {/* componentes pequenos, agrupados perto dos CIs: uma malha por cor */}
          <mesh geometry={g.smdTan} material={M.smdTan} />
          <mesh geometry={g.smdBlack} material={M.chip} />
          <mesh geometry={g.smdMetal} material={M.metal} />
          <mesh geometry={g.smdGold} material={M.gold} />
        </ClickablePart>

        <ClickablePart id="led-botao-placa">
          <Led sample={sampleLed} boost={3.5} baseColor="#b9c8ee" position={[-0.06, PCB_Y + 0.012, CAPSULE_Z - 0.045]}><boxGeometry args={[0.04, 0.022, 0.03]} /></Led>
          <mesh material={M.metal} position={[0.07, PCB_Y + 0.014, CAPSULE_Z - 0.03]}><boxGeometry args={[0.085, 0.028, 0.085]} /></mesh>
          <mesh material={M.wireBlue} position={[0.07, PCB_Y + 0.04, CAPSULE_Z - 0.03]}><cylinderGeometry args={[0.026, 0.028, 0.03, 16]} /></mesh>
        </ClickablePart>

        {/* cartão do chip 4G: plaquinha espetada num slot preto, com o suporte metálico e o SIM */}
        <ClickablePart id="chip-4g">
          <mesh material={M.pcbDark} position={[0.2, PCB_Y + 0.045, 0.35]}><boxGeometry args={[0.6, 0.012, 0.4]} /></mesh>
          <RoundedBox args={[0.07, 0.05, 0.42]} radius={0.01} smoothness={2} position={[0.535, PCB_Y + 0.03, 0.35]} material={M.chip} />
          <mesh material={M.white} position={[0.24, PCB_Y + 0.056, 0.4]}><boxGeometry args={[0.26, 0.008, 0.2]} /></mesh>
          <mesh material={M.metal} position={[0.2, PCB_Y + 0.064, 0.4]}><boxGeometry args={[0.06, 0.008, 0.21]} /></mesh>
          <mesh material={M.metal} position={[0.2, PCB_Y + 0.064, 0.4]}><boxGeometry args={[0.2, 0.008, 0.035]} /></mesh>
          {[0, 1, 2].map((i) => <mesh key={i} material={M.gold} position={[-0.03, PCB_Y + 0.056, 0.22 + i * 0.1]}><cylinderGeometry args={[0.017, 0.017, 0.014, 10]} /></mesh>)}
          <mesh geometry={g.coaxB} material={M.brown} />
        </ClickablePart>

        {/* módulo Wi-Fi / rede: blindagem prateada, etiqueta lisa, conector dourado, coaxial e LEDs verdes */}
        <ClickablePart id="wifi">
          <RoundedBox args={[0.26, 0.05, 0.42]} radius={0.012} smoothness={2} position={[-0.31, PCB_Y + 0.026, 0.32]} material={M.metal} />
          <mesh material={M.white} position={[-0.27, PCB_Y + 0.052, 0.4]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.1, 0.07]} /></mesh>
          <mesh material={M.wireBlue} position={[-0.46, PCB_Y + 0.012, 0.3]}><boxGeometry args={[0.035, 0.02, 0.3]} /></mesh>
          <mesh material={M.gold} position={[-0.42, PCB_Y + 0.045, 0.13]}><cylinderGeometry args={[0.017, 0.017, 0.016, 10]} /></mesh>
          {[0, 1].map((i) => (
            <Led key={i} sample={(t, o) => { o.color = '#27d455'; o.on = (t + i * 0.37) % 0.9 < 0.6 ? 1 : 0.15 }} boost={2.5} position={[-0.46, PCB_Y + 0.026, 0.42 + i * 0.05]}><boxGeometry args={[0.022, 0.01, 0.022]} /></Led>
          ))}
          <mesh geometry={g.coaxA} material={M.brown} />
        </ClickablePart>

        {/* rádio dos sensores: blindagem quadrada cheia de furinhos, chip ao lado e a antena de fio amarelo */}
        <ClickablePart id="radio">
          <RoundedBox args={[0.22, 0.045, 0.22]} radius={0.01} smoothness={2} position={[-0.52, PCB_Y + 0.023, -0.3]} material={M.metal} />
          <instancedMesh ref={shieldHoles} args={[g.hole, M.hole, 16]} />
          <mesh material={M.chip} position={[-0.42, PCB_Y + 0.012, -0.1]}><boxGeometry args={[0.07, 0.022, 0.07]} /></mesh>
          <mesh geometry={g.yellow} material={M.yellow} />
        </ClickablePart>

        {/* alto-falante: caixinha cinza no recorte da placa, logo acima da grade do bolsão; cone preto e ímã cromado */}
        <ClickablePart id="speaker">
          <group position={[GRILLE.x, -0.02, -0.5]}>
            <RoundedBox args={[0.44, 0.15, 0.5]} radius={0.04} smoothness={4} material={M.grey} />
            <mesh geometry={g.cone} material={M.black} position={[0, 0.045, 0]} />
            <mesh geometry={g.magnet} material={M.chrome} position={[0, 0.05, 0]} />
            <mesh material={M.groove} position={[0, 0.0755, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.186, 0.196, 48]} /></mesh>
          </group>
          <mesh geometry={g.spkA} material={M.wireBlue} />
          <mesh geometry={g.spkB} material={M.brown} />
        </ClickablePart>
        <ClickablePart id="microfone">
          <mesh material={M.chip} position={[0.375, -0.21, -0.25]}><cylinderGeometry args={[0.035, 0.035, 0.03, 16]} /></mesh>
          <mesh geometry={g.micA} material={M.red} />
          <mesh geometry={g.micB} material={M.chip} />
        </ClickablePart>

        {/* bateria por baixo da placa; conector branco de 2 pinos na borda, fios vermelho e preto */}
        <ClickablePart id="bateria">
          <RoundedBox args={[0.6, 0.1, 0.34]} radius={0.03} smoothness={3} position={[0.1, -0.25, 0.12]} material={M.cell} />
          <mesh material={M.orange} position={[0.1, -0.1985, 0.12]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.32, 0.14]} /></mesh>
          <RoundedBox args={[0.07, 0.04, 0.09]} radius={0.008} smoothness={2} position={[0.6, PCB_Y + 0.02, -0.04]} material={M.white} />
          <mesh geometry={g.batA} material={M.red} />
          <mesh geometry={g.batB} material={M.chip} />
        </ClickablePart>

        {/* cabos que entram pela abertura de trás do bolsão: plugue de energia em L e cabo de rede */}
        {interactive && (
          <group ref={cables} visible={false}>
            <group ref={netRef} position={[RJ.x, RJ.y, NET_Z]}>
              <mesh material={M.wireBlue} userData={{ fx: true }}><boxGeometry args={[0.13, 0.14, 0.2]} /></mesh>
              <mesh geometry={g.netCable} material={M.wireBlue} userData={{ fx: true }} raycast={() => null} />
            </group>
            <group ref={powRef} position={[POW_X, JACK.y, JACK.z]}>
              {/* plugue em L: o pino entra de lado na parede do bolsão e o corpo fica deitado, apontando para trás */}
              <mesh material={M.chip} position={[0.05, 0, 0]} userData={{ fx: true }}><boxGeometry args={[0.14, 0.1, 0.09]} /></mesh>
              <mesh material={M.chip} position={[0, 0, -0.085]} userData={{ fx: true }}><boxGeometry args={[0.09, 0.1, 0.2]} /></mesh>
              <mesh geometry={g.powCable} material={M.chip} userData={{ fx: true }} raycast={() => null} />
            </group>
          </group>
        )}
        </group>
      </group>

      {/* ================= efeitos das micro-animações ================= */}
      {interactive && (
        <>
          <CommLinks from={VIAS_FROM} to={VIAS_TO} state={(i) => {
            const t = actionTime('antena')
            if (t < 4.2 + i * 0.7) return 0
            if (i === 0 && t > 7.5 && t < 10.5) return 2
            if (i === 1 && t > 8.3 && t < 10.5) return 3
            return 1
          }} />
          {viasPhase >= 1 && (
            <Html position={[0, 2.9, -0.7]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-full bg-black/70 px-4 py-1.5 text-sm font-semibold text-white">
                {viasPhase === 1 ? 'Caiu o 4G? Outra via assume.' : 'Três vias: sempre conectado.'}
              </div>
            </Html>
          )}
          <VoiceWaves on={() => actionTime('audio') >= 0.4} position={[GRILLE.x, -0.44, GRILLE.z]} rotation={[-0.5, 0, Math.PI]} />
          {audioPhase >= 0 && (
            <Html position={[0.5, -1.0, -1.3]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-2xl rounded-bl-none bg-white px-4 py-2 text-sm font-semibold text-[#1E398D] shadow-lg">
                Central Orsegups: Olá, está tudo bem?
              </div>
            </Html>
          )}
          <group ref={plug} position={[POW_X, sq(JACK.y), JACK.z]} visible={false}>
            <mesh geometry={g.plugCable} material={cableMat} userData={{ fx: true }} raycast={() => null} />
            <mesh material={M.chip} rotation={[0, 0, Math.PI / 2]} userData={{ fx: true }} raycast={() => null}><capsuleGeometry args={[0.05, 0.1, 4, 12]} /></mesh>
          </group>
          {batPhase >= 0 && (
            <Html position={[0, 1.15, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag flex items-center gap-3 rounded-2xl bg-black/75 px-4 py-2 text-white">
                <svg width="44" height="22" viewBox="0 0 44 22"><rect x="1" y="1" width="37" height="20" rx="4" fill="none" stroke="#fff" strokeWidth="2" /><rect x="40" y="7" width="3" height="8" rx="1" fill="#fff" /><rect x="4" y="4" width="26" height="14" rx="2" fill="hsl(128 53% 50%)" /></svg>
                <div className="text-left leading-tight"><div className="text-lg font-bold">~3 h</div><div className="text-xs font-normal opacity-80">sem energia, tudo segue ligado</div></div>
              </div>
            </Html>
          )}
        </>
      )}
    </DeviceCtx.Provider>
  )
}
