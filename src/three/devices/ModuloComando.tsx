import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { smoothLatheY, stadiumGeometry, stadiumRingGeometry, wire } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import { LED_BY_ID, ledSample } from '../../data/ledStates'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { CommLinks } from '../fx/CommLinks'
import { VoiceWaves } from '../fx/VoiceWaves'
import { HoldRing } from '../fx/HoldRing'

// ---------- medidas (Y para cima, frente em +Z) ----------
// Ficha (1 unidade = 80 mm): planta quase redonda de 144 × 145 mm com a cauda; corpo com 38 mm de altura.
const BOTTOM = -0.4, SQUASH = 0.6 // o corpo foi modelado mais alto; SQUASH leva a altura máxima a ~0,5 (≈ 40 mm)
const RF = 0.9 // raio da face (disco plano)
const YC = 0.25 // altura do centro da face
const TILT = Math.atan(0.2) // a face cai para a frente: o corpo fica bem mais fundo atrás
const CAPSULE_Z = 0.62 // a cápsula do LED/190 fica na frente, perto da ponta
const PCB_Y = -0.08 // topo da placa
const VIAS_TO: [number, number, number][] = [[-1.5, 1.9, -0.6], [0, 2.3, -0.9], [1.5, 1.9, -0.6]]
const VIAS_FROM: [number, number, number] = [0, 0.2, 0]

/**
 * Contorno do módulo visto de cima/de baixo: gota (escudo). Redondo atrás, do lado da antena, afinando para
 * uma ponta arredondada na frente. t = 0 na frente (+Z).
 */
const outR = (t: number) => RF * (1 - 0.2 * Math.sin(t) ** 2 * Math.max(0, Math.cos(t)))
const Y_SEAM = -0.05 // emenda entre a tampa branca e a base cinza

/**
 * Tampa: UMA superfície lisa. O topo é plano (levemente caído para a frente) e desce para a lateral numa curva
 * contínua (superelipse), até a emenda com a base. Sem aro, sem degrau e sem saia.
 */
function lidGeometry() {
  const NT = 144, NP = 26, P = 5
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let i = 0; i <= NT; i++) {
    const t = (i / NT) * Math.PI * 2, ro = outR(t) + 0.012
    for (let j = 0; j <= NP; j++) {
      const f = Math.sin((j / NP) * (Math.PI / 2)) // mais amostras perto da borda, onde a curva aperta
      const x = ro * f * Math.sin(t), z = ro * f * Math.cos(t)
      const top = YC - z * Math.tan(TILT)
      pos.push(x, Y_SEAM + (top - Y_SEAM) * Math.pow(Math.max(0, 1 - Math.pow(f, P)), 1 / P), z)
      uv.push(x * 3, z * 3)
    }
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) {
    const a = i * (NP + 1) + j, b = a + NP + 1
    idx.push(a, a + 1, b, b, a + 1, b + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // fecha a emenda: a primeira e a última coluna compartilham a normal
  const n = g.attributes.normal
  for (let j = 0; j <= NP; j++) {
    const a = j, b = NT * (NP + 1) + j
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize()
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z)
  }
  return g
}

