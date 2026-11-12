import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { fresnelTexture, polaroidTexture } from '../common/textures'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { stadiumGeometry } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { DetectionFan, LowPolyDog, LowPolyPerson } from '../fx/DetectionFan'
import { CameraFlash } from '../fx/CameraFlash'
import { REF_ON } from '../../dev/RefMode'

// ---------- medidas (frente em +Z), tiradas das fotos reais ----------
// Torre arredondada: altura ≈ 2,2× a largura, profundidade ≈ 0,7× a largura. 1 unidade ≈ 72 mm.
const HW = 0.43, HD = 0.3, RC = 0.29 // meia largura, meia profundidade e raio dos cantos da frente (laterais quase semicirculares)
const RB = 0.2 // raio dos cantos de trás: a face de trás é mais plana, é onde ficam a tampa e o suporte
const Y_TOP = 0.8, TOP_R = 0.17 // topo plano com a borda arredondada
const Y_BASE = -0.95 // acima disto é corpo branco; abaixo, a faixa cinza recuada
// compartimento das pilhas: metade de cima da traseira
const BAY = { y0: -0.16, y1: 0.62, hw: 0.335, floor: 0.0 }
// pilha AA (50,5 × 14,5 mm) na escala do aparelho: cilindro de ponta reta com o polo + saliente
const CELL = { r: 0.098, len: 0.7, y: 0.23, s: 0.12 }
const CELL_X = [-0.208, 0, 0.208]
// Relevo da frente, medido na arte oficial (tudo para DENTRO do corpo; só a cápsula da câmera é saliente):
// - capuz: corte em arco no alto, de lados retos, com ~51% da largura; a cápsula ocupa quase todo ele;
// - crista: a borda que sobra entre os dois cortes, na altura da base da cápsula; desce em diagonal para os lados;
// - rebaixo de baixo: da crista até pouco acima da base. A parede de cima dele é a faixa em trapézio, uma
//   rampa longa que desce até a janela PIR; embaixo da janela fica o logo, e o rebaixo afunila um pouco.
const HOOD = { top: 0.58, arc: 0.2, hw: 0.225, depth: 0.09 }
const RIDGE = { y: -0.05, drop: 0.105, x0: 0.225, x1: 0.33, half: 0.014 }
const WELL = { hw: 0.33, hwBottom: 0.27, taper: -0.6, bottom: -0.93, depth: 0.055 }
const CAP = { top: 0.545, bottom: -0.1, hwTop: 0.182, hwBottom: 0.145 } // cápsula: pílula grande, um pouco mais larga em cima
const LENS_Y = 0.42, LEDWIN_Y = 0.15 // lente da câmera e janela oval do LED, dentro da cápsula
const PIR = { y0: -0.6, y1: -0.165, hw: 0.31 } // janela PIR, quase quadrada, no fundo do rebaixo
const LOGO_Y = -0.735
const Y_FOOT = -1.28 // os pés do suporte de parede passam ~10% da altura para baixo do corpo
const HINGE: [number, number, number] = [0, Y_FOOT, -(HD + 0.04)] // eixo horizontal no pé do suporte: é ali que o sensor inclina
const FAN_Y = -1.1
const personX = (t: number) => -3.4 + seg(t, 2.5, 6.5) * 6.8
const dogX = (t: number) => -3.4 + seg(t, 8, 12) * 6.8
const PERSON_Z = 2.5

/** Profundidade do contorno na posição x: para trás (cantos de raio RB) e para a frente (raio RC). */
const sBack = (x: number) => { const d = Math.abs(x) - (HW - RB); return d <= 0 ? HD : HD - RB + Math.sqrt(Math.max(0, RB * RB - d * d)) }
const sFront = (x: number) => { const d = Math.abs(x) - (HW - RC); return d <= 0 ? HD : HD - RC + Math.sqrt(Math.max(0, RC * RC - d * d)) }
/** Geometria extrudada no plano (x, s = −z) e posta de pé: a extrusão vira a altura. */
const upright = (g: THREE.BufferGeometry, y = 0) => { g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g }

