import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, MeshTransmissionMaterial, RoundedBox } from '@react-three/drei'
import { RoundedBoxGeometry } from 'three-stdlib'
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
const CAPSULE_Z = 0.7 // a cápsula do LED/190 fica perto da borda da frente
const PCB_Y = -0.08 // topo da placa
const VIAS_TO: [number, number, number][] = [[-1.5, 1.9, -0.6], [0, 2.3, -0.9], [1.5, 1.9, -0.6]]
const VIAS_FROM: [number, number, number] = [0, 0.2, 0]

const gauss = (d: number, w: number) => Math.exp(-(d / w) * (d / w))
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
/** "Asas" da concha: uma ponta na frente e duas largas atrás (por onde saem a antena e os cabos). */
const lobeFront = (t: number) => gauss(wrap(t), 0.52)
const lobeBack = (t: number) => Math.max(gauss(wrap(t - 2.2), 0.6), gauss(wrap(t + 2.2), 0.6))
/** Metade de trás inteira (0 na frente, 1 atrás): é onde a concha se abre e saem a antena e os cabos. */
const rear = (t: number) => { const x = Math.min(1, Math.max(0, (Math.abs(wrap(t)) - 1.0) / 1.1)); return x * x * (3 - 2 * x) }

/** Saia da tampa: nasce redonda na borda da face e se abre numa concha de três pontas. */
function apronGeometry() {
  const NT = 144, NP = 24, RT = RF + 0.016, S = 0.075
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let i = 0; i <= NT; i++) {
    const t = (i / NT) * Math.PI * 2, LF = lobeFront(t), LB = lobeBack(t), L = Math.max(LF, LB)
    const x0 = RT * Math.sin(t), z0 = RT * Math.cos(t) * Math.cos(TILT), y0 = YC - RT * Math.cos(t) * Math.sin(TILT) - 0.012
    const r0 = Math.hypot(x0, z0), dx = x0 / r0, dz = z0 / r0
    // a saia desce quase reta e só abre de verdade atrás; a borda de baixo é recortada entre as pontas
    const ro = 1.02 + 0.06 * LF + 0.2 * rear(t), yl = -0.08 - 0.15 * L
    for (let j = 0; j <= NP; j++) {
      const u = j / NP
      let r: number, y: number
      if (u < 0.3) { const a = (u / 0.3) * (Math.PI / 2); r = r0 + S * Math.sin(a); y = y0 - S * (1 - Math.cos(a)) }
      else { const k = (u - 0.3) / 0.7; r = r0 + S + (ro - r0 - S) * Math.pow(k, 1.6); y = y0 - S + (yl - y0 + S) * k }
      pos.push(r * dx, y, r * dz); uv.push((i / NT) * 6, u * 1.5)
    }
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) {
    const a = i * (NP + 1) + j, b = a + NP + 1
    idx.push(a, b, a + 1, b, b + 1, a + 1)
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

/** Placa verde: redonda, com o recorte onde encaixa a caixinha do alto-falante. */
function pcbGeometry() {
  const s = new THREE.Shape()
  const R = 0.76
  // contorno no plano (x, -z): começa depois do recorte e dá a volta
  const a0 = Math.asin(0.29 / R), a1 = Math.PI * 2 - Math.asin(0.17 / R)
  for (let i = 0; i <= 80; i++) { const a = a0 + ((a1 - a0) * i) / 80; const x = Math.sin(a) * R, y = Math.cos(a) * R; i ? s.lineTo(x, y) : s.moveTo(x, y) }
  s.lineTo(-0.17, 0.19); s.lineTo(0.29, 0.19); s.closePath()
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
    apron: apronGeometry(),
    face: smoothLatheY([[0.9, -0.03], [0.897, -0.014], [0.888, -0.004], [0.865, 0], [0.6, 0], [0.001, 0]], 128),
    base: smoothLatheY([[0.001, -0.4], [0.5, -0.4], [0.72, -0.4], [0.775, -0.39], [0.805, -0.35], [0.825, -0.2], [0.83, -0.05], [0.82, -0.03], [0.8, -0.04]], 96),
    fin: new RoundedBoxGeometry(0.04, 0.3, 0.12, 3, 0.017),
    capsuleRim: stadiumRingGeometry(0.33, 0.145, 0.014, 0.012, 0.003),
    capsule: stadiumGeometry(0.3, 0.116, 0.014, 0.006),
    halo: stadiumRingGeometry(0.296, 0.112, 0.012, 0.003, 0),
    paddle: stadiumGeometry(0.17, 1.2, 0.05, 0.014),
    pcb: pcbGeometry(),
    cone: smoothLatheY([[0.185, 0.04], [0.175, 0.046], [0.155, 0.036], [0.11, 0.02], [0.06, 0.012], [0.03, 0.03]], 48, 24),
    magnet: smoothLatheY([[0.064, 0.012], [0.064, 0.03], [0.062, 0.044], [0.05, 0.05], [0.001, 0.05]], 32, 16),
    smd: new THREE.BoxGeometry(0.03, 0.014, 0.018),
    hole: new THREE.CircleGeometry(0.018, 10),
    // cabos e fios
    coaxA: wire([[-0.42, PCB_Y + 0.045, 0.13], [-0.2, PCB_Y + 0.07, -0.05], [-0.25, PCB_Y + 0.06, -0.4], [-0.42, PCB_Y + 0.03, -0.6]], 0.007),
    coaxB: wire([[0.0, PCB_Y + 0.05, 0.16], [-0.1, PCB_Y + 0.08, 0.0], [-0.02, PCB_Y + 0.07, -0.12], [-0.12, PCB_Y + 0.05, -0.16]], 0.007),
    yellow: wire([[-0.25, PCB_Y + 0.02, -0.44], [-0.2, PCB_Y + 0.06, -0.6], [-0.05, PCB_Y + 0.08, -0.72], [0.2, PCB_Y + 0.07, -0.7], [0.33, PCB_Y + 0.05, -0.45], [0.34, PCB_Y + 0.02, -0.25]], 0.009),
    spkA: wire([[0.0, -0.06, -0.36], [-0.06, 0.0, -0.3], [-0.2, PCB_Y + 0.03, -0.18], [-0.24, PCB_Y + 0.012, -0.1]], 0.007),
    spkB: wire([[0.06, -0.06, -0.33], [0.0, -0.01, -0.26], [-0.12, PCB_Y + 0.03, -0.14], [-0.2, PCB_Y + 0.012, -0.06]], 0.007),
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

// posições pseudoaleatórias fixas dos componentes SMD, fora dos blocos grandes
const SMD: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = []
  let seed = 11
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  const blocked = (x: number, z: number) =>
    (x > -0.2 && x < 0.32 && z < -0.15) || (x > -0.46 && x < -0.16 && z > 0.08 && z < 0.56) || (x > -0.1 && x < 0.58 && z > 0.1 && z < 0.6) ||
    (x > -0.42 && x < -0.18 && z > -0.42 && z < -0.18) || Math.hypot(x, z) > 0.7
  while (out.length < 90) { const x = rnd() * 1.5 - 0.75, z = rnd() * 1.5 - 0.75; if (!blocked(x, z)) out.push([x, z, rnd() * Math.PI, rnd()]) }
  return out
})()

