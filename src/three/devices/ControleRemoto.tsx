import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { iconTexture, type IconId } from '../common/textures'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { boxesGeometry, latheZ, ringSectorGeometry, smoothLatheZ, stadiumGeometry, wire, type Block } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import type { ActionId } from '../../data/devices'
import { actionTau, actionTime, useShowroom, type ArmState } from '../../store/showroomStore'
import { RadioPulse } from '../fx/RadioPulse'
import { HoldRing } from '../fx/HoldRing'
import { MiniModulo } from '../fx/MiniModulo'
import { beep } from '../../ui/audio'

const D2R = Math.PI / 180
const BUTTONS: { id: string; icon: IconId; angle: number; action: ActionId; arm?: ArmState }[] = [
  { id: 'btn-panico', icon: 'panico', angle: 90, action: 'panico' },
  { id: 'btn-desarmar', icon: 'desarmar', angle: 180, action: 'btn-desarmar', arm: 'disarmed' },
  { id: 'btn-armar', icon: 'armar', angle: 0, action: 'btn-armar', arm: 'armed' },
  { id: 'btn-parcial', icon: 'parcial', angle: 270, action: 'btn-parcial', arm: 'partial' },
]
const CMD: ActionId[] = ['btn-desarmar', 'btn-armar', 'btn-parcial']
const MINI: [number, number, number] = [2.5, 0.75, 0]
const cmdTime = () => { for (const c of CMD) { const t = actionTime(c); if (t >= 0) return t } return -1 }

// Medidas externas: 44 de largura × 51 de altura (com o olhal da argola) × 13 mm de espessura. 1 unidade = 25,9 mm.
// As bordas da frente e de trás são arredondadas (um seixo, não uma moeda); a frente e as costas são quase planas.
const THICK = 1.45 // a espessura modelada (0,34) vira ~13 mm no meio
const cm = (v: number) => v / 25.9, zm = (v: number) => v / 37.6
// face da frente (e das costas): o alto do ombro, a ~6,4 mm da emenda
const SH = { face: 0.17 }
// ombro do corpo pelas medidas externas (raio → meia espessura, em mm): desce quase reto perto da borda, como um seixo
const SHOULDER_MM: [number, number][] = [[22.1, 2.2], [21.5, 3.0], [21, 3.9], [20.5, 4.6], [20, 5.15], [19.5, 5.9], [19, 6.2], [18.5, 6.39]]
const SHOULDER = new THREE.SplineCurve(SHOULDER_MM.map(([r, z]) => new THREE.Vector2(cm(r), zm(z)))).getPoints(20).map((p) => [p.x, p.y] as [number, number])
/** Perfil do ombro, da borda até o alto do aro. Pontos [raio, z ≥ 0]. */
const shoulder = (): [number, number][] => SHOULDER.map(([r, z]) => [r, z])
const KY = 0 // o teclado (~29 mm de diâmetro) fica no centro do corpo
// abertura do teclado (14,75 mm de raio): o aro desce ~1 mm do alto do ombro até ela
const KEY_OPEN: [number, number] = [0.57, 0.143]
// corpo redondo (raio 22 mm) que vira gota embaixo: o olhal da argola é um círculo de ~7 mm de raio com o centro
// quase na borda do corpo, ligado a ele por concordâncias largas (o pescoço é largo). Altura total ≈ 1,15× a largura
const R = 0.853, TAIL_Y = -0.831, TAIL_R = 0.27, FILLET = 0.55
const HOLE_Y = -0.9 // furo da argola: oval deitado (~6,2 × 3,9 mm), com ~3 mm de ponte até a ponta
// tampa da bateria, atrás: disco com um lado reto (onde ela engancha) e a presilha de abrir no lado oposto; fica
// girada 45° em relação ao olhal
const COVER_ROT = -Math.PI / 4, CHORD = 0.405
// Placa redonda (~38 mm), 1 mm à frente da emenda das cascas: encosta atrás na parede da cavidade da bateria e na
// frente nos pinos do miolo. Teclas a 14 mm do centro. Em Z o modelo é escalado por THICK (1 mm = 1/37,6).
const PCB = { r: cm(18.9), z0: zm(0.9), t: zm(1.6) }
const PCB_F = PCB.z0 + PCB.t // face da frente da placa (a dos componentes, virada para o teclado)
const SW_R = cm(14.1)
// os componentes seguem a foto da placa, girada 135°: o LED fica embaixo da fenda e o entalhe da borda, do lado da argola
const LAYOUT_ROT = Math.PI * 0.75
const COIN_C = -0.03 // centro da bateria-moeda (e do suporte), atrás da placa
const HOLDER_ROT = -Math.PI * 0.75 // giro do suporte: o lado aberto (antes a 180°) vai para 45°
const COIN_R = 0.42 * 0.92 // raio da bateria no modelo
// topo do pedestal no referencial do corpo: 0,08 abaixo do `bottom` do aparelho (−1,08), e o corpo está 0,1 acima
const PED_TOP = -1.08 - 0.08 - 0.1
const U45 = Math.SQRT1_2 // direção de saída da bateria (45°): (U45, U45)