// Fundo (pelo vídeo de fábrica). Tudo em coordenadas do corpo, antes do achatamento em Y.
const Y_BOT = BOTTOM
// Visto por baixo, com a antena para cima: o bolsão fica NO MEIO (um nada para a esquerda), encostado na borda de
// trás; a antena sai ao lado dele, à direita (−X); o furo pequeno fica à esquerda (+X).
const POCKET = { x0: -0.2, x1: 0.3, z0: -0.76, z1: -0.22, d: 0.24 } // bolsão fundo dos cabos, no meio
const LABEL = { x0: -0.3, x1: 0.3, z0: 0.0, z1: 0.3 } // rebaixo raso da etiqueta (fica vazio)
const RJ = { x: 0.0, z: -0.31 } // RJ45 na face funda do bolsão, embaixo da grade, boca para quem olha o fundo
const GRILLE = { x: (POCKET.x0 + POCKET.x1) / 2, z: -0.565, pitch: 0.054 } // grade de som: hexágono de furos na face funda do bolsão
const ANT_X = -0.35 // a antena não fica no centro: sai num ressalto ao lado do bolsão
/** Altura depois do achatamento do corpo (para o que fica fora do grupo achatado). */
const sq = (y: number) => BOTTOM + (y - BOTTOM) * SQUASH
const NET_Y = Y_BOT + POCKET.d - 0.2, POW_X = POCKET.x1 - 0.15 // posição encaixada dos plugues
const JACK = { y: Y_BOT + POCKET.d * 0.5, z: -0.47 } // entrada da fonte na parede esquerda (+X), a meia altura