function stadium(hw: number, hd: number, r: number) {
  const sh = new THREE.Shape()
  sh.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false)
  sh.absarc(-(hw - r), hd - r, r, Math.PI / 2, Math.PI, false)
  sh.absarc(-(hw - r), -(hd - r), r, Math.PI, Math.PI * 1.5, false)
  sh.absarc(hw - r, -(hd - r), r, Math.PI * 1.5, Math.PI * 2, false)
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
/** Altura da crista em x: mais alta sob a cápsula, desce em diagonal até a largura do rebaixo. */
const ridgeY = (x: number) => RIDGE.y - RIDGE.drop * Math.min(1, Math.max(0, (Math.abs(x) - RIDGE.x0) / (RIDGE.x1 - RIDGE.x0)))
/** Quanto a frente é escavada no ponto (x, y): o maior entre o corte do capuz e o rebaixo de baixo. */
function frontDepth(x: number, y: number) {
  const ax = Math.abs(x), yr = ridgeY(x)
  // capuz: arco no alto e lados retos até a crista
  const yArc = HOOD.top - HOOD.arc
  const side = y >= yArc ? HOOD.hw * (1 - Math.cbrt((ax / HOOD.hw) ** 3 + ((y - yArc) / HOOD.arc) ** 3)) : HOOD.hw - ax
  const hood = HOOD.depth * smooth(0, 0.04, side) * smooth(0, 0.05, y - (RIDGE.y + RIDGE.half))
  // rebaixo de baixo: a parede de cima é uma rampa (a faixa em trapézio) da crista até o topo da janela PIR
  const hw = y > WELL.taper ? WELL.hw : WELL.hw - (WELL.hw - WELL.hwBottom) * Math.min(1, (WELL.taper - y) / (WELL.taper - WELL.bottom))
  const ramp = smooth(0, 1, (yr - RIDGE.half - y) / Math.max(0.035, yr - RIDGE.half - PIR.y1))
  const well = WELL.depth * smooth(0, 0.028, hw - ax) * ramp * smooth(0, 0.04, y - WELL.bottom)
  return Math.max(hood, well)
}

/**
 * Casca do corpo: superfície paramétrica (volta do contorno em estádio × altura), com a borda do topo
 * arredondada, o lábio da base, o capuz e o rebaixo da frente escavados (com fundo e paredes de verdade)
 * e o compartimento das pilhas aberto atrás. É uma peça só, como o plástico injetado da foto.
 */