/**
 * Contorno do corpo: um círculo com uma aba curta embaixo (o olhal da argola), ligada por duas concordâncias
 * côncavas. É um bloco só. `grow` engorda o contorno (usado no filete azul).
 */
function teardrop(grow = 0) {
  const R0 = R + grow, r = TAIL_R + grow, f = FILLET - grow
  // centro da concordância: tangente por fora ao círculo do corpo e ao da aba
  const cy = ((R0 + f) ** 2 - (r + f) ** 2 + TAIL_Y * TAIL_Y) / (2 * TAIL_Y)
  const cx = Math.sqrt((R0 + f) ** 2 - cy * cy)
  const a0 = Math.atan2(cy, cx) // onde o corpo encontra a concordância (lado direito)
  const a1 = Math.atan2(cy - TAIL_Y, cx) // onde a aba encontra a concordância (lado direito)
  const s = new THREE.Shape()
  s.absarc(0, 0, R0, a0, Math.PI - a0, false)
  s.absarc(-cx, cy, f, -a0, -a1, true)
  s.absarc(0, TAIL_Y, r, Math.PI - a1, Math.PI * 2 + a1, false)
  s.absarc(cx, cy, f, Math.PI + a1, Math.PI + a0, true)
  s.closePath()
  return s
}
// furo da argola; `grow` alarga o oval (nas placas, que ficam escondidas dentro do olhal)
const ringHole = (grow = 0) => { const h = new THREE.Path(); h.absellipse(0, HOLE_Y, 0.12 + grow, 0.075 + grow, 0, Math.PI * 2, true, 0); return h }
/**
 * Olhal da argola, por cima das placas: as duas concordâncias e a aba do contorno em gota (um pouco para dentro: o
 * chanfro devolve), fechadas por uma reta logo abaixo da placa, com quinas arredondadas. A reta e as quinas ficam
 * escondidas dentro do ombro e das placas.
 */
const EYE = { grow: -0.032, y: -0.765, rho: 0.05 }
function eyeShape() {
  const R0 = R + EYE.grow, r = TAIL_R + EYE.grow, f = FILLET - EYE.grow
  const cy = ((R0 + f) ** 2 - (r + f) ** 2 + TAIL_Y * TAIL_Y) / (2 * TAIL_Y)
  const cx = Math.sqrt((R0 + f) ** 2 - cy * cy)
  const a1 = Math.atan2(cy - TAIL_Y, cx)
  // quina: círculo de raio rho encostado na reta (por baixo) e na concordância (por fora)
  const yr = EYE.y - EYE.rho, xr = cx - Math.sqrt((f + EYE.rho) ** 2 - (yr - cy) ** 2)
  const b = Math.atan2(yr - cy, xr - cx)
  const s = new THREE.Shape()
  s.absarc(-cx, cy, f, Math.PI - b, -a1, true)
  s.absarc(0, TAIL_Y, r, Math.PI - a1, Math.PI * 2 + a1, false)
  s.absarc(cx, cy, f, Math.PI + a1, b, true)
  s.absarc(xr, yr, EYE.rho, b - Math.PI, Math.PI / 2, false)
  s.absarc(-xr, yr, EYE.rho, Math.PI / 2, Math.PI * 2 - b, false)
  s.closePath()
  return s
}

