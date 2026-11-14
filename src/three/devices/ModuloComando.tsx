import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { duvidasStickerTexture } from '../common/textures'
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
// 1 unidade = 80 mm. Medidas externas: tampa de 143,5 × 144,9 mm de planta e 38 mm de altura; base cinza de ~137 mm.
const BOTTOM = -0.4, SQUASH = 0.6 // o corpo foi modelado mais alto; SQUASH leva a altura a ~0,475 (38 mm)
const RF = 0.9 // raio de referência do corpo (72 mm)
const R_TOP = 58.5 / 80 // raio do topo plano (58,5 mm): bem menor que o corpo; a lateral abre em curva até 75 mm no fundo
const YC = 0.39 // altura do topo (antes do achatamento): plano e nivelado
const TILT = 0 // o topo não é rampa: fica paralelo à base
const CAPSULE_Z = 0.63 // a cápsula do LED/190 fica na frente, rente à borda do topo plano
const PCB_Y = -0.08 // topo da placa
// borda da placa onde o cabo da bateria sobe; o trecho por cima da placa gira aqui quando o plugue é puxado
const BAT_PIVOT: [number, number, number] = [0.7625, PCB_Y + 0.03, 0.1725]
const BAT_AXIS = new THREE.Vector3(0.23, 0, -0.165).normalize()
const VIAS_TO: [number, number, number][] = [[-1.5, 1.9, -0.6], [0, 2.3, -0.9], [1.5, 1.9, -0.6]]
const VIAS_FROM: [number, number, number] = [0, 0.2, 0]

const Y_SIDE = BOTTOM + 18 / 48 // borda de baixo da tampa no alto dos arcos: 18 mm acima do fundo (faixa branca de 20 mm)
const DEG = Math.PI / 180

const FOOT_T = 120 * DEG // os três apoios da tampa ficam a 120° um do outro: o da frente e os dois de trás

// Perfil externo da lateral da tampa: [mm abaixo do topo, mm além do raio do topo]. Abre rápido perto do topo e vai
// ficando reta até o fundo, onde os apoios chegam a 75 mm de raio.
const WALL_PROFILE: [number, number][] = [[0, 0], [2, 1.1], [6, 4.3], [11, 7.2], [16, 9.7], [21, 11.9], [29, 14.7], [36, 16.4], [38, 16.5]]

/** Raio da lateral da tampa na altura y (interpola o perfil externo). É o mesmo em toda a volta. */
function wallR(y: number) {
  const d = Math.min(38, Math.max(0, (YC - y) * 48))
  let i = 1
  while (i < WALL_PROFILE.length - 1 && WALL_PROFILE[i][0] < d) i++
  const [d0, r0] = WALL_PROFILE[i - 1], [d1, r1] = WALL_PROFILE[i]
  return R_TOP + (r0 + ((r1 - r0) * (d - d0)) / (d1 - d0)) / 80
}

/**
 * Borda de baixo da tampa em volta do contorno: [raio, altura]. A tampa desce até o fundo em TRÊS apoios iguais, a
 * 120° um do outro (na frente, atrás à esquerda e atrás à direita), que é onde ficam as presilhas. Entre eles a
 * borda faz um arco simétrico e arredondado: nos dois lados, onde a base cinza aparece, e atrás, por onde saem a
 * antena e os cabos.
 */
function lidRim(t: number): [number, number] {
  const y = BOTTOM + (Y_SIDE - BOTTOM) * Math.min(...lidFeet(t))
  return [wallR(y), y]
}

/**
 * Quanto a borda já subiu (0 no apoio, 1 no alto do arco), contando do apoio da frente e dos dois de trás. Cada apoio
 * é plano em ±12°; daí a borda sobe rápido e arredonda até o meio do arco, a 60° do apoio.
 */
function lidFeet(t: number): [number, number] {
  const a = Math.abs(Math.atan2(Math.sin(t), Math.cos(t))) // 0 na frente, π atrás
  const rise = (phi: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, (phi - 12.5 * DEG) / (47.5 * DEG))), 3)
  return [rise(a), rise(Math.abs(a - FOOT_T))]
}

/** Raio da lateral da tampa na altura y. Abaixo da borda não há tampa. */
function lidRadiusAt(t: number, y: number) {
  return y <= lidRim(t)[1] ? Infinity : wallR(y)
}