/**
 * Módulo de Comando. Tampa branca em concha (face plana inclinada + saia que se abre para trás),
 * cápsula do LED/190 na frente, base cinza serrilhada com o bolsão dos cabos e a antena atrás.
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
  const smd = useRef<THREE.InstancedMesh>(null!)
  const holes = useRef<THREE.InstancedMesh>(null!)
  const shieldHoles = useRef<THREE.InstancedMesh>(null!)
  const inited = useRef(false)
  const cableMat = useMemo(() => fxBasic('#2a2d35'), [])
  const apronMat = useMemo(() => { const m = M.white.clone(); m.side = THREE.DoubleSide; return m }, [])
  const finMat = useMemo(() => M.grey.clone(), [])
  const smdMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.5 }), [])
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
    if (!inited.current && fins.current && smd.current && holes.current && shieldHoles.current) {
      const o = new THREE.Object3D(), c = new THREE.Color()
      // dentes/aletas da base, em todo o contorno
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2
        o.position.set(Math.sin(a) * 0.86, -0.205, Math.cos(a) * 0.86); o.rotation.set(0, a, 0); o.scale.setScalar(1)
        o.updateMatrix(); fins.current.setMatrixAt(i, o.matrix)
      }
      SMD.forEach(([x, z, r, k], i) => {
        o.position.set(x, PCB_Y + 0.007, z); o.rotation.set(0, r, 0); o.scale.setScalar(0.7 + k * 0.9)
        o.updateMatrix(); smd.current.setMatrixAt(i, o.matrix)
        smd.current.setColorAt(i, c.set(k < 0.45 ? '#15161a' : k < 0.75 ? '#b99a62' : '#8a6b4a'))
      })
      // grade de furos do alto-falante, no fundo do bolsão (virada para baixo)
      let n = 0
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) {
        // grade do alto-falante: furos redondos no lado do bolsão mais perto da cauda
        o.position.set(-0.36 + i * 0.09, -0.4012, -0.735 + j * 0.05); o.rotation.set(Math.PI / 2, 0, 0); o.scale.setScalar(1.05)
        o.updateMatrix(); holes.current.setMatrixAt(n++, o.matrix)
      }
      n = 0
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        o.position.set(-0.375 + i * 0.05, PCB_Y + 0.0465, -0.375 + j * 0.05); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(0.55)
        o.updateMatrix(); shieldHoles.current.setMatrixAt(n++, o.matrix)
      }
      for (const m of [fins, smd, holes, shieldHoles]) m.current.instanceMatrix.needsUpdate = true
      if (smd.current.instanceColor) smd.current.instanceColor.needsUpdate = true
      for (const m of [fins, smd, holes, shieldHoles]) m.current.computeBoundingBox()
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
    plug.current.position.x = -0.2 - (tb < 0 ? 0 : seg(tb, 0.6, 1.8)) * 0.7
    // cabos de rede e de energia entram no bolsão e encaixam
    const tc = actionTime('cabos')
    cables.current.visible = tc >= 0
    if (tc >= 0) {
      netRef.current.position.z = -(1 - seg(tc, 0.3, 1.3)) * 0.9 - bump(tc, 1.25, 1.4, 1.45, 1.6) * 0.03
      // o plugue da fonte chega pela lateral e encaixa no meio do bolsão
      powRef.current.position.x = -0.16 - (1 - seg(tc, 1.7, 2.7)) * 0.9 - bump(tc, 2.65, 2.8, 2.85, 3.0) * 0.03
      cables.current.position.z = -seg(tc, 4.6, 5.4) * 1.1
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
            <mesh geometry={g.apron} material={apronMat} castShadow />
            <group position={[0, YC, 0]} rotation={[TILT, 0, 0]}>
              <mesh geometry={g.face} material={M.white} />
              {/* linha de partição entre a face e o corpo */}
              <mesh material={M.partition} position={[0, -0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[RF - 0.004, RF + 0.012, 128]} /></mesh>
              <LogoGroove r={0.43} position={[0.04, 0.0015, -0.06]} rotation={[-Math.PI / 2, 0, 0]} />
              {/* por dentro: bloco do guia de luz com furo de parafuso, ganchos e ressalto quadrado */}
              <RoundedBox args={[0.34, 0.08, 0.17]} radius={0.03} smoothness={3} position={[0, -0.06, CAPSULE_Z]} material={M.white} />
              <mesh material={M.hole} position={[0.0, -0.101, CAPSULE_Z]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.022, 16]} /></mesh>
              <RoundedBox args={[0.1, 0.07, 0.1]} radius={0.015} smoothness={2} position={[0.74, -0.065, 0.2]} material={M.white} />
              {[0.6, 1.9, 2.9, 3.9, 5.2].map((a) => (
                <RoundedBox key={a} args={[0.09, 0.07, 0.03]} radius={0.01} smoothness={2} position={[Math.sin(a) * 0.84, -0.065, Math.cos(a) * 0.84]} rotation={[0, a, 0]} material={M.white} />
              ))}
            </group>
          </ClickablePart>

          {/* cápsula do LED/190: aro fino, guia de luz e o ponto do LED no centro */}
          <ClickablePart id="botao-sos">
            <group position={[0, YC, 0]} rotation={[TILT, 0, 0]}>
              <group position={[0, 0, CAPSULE_Z]}>
                <mesh geometry={g.capsuleRim} material={M.chrome} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, 0]} />
                <group ref={pressA} {...hold}>
                  {interactive ? (
                    <mesh ref={cap} geometry={g.capsule} rotation={[-Math.PI / 2, 0, 0]} userData={{ fx: true }}>
                      <MeshTransmissionMaterial resolution={256} samples={3} transmission={0.92} thickness={0.08} roughness={0.28} chromaticAberration={0} anisotropicBlur={0.1} color="#f4f7fc" backside={false} />
                    </mesh>
                  ) : (
                    <mesh geometry={g.capsule} material={M.crystal} rotation={[-Math.PI / 2, 0, 0]} />
                  )}
                </group>
                {interactive && <HoldRing radius={0.26} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} />}
              </group>
            </group>
          </ClickablePart>
          <ClickablePart id="led">
            <group position={[0, YC, 0]} rotation={[TILT, 0, 0]}>
              <group position={[0, 0, CAPSULE_Z]}>
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
          <group position={[0, BOTTOM + (-0.14 - BOTTOM) * SQUASH, -0.8]}>
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

        {/* ================= base cinza: copo liso + borda serrilhada ================= */}
        <ClickablePart id="base">
          <mesh geometry={g.base} material={M.grey} castShadow />
          <instancedMesh ref={fins} args={[g.fin, finMat, 60]} castShadow />
        </ClickablePart>
        <ClickablePart follow="base">
          {/* bolsão dos cabos (moldura + fundo mais escuro) e rebaixo raso da etiqueta */}
          <mesh material={M.greyDark} position={[0, -0.4005, -0.56]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.98, 0.42]} /></mesh>
          {[[0, -0.775, 1.02, 0.03], [0, -0.345, 1.02, 0.03], [-0.5, -0.56, 0.03, 0.46], [0.5, -0.56, 0.03, 0.46]].map(([x, z, w, d], i) => (
            <RoundedBox key={i} args={[w, 0.03, d]} radius={0.01} smoothness={2} position={[x, -0.405, z]} material={M.grey} />
          ))}
          <mesh material={M.greyDark} position={[0, -0.4005, 0.02]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.7, 0.4]} /></mesh>
          <mesh material={M.white} position={[0.02, -0.4012, 0.04]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.3, 0.2]} /></mesh>
          <mesh material={M.hole} position={[-0.62, -0.4008, -0.3]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.03, 16]} /></mesh>
          <mesh material={M.grey} position={[0, -0.4, 0.5]} scale={[1, 0.35, 1]}><sphereGeometry args={[0.085, 24, 12]} /></mesh>
          {/* duas travas cinza, em lados opostos, que prendem a placa */}
          {[-1, 1].map((sx) => (
            <RoundedBox key={sx} args={[0.07, 0.07, 0.2]} radius={0.02} smoothness={3} position={[sx * 0.775, PCB_Y + 0.01, 0.05]} material={M.grey} />
          ))}
        </ClickablePart>

        <ClickablePart id="alto-falante">
          <instancedMesh ref={holes} args={[g.hole, M.hole, 36]} />
        </ClickablePart>
        <ClickablePart id="ethernet">
          {/* RJ45 na parede do bolsão do lado do centro; o cabo chega pelo lado da cauda */}
          <RoundedBox args={[0.24, 0.07, 0.2]} radius={0.015} smoothness={2} position={[0.24, -0.43, -0.455]} material={M.metal} />
          <mesh material={M.hole} position={[0.24, -0.44, -0.54]}><boxGeometry args={[0.18, 0.045, 0.04]} /></mesh>
          <mesh material={M.gold} position={[0.24, -0.428, -0.548]}><boxGeometry args={[0.13, 0.008, 0.03]} /></mesh>
        </ClickablePart>
        <ClickablePart id="fonte">
          {/* entrada da fonte no meio do bolsão; o conector entra pela lateral (−X), não pela traseira */}
          <group position={[-0.06, -0.435, -0.5]} rotation={[0, Math.PI / 2, 0]}>
            <RoundedBox args={[0.15, 0.08, 0.18]} radius={0.02} smoothness={2} material={M.chip} />
            <mesh material={M.hole} position={[0, -0.004, -0.0905]} rotation={[0, Math.PI, 0]}><circleGeometry args={[0.032, 16]} /></mesh>
            <mesh material={M.gold} position={[0, -0.004, -0.085]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.009, 0.009, 0.03, 8]} /></mesh>
          </group>
        </ClickablePart>

        {/* ================= interior ================= */}
        <ClickablePart id="placa-principal">
          <mesh geometry={g.pcb} material={M.pcb} position={[0, PCB_Y, 0]} />
          <instancedMesh ref={smd} args={[g.smd, smdMat, SMD.length]} />
          {/* área de energia: bobinas e chips pequenos */}
          {[[0.5, -0.36], [0.62, -0.26], [0.56, -0.16]].map(([x, z], i) => (
            <RoundedBox key={i} args={[0.075, 0.045, 0.075]} radius={0.012} smoothness={2} position={[x, PCB_Y + 0.022, z]} material={M.chip} />
          ))}
          {/* pinos dourados de teste em fileira, dois parafusos pretos e a etiqueta lisa */}
          {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} material={M.gold} position={[-0.6 + i * 0.03, PCB_Y + 0.012, 0.02 - i * 0.012]}><cylinderGeometry args={[0.007, 0.007, 0.03, 6]} /></mesh>)}
          {[[0.02, 0.0], [0.02, -0.12]].map(([x, z], i) => <mesh key={i} material={M.chip} position={[x, PCB_Y + 0.008, z]}><cylinderGeometry args={[0.03, 0.03, 0.016, 12]} /></mesh>)}
          <mesh material={M.white} position={[-0.47, PCB_Y + 0.002, -0.5]} rotation={[-Math.PI / 2, 0, 0.5]}><planeGeometry args={[0.16, 0.1]} /></mesh>
          <mesh material={M.chip} position={[-0.29, PCB_Y + 0.012, -0.05]}><boxGeometry args={[0.09, 0.022, 0.09]} /></mesh>
        </ClickablePart>

        <ClickablePart id="led-botao-placa">
          <Led sample={sampleLed} boost={3.5} baseColor="#b9c8ee" position={[-0.06, PCB_Y + 0.012, 0.655]}><boxGeometry args={[0.04, 0.022, 0.03]} /></Led>
          <mesh material={M.metal} position={[0.07, PCB_Y + 0.014, 0.67]}><boxGeometry args={[0.085, 0.028, 0.085]} /></mesh>
          <mesh material={M.wireBlue} position={[0.07, PCB_Y + 0.04, 0.67]}><cylinderGeometry args={[0.026, 0.028, 0.03, 16]} /></mesh>
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
          <RoundedBox args={[0.22, 0.045, 0.22]} radius={0.01} smoothness={2} position={[-0.3, PCB_Y + 0.023, -0.3]} material={M.metal} />
          <instancedMesh ref={shieldHoles} args={[g.hole, M.hole, 16]} />
          <mesh material={M.chip} position={[-0.47, PCB_Y + 0.012, -0.22]}><boxGeometry args={[0.07, 0.022, 0.07]} /></mesh>
          <mesh geometry={g.yellow} material={M.yellow} />
        </ClickablePart>

        {/* alto-falante: caixinha cinza quadrada no recorte da placa, cone preto e ímã cromado */}
        <ClickablePart id="speaker">
          <group position={[0.06, -0.12, -0.45]}>
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
            <group ref={netRef} position={[0.24, -0.44, -0.56]}>
              <RoundedBox args={[0.16, 0.1, 0.22]} radius={0.02} smoothness={2} position={[0, -0.01, -0.1]} material={M.wireBlue} userData={{ fx: true }} />
              <mesh geometry={g.netCable} material={M.wireBlue} position={[0, -0.01, -0.2]} userData={{ fx: true }} raycast={() => null} />
            </group>
            <group ref={powRef} position={[-0.16, -0.44, -0.5]}>
              <RoundedBox args={[0.2, 0.1, 0.11]} radius={0.03} smoothness={2} position={[-0.08, -0.004, 0]} material={M.chip} userData={{ fx: true }} />
              <mesh geometry={g.powCable} material={M.chip} position={[-0.16, -0.004, 0]} userData={{ fx: true }} raycast={() => null} />
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
          <VoiceWaves on={() => actionTime('audio') >= 0.4} position={[0, -0.44, -0.56]} rotation={[-0.5, 0, Math.PI]} />
          {audioPhase >= 0 && (
            <Html position={[0.5, -1.0, -1.3]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-2xl rounded-bl-none bg-white px-4 py-2 text-sm font-semibold text-[#1E398D] shadow-lg">
                Central Orsegups: Olá, está tudo bem?
              </div>
            </Html>
          )}
          <group ref={plug} position={[-0.2, -0.44, -0.5]} rotation={[0, Math.PI, 0]} visible={false}>
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