type Geo = ReturnType<typeof build>
let cache: Geo | null = null
function build() {
  const bevel = { bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 3, curveSegments: 48 }
  // O corpo é feito de duas placas finas no contorno inteiro (com a aba da argola), uma de cada lado da emenda, e
  // de dois ombros arredondados (sólidos de revolução, só no círculo): é por isso que a aba fica fina e o corpo, gordinho.
  // Metade da frente: maciça. Metade de trás: aro grosso com a cavidade da bateria (fechada pela tampa).
  // casca da frente oca: a placa fina da emenda é só um aro (por dentro fica o vão da placa e do teclado)
  // as placas têm o furo da argola um pouco maior: por dentro do olhal elas não aparecem
  const fs = teardrop(); fs.holes.push(ringHole(0.02))
  const frontHole = new THREE.Path(); frontHole.absarc(0, 0, cm(19.6), 0, Math.PI * 2, true); fs.holes.push(frontHole)
  const front = new THREE.ExtrudeGeometry(fs, { depth: 0.05, ...bevel })
  const bs = teardrop(); bs.holes.push(ringHole(0.02))
  const cav = new THREE.Path(); cav.absarc(0, 0, 0.61, 0, Math.PI * 2, true); bs.holes.push(cav)
  const back = new THREE.ExtrudeGeometry(bs, { depth: 0.05, ...bevel }); back.translate(0, 0, -0.06)
  // olhal da argola: peça grossa (~6,8 mm) de borda redonda, que vai afinando até sumir dentro do ombro e das placas
  // no pescoço. O chanfro engorda o contorno e aperta o furo (0,04): por fora fica rente às placas e o furo, no meio
  // da espessura, fica com ~6,2 × 3,9 mm. A borda redonda do furo é o chanfro dele
  const es = eyeShape()
  const eh = new THREE.Path(); eh.absellipse(0, HOLE_Y, 0.16, 0.115, 0, Math.PI * 2, true, 0); es.holes.push(eh)
  const eyeRaw = new THREE.ExtrudeGeometry(es, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4, curveSegments: 28 }); eyeRaw.translate(0, 0, -0.05)
  const ep = eyeRaw.attributes.position
  for (let i = 0; i < ep.count; i++) ep.setZ(i, ep.getZ(i) * (0.72 + 0.28 * seg(-ep.getY(i), 0.76, 0.86)))
  // normais suaves na borda redonda (sem as faixas da extrusão)
  eyeRaw.deleteAttribute('uv'); eyeRaw.deleteAttribute('normal')
  const eye = mergeVertices(eyeRaw); eye.computeVertexNormals(); eyeRaw.dispose()
  // ombro da frente: da borda até o alto do aro, que desce até a abertura do teclado (como na peça real: o miolo
  // fica preso por quatro raios em X). Por dentro, a parede do ombro tem a face de dentro (a casca tem ~1,5 mm)
  const frontDome = latheZ([[R, 0.03], ...shoulder(), KEY_OPEN], 96)
  const innerShoulder = shoulder().map(([r, z]) => [r - 0.035, Math.max(0.05, z - 0.03)] as [number, number])
  const frontDomeIn = latheZ([[KEY_OPEN[0], KEY_OPEN[1] - 0.03], ...innerShoulder.reverse(), [R - 0.035, 0.05]], 96)
  // raios em X que seguram o miolo: ficam nas frestas entre as quatro teclas (a 45°), um pouco abaixo delas
  const spokes = mergeGeometries([45, 135, 225, 315].map((d) => {
    const b = new THREE.BoxGeometry(0.3, 0.05, 0.03)
    b.translate(0.42, 0, 0.148); b.rotateZ(d * D2R)
    return b
  }))
  // por dentro: parede circular em volta do teclado e os pinos de apoio da placa
  // pinos das cascas, por fora da borda da placa (curtos: não chegam à face de fora do ombro), e o anel do miolo que
  // encosta na frente da placa (em volta do CI)
  const posts = mergeGeometries([90, 38, 142, 195, 345, 245, 296].map((d) => {
    const c = new THREE.CylinderGeometry(0.03, 0.03, 0.075, 10)
    c.rotateX(Math.PI / 2); c.translate(Math.cos(d * D2R) * 0.78, Math.sin(d * D2R) * 0.78, 0.0575)
    return c
  }))
  const hubRing = latheZ([[0.218, PCB_F + 0.003], [0.261, PCB_F + 0.003], [0.261, SH.face - 0.02], [0.218, SH.face - 0.02], [0.218, PCB_F + 0.003]], 48)
  // miolo: o disco central fixo também tem a face de baixo
  const hubBack = new THREE.CircleGeometry(0.27, 48); hubBack.rotateY(Math.PI); hubBack.translate(0, KY, SH.face - 0.025)
  // teclado de borracha: lâmina logo abaixo das teclas, com um pino embaixo de cada tecla (aperta o domo dourado da
  // placa). Vai do anel do miolo até embaixo do aro: nada da placa aparece nas fendas
  const keypadSheet = new THREE.RingGeometry(0.265, 0.69, 64)
  keypadSheet.translate(0, KY, 0.112)
  const keypadBack = new THREE.RingGeometry(0.265, 0.69, 64); keypadBack.rotateY(Math.PI); keypadBack.translate(0, KY, 0.104)
  // fundo do teclado: anel com espessura (as duas faces), abaixo da lâmina e acima dos domos, preso na casca da
  // frente, com um furo para cada pino
  const ring = new THREE.Shape().absarc(0, 0, 0.69, 0, Math.PI * 2, false)
  ring.holes.push(new THREE.Path().absarc(0, 0, 0.265, 0, Math.PI * 2, true))
  for (const d of [0, 90, 180, 270]) ring.holes.push(new THREE.Path().absarc(Math.cos(d * D2R) * SW_R, Math.sin(d * D2R) * SW_R, 0.056, 0, Math.PI * 2, true))
  const keypadFloor = new THREE.ExtrudeGeometry(ring, { depth: 0.006, bevelEnabled: false, curveSegments: 48 }); keypadFloor.translate(0, KY, 0.096)
  // pinos: do topo do domo (~0,094) até dentro da lâmina
  const plungers = mergeGeometries([0, 90, 180, 270].map((d) => {
    const c = new THREE.CylinderGeometry(0.045, 0.05, 0.017, 16); c.rotateX(Math.PI / 2)
    c.translate(Math.cos(d * D2R) * SW_R, KY + Math.sin(d * D2R) * SW_R, 0.103)
    return c
  }))
  // ombro de trás: o mesmo perfil espelhado; por dentro, a parede da cavidade da bateria
  const backDome = latheZ([[0.61, -0.05], [0.61, -SH.face], ...shoulder().reverse().map(([r, z]) => [r, -z] as [number, number]), [R, -0.03]], 96)
  // filete azul: anel fino (~1,5 mm) no meio da espessura, quase rente às cascas
  const fl = teardrop(0.008) // o filete fica rente às cascas (de frente não vira contorno azul)
  // é um anel de verdade (não um disco): na vista explodida aparece fino, só o contorno
  fl.holes.push(new THREE.Path(teardrop(-0.05).getPoints(120).reverse()))
  const fillet = new THREE.ExtrudeGeometry(fl, { depth: 0.03, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 64 }); fillet.translate(0, 0, -0.015)
  // tampa: disco com um lado reto (embaixo, no referencial da tampa); a presilha fica na borda oposta
  const cs = new THREE.Shape(), ca = Math.asin(CHORD / 0.87 / 0.7)
  cs.absarc(0, 0, 0.7, -ca, Math.PI + ca, false); cs.closePath()
  // fora do lado reto da tampa a casca de trás é fechada: a cavidade (e a placa) não aparecem por fora
  // (a face dela fica um fio para dentro das costas: sem brigar com a face do ombro de trás na borda)
  const fs2 = new THREE.Shape(), fa = Math.asin((CHORD - 0.007) / 0.62)
  fs2.absarc(0, 0, 0.62, Math.PI + fa, Math.PI * 2 - fa, false); fs2.closePath()
  const coverSill = new THREE.ExtrudeGeometry(fs2, { depth: 0.093, bevelEnabled: false, curveSegments: 24 }); coverSill.translate(0, 0, -0.168)
  const cover = new THREE.ExtrudeGeometry(cs, { depth: 0.014, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 48 }); cover.translate(0, 0, -0.022)
  // placa: disco com um entalhe pequeno na borda do lado da argola
  const ps = new THREE.Shape(), nx = cm(0.8), na = Math.asin(nx / PCB.r)
  ps.absarc(0, 0, PCB.r, -Math.PI / 2 + na, Math.PI * 1.5 - na, false); ps.lineTo(-nx, -cm(17.4)); ps.lineTo(nx, -cm(17.4)); ps.closePath()
  const pcb = new THREE.ExtrudeGeometry(ps, { depth: PCB.t, bevelEnabled: false, curveSegments: 64 }); pcb.translate(0, 0, PCB.z0)
  const uv = pcb.attributes.uv as THREE.BufferAttribute, pos = pcb.attributes.position
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (2 * PCB.r) + 0.5, pos.getY(i) / (2 * PCB.r) + 0.5)
  // frente da placa, como na foto (em mm, a partir do centro, antes do giro): o CI quadrado no meio, o cristal metálico
  // em cima, capacitores (bege) e resistores/CIs pequenos (pretos) em volta, e os pads dourados. Sem texto
  const L = (items: [number, number, number, number, number][]) => {
    const g = boxesGeometry(items.map(([x, y, w, h, d]) => [cm(x), cm(y), PCB_F + zm(d) / 2, cm(w), cm(h), zm(d)] as Block)); g.rotateZ(LAYOUT_ROT); return g
  }
  const v = (x: number, y: number, d = 0.5): [number, number, number, number, number] => [x, y, 0.8, 1.6, d]
  const hz = (x: number, y: number, d = 0.5): [number, number, number, number, number] => [x, y, 1.6, 0.8, d]
  const smdBlack = L([[0, 0, 7, 7, 0.9], [2.3, -10.4, 2.9, 1.3, 1], [8.7, 0.4, 1.4, 1, 0.8], [10.6, 0.4, 1.4, 1, 0.8],
    v(-3.9, -9), v(-1.5, -9), v(0.9, -9), v(-8.4, 4.4), hz(-7, 3), v(-11, -3), hz(-8, -5.2), [-7.4, -8, 1.3, 1.3, 0.5], v(7.7, 2.8), hz(5.5, -6.5)])
  const smdTan = L([hz(-14, 2.6, 0.6), hz(-13.5, -0.7, 0.6), hz(-13.1, -3.8, 0.6), hz(-13.5, -6.6, 0.6), v(-11.6, 3.4), v(-11.6, 0.6), v(-11.6, -5.4),
    [-8.6, -1.7, 1.6, 3.4, 0.8], v(-3.5, 8.4), v(-2.6, 8.4), hz(1.8, 5), [10.5, 4, 1, 2, 0.7], [9.6, -2.4, 1, 2, 0.7], v(8.4, 6.6), v(9.2, 6.6),
    hz(-1.3, -5.2), v(4.2, -7.8), v(5, -7.8), v(-5.3, -9), v(-2.7, -9), v(-0.3, -9)])
  const smdMetal = L([[0.6, 9, 3.4, 2.4, 0.8]])
  // pads redondos: alimentação (2), gravação (fileira de 5, passo de 2,54 mm) e um ponto de teste
  const smdGold = mergeGeometries([[3.8, 8.7, 0.75], [6.3, 8.7, 0.75], ...[-5.6, -3, -0.4, 2.2, 4.8].map((x) => [x, -12.8, 0.8]), [-15.2, -8.3, 0.5]].map(([x, y, r]) => {
    const c = new THREE.CylinderGeometry(cm(r), cm(r), zm(0.1), 16); c.rotateX(Math.PI / 2); c.translate(cm(x), cm(y), PCB_F + zm(0.05)); return c
  })); smdGold.rotateZ(LAYOUT_ROT)
  // as 4 teclas da placa, embaixo dos pinos do teclado: base quadrada preta com o domo dourado
  const swBase = boxesGeometry(BUTTONS.map((b) => [Math.cos(b.angle * D2R) * SW_R, Math.sin(b.angle * D2R) * SW_R, PCB_F + zm(0.35), cm(5.2), cm(5.2), zm(0.7)] as Block))
  const swDome = mergeGeometries(BUTTONS.map((b) => {
    const d = new THREE.SphereGeometry(cm(2), 20, 10); d.scale(1, 1, 0.12); d.translate(Math.cos(b.angle * D2R) * SW_R, Math.sin(b.angle * D2R) * SW_R, PCB_F + zm(0.7)); return d
  }))
  // atrás da placa: suporte da bateria-moeda (moldura marrom aberta de um lado, por onde a bateria sai) e a lâmina dourada
  // o lado aberto do suporte fica a 45°, para o lado da presilha da tampa (o lado reto, a 225°, é fechado pela casca)
  const holder = ringSectorGeometry(0.395, 0.435, -140 * D2R, 140 * D2R, PCB.z0 + 0.062, 0.004); holder.rotateZ(HOLDER_ROT); holder.translate(0, COIN_C, -0.066)
  // contatos do suporte: a lâmina da lateral e, EMBAIXO da pilha (entre ela e a placa), a alavanquinha de mola que se
  // pressiona para a pilha encaixar no lugar; a ponta dela sai pela borda da pilha, dobrada para trás (não há tira por cima)
  const clip = boxesGeometry([[0.465, 0, -0.023, 0.012, 0.2, 0.094], [0, -0.32, 0.021, 0.12, 0.26, 0.004], [0, -0.465, 0.0, 0.12, 0.03, 0.044]])
  clip.rotateZ(HOLDER_ROT); clip.translate(0, COIN_C, 0)
  return {
    front, back, eye, frontDome, frontDomeIn, spokes, posts, hubRing, hubBack, keypadSheet, keypadBack, keypadFloor, plungers, backDome, fillet, cover, coverSill,
    pcb, smdTan, smdBlack, smdMetal, smdGold, swBase, swDome, holder, clip,
    // teclas: ~29 mm no total, dentro da abertura de 14,75 mm de raio (com o chanfro, sobra uma fresta)
    sector: ringSectorGeometry(0.32, 0.535, -38 * D2R, 38 * D2R, 0.018, 0.022),
    // disco central fixo: baixo (quase rente às teclas), sem contorno de tecla
    center: smoothLatheZ([[0.293, 0.155], [0.291, 0.1615], [0.282, 0.1655], [0.2, 0.1683], [0.1, 0.1702], [0.001, 0.171]], 96, 24),
    coin: smoothLatheZ([[0.001, -0.064], [0.39, -0.064], [0.414, -0.06], [0.42, -0.05], [0.42, 0.008], [0.412, 0.017], [0.001, 0.019]], 64, 32),
    slit: stadiumGeometry(0.27, 0.075, 0.01, 0.003), // fenda do LED: ~7 × 2 mm
    ledLens: stadiumGeometry(0.26, 0.07, 0.002, 0), // a luz ocupa a fenda quase toda
    aerial: wire([[160, 0.66, 0.006], [170, 0.705, 0.016], [195, 0.705, 0.018], [220, 0.7, 0.018], [245, 0.69, 0.016]].map(([d, r, dz]) => [Math.cos(d * D2R) * r, Math.sin(d * D2R) * r, PCB_F + dz] as [number, number, number]), 0.012),
    rib: wire([[-0.42, 0.25, 0], [-0.45, -0.1, 0], [-0.36, -0.34, 0], [0, -0.39, 0], [0.36, -0.34, 0], [0.45, -0.1, 0], [0.42, 0.25, 0]], 0.014),
  }
}
const G = () => (cache ??= build())