/**
 * Tampa: UMA superfície. Topo plano e nivelado (disco de raio R_TOP) e lateral que desce abrindo em curva,
 * rente à carcaça cinza nos arcos. A borda de baixo segue lidRim() e dobra para dentro (dá espessura à borda).
 * Devolve duas malhas que dividem os mesmos vértices: o topo (fosco) e a lateral (com brilho).
 */
function lidGeometry() {
  const NT = 180, NF = 5, NC = 6, NS = 10 // colunas; anéis do topo, do ombro e da lateral
  const pos: number[] = [], uv: number[] = [], idxTop: number[] = [], idxSide: number[] = []
  const W = 2 + NF + NC + NS
  for (let i = 0; i <= NT; i++) {
    const t = (i / NT) * Math.PI * 2, sn = Math.sin(t), cs = Math.cos(t)
    const [er, ey] = lidRim(t)
    const put = (r: number, y: number) => { pos.push(r * sn, y, r * cs); uv.push(r * sn * 3, r * cs * 3) }
    for (let j = 0; j <= NF; j++) put(R_TOP * Math.pow(j / NF, 0.8), YC)
    // ombro (os primeiros 6 mm, onde o perfil mais curva) e depois a lateral até a borda
    const yS = YC - 6 / 48
    for (let j = 1; j <= NC; j++) { const y = YC + (yS - YC) * (j / NC); put(wallR(y), y) }
    for (let j = 1; j <= NS; j++) { const y = yS + (ey - yS) * (j / NS); put(wallR(y), y) }
    put(er - 0.015, ey) // a borda dobra para dentro até encostar na carcaça cinza
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

/** Adesivo da frente: retalho de ~19 × 25 mm colado na lateral da tampa, centrado sob o botão. */
function stickerGeometry() {
  const NU = 8, NV = 8, HALF = 0.125, Y1 = YC - 5 / 48, Y0 = YC - 31 / 48 // meia largura (rad) e alturas de cima e de baixo
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const t = (i / NU - 0.5) * 2 * HALF, y = Y1 + (Y0 - Y1) * (j / NV), r = wallR(y) + 0.004
    pos.push(r * Math.sin(t), y, r * Math.cos(t)); uv.push(i / NU, 1 - j / NV)
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1; idx.push(a, c, b, b, c, c + 1) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}

// Fundo (pelo vídeo de fábrica). Tudo em coordenadas do corpo, antes do achatamento em Y.
const Y_BOT = BOTTOM
// Visto por baixo, com a antena para cima: o bolsão fica NO MEIO (um nada para a esquerda) e é um rasgo aberto na
// borda de trás, por onde saem os cabos; a antena sai ao lado dele, à direita (−X), e o furo do reset fica do mesmo lado, mais para a frente.
const POCKET = { x0: -0.2, x1: 0.3, z1: -0.22, d: 0.3 } // bolsão fundo dos cabos, no meio: começa em z1 e vai até a borda de trás, aberto
const PLATE = { x0: POCKET.x0 + 0.03, x1: POCKET.x1 - 0.03, z0: -0.78, z1: POCKET.z1 + 0.02 } // moldura da grade de som, na face funda
const LABEL = { x0: -0.365, x1: 0.375, z0: 0.075, z1: 0.425 } // rebaixo raso da etiqueta (fica vazio): ~59 × 28 mm, à frente do bolsão
const RJ = { x: 0.0, y: Y_BOT + 0.145 } // RJ45 deitado, na PAREDE DA FRENTE do bolsão, com a boca virada para dentro dele
const GRILLE = { x: (POCKET.x0 + POCKET.x1) / 2, z: -0.47, pitch: 0.054 } // grade de som: hexágono de furos na face funda do bolsão
/** Onde a base tem nervuras: só nos dois lados, sob os arcos laterais da tampa (de ~15° a ~105° da frente). */
const ribZone = (t: number) => {
  const a = Math.abs(Math.atan2(Math.sin(t), Math.cos(t)))
  return THREE.MathUtils.smoothstep(a, 13 * DEG, 19 * DEG) * (1 - THREE.MathUtils.smoothstep(a, 101 * DEG, 107 * DEG))
}
// Perfil externo da base cinza: [mm acima do fundo, raio em mm]. Sob os arcos ela afina para baixo; sob os três apoios
// ela abre para baixo, acompanhando a tampa por dentro.
const BASE_ARCH: [number, number][] = [[0, 61.8], [3, 62.9], [7, 63.5], [11, 64.6], [15, 66.2], [19, 66.9], [24, 67.1]]
const BASE_FOOT: [number, number][] = [[0, 72.3], [3, 71.8], [7, 70.3], [11, 68.7], [15, 67.1], [19, 66.9], [24, 67.1]]
const BASE_R = 67.1 / 80, FLOOR_R = 61.8 / 80, FOOT_FLOOR_R = 72.3 / 80
const lerpTable = (tb: [number, number][], h: number) => {
  let i = 1
  while (i < tb.length - 1 && tb[i][0] < h) i++
  const [h0, r0] = tb[i - 1], [h1, r1] = tb[i]
  return r0 + ((r1 - r0) * Math.min(1, Math.max(0, (h - h0) / (h1 - h0))))
}
/** Raio da base na altura y, em cada ângulo: mistura o perfil dos arcos com o dos apoios, conforme a borda da tampa desce. */
const baseR = (t: number, y: number) => {
  const h = (y - BOTTOM) * 48, w = Math.pow(1 - Math.min(...lidFeet(t)), 1.5)
  return (lerpTable(BASE_ARCH, h) + w * (lerpTable(BASE_FOOT, h) - lerpTable(BASE_ARCH, h))) / 80
}
const FEET: [number, number][] = [[0, 0.675], [0.65, -0.45], [-0.65, -0.45]] // pés: um atrás do apoio da frente e dois sob os apoios de trás
// cartão do modem (pela foto da placa aberta): ~51 × 30 mm, na frente e para o lado de +X, inteiro dentro da placa
const MODEM = { x0: -0.2, x1: 0.42, z0: 0.17, z1: 0.54 }
const ANT_X = -0.35 // a antena não fica no centro: sai num ressalto ao lado do bolsão, sob o arco de trás da tampa
/** Altura depois do achatamento do corpo (para o que fica fora do grupo achatado). */
const sq = (y: number) => BOTTOM + (y - BOTTOM) * SQUASH
const NET_Z = POCKET.z1 - 0.13, POW_X = POCKET.x1 - 0.15 // posição encaixada dos plugues
const JACK = { y: Y_BOT + POCKET.d * 0.5, z: -0.56 } // entrada da fonte na parede esquerda (+X), a meia altura

/**
 * Base cinza: tambor redondo, logo por dentro da tampa (a tampa encaixa rente nela), com frisos verticais (os sulcos caem em cima das fendas do fundo),
 * borda de baixo arredondada e fundo com o rebaixo da etiqueta. O bolsão dos cabos é um RASGO: abre no fundo e
 * atravessa a parede de trás até a borda, que é por onde os cabos saem. A parede sobe até passar da borda da tampa.
 */
function baseGeometry() {
  type P = [number, number, number]
  // perfil: [fração do raio, altura, quanto do sulco]
  // perfil: [altura, quanto da nervura]. O raio vem do perfil externo da base
  const NT = 360, prof: [number, number][] = [
    [0.1, 0], [0.06, 0], [0.0, 0], [-0.04, 0], [-0.1, 1], [-0.18, 1], [-0.254, 1], [-0.327, 1], [-0.375, 1], [-0.395, 0.5], [Y_BOT, 0], // por baixo, o contorno é liso
  ]
  const NP = prof.length, yTop = Y_BOT + POCKET.d // yTop: a face funda do bolsão
  // os frisos somem na largura do bolsão (a borda da abertura é lisa) e voltam aos poucos dos dois lados dela
  const tA = Math.PI - Math.asin(POCKET.x1 / (FLOOR_R)), tB = Math.PI - Math.asin(POCKET.x0 / (FLOOR_R))
  const fade = (t: number) => THREE.MathUtils.smoothstep(Math.max(tA - t, t - tB), 0, 8 * DEG)
  // onde a tampa cobre a base (queixo, cauda e acima da borda), a parede recua para dentro dela
  const rad = (t: number, y: number, w: number) => Math.min(baseR(t, y) * (1 - 0.04 * w * fade(t) * ribZone(t) * Math.pow(0.5 + 0.5 * Math.cos(60 * t), 1.2)), lidRadiusAt(t, y) - 0.014)
  // colunas da parede. Na largura do bolsão a parede só existe acima da face funda: as colunas "abertas" param nela
  type Col = { p: P[]; open: boolean; edge?: P }
  const lift = (p: P[], edge: P) => p.map((q) => (q[1] < yTop ? edge : q))
  const column = (t: number): Col | null => {
    const p = prof.map(([y, w]) => { const r = rad(t, y, w); return [r * Math.sin(t), y, r * Math.cos(t)] as P })
    const inside = Math.cos(t) > 0 ? 0 : p.filter(([x]) => x > POCKET.x0 && x < POCKET.x1).length
    if (inside === 0) return { p, open: false }
    if (inside < NP) return null // em cima do batente: dá lugar à coluna exata do batente
    const rc = rad(t, yTop, 1), edge: P = [rc * Math.sin(t), yTop, rc * Math.cos(t)]
    return { p: lift(p, edge), open: true, edge }
  }
  // batente do rasgo: coluna reta, no plano x = xb
  const jamb = (xb: number) => {
    const t = Math.PI - Math.asin(xb / (BASE_R)), at = (r: number, y: number): P => [xb, y, -Math.sqrt(r * r - xb * xb)]
    return { p: prof.map(([y, w]) => at(rad(t, y, w), y)), edge: at(rad(t, yTop, 1), yTop) }
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
      if (cols[i].open && prof[j][0] < yTop) continue // abaixo da face funda não há parede
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
    sticker: stickerGeometry(),
    base: baseGeometry(),
    slit: new THREE.BoxGeometry(0.034, 0.004, 0.15), // rasgo do fundo: a continuação de cada nervura
    foot: new THREE.CylinderGeometry(0.07, 0.075, 0.06, 20), // pé de ~3 mm
    capsuleRim: roundedRectGeometry(0.365, 0.155, 0.05, 0.012, 0.004), // fresta em volta da tecla (29,2 × 12,4 mm)
    capsule: roundedRectGeometry(0.339, 0.129, 0.04, 0.014, 0.005), // tecla branca do botão
    paddle: stadiumGeometry(0.17, 1.2, 0.05, 0.014),
    pcb: pcbGeometry(),
    cone: smoothLatheY([[0.185, 0.04], [0.175, 0.046], [0.155, 0.036], [0.11, 0.02], [0.06, 0.012], [0.03, 0.03]], 48, 24),
    magnet: smoothLatheY([[0.064, 0.012], [0.064, 0.03], [0.062, 0.044], [0.05, 0.05], [0.001, 0.05]], 32, 16),
    hole: new THREE.CircleGeometry(0.018, 10),
    // cabos e fios
    // coaxial do Wi-Fi: rabicho curto até a placa
    coaxA: wire([[-0.49, PCB_Y + 0.045, 0.5], [-0.47, PCB_Y + 0.07, 0.56], [-0.42, PCB_Y + 0.08, 0.62], [-0.36, PCB_Y + 0.14, 0.66]], 0.007),
    // coaxial do 4G: do cartão do chip até a rosca da antena, pelo braço da placa ao lado do recorte
    // coaxial do conector MAIN do modem até a antena externa, por cima do módulo Wi-Fi
    coaxB: wire([[MODEM.x0 + 0.06, PCB_Y + 0.06, 0.445], [-0.22, PCB_Y + 0.09, 0.32], [-0.36, PCB_Y + 0.085, 0.08], [-0.4, PCB_Y + 0.075, -0.2], [-0.37, PCB_Y + 0.06, -0.45], [ANT_X, PCB_Y + 0.02, -0.61]], 0.007),
    // antena de fio do rádio dos sensores: acompanha a borda da placa
    // antena do rádio: fio amarelo soldado atrás do rádio, que sobe pela borda de trás, por cima da caixinha do alto-falante
    yellow: wire([[-0.43, PCB_Y + 0.012, -0.45], [-0.36, PCB_Y + 0.04, -0.6], [-0.18, 0.075, -0.64], [0.06, 0.08, -0.64], [0.2, 0.075, -0.6], [0.25, 0.07, -0.52], [0.24, 0.062, -0.45]], 0.009),
    spkA: wire([[0.01, 0.075, -0.33], [-0.06, 0.09, -0.24], [-0.1, 0.06, -0.19], [-0.2, PCB_Y + 0.03, -0.14], [-0.24, PCB_Y + 0.012, -0.1]], 0.007),
    spkB: wire([[0.08, 0.075, -0.33], [0.02, 0.09, -0.23], [-0.04, 0.06, -0.17], [-0.13, PCB_Y + 0.03, -0.11], [-0.2, PCB_Y + 0.012, -0.06]], 0.007),
    micA: wire([[0.36, -0.2, -0.26], [0.4, -0.1, -0.2], [0.38, PCB_Y + 0.03, -0.12], [0.33, PCB_Y + 0.012, -0.08]], 0.006),
    micB: wire([[0.39, -0.2, -0.24], [0.44, -0.1, -0.17], [0.42, PCB_Y + 0.03, -0.1], [0.37, PCB_Y + 0.012, -0.05]], 0.006),
    // cabo da bateria: sai da ponta da bateria (embaixo da placa), sobe por fora da borda e passa por cima da placa até o conector
    // cabo da bateria em dois trechos: da bateria até a borda da placa (fixo) e, por cima da placa, até o plugue (gira
    // na borda quando o plugue é puxado do conector)
    batA: wire([[0.36, -0.2, 0.2], [0.6, -0.17, 0.23], [0.755, -0.12, 0.21], [0.765, PCB_Y + 0.03, 0.19]], 0.008),
    batB: wire([[0.36, -0.2, 0.16], [0.6, -0.17, 0.19], [0.75, -0.12, 0.175], [0.76, PCB_Y + 0.03, 0.155]], 0.008),
    batA2: wire([[0.765, PCB_Y + 0.03, 0.19], [0.68, PCB_Y + 0.03, 0.09], [0.615, PCB_Y + 0.025, 0.005]], 0.008),
    batB2: wire([[0.76, PCB_Y + 0.03, 0.155], [0.665, PCB_Y + 0.03, 0.06], [0.585, PCB_Y + 0.025, 0.005]], 0.008),
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
 * frente, com o LED no centro; base cinza redonda, logo por dentro da tampa, com o bolsão dos cabos
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
  // adesivo "Dúvidas?" da frente: mesmo tipo de material da placa (padrão, com textura)
  const stickerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, map: duvidasStickerTexture() }), [])
  const viasPhase = useActionPhase('antena', [4, 7.5, 10])
  const audioPhase = useActionPhase('audio', [1.2])
  const unplugPhase = useActionPhase('desplugar-bateria', [2.0], true)
  const batPlug = useRef<THREE.Group>(null!)
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
      // rasgos do fundo: cada nervura da parede dobra para baixo e continua no fundo. Só existem nas duas faixas laterais
      let n = 0
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, r = baseR(a, BOTTOM) - 0.085, x = Math.sin(a) * r, z = Math.cos(a) * r
        if (ribZone(a) < 0.5) continue // na frente (sob a ponta da tampa) e atrás (bolsão e antena) o fundo é liso
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
    // desplugar a bateria: a cúpula sobe e o plugue do cabo da bateria sai do conector da placa
    const td = actionTau('desplugar-bateria')
    const up = Math.max(to < 0 ? 0 : seg(to, 2.1, 3.1), td < 0 ? 0 : seg(td, 0.1, 1.0))
    const pull = td < 0 ? 0 : seg(td, 1.3, 1.9)
    batPlug.current.quaternion.setFromAxisAngle(BAT_AXIS, pull * 0.42)
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
            {/* adesivo "Dúvidas?" na frente, sob o botão: o QR é ilustrativo, não codifica nada */}
            <mesh geometry={g.sticker} material={stickerMat} />
            {/* presilhas de trás: de baixo, a aba branca com a fenda sob cada apoio */}
            {[FOOT_T, -FOOT_T].map((a) => (
              <group key={a} rotation={[0, a, 0]}>
                <RoundedBox args={[0.13, 0.014, lidRim(a)[0] - FOOT_FLOOR_R + 0.05]} radius={0.005} smoothness={2} position={[0, Y_BOT - 0.004, (lidRim(a)[0] + FOOT_FLOOR_R - 0.05) / 2 - 0.004]} material={M.white} />
                <mesh material={M.hole} position={[0, Y_BOT - 0.0115, FOOT_FLOOR_R - 0.02]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.07, 0.016]} /></mesh>
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
                <mesh geometry={g.capsuleRim} material={M.logoGroove} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} />
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
                  <Led on="shell" sample={sampleLed} boost={9} baseColor="#14161b" position={[0, 0.0152, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.028, 24]} /></Led>
                </group>
              </group>
            </group>
          </ClickablePart>
        </group>

        {/* ================= antena tipo pá: conector rosqueado e articulação ================= */}
        </group>
        <ClickablePart id="antena">
          <group position={[ANT_X, BOTTOM + (-0.14 - BOTTOM) * SQUASH, -0.648]}>
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

        {/* ================= base cinza: tambor redondo rente à tampa, fendas na borda, pés, rebaixos ================= */}
        <ClickablePart id="base">
          <mesh geometry={g.base} material={M.grey} castShadow />
          <instancedMesh ref={fins} args={[g.slit, M.greyDark, 60]} />
        </ClickablePart>
        <ClickablePart follow="base">
          {/* pés redondos e baixos, com o furo do parafuso no centro */}
          {FEET.map(([x, z]) => (
            <group key={x} position={[x, Y_BOT - 0.03, z]}>
              <mesh geometry={g.foot} material={M.grey} />
              <mesh material={M.hole} position={[0, -0.0305, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.02, 12]} /></mesh>
            </group>
          ))}
          {/* furo do botão de reset (o botão fica na placa, logo acima): do lado da antena, ao lado do bolsão */}
          <mesh material={M.hole} position={[-0.42, Y_BOT - 0.001, -0.56]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.022, 14]} /></mesh>
          {/* ressalto da rosca da antena: bloco de face plana na borda de trás, à direita do bolsão; aparece sob o arco de trás da tampa */}
          <RoundedBox args={[0.16, 0.341, 0.122]} radius={0.03} smoothness={3} position={[ANT_X, -0.2255, -0.679]} material={M.grey} />
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
        {/* anti-sabotagem: micro-chave preta com o pino para cima, à esquerda, logo atrás da placa do Wi-Fi; a tampa a mantém
            apertada */}
        <ClickablePart id="tamper">
          <mesh material={M.chip} position={[-0.45, PCB_Y + 0.02, 0.03]}><boxGeometry args={[0.09, 0.04, 0.07]} /></mesh>
          <mesh material={M.greyDark} position={[-0.45, PCB_Y + 0.05, 0.03]}><cylinderGeometry args={[0.018, 0.018, 0.03, 12]} /></mesh>
        </ClickablePart>
        {/* botão de reset: embaixo da placa, sobre o furo do fundo (base preta e botão azul, como na foto da placa) */}
        <ClickablePart id="reset">
          <mesh material={M.chip} position={[-0.42, PCB_Y - 0.04, -0.56]}><boxGeometry args={[0.08, 0.03, 0.08]} /></mesh>
          <mesh material={M.wireBlue} position={[-0.42, PCB_Y - 0.065, -0.56]}><cylinderGeometry args={[0.024, 0.024, 0.025, 14]} /></mesh>
        </ClickablePart>
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
          {/* processador no meio da placa e os dois CIs de 8 pinos ao lado do conector da bateria */}
          <mesh material={M.chip} position={[0.3, PCB_Y + 0.01, 0.03]}><boxGeometry args={[0.08, 0.018, 0.08]} /></mesh>
          {[0.2, 0.29].map((z) => <mesh key={z} material={M.chip} position={[0.63, PCB_Y + 0.008, z]}><boxGeometry args={[0.07, 0.014, 0.05]} /></mesh>)}
          {/* componentes pequenos, agrupados perto dos CIs: uma malha por cor */}
          <mesh geometry={g.smdTan} material={M.smdTan} />
          <mesh geometry={g.smdBlack} material={M.chip} />
          <mesh geometry={g.smdMetal} material={M.metal} />
          <mesh geometry={g.smdGold} material={M.gold} />
        </ClickablePart>

        <ClickablePart id="led-botao-placa">
          <Led on="board" sample={sampleLed} boost={3.5} baseColor="#b9c8ee" position={[-0.06, PCB_Y + 0.012, CAPSULE_Z - 0.045]}><boxGeometry args={[0.04, 0.022, 0.03]} /></Led>
          <mesh material={M.metal} position={[0.07, PCB_Y + 0.014, CAPSULE_Z - 0.03]}><boxGeometry args={[0.085, 0.028, 0.085]} /></mesh>
          <mesh material={M.wireBlue} position={[0.07, PCB_Y + 0.04, CAPSULE_Z - 0.03]}><cylinderGeometry args={[0.026, 0.028, 0.03, 16]} /></mesh>
        </ClickablePart>

        {/* cartão do modem 4G (mini PCIe, ~51 × 30 mm): espetado no slot preto do lado de +X, preso pela presilha metálica na
            outra ponta; o SIM no suporte metálico e os três conectores dourados (AUX, GNSS, MAIN) perto da presilha.
            Posição e tamanho pela foto da placa aberta, na escala da placa (120 mm de diâmetro, pelos encaixes da base) */}
        <ClickablePart id="chip-4g">
          <mesh material={M.pcbDark} position={[(MODEM.x0 + MODEM.x1) / 2, PCB_Y + 0.045, (MODEM.z0 + MODEM.z1) / 2]}><boxGeometry args={[MODEM.x1 - MODEM.x0, 0.012, MODEM.z1 - MODEM.z0]} /></mesh>
          <RoundedBox args={[0.05, 0.05, MODEM.z1 - MODEM.z0 + 0.03]} radius={0.01} smoothness={2} position={[MODEM.x1 + 0.025, PCB_Y + 0.03, (MODEM.z0 + MODEM.z1) / 2]} material={M.chip} />
          <mesh material={M.white} position={[0.215, PCB_Y + 0.056, 0.355]}><boxGeometry args={[0.18, 0.008, 0.3]} /></mesh>
          <mesh material={M.metal} position={[0.215, PCB_Y + 0.064, 0.355]}><boxGeometry args={[0.045, 0.008, 0.31]} /></mesh>
          <mesh material={M.metal} position={[0.215, PCB_Y + 0.064, 0.355]}><boxGeometry args={[0.18, 0.008, 0.03]} /></mesh>
          {[0, 1, 2].map((i) => <mesh key={i} material={M.gold} position={[MODEM.x0 + 0.06, PCB_Y + 0.056, 0.245 + i * 0.1]}><cylinderGeometry args={[0.015, 0.015, 0.014, 10]} /></mesh>)}
          <mesh geometry={g.coaxB} material={M.brown} />
          {/* presilha metálica na ponta do cartão (o lado oposto ao slot): uma base e duas travas que seguram os cantos */}
          <mesh material={M.metal} position={[MODEM.x0 - 0.022, PCB_Y + 0.012, (MODEM.z0 + MODEM.z1) / 2]}><boxGeometry args={[0.02, 0.024, MODEM.z1 - MODEM.z0 + 0.04]} /></mesh>
          {[MODEM.z0 + 0.02, MODEM.z1 - 0.02].map((z) => (
            <group key={z}>
              <mesh material={M.metal} position={[MODEM.x0 - 0.022, PCB_Y + 0.033, z]}><boxGeometry args={[0.012, 0.05, 0.028]} /></mesh>
              <mesh material={M.metal} position={[MODEM.x0 - 0.006, PCB_Y + 0.057, z]} rotation={[0, 0, -0.25]}><boxGeometry args={[0.045, 0.009, 0.028]} /></mesh>
            </group>
          ))}
        </ClickablePart>

        {/* módulo Wi-Fi / rede: blindagem prateada, etiqueta lisa, conector dourado, coaxial e LEDs verdes */}
        <ClickablePart id="wifi">
          <RoundedBox args={[0.26, 0.05, 0.42]} radius={0.012} smoothness={2} position={[-0.4, PCB_Y + 0.026, 0.32]} material={M.metal} />
          <mesh material={M.white} position={[-0.36, PCB_Y + 0.052, 0.4]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.1, 0.07]} /></mesh>
          <mesh material={M.wireBlue} position={[-0.545, PCB_Y + 0.012, 0.28]}><boxGeometry args={[0.035, 0.02, 0.3]} /></mesh>
          <mesh material={M.gold} position={[-0.49, PCB_Y + 0.045, 0.5]}><cylinderGeometry args={[0.017, 0.017, 0.016, 10]} /></mesh>
          {[0, 1].map((i) => (
            <Led key={i} sample={(t, o) => { o.color = '#27d455'; o.on = (t + i * 0.37) % 0.9 < 0.6 ? 1 : 0.15 }} boost={2.5} position={[-0.545, PCB_Y + 0.026, 0.38 + i * 0.05]}><boxGeometry args={[0.022, 0.01, 0.022]} /></Led>
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

        {/* caixinha cinza do alto-falante, no recorte da placa, logo acima da grade do bolsão: é da base e fica nela na
            vista explodida; só o alto-falante sai */}
        <ClickablePart follow="base" internal>
          <group position={[GRILLE.x, -0.02, -0.5]}>
            <RoundedBox args={[0.44, 0.15, 0.5]} radius={0.04} smoothness={4} material={M.grey} />
            <mesh material={M.groove} position={[0, 0.0755, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.186, 0.196, 48]} /></mesh>
          </group>
        </ClickablePart>
        {/* alto-falante: cone preto e ímã cromado */}
        <ClickablePart id="speaker">
          <group position={[GRILLE.x, -0.02, -0.5]}>
            <mesh geometry={g.cone} material={M.black} position={[0, 0.045, 0]} />
            <mesh geometry={g.magnet} material={M.chrome} position={[0, 0.05, 0]} />
            {/* as duas abas de solda na borda do cone, onde chegam os fios */}
            {[-0.04, 0.03].map((x) => <mesh key={x} material={M.metal} position={[x, 0.093, 0.172]}><boxGeometry args={[0.03, 0.006, 0.03]} /></mesh>)}
          </group>
          <mesh geometry={g.spkA} material={M.wireBlue} />
          <mesh geometry={g.spkB} material={M.brown} />
        </ClickablePart>
        <ClickablePart id="microfone">
          <mesh material={M.chip} position={[0.375, -0.21, -0.25]}><cylinderGeometry args={[0.035, 0.035, 0.03, 16]} /></mesh>
          <mesh geometry={g.micA} material={M.red} />
          <mesh geometry={g.micB} material={M.chip} />
        </ClickablePart>

        {/* bateria (pacote amarelo) por baixo da placa; conector branco de 2 pinos na borda, fios vermelho e preto */}
        <ClickablePart id="bateria">
          {/* pacote amarelo, como nas fotos do módulo aberto */}
          <RoundedBox args={[0.6, 0.1, 0.34]} radius={0.03} smoothness={3} position={[0.1, -0.25, 0.12]} material={M.yellow} />
          <mesh geometry={g.batA} material={M.red} />
          <mesh geometry={g.batB} material={M.chip} />
          {/* plugue branco e o trecho do cabo por cima da placa: giram na borda da placa quando o plugue é puxado */}
          <group position={BAT_PIVOT}>
            <group ref={batPlug}>
              <group position={[-BAT_PIVOT[0], -BAT_PIVOT[1], -BAT_PIVOT[2]]}>
                <RoundedBox args={[0.07, 0.04, 0.09]} radius={0.008} smoothness={2} position={[0.6, PCB_Y + 0.02, -0.04]} material={M.white} />
                <mesh geometry={g.batA2} material={M.red} />
                <mesh geometry={g.batB2} material={M.chip} />
              </group>
            </group>
          </group>
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
          {unplugPhase >= 0 && (
            <Html position={[0.6, 0.55, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-full bg-black/75 px-4 py-1.5 text-sm font-semibold text-white">Cabo da bateria desconectado</div>
            </Html>
          )}
          {/* a Central fala pelo alto-falante do módulo: balão de conversa (o LED pisca vermelho enquanto a ligação dura) */}
          {audioPhase >= 0 && (
            <Html position={[0.95, 0.95, 0.1]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag relative rounded-2xl rounded-bl-none bg-white px-4 py-2 text-left shadow-lg" style={{ animation: 'screen-in 0.4s cubic-bezier(.16,.84,.3,1) both' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Central Orsegups</div>
                <div className="text-sm font-bold text-[#1E398D]">Alarme 365, identifique-se.</div>
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