function shellGeometry() {
  const ex = HW - RC, ez = HD - RC, bx = HW - RB, bz = HD - RB
  type Col = { cx: number; cz: number; nx: number; nz: number; r: number; bay: boolean }
  const cols: Col[] = []
  const phiBay = Math.acos((BAY.hw - bx) / RB) // ângulo, nos cantos de trás, em que x = ±BAY.hw
  // cx vem em "fração" da meia largura do esqueleto (−1..1); frente usa RC, trás usa RB
  const col = (phi: number, fx: number, bay: boolean) => {
    const front = Math.sin(phi) > 1e-9 || (Math.abs(Math.sin(phi)) <= 1e-9 && frontSide)
    cols.push({ cx: fx * (front ? ex : bx), cz: front ? ez : -bz, nx: Math.cos(phi), nz: Math.sin(phi), r: front ? RC : RB, bay })
  }
  let frontSide = true
  const A = 40, F = 24, K = 14
  // canto direito da frente, frente plana, canto esquerdo da frente
  for (let i = 0; i <= A; i++) col((i / A) * (Math.PI / 2), 1, false)
  for (let i = 1; i < F; i++) col(Math.PI / 2, 1 - (2 * i) / F, false)
  for (let i = 0; i <= A; i++) col(Math.PI / 2 + (i / A) * (Math.PI / 2), -1, false)
  frontSide = false
  // canto esquerdo de trás, até a parede do compartimento
  const nL = Math.round((A * (Math.PI / 2 - phiBay)) / (Math.PI / 2))
  for (let i = 0; i <= nL; i++) col(Math.PI + (i / nL) * (Math.PI / 2 - phiBay), -1, false)
  // dentro do compartimento (as paredes nascem das amostras duplicadas)
  const nB = A - nL
  for (let i = 0; i <= nB; i++) col(Math.PI * 1.5 - phiBay + (i / nB) * phiBay, -1, true)
  for (let i = 1; i < K; i++) col(Math.PI * 1.5, -1 + (2 * i) / K, true)
  for (let i = 0; i <= nB; i++) col(Math.PI * 1.5 + (i / nB) * phiBay, 1, true)
  for (let i = 0; i <= nL; i++) col(Math.PI * 1.5 + phiBay + (i / nL) * (Math.PI / 2 - phiBay), 1, false)

  type Row = { y: number; inset: number; bay: boolean; flat?: boolean }
  const rows: Row[] = []
  // fundo (tampado pela faixa cinza) e lábio arredondado da base
  rows.push({ y: Y_BASE, inset: RC, bay: false, flat: true }, { y: Y_BASE, inset: RC - 0.002, bay: false }, { y: Y_BASE, inset: 0.12, bay: false }, { y: Y_BASE, inset: 0.032, bay: false })
  rows.push({ y: Y_BASE + 0.012, inset: 0.014, bay: false }, { y: Y_BASE + 0.03, inset: 0.004, bay: false })
  const yA = Y_BASE + 0.055, yB = Y_TOP - TOP_R, N = 132
  for (let i = 0; i <= N; i++) {
    const y = yA + ((yB - yA) * i) / N, next = yA + ((yB - yA) * (i + 1)) / N
    rows.push({ y, inset: 0, bay: y > BAY.y0 && y < BAY.y1 })
    // paredes de baixo e de cima do compartimento: a mesma altura duas vezes (fora e dentro)
    if (y < BAY.y0 && next >= BAY.y0) rows.push({ y: BAY.y0, inset: 0, bay: false }, { y: BAY.y0, inset: 0, bay: true })
    if (y < BAY.y1 && next >= BAY.y1) rows.push({ y: BAY.y1, inset: 0, bay: true }, { y: BAY.y1, inset: 0, bay: false })
  }
  for (let k = 1; k <= 8; k++) { const a = (k / 8) * (Math.PI / 2); rows.push({ y: yB + TOP_R * Math.sin(a), inset: TOP_R * (1 - Math.cos(a)), bay: false }) }
  rows.push({ y: Y_TOP, inset: 0.18, bay: false }, { y: Y_TOP, inset: RC - 0.002, bay: false }, { y: Y_TOP, inset: RC, bay: false, flat: true })

  const C = cols.length, R = rows.length
  const pos = new Float32Array(C * R * 3), uv = new Float32Array(C * R * 2)
  rows.forEach((r, j) => cols.forEach((c, i) => {
    const rad = Math.max(0, c.r - r.inset)
    const x = c.cx + rad * c.nx
    let z = r.flat ? 0 : c.cz + rad * c.nz
    if (r.bay && c.bay) z = -BAY.floor
    else if (r.inset === 0 && c.nz > 0.05) z -= frontDepth(x, r.y)
    pos.set([x, r.y, z], (j * C + i) * 3)
    uv.set([(i / C) * 6, r.y * 2.5], (j * C + i) * 2) // UV contínuo para a micro-textura do plástico
  }))
  const idx: number[] = []
  for (let j = 0; j < R - 1; j++) for (let i = 0; i < C; i++) {
    const a = j * C + i, b = j * C + ((i + 1) % C), c = a + C, d = b + C
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Painel no fundo do rebaixo (janela PIR): plano com UV, que acompanha a curva do fundo. Fica atrás da linha do corpo. */
function frontPanel(hw: number, y0: number, y1: number, proud: number) {
  const g = new THREE.PlaneGeometry(hw * 2, y1 - y0, 36, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i), p.getY(i) + (y0 + y1) / 2, sFront(p.getX(i)) - WELL.depth + proud)
  g.computeVertexNormals()
  return g
}

type Geo = ReturnType<typeof build>
let cache: Geo | null = null
function build() {
  const flat = { bevelEnabled: false, curveSegments: 24 }
  // faixa cinza da base: recuada, com o fundo arredondado
  const base = upright(new THREE.ExtrudeGeometry(stadium(HW - 0.065, HD - 0.065, RC - 0.065), { depth: 0.06, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.03, bevelSegments: 5, curveSegments: 24 }), Y_BASE - 0.08)
  const baseSeam = upright(new THREE.ExtrudeGeometry(stadium(HW - 0.034, HD - 0.034, RC - 0.034), { depth: 0.01, ...flat }), Y_BASE - 0.01)

  // cápsula da câmera: pílula vertical, com a cabeça (lente) mais larga e a parte do LED mais estreita
  const cp = new THREE.Shape()
  const rT = CAP.hwTop, rB = CAP.hwBottom
  cp.moveTo(rB, CAP.bottom + rB)
  cp.lineTo(rT, CAP.top - rT)
  cp.absarc(0, CAP.top - rT, rT, 0, Math.PI, false)
  cp.lineTo(-rB, CAP.bottom + rB)
  cp.absarc(0, CAP.bottom + rB, rB, Math.PI, Math.PI * 2, false)
  const capsule = new THREE.ExtrudeGeometry(cp, { depth: 0.04, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 5, curveSegments: 32 })

  // traseira: tampa curva, aba de alavanca no topo, presilhas embaixo e os frisos perto da base (dos dois lados)
  const coverH = BAY.y1 + 0.02 - (BAY.y0 - 0.012)
  const cover = upright(backBand(-(BAY.hw + 0.012), BAY.hw + 0.012, coverH, 0.006, 0.028), BAY.y0 - 0.012)
  // linha de junção em volta da tampa (embaixo e dos lados)
  const coverSeam = mergeGeometries([
    upright(backBand(-(BAY.hw + 0.018), BAY.hw + 0.018, 0.007, 0.0035, 0.01), BAY.y0 - 0.019),
    upright(backBand(-(BAY.hw + 0.018), -(BAY.hw + 0.011), coverH, 0.0035, 0.01), BAY.y0 - 0.012),
    upright(backBand(BAY.hw + 0.011, BAY.hw + 0.018, coverH, 0.0035, 0.01), BAY.y0 - 0.012),
  ])
  const latch = upright(backBand(-0.085, 0.085, 0.045, 0.012, 0.03), BAY.y1 + 0.02)
  const clipL = upright(backBand(-0.25, -0.15, 0.035, 0, 0.022), BAY.y0 - 0.047)
  const clipR = upright(backBand(0.15, 0.25, 0.035, 0, 0.022), BAY.y0 - 0.047)
  // suporte de parede (visto por trás, o lado +x fica à esquerda): dois trilhos cinza em "Λ" aberto,
  // mais próximos no alto e mais afastados embaixo, cada um afinando para baixo até um pé reto
  const TOP = BAY.y0 - 0.03
  const legA = new THREE.Shape() // lado +x: quase vertical
  legA.moveTo(0.067, TOP); legA.lineTo(0.26, TOP); legA.lineTo(0.262, Y_FOOT); legA.lineTo(0.15, Y_FOOT); legA.lineTo(0.094, -1.0); legA.closePath()
  const legB = new THREE.Shape() // lado −x: a borda de dentro inclina para fora
  legB.moveTo(-0.054, TOP); legB.lineTo(-0.134, -1.0); legB.lineTo(-0.17, Y_FOOT); legB.lineTo(-0.262, Y_FOOT); legB.lineTo(-0.26, TOP); legB.closePath()
  const railOpt = { depth: 0.04, bevelEnabled: true, bevelSize: 0.009, bevelThickness: 0.009, bevelSegments: 3 }
  const rails = mergeGeometries([new THREE.ExtrudeGeometry(legA, railOpt), new THREE.ExtrudeGeometry(legB, railOpt)])
  // placa cinza entre os trilhos, num nível mais fundo, com o entalhe retangular no alto
  const pl = new THREE.Shape()
  pl.moveTo(-0.25, TOP - 0.01); pl.lineTo(-0.03, TOP - 0.01); pl.lineTo(-0.03, TOP - 0.04); pl.lineTo(0.045, TOP - 0.04); pl.lineTo(0.045, TOP - 0.01); pl.lineTo(0.25, TOP - 0.01)
  pl.lineTo(0.252, -1.06); pl.lineTo(-0.252, -1.06); pl.closePath()
  const plate = new THREE.ExtrudeGeometry(pl, { depth: 0.014, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 })
  // faixa de frisos verticais finos nas laterais, perto da base
  const fr: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) for (let i = 0; i <= 26; i++) {
    const phi = -0.9 + (i / 26) * 1.45 // de ~52° atrás até ~31° na frente, em volta de cada lateral
    const front = phi >= 0, r = (front ? RC : RB) + 0.001
    const b = new THREE.BoxGeometry(0.005, 0.13, 0.006)
    b.rotateY(Math.atan2(sx * Math.cos(phi), Math.sin(phi))) // o lado fino aponta para fora, na normal
    b.translate(sx * ((front ? HW - RC : HW - RB) + r * Math.cos(phi)), -0.72, (front ? HD - RC : -(HD - RB)) + r * Math.sin(phi))
    fr.push(b)
  }
  return {
    shell: shellGeometry(), base, baseSeam, capsule, cover, coverSeam, latch, clipL, clipR, rails, plate,
    ribs: mergeGeometries(fr),
    pirFrame: frontPanel(PIR.hw + 0.014, PIR.y0 - 0.014, PIR.y1 + 0.014, 0.0015),
    pirBack: frontPanel(PIR.hw, PIR.y0, PIR.y1, 0.004),
    pirLens: frontPanel(PIR.hw, PIR.y0, PIR.y1, 0.012),
    win: stadiumGeometry(0.1, 0.17, 0.008, 0.003),
    cell: new THREE.CylinderGeometry(CELL.r, CELL.r, CELL.len, 32),
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
 * Na frente, o rebaixo em capuz com a cápsula da câmera (lente e janela oval do LED), a janela PIR quase
 * quadrada logo abaixo e o logo; faixa cinza recuada na base. Atrás, a tampa curva das pilhas (3 AA) na
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
  const winMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#0f3a1f', roughness: 0.12, clearcoat: 1 }), [])
  // base e suporte de parede: o mesmo plástico cinza fosco
  const baseMat = useMemo(() => { const m = M.grey.clone(); m.color.set('#80848c'); return m }, [])
  // a cápsula é um plástico um pouco mais frio e brilhante que o corpo
  const capMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#d3d6df', roughness: 0.26, clearcoat: 0.6, clearcoatRoughness: 0.2 }), [])
  const mountMat = useMemo(() => { const m = M.grey.clone(); m.color.set('#9a9ea6'); return m }, [])
  const lensBack = useMemo(() => new THREE.MeshStandardMaterial({ color: '#aeb2bb', roughness: 0.7 }), [])
  const pirMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#c3c7d0', map: fresnelTexture(), bumpMap: fresnelTexture(), bumpScale: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true, opacity: 0.88, envMapIntensity: 1.4 }), [])
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
    polaroid.current.position.set(k * 1.05, LENS_Y + k * 0.05, 0.38 + k * 0.3)
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
            <ClickablePart follow="corpo">
              <mesh geometry={g.shell} material={M.white} castShadow />
              <mesh geometry={g.baseSeam} material={M.partition} />
              <LogoGroove r={0.09} position={[0, LOGO_Y, HD - WELL.depth + 0.0008]} />
              {/* cabeça de um parafuso pequeno na lateral, junto à base */}
              <mesh material={M.metal} position={[-(HW + 0.002), -0.86, -0.1]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.022, 0.022, 0.012, 16]} /></mesh>
              <mesh geometry={g.ribs} material={M.white} />
              <mesh geometry={g.coverSeam} material={M.partition} />
              {/* berço preto das pilhas: fundo, divisórias, molas no polo − e contatos no polo + */}
              <mesh material={M.chip} position={[0, CELL.y, -(BAY.floor + 0.006)]}><boxGeometry args={[BAY.hw * 2 - 0.01, BAY.y1 - BAY.y0 - 0.02, 0.012]} /></mesh>
              {[-0.104, 0.104].map((x) => <mesh key={x} material={M.chip} position={[x, CELL.y, -(BAY.floor + 0.05)]}><boxGeometry args={[0.008, CELL.len, 0.09]} /></mesh>)}
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

            {/* cápsula da câmera, dentro do rebaixo */}
            <ClickablePart follow="camera">
              <mesh geometry={g.capsule} material={capMat} position={[0, 0, 0.232]} />
            </ClickablePart>
            <ClickablePart id="camera">
              <mesh material={M.blackGloss} position={[0, LENS_Y, 0.303]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.058, 0.058, 0.012, 32]} /></mesh>
              <mesh material={M.lens} position={[0, LENS_Y, 0.311]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.038, 0.038, 0.008, 32]} /></mesh>
              {/* anéis internos da íris */}
              {[0.012, 0.021, 0.029].map((r) => <mesh key={r} material={M.greyDark} position={[0, LENS_Y, 0.3155]}><torusGeometry args={[r, 0.002, 6, 32]} /></mesh>)}
            </ClickablePart>
            {/* janela oval vertical do LED (verde): o flash em cima, o LED de status embaixo */}
            <ClickablePart id="flash">
              <mesh geometry={g.win} material={winMat} position={[0, LEDWIN_Y, 0.3]} />
              <Led sample={(_, o) => { const p = flashPower(); o.color = '#fff6c8'; o.on = 0.08 + p * 3 }} baseColor="#e8d98a" position={[0, LEDWIN_Y + 0.032, 0.312]}>
                <boxGeometry args={[0.032, 0.045, 0.004]} />
              </Led>
            </ClickablePart>
            <ClickablePart id="led">
              <Led sample={(t, o) => {
                const al = interactive ? alertV.current : 0
                o.color = al > 0.5 ? '#ff2a2a' : '#27d455'
                o.on = al > 0.5 ? 1 : t % 3 < 0.25 ? 0.9 : 0.14
              }} position={[0, LEDWIN_Y - 0.04, 0.312]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.018, 0.018, 0.005, 16]} />
              </Led>
            </ClickablePart>

            {/* janela PIR: grande, quase quadrada, branco-leitosa, com Fresnel discreto; acompanha a curva da frente */}
            <ClickablePart id="pir">
              <mesh geometry={g.pirFrame} material={M.partition} />
              <mesh geometry={g.pirBack} material={lensBack} />
              <mesh geometry={g.pirLens} material={pirMat} />
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
            {/* 3 pilhas AA na vertical, lado a lado, com a polaridade alternada (sem marca) */}
            <ClickablePart id="pilhas">
              {CELL_X.map((x, i) => (
                <group key={x} ref={(gr) => { cellRefs.current[i] = gr }}>
                  <group position={[x, CELL.y, -CELL.s]} rotation={[0, 0, i % 2 ? Math.PI : 0]}>
                    <mesh geometry={g.cell} material={M.cell} />
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
              <mesh ref={pin} material={M.grey} position={[0.104, BAY.y1 - 0.022, -(CELL.s + 0.06)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.014, 0.014, 0.04, 12]} /></mesh>
            </ClickablePart>
            {interactive && arrowPhase === 0 && (
              <Html position={[0, 0.92, -0.4]} center style={{ pointerEvents: 'none' }}>
                <div className="fx-tag -translate-y-7 text-center text-xs font-semibold text-accent">aba<div className="text-xl leading-none">▼</div></div>
              </Html>
            )}
          </group>
        </group>
      </group>

      {/* suporte de parede, preso à traseira (fica parado quando o sensor inclina): placa cinza com um parafuso
          perto de baixo e, sobre ela, os dois trilhos em Λ que passam da base do corpo */}
      <ClickablePart id="fixacao">
        <mesh geometry={g.plate} material={mountMat} position={[0, 0, -(HD + 0.018)]} castShadow />
        <mesh material={M.metal} position={[-0.02, -0.86, -(HD + 0.024)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.036, 0.036, 0.012, 20]} /></mesh>
        <mesh material={M.greyDark} position={[-0.02, -0.86, -(HD + 0.0305)]} rotation={[0, Math.PI, 0.6]}><planeGeometry args={[0.046, 0.008]} /></mesh>
        <mesh material={M.greyDark} position={[-0.02, -0.86, -(HD + 0.0306)]} rotation={[0, Math.PI, 0.6 + Math.PI / 2]}><planeGeometry args={[0.046, 0.008]} /></mesh>
      </ClickablePart>
      <ClickablePart id="suporte">
        <mesh geometry={g.rails} material={mountMat} position={[0, 0, -(HD + 0.062)]} castShadow />
      </ClickablePart>

      </group>

      {interactive && (
        <>
          <CameraFlash power={flashPower} position={[0, LEDWIN_Y + 0.03, 0.38]} />
          <group ref={polaroid} visible={false}>
            <mesh material={polMat} userData={{ fx: true }} raycast={() => null}><planeGeometry args={[0.8, 0.8]} /></mesh>
          </group>
          <DetectionFan position={[0, FAN_Y, 0.36]} length={4.2} labels={pirPhase >= 0} alert={() => alertV.current}
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