/**
 * Controle remoto: corpo redondo em seixo, com o olhal grosso da argola, preto/grafite acetinado, com filete azul,
 * 4 botões em cunha (em X), quase rentes ao aro, em volta de um disco central fixo, que não é botão. Atrás, a tampa (um disco de um lado reto)
 * fecha a cavidade com a placa verde, o suporte e a bateria CR2032. Frente em +Z.
 */
export function ControleRemoto({ interactive = false, pressed }: DeviceProps & { pressed?: () => string | null }) {
  const g = G()
  // corpo preto/grafite acetinado
  const bodyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#1d1f24', roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.5 }), [])
  const coinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dfe2e8', roughness: 0.32, metalness: 0.6 }), [])
  const coverMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#22242a', roughness: 0.7 }), [])
  const icons = useMemo(() => BUTTONS.map((b) => new THREE.MeshBasicMaterial({ map: iconTexture(b.icon), transparent: true, toneMapped: false })), [])
  const btnRefs = useRef<(THREE.Group | null)[]>([])
  const root = useRef<THREE.Group>(null!)
  const cover = useRef<THREE.Group>(null!)
  const coin = useRef<THREE.Group>(null!)
  const range = useRef<THREE.Mesh>(null!)
  const rangeMat = useMemo(() => fxBasic('#5b8cff', 0), [])
  // o módulo só confirma o comando ~2,7 s depois do aperto (não é instantâneo): aí o LED dele muda
  const cmdPhase = useActionPhase(CMD, [0, 2.7])
  const panicOn = useActionPhase('panico') >= 0
  const rangePhase = useActionPhase('alcance', [1.2])
  const coverPhase = useActionPhase('tampa-controle', [0.8, 1.6])
  const tx = () => {
    if (!interactive) return !!pressed?.()
    const t = cmdTime(), s = useShowroom.getState()
    return (t > 0.25 && t < 2.2) || (s.action?.id === 'panico' && s.holdMsg === 'ok')
  }

  const sampleLed = (t: number, o: { color: string; on: number }) => { o.color = '#3d7bff'; o.on = tx() ? (t % 0.24 < 0.12 ? 1 : 0.1) : 0 } // apagado, a janela fica preta (como na arte)

  // o comando chega ao módulo: o estado do alarme muda
  useEffect(() => {
    if (cmdPhase !== 1) return
    const s = useShowroom.getState()
    const b = BUTTONS.find((x) => x.action === s.action?.id)
    if (b?.arm) s.setArm(b.arm)
  }, [cmdPhase])
  useEffect(() => { if (cmdPhase === 0) beep('click') }, [cmdPhase])

  useFrame(() => {
    const s = useShowroom.getState()
    BUTTONS.forEach((b, i) => {
      const g = btnRefs.current[i]
      if (!g) return
      let down = 0
      if (interactive) {
        const t = actionTime(b.action)
        if (b.action === 'panico') down = s.holding && t >= 0 ? 1 : 0
        else if (t >= 0) down = bump(t, 0.05, 0.2, 0.45, 0.6)
      } else if (pressed?.() === b.id) down = 1
      g.position.z = -down * 0.012 // a tecla desce até encostar no fundo do teclado
    })
    if (!interactive) return
    // troca da bateria: o controle vira de costas; a tampa inclina ~25° pela presilha, desengata puxando para o lado
    // dela e vai para o lado, longe do caminho da bateria. A velha sai pelo lado aberto do suporte (o da presilha, a
    // 45°): solta um pouco, sobe para fora da cavidade, desliza e cai até o pedestal, onde some. A nova vem de longe
    // pelo mesmo lado e faz o caminho inverso; a tampa volta e o controle vira de frente
    const tt = actionTime('tampa-controle')
    const sm = (x: number) => x * x * (3 - 2 * x)
    const at = (a: number, b: number) => (tt < 0 ? 0 : sm(seg(tt, a, b)))
    root.current.rotation.y = (at(0, 0.8) - at(6.9, 7.7)) * Math.PI
    const unhook = at(2.0, 2.35) * (1 - at(5.85, 6.1)), park = at(2.35, 2.75) * (1 - at(5.45, 5.85))
    cover.current.rotation.x = -at(1.5, 2.0) * (1 - at(6.1, 6.5)) * 0.44
    cover.current.position.set(-park * 1.3, unhook * 0.15, -unhook * 0.15 - park * 0.45)
    let sOut: number, zOut: number, yDrop = 0, size = 1
    if (tt < 4.12) {
      sOut = at(2.8, 2.95) * 0.015 + at(3.3, 3.65) * 0.6
      zOut = -at(2.95, 3.3) * 0.3
      const d = tt < 0 ? 0 : THREE.MathUtils.clamp((tt - 3.65) / 0.35, 0, 1) // queda acelerando
      yDrop = d * d * (COIN_C + 0.615 * U45 - (PED_TOP + COIN_R))
      size = 1 - at(4.0, 4.12)
    } else {
      sOut = 0.015 * (1 - at(5.25, 5.4)) + 0.6 * (1 - at(4.65, 4.95)) + 2.6 * (1 - at(4.15, 4.65))
      zOut = -0.3 * (1 - at(4.95, 5.25))
    }
    coin.current.position.set(sOut * U45, sOut * U45 - yDrop, zOut)
    coin.current.scale.setScalar(Math.max(size, 1e-3))
    const ta = actionTime('alcance')
    const k = ta < 0 ? 0 : seg(ta, 0.2, 2.6)
    range.current.scale.setScalar(0.2 + k * 5.2)
    rangeMat.opacity = ta < 0 ? 0 : 0.8 * (1 - seg(ta, 4.8, 5.8)) * seg(ta, 0.1, 0.5)
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'controle', interactive }}>
      <group ref={root} position={[0, 0.1, 0]} scale={[1, 1, THICK]}>
        {/* casca da frente */}
        <ClickablePart id="corpo">
          <mesh geometry={g.front} material={bodyMat} castShadow />
          <mesh geometry={g.frontDome} material={bodyMat} castShadow />
          {/* por dentro: face interna do ombro, raios do miolo, pinos das cascas e o anel do miolo que encosta na placa */}
          <mesh geometry={g.frontDomeIn} material={bodyMat} />
          <mesh geometry={g.spokes} material={M.groove} />
          <mesh geometry={g.posts} material={bodyMat} />
          <mesh geometry={g.hubRing} material={bodyMat} />
          <mesh geometry={g.hubBack} material={bodyMat} />
          {/* fundo do teclado, na própria casca: fecha a vista da placa pelas fendas entre as teclas, de qualquer ângulo */}
          <mesh geometry={g.keypadFloor} material={bodyMat} />
        </ClickablePart>
        {/* anel do filete azul: ~1,5 mm, no MEIO da espessura (a emenda entre as duas cascas), em volta de tudo */}
        <ClickablePart follow="corpo" explode={[0, 0, 0.2]}>
          <mesh geometry={g.fillet} material={M.blueGlow} />
        </ClickablePart>
        {/* casca de trás, com a argola */}
        <ClickablePart follow="corpo" explode={[0, 0, -0.6]}>
          <mesh geometry={g.back} material={bodyMat} castShadow />
          <mesh geometry={g.backDome} material={bodyMat} castShadow />
          <mesh geometry={g.coverSill} material={bodyMat} rotation={[0, 0, COVER_ROT]} />
          {/* entalhe de abrir a tampa: o vão na borda da cavidade, do lado da presilha */}
          <group rotation={[0, 0, COVER_ROT]}>
            <mesh material={M.hole} position={[0, 0.6475, -0.1665]}><boxGeometry args={[0.22, 0.075, 0.009]} /></mesh>
          </group>
        </ClickablePart>
        {/* olhal da argola: grosso, de borda redonda, com o furo oval deitado (a borda redonda do furo faz o chanfro) */}
        <ClickablePart id="argola">
          <mesh geometry={g.eye} material={bodyMat} castShadow />
        </ClickablePart>
        <ClickablePart id="led">
          {/* a fenda fica no aro, que sobe da abertura do teclado até o alto do ombro: segue a inclinação dele */}
          <mesh geometry={g.slit} material={M.blackGloss} position={[0, 0.685, 0.1545]} rotation={[0.184, 0, 0]} />
          <Led on="shell" sample={sampleLed} geometry={g.ledLens} position={[0, 0.685, 0.1688]} rotation={[0.184, 0, 0]} />
        </ClickablePart>

        {/* teclado de borracha atrás da face: a lâmina e os pinos que apertam os domos da placa; sai junto com as teclas */}
        <ClickablePart follow="btn-panico">
          <mesh geometry={g.keypadSheet} material={M.blackBtn} />
          <mesh geometry={g.keypadBack} material={M.blackBtn} />
          <mesh geometry={g.plungers} material={M.blackBtn} />
        </ClickablePart>

        {/* 4 botões em cunha, em X: ✱ em cima, cadeado aberto à esquerda, fechado à direita, casa embaixo */}
        {BUTTONS.map((b, i) => (
          <ClickablePart key={b.id} id={b.id}>
            <group ref={(gr) => { btnRefs.current[i] = gr }}
              onPointerDown={b.action === 'panico' ? (e) => { if (panicOn) { e.stopPropagation(); useShowroom.getState().set({ holding: true, holdMsg: '' }) } } : undefined}
              onPointerUp={b.action === 'panico' ? () => panicOn && useShowroom.getState().set({ holding: false }) : undefined}
              onPointerLeave={b.action === 'panico' ? () => panicOn && useShowroom.getState().set({ holding: false }) : undefined}>
              <mesh geometry={g.sector} material={M.blackBtn} position={[0, KY, 0.136]} rotation={[0, 0, b.angle * D2R]} />
              <mesh material={icons[i]} position={[Math.cos(b.angle * D2R) * 0.43, KY + Math.sin(b.angle * D2R) * 0.43, 0.1775]}><planeGeometry args={[0.18, 0.18]} /></mesh>
            </group>
            {interactive && b.action === 'panico' && <HoldRing radius={0.18} position={[0, KY + 0.43, 0.205]} />}
          </ClickablePart>
        ))}
        {/* centro: disco escuro FIXO (não afunda, não tem contorno de tecla), com o logo em baixo-relevo bem discreto.
            TODO(usuário): confirmar o logo no disco (a arte de marketing mostra; o ícone do sistema mostra liso). */}
        <ClickablePart follow="corpo">
          <mesh geometry={g.center} material={bodyMat} position={[0, KY, 0]} />
          <LogoGroove r={0.12} position={[0, KY, 0.1705]} material={M.logoGrooveDark} />
        </ClickablePart>

        {/* tampa traseira: disco de um lado reto, com duas abas nesse lado, a presilha no lado oposto e o símbolo em relevo */}
        <ClickablePart id="tampa">
          <group rotation={[0, 0, COVER_ROT]}>
          <group position={[0, -CHORD, -0.145]}>
            <group ref={cover}>
              <group position={[0, CHORD, 0]} scale={[0.87, 0.87, 1]}>
                <mesh geometry={g.cover} material={coverMat} />
                {/* presilha da tampa, na borda oposta ao lado reto: lingueta quase rente (o vão de abrir fica na casca) */}
                <mesh material={coverMat} position={[0, 0.6, -0.027]}><boxGeometry args={[0.24, 0.11, 0.012]} /></mesh>
                <mesh material={M.black} position={[0, 0.3, -0.031]} rotation={[Math.PI / 2, Math.PI / 6, 0]}><cylinderGeometry args={[0.07, 0.07, 0.006, 3]} /></mesh>
                <mesh material={M.black} position={[0, 0.17, -0.031]}><boxGeometry args={[0.2, 0.035, 0.006]} /></mesh>
                {[[-0.22, -0.45], [0.22, -0.45]].map(([x, y], i) => (
                  <mesh key={i} material={coverMat} position={[x, y, -0.006]}><boxGeometry args={[0.12, 0.06, 0.03]} /></mesh>
                ))}
                {/* por dentro: nervura em "U" e a etiqueta (lisa, sem texto) */}
                <mesh geometry={g.rib} material={coverMat} position={[0, 0, 0.004]} />
                <mesh material={M.white} position={[0, 0.06, 0.0005]}><planeGeometry args={[0.74, 0.64]} /></mesh>
              </group>
            </group>
          </group>
          </group>
        </ClickablePart>
        {/* por dentro: a placa verde (componentes na frente, virados para o teclado) e, atrás, o suporte da bateria */}
        <ClickablePart internal>
          <mesh geometry={g.pcb} material={M.pcb} />
          <mesh geometry={g.swBase} material={M.chip} />
          <mesh geometry={g.swDome} material={M.gold} />
          <mesh geometry={g.smdBlack} material={M.chip} />
          <mesh geometry={g.smdTan} material={M.smdTan} />
          <mesh geometry={g.smdMetal} material={M.metal} />
          <mesh geometry={g.smdGold} material={M.gold} />
          <mesh geometry={g.aerial} material={M.yellow} />
          {/* o LED de verdade fica na borda da placa, embaixo da fenda; com o aparelho explodido, é ele que acende */}
          <Led on="board" sample={sampleLed} position={[cm(-0.3), cm(18), PCB_F + zm(0.4)]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[cm(1.6), cm(1), zm(0.8)]} />
          </Led>
          <mesh geometry={g.holder} material={M.brown} />
          <mesh geometry={g.clip} material={M.gold} />
          {/* etiqueta lisa atrás da placa, embaixo do suporte (sem texto) */}
          <mesh material={M.white} position={[0, -0.52, PCB.z0 - 0.001]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.45, 0.07]} /></mesh>
        </ClickablePart>
        <ClickablePart id="bateria">
          <group ref={coin}>
            <group position={[0, COIN_C, 0]} scale={[0.92, 0.92, 1]}>
              <mesh geometry={g.coin} material={coinMat} />
              {/* o "+" gravado na face */}
              <mesh material={M.metal} position={[-0.1, -0.2, -0.065]}><boxGeometry args={[0.13, 0.022, 0.002]} /></mesh>
              <mesh material={M.metal} position={[-0.1, -0.2, -0.065]}><boxGeometry args={[0.022, 0.13, 0.002]} /></mesh>
            </group>
          </group>
        </ClickablePart>
        {interactive && coverPhase === 0 && (
          <Html position={[0.45, 0.45, -0.2]} center style={{ pointerEvents: 'none' }}>
            <div className="fx-tag -translate-y-7 text-center text-xs font-semibold text-accent">entalhe<div className="text-xl leading-none">▼</div></div>
          </Html>
        )}
      </group>

      {interactive && (
        <>
          {(cmdPhase >= 0 || panicOn) && (
            <>
              <MiniModulo position={MINI} led={() => { const s = useShowroom.getState(); return s.action?.id === 'panico' && s.holdMsg === 'ok' ? 'sos' : null }} />
              <RadioPulse from={[0, 0.95, 0.15]} to={MINI} on={tx} />
            </>
          )}
          <mesh ref={range} material={rangeMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} userData={{ fx: true }} raycast={() => null}>
            <ringGeometry args={[0.97, 1, 96]} />
          </mesh>
          {rangePhase >= 0 && (
            <Html position={[0, -0.3, 5.4]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white">Alcance de até 30 m</div>
            </Html>
          )}
        </>
      )}
    </DeviceCtx.Provider>
  )
}