/** Base cinza: parede lisa no contorno em gota, borda de baixo arredondada e fundo com os dois rebaixos abertos. */
function baseGeometry() {
  const NT = 144, prof: [number, number][] = [[0.95, -0.02], [0.985, Y_SEAM], [0.985, -0.3], [0.975, -0.36], [0.955, -0.39], [0.93, Y_BOT]]
  const pos: number[] = [], idx: number[] = []
  for (let i = 0; i <= NT; i++) {
    const t = (i / NT) * Math.PI * 2
    for (const [k, y] of prof) pos.push(outR(t) * k * Math.sin(t), y, outR(t) * k * Math.cos(t))
  }
  const NP = prof.length
  for (let i = 0; i < NT; i++) for (let j = 0; j < NP - 1; j++) { const a = i * NP + j, b = a + NP; idx.push(a, a + 1, b, b, a + 1, b + 1) }
  const wall = new THREE.BufferGeometry()
  wall.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wall.setIndex(idx); wall.computeVertexNormals()
  // fundo: o contorno com os recortes do bolsão e da etiqueta (no plano x, z)
  const sh = new THREE.Shape()
  for (let i = 0; i <= NT; i++) { const t = (i / NT) * Math.PI * 2, r = outR(t) * 0.93; i ? sh.lineTo(r * Math.sin(t), r * Math.cos(t)) : sh.moveTo(r * Math.sin(t), r * Math.cos(t)) } // os mesmos pontos da parede: sem fresta
  const rect = (r: { x0: number; x1: number; z0: number; z1: number }) => { const h = new THREE.Path(); h.moveTo(r.x0, r.z0); h.lineTo(r.x1, r.z0); h.lineTo(r.x1, r.z1); h.lineTo(r.x0, r.z1); h.closePath(); return h }
  sh.holes.push(rect(POCKET), rect(LABEL))
  const floor = new THREE.ShapeGeometry(sh, 24)
  floor.rotateX(Math.PI / 2); floor.translate(0, Y_BOT, 0)
  // paredes e teto de cada rebaixo, virados para dentro
  const inner = (r: { x0: number; x1: number; z0: number; z1: number }, d: number) => {
    const w = r.x1 - r.x0, l = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, y = Y_BOT + d / 2
    const pl = (pw: number, ph: number, rot: [number, number, number], at: [number, number, number]) => { const g = new THREE.PlaneGeometry(pw, ph); g.rotateX(rot[0]); g.rotateY(rot[1]); g.translate(...at); return g }
    return [
      pl(w, l, [Math.PI / 2, 0, 0], [cx, Y_BOT + d, cz]), // teto, virado para baixo
      pl(w, d, [0, 0, 0], [cx, y, r.z0]), pl(w, d, [0, Math.PI, 0], [cx, y, r.z1]), // paredes de trás e da frente
      pl(l, d, [0, Math.PI / 2, 0], [r.x0, y, cz]), pl(l, d, [0, -Math.PI / 2, 0], [r.x1, y, cz]), // paredes dos lados
    ]
  }
  for (const g of [wall, floor]) g.deleteAttribute('uv')
  const parts = [wall, floor, ...inner(POCKET, POCKET.d), ...inner(LABEL, 0.018)]
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

type Geo = ReturnType<typeof build>
let cache: Geo | null = null
function build() {
  return {
    lid: lidGeometry(),
    base: baseGeometry(),
    slit: new THREE.BoxGeometry(0.016, 0.004, 0.075), // fenda de ventilação
    foot: new THREE.CylinderGeometry(0.07, 0.075, 0.02, 20),
    capsuleRim: stadiumRingGeometry(0.33, 0.145, 0.014, 0.012, 0.003),
    capsule: stadiumGeometry(0.3, 0.116, 0.014, 0.006),
    halo: stadiumRingGeometry(0.296, 0.112, 0.012, 0.003, 0),
    paddle: stadiumGeometry(0.17, 1.2, 0.05, 0.014),
    pcb: pcbGeometry(),
    cone: smoothLatheY([[0.185, 0.04], [0.175, 0.046], [0.155, 0.036], [0.11, 0.02], [0.06, 0.012], [0.03, 0.03]], 48, 24),
    magnet: smoothLatheY([[0.064, 0.012], [0.064, 0.03], [0.062, 0.044], [0.05, 0.05], [0.001, 0.05]], 32, 16),
    hole: new THREE.CircleGeometry(0.018, 10),
    // cabos e fios
    // coaxial do Wi-Fi: rabicho curto até a placa
    coaxA: wire([[-0.42, PCB_Y + 0.045, 0.13], [-0.5, PCB_Y + 0.07, 0.05], [-0.56, PCB_Y + 0.06, -0.05], [-0.52, PCB_Y + 0.03, -0.12]], 0.007),
    // coaxial do 4G: do cartão do chip até a rosca da antena, pelo braço da placa ao lado do recorte
    coaxB: wire([[0.0, PCB_Y + 0.05, 0.16], [-0.16, PCB_Y + 0.085, 0.02], [-0.345, PCB_Y + 0.075, -0.2], [-0.355, PCB_Y + 0.06, -0.5], [ANT_X, PCB_Y + 0.02, -0.69]], 0.007),
    // antena de fio do rádio dos sensores: acompanha a borda da placa
    yellow: wire([[-0.52, PCB_Y + 0.02, -0.42], [-0.63, PCB_Y + 0.06, -0.2], [-0.7, PCB_Y + 0.07, 0.05], [-0.66, PCB_Y + 0.06, 0.3], [-0.56, PCB_Y + 0.03, 0.46]], 0.009),
    spkA: wire([[0.0, -0.03, -0.27], [-0.08, 0.0, -0.2], [-0.2, PCB_Y + 0.03, -0.14], [-0.24, PCB_Y + 0.012, -0.1]], 0.007),
    spkB: wire([[0.07, -0.03, -0.27], [-0.01, 0.0, -0.19], [-0.13, PCB_Y + 0.03, -0.11], [-0.2, PCB_Y + 0.012, -0.06]], 0.007),
    micA: wire([[0.36, -0.2, -0.26], [0.4, -0.1, -0.2], [0.38, PCB_Y + 0.03, -0.12], [0.33, PCB_Y + 0.012, -0.08]], 0.006),
    micB: wire([[0.39, -0.2, -0.24], [0.44, -0.1, -0.17], [0.42, PCB_Y + 0.03, -0.1], [0.37, PCB_Y + 0.012, -0.05]], 0.006),
    batA: wire([[0.6, PCB_Y + 0.03, -0.02], [0.7, PCB_Y + 0.03, 0.1], [0.74, PCB_Y - 0.04, 0.22]], 0.008),
    batB: wire([[0.6, PCB_Y + 0.03, -0.06], [0.72, PCB_Y + 0.03, 0.06], [0.76, PCB_Y - 0.04, 0.18]], 0.008),
    netCable: wire([[0, 0, 0], [0, -0.05, -0.25], [0, -0.02, -0.7], [0.1, 0.02, -1.4]], 0.035),
    powCable: wire([[0, 0, 0], [-0.12, -0.02, 0], [-0.3, -0.05, -0.12], [-0.42, -0.04, -0.5], [-0.5, 0.02, -1.1]], 0.026),
    plugCable: wire([[0, 0, 0], [0.5, -0.02, -0.1], [1.3, -0.02, 0.2], [2.4, -0.02, 0.1]], 0.03),
  }
}
const G = () => (cache ??= build())


/**
 * Módulo de Comando. Tampa branca numa superfície só, cápsula do LED/190 na frente, base cinza em gota com o
 * bolsão dos cabos no meio da borda de trás e a antena saindo ao lado dele (fora do centro).
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
  const cap = useRef<THREE.Mesh>(null!)
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
        const a = (i / 60) * Math.PI * 2, r = outR(a) * 0.85, x = Math.sin(a) * r, z = Math.cos(a) * r
        if (z < -0.5 && x > ANT_X - 0.14 && x < POCKET.x1 + 0.06) continue // atrás do bolsão e do ressalto da antena não há fenda
        o.position.set(x, Y_BOT - 0.0015, z); o.rotation.set(0, a, 0); o.scale.setScalar(1)
        o.updateMatrix(); fins.current.setMatrixAt(n++, o.matrix)
      }
      fins.current.count = n
      // grade de som: 37 furos redondos em hexágono, na face funda do bolsão, virados para quem olha o fundo
      n = 0
      const HS = GRILLE.pitch, rows = [4, 5, 6, 7, 6, 5, 4]
      rows.forEach((cnt, j) => {
        for (let i = 0; i < cnt; i++) {
          o.position.set(GRILLE.x + (i - (cnt - 1) / 2) * HS, Y_BOT + POCKET.d - 0.002, GRILLE.z + (j - 3) * HS * 0.866)
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
    // a cápsula de transmissão não entra no esmaecer das partes: some quando outra parte está em foco
    if (cap.current) cap.current.visible = !s.part || s.part === 'led' || s.part === 'botao-sos' || !!s.action
    // tomada sai ("sem energia")
    const tb = actionTime('bateria-modulo')
    plug.current.visible = tb >= 0
    // o plugue da fonte sai de lado e depois desce, para fora do bolsão
    plug.current.position.set(POW_X - (tb < 0 ? 0 : seg(tb, 0.6, 1.2)) * 0.16, sq(JACK.y) - (tb < 0 ? 0 : seg(tb, 1.2, 1.8)) * 0.6, JACK.z)
    // cabos de rede e de energia entram no bolsão e encaixam
    const tc = actionTime('cabos')
    cables.current.visible = tc >= 0
    if (tc >= 0) {
      // o cabo de rede sobe e encaixa no RJ45, que tem a boca para baixo
      netRef.current.position.y = NET_Y - (1 - seg(tc, 0.3, 1.3)) * 0.8 + bump(tc, 1.25, 1.4, 1.45, 1.6) * 0.02
      // o plugue da fonte sobe para dentro do bolsão e entra de lado, na parede esquerda
      powRef.current.position.set(POW_X - (1 - seg(tc, 2.2, 2.8)) * 0.16 + bump(tc, 2.75, 2.9, 2.95, 3.1) * 0.02, JACK.y - (1 - seg(tc, 1.6, 2.2)) * 0.7, JACK.z)
      cables.current.position.y = -seg(tc, 4.6, 5.4) * 1.1
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
  const sampleHalo = (t: number, out: { color: string; on: number }) => { sampleLed(t, out); out.on *= 0.35 }

  return (
    <DeviceCtx.Provider value={{ deviceId: 'modulo', interactive }}>
      <group ref={root}>
        {/* corpo na altura da ficha (38 mm; 41 com a cápsula do LED): tudo, menos a antena, é achatado em Y a partir do fundo */}
        <group position={[0, BOTTOM * (1 - SQUASH), 0]} scale={[1, SQUASH, 1]}>
        {/* ================= tampa branca (cúpula em concha) ================= */}
        <group ref={lid}>
          <ClickablePart id="tampa">
            {/* uma superfície só: topo plano que desce para a lateral em curva contínua, na forma de gota do fundo */}
            <mesh geometry={g.lid} material={apronMat} castShadow />
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

          {/* cápsula do LED/190: aro fino, guia de luz e o ponto do LED no centro */}
          <ClickablePart id="botao-sos">
            <group position={[0, YC, 0]} rotation={[TILT, 0, 0]}>
              <group position={[0, -0.008, CAPSULE_Z]}>
                <mesh geometry={g.capsuleRim} material={M.chrome} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, 0]} />
                <group ref={pressA} {...hold}>
                  {/* cristal do LED: plástico translúcido que já existia (M.crystal); a luz aparece por trás. Sem transmission */}
                  <mesh ref={cap} geometry={g.capsule} material={M.crystal} rotation={[-Math.PI / 2, 0, 0]} userData={interactive ? { fx: true } : undefined} />
                </group>
                {interactive && <HoldRing radius={0.26} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} />}
              </group>
            </group>
          </ClickablePart>
          <ClickablePart id="led">
            <group position={[0, YC, 0]} rotation={[TILT, 0, 0]}>
              <group position={[0, -0.008, CAPSULE_Z]}>
                <group ref={pressB} {...hold}>
                  {/* ponto forte no centro + halo suave pelo contorno: a cápsula inteira guia a luz */}
                  <Led sample={sampleLed} boost={5} baseColor="#20242c" position={[0, 0.0215, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.024, 20]} /></Led>
                  <Led sample={sampleHalo} boost={2.2} baseColor="#dfe5ef" geometry={g.halo} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                </group>
              </group>
            </group>
          </ClickablePart>
        </group>

        {/* ================= antena tipo pá: conector rosqueado e articulação ================= */}
        </group>
        <ClickablePart id="antena">
          <group position={[ANT_X, BOTTOM + (-0.14 - BOTTOM) * SQUASH, -0.73]}>
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

        {/* ================= base cinza: silhueta lisa em gota, fendas na borda, pés, rebaixos ================= */}
        <ClickablePart id="base">
          <mesh geometry={g.base} material={M.grey} castShadow />
          <instancedMesh ref={fins} args={[g.slit, M.hole, 60]} />
        </ClickablePart>
        <ClickablePart follow="base">
          {/* pés redondos e baixos, perto da borda */}
          {[0, 2.25, -2.25].map((a) => <mesh key={a} geometry={g.foot} material={M.grey} position={[Math.sin(a) * 0.68, Y_BOT - 0.01, Math.cos(a) * 0.68]} />)}
          {/* furo pequeno, à esquerda do bolsão */}
          <mesh material={M.hole} position={[0.43, Y_BOT - 0.001, -0.5]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.022, 14]} /></mesh>
          {/* ressalto da rosca da antena: bloco de face plana na borda de trás, colado no lado direito do bolsão */}
          <RoundedBox args={[0.27, 0.341, 0.125]} radius={0.03} smoothness={3} position={[ANT_X + 0.01, -0.2255, -0.7625]} material={M.grey} />
          {/* duas travas cinza, em lados opostos, que prendem a placa */}
          {[-1, 1].map((sx) => (
            <RoundedBox key={sx} args={[0.07, 0.07, 0.2]} radius={0.02} smoothness={3} position={[sx * 0.74, PCB_Y + 0.01, -0.1]} material={M.grey} />
          ))}
        </ClickablePart>

        {/* grade de som: furos em hexágono na face funda do bolsão; de baixo, é o que mais aparece */}
        <ClickablePart id="alto-falante">
          <instancedMesh ref={holes} args={[g.hole, M.hole, 37]} />
        </ClickablePart>
        {/* RJ45: na face funda do bolsão, embaixo da grade (perto da parede da frente), com a boca para quem olha o fundo */}
        <ClickablePart id="ethernet">
          <mesh material={M.metal} position={[RJ.x, Y_BOT + POCKET.d - 0.05, RJ.z]}><boxGeometry args={[0.2, 0.1, 0.16]} /></mesh>
          <mesh material={M.hole} position={[RJ.x, Y_BOT + POCKET.d - 0.101, RJ.z]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.15, 0.11]} /></mesh>
          <mesh material={M.gold} position={[RJ.x, Y_BOT + POCKET.d - 0.102, RJ.z - 0.035]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.11, 0.02]} /></mesh>
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
          <mesh material={M.metal} position={[RJ.x, PCB_Y - 0.06, RJ.z + 0.14]}><boxGeometry args={[0.22, 0.1, 0.12]} /></mesh>
          <mesh material={M.chip} position={[POCKET.x1 + 0.07, PCB_Y - 0.05, JACK.z]}><boxGeometry args={[0.12, 0.09, 0.12]} /></mesh>
          {/* área de energia: bobinas e chips pequenos */}
          {[[0.5, -0.36], [0.62, -0.26], [0.56, -0.16]].map(([x, z], i) => (
            <RoundedBox key={i} args={[0.075, 0.045, 0.075]} radius={0.012} smoothness={2} position={[x, PCB_Y + 0.022, z]} material={M.chip} />
          ))}
          {/* pinos dourados de teste em fileira, dois parafusos pretos e a etiqueta lisa */}
          {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} material={M.gold} position={[-0.6 + i * 0.03, PCB_Y + 0.012, 0.02 - i * 0.012]}><cylinderGeometry args={[0.007, 0.007, 0.03, 6]} /></mesh>)}
          {[[0.02, 0.0], [0.02, -0.12]].map(([x, z], i) => <mesh key={i} material={M.chip} position={[x, PCB_Y + 0.008, z]}><cylinderGeometry args={[0.03, 0.03, 0.016, 12]} /></mesh>)}
          <mesh material={M.white} position={[-0.42, PCB_Y + 0.002, -0.52]} rotation={[-Math.PI / 2, 0, 0.6]}><planeGeometry args={[0.13, 0.08]} /></mesh>
          <mesh material={M.chip} position={[-0.29, PCB_Y + 0.012, -0.05]}><boxGeometry args={[0.09, 0.022, 0.09]} /></mesh>
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
          <group position={[GRILLE.x, -0.08, -0.5]}>
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

        {/* cabos que entram no bolsão: plugue de energia em L e cabo de rede */}
        {interactive && (
          <group ref={cables} visible={false}>
            <group ref={netRef} position={[RJ.x, NET_Y, RJ.z]}>
              <mesh material={M.wireBlue} position={[0, 0.02, 0]} userData={{ fx: true }}><boxGeometry args={[0.15, 0.2, 0.1]} /></mesh>
              <mesh material={M.wireBlue} position={[0, -0.6, 0]} userData={{ fx: true }} raycast={() => null}><cylinderGeometry args={[0.03, 0.03, 1.1, 10]} /></mesh>
            </group>
            <group ref={powRef} position={[POW_X, JACK.y, JACK.z]}>
              <mesh material={M.chip} position={[0.02, 0, 0]} userData={{ fx: true }}><boxGeometry args={[0.2, 0.1, 0.09]} /></mesh>
              <mesh material={M.chip} position={[-0.07, -0.55, 0]} userData={{ fx: true }} raycast={() => null}><cylinderGeometry args={[0.025, 0.025, 1.1, 10]} /></mesh>
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
