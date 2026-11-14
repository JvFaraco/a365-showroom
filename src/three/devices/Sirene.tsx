import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { boxesGeometry, smoothLatheZ, stadiumGeometry, wire, type Block } from '../common/shapes'
import { DeviceCtx, bump, clamp01, explodeAmt, seg, useActionPhase, type DeviceProps } from '../common/util'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { SoundWaves } from '../fx/SoundWaves'
import { beep } from '../../ui/audio'

const TAMPER: [number, number] = [-0.5, 0.0] // micro-chave do anti-sabotagem (em coordenadas do miolo, antes do giro)
const LIFT = 1.9 // quanto a sirene sobe para sair do suporte
// 1 unidade = 64 mm. Medidas externas: 127,9 mm de diâmetro. A sirene em si é só a cúpula, de 36,4 mm de altura; o
// suporte de parede (um prato de 3 mm sobre três pés de 21 mm) a mantém afastada da parede: 59,9 mm no total.
const FACE_Z = 0.3 // face da frente
const WALL = FACE_Z - 59.9 / 64 // plano da parede: os pés do suporte chegam até aqui
const SEAM = FACE_Z - 36.4 / 64 // borda de trás da cúpula: assenta no prato do suporte
const PLATE_T = 3 / 64 // espessura do prato do suporte
const BACK = SEAM + 0.004 // face traseira da sirene, rente à borda da cúpula
const LED_Y = -40 / 64 // LED na face, a 40 mm do centro, embaixo (às 6 horas): fica voltado para o chão
// O miolo e a traseira são desenhados deitados (bateria na horizontal, em cima) e girados 90°: na sirene instalada,
// com o LED para baixo, a bateria fica em pé de um lado e o elemento sonoro do outro.
const CORE_ROT = Math.PI / 2
// por dentro da traseira (pelo CAD): a frente do disco de trás e a altura em que a placa se apoia (~16 mm à frente dele)
const MOLD_Z0 = BACK + 0.052, BOARD_Z0 = 0.3 - 20.3 / 64
const rot = ([x, y]: [number, number]): [number, number] => [-y, x] // do miolo para a sirene instalada
const SOUND: [number, number] = [0.2, -0.42] // centro do elemento sonoro (miolo)
const BATT_Y = 0.38 // eixo da bateria (miolo)
// encaixes: quatro rasgos quadrados na traseira, onde entram as travas do prato (posições na sirene instalada)
const LATCHES: [number, number][] = [[0.34, 0.81], [0.41, -0.63], [-0.2, -0.75], [-0.73, 0.42]]
// os três pés do suporte, a 120° um do outro: às 12, 4 e 8 horas, de frente
const FOOT_AT = [90, -30, 210].map((d) => (d * Math.PI) / 180)
const FOOT_IN = 0.72 // até onde a cunha de cada pé entra no prato

// Perfil externo da cúpula: [mm abaixo da face, raio em mm]. Sai de 50 mm na face e abre, em curva suave, até 64 mm.
const DOME: [number, number][] = [[0.5, 50.4], [1, 50.8], [2, 51.4], [4, 52.6], [6, 53.5], [8, 54.7], [10, 55.7], [13, 57.1], [16, 58.3], [20, 59.7], [24, 61.1], [28, 62.2], [32, 63.2], [35, 63.7], [36.4, 63.95]]

/** Cúpula: face plana, quina curta e a lateral do perfil, numa superfície só (revolução em torno de Z). */
function domeGeometry(N = 144) {
  const prof: [number, number][] = []
  const FR = 49.6 / 64
  for (let i = 0; i <= 6; i++) prof.push([Math.max(0.001, (FR * i) / 6), FACE_Z])
  prof.push([50.1 / 64, FACE_Z - 0.003])
  for (const [d, r] of DOME) prof.push([r / 64, FACE_Z - d / 64])
  prof.push([0.955, SEAM + 0.002]) // a borda dobra para dentro
  const NP = prof.length, pos: number[] = [], idx: number[] = []
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2
    for (const [r, z] of prof) pos.push(r * Math.cos(t), r * Math.sin(t), z)
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < NP - 1; j++) { const a = i * NP + j, b = a + NP; idx.push(a, a + 1, b, a + 1, b + 1, b) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
  const n = g.attributes.normal // fecha a emenda da volta
  for (let j = 0; j < NP; j++) {
    const a = j, b = N * NP + j
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize()
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z)
  }
  return g
}

/**
 * Prato do suporte: disco fechado do diâmetro da sirene, só com o furo redondo do elemento sonoro e, em cada pé, uma
 * cunha aberta por onde entra o parafuso. A calha da bateria é um rebaixo (fechado) para o lado da parede.
 */
function supportPlate() {
  const s = new THREE.Shape()
  s.absarc(0, 0, 0.998, 0, Math.PI * 2, false)
  const poly = (pts: [number, number][]) => { const p = new THREE.Path(); p.moveTo(...pts[0]); for (const q of pts.slice(1)) p.lineTo(...q); p.closePath(); return p }
  const hole = new THREE.Path()
  hole.absarc(...rot(SOUND), 0.36, 0, Math.PI * 2, true)
  s.holes.push(hole)
  for (const a of FOOT_AT) {
    const pts: [number, number][] = [[FOOT_IN * Math.cos(a), FOOT_IN * Math.sin(a)]]
    for (let i = 0; i <= 6; i++) { const t = a + ((i / 6) * 2 - 1) * 0.33; pts.push([0.95 * Math.cos(t), 0.95 * Math.sin(t)]) }
    s.holes.push(poly(pts))
  }
  return new THREE.ExtrudeGeometry(s, { depth: PLATE_T, bevelEnabled: false, curveSegments: 48 })
}

/**
 * Os três pés do suporte, numa malha só. Cada pé é uma cunha oca: a parede de fora, curva, acompanha o contorno da
 * sirene (mais larga junto ao prato, mais estreita na parede); duas paredes fecham os lados até a ponta da cunha, e o
 * fundo, encostado na parede, leva o parafuso.
 */
function supportFeet() {
  const pos: number[] = [], idx: number[] = []
  const zB = WALL, zT = SEAM - PLATE_T, NS = 8
  const R = (h: number) => (62.8 + h) / 64, half = (h: number) => ((14 + 8 * h) * Math.PI) / 180
  const v = (r: number, t: number, z: number) => { pos.push(r * Math.cos(t), r * Math.sin(t), z); return pos.length / 3 - 1 }
  for (const a of FOOT_AT) {
    // parede de fora
    const o: number[] = []
    for (let i = 0; i <= NS; i++) { const k = (i / NS) * 2 - 1; o.push(v(R(0), a + k * half(0), zB), v(R(1), a + k * half(1), zT)) }
    for (let i = 0; i < NS; i++) { const q = i * 2; idx.push(o[q], o[q + 2], o[q + 1], o[q + 1], o[q + 2], o[q + 3]) }
    // paredes dos lados, da borda até a ponta da cunha
    for (const k of [-1, 1]) {
      const e0 = v(R(0), a + k * half(0), zB), e1 = v(R(1), a + k * half(1), zT), a0 = v(FOOT_IN, a, zB), a1 = v(FOOT_IN, a, zT)
      idx.push(e0, a0, e1, e1, a0, a1)
    }
    // fundo
    const c = v(FOOT_IN, a, zB + 0.02)
    const f: number[] = []
    for (let i = 0; i <= NS; i++) f.push(v(R(0), a + ((i / NS) * 2 - 1) * half(0), zB + 0.02))
    for (let i = 0; i < NS; i++) idx.push(c, f[i], f[i + 1])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
  return g
}

/**
 * Sirene: uma cúpula baixa (face plana em +Z) sobre o suporte de parede, que é um prato do mesmo diâmetro apoiado em
 * três pés. A traseira tem o berço da bateria, o elemento sonoro e o tamper; por dentro fica a placa. A sirene NÃO
 * gira para encaixar: desce de cima para baixo no suporte e trava com um clique; para tirar, sobe e sai.
 */
export function Sirene({ interactive = false, sounding, waves = [5, 1.9] }: DeviceProps & { sounding?: () => boolean; waves?: [number, number] }) {
  const body = useRef<THREE.Group>(null!)
  const shell = useRef<THREE.Group>(null!)
  const batt = useRef<THREE.Group>(null!)
  const plugRef = useRef<THREE.Group>(null!)
  const lever = useRef<THREE.Group>(null!)
  // cúpula: face plana, quina e lateral numa peça só
  const dome = useMemo(() => domeGeometry(), [])
  const plate = useMemo(supportPlate, [])
  const feet = useMemo(supportFeet, [])
  const slit = useMemo(() => stadiumGeometry(0.13, 0.048, 0.004, 0.002), []) // janela do LED na face: ~9 × 3,5 mm
  const lens = useMemo(() => { const m = M.crystal.clone(); m.opacity = 0.2; return m }, []) // lente fina: deixa a cor do LED passar
  // tampa do tamper: disco em degraus (anéis concêntricos) com o miolo abaulado, virado para trás
  const tamperCap = useMemo(() => smoothLatheZ([[0.31, 0.0], [0.305, -0.03], [0.28, -0.04], [0.225, -0.042], [0.21, -0.07], [0.13, -0.075], [0.1, -0.1], [0.04, -0.115], [0.001, -0.118]], 64, 48), [])
  const piezo = useMemo(() => smoothLatheZ([[0.04, 0.06], [0.2, 0.06], [0.225, 0.05], [0.23, 0.03], [0.23, -0.04], [0.22, -0.05], [0.001, -0.05]], 48, 24), [])
  const board = useMemo(() => {
    const sh = new THREE.Shape()
    // cunha: lado reto rente à meia-cana da bateria, lado reto ao lado do elemento sonoro e o lado inclinado seguindo a borda
    sh.moveTo(-0.12, 0.18); sh.lineTo(-0.86, 0.18); sh.lineTo(-0.86, -0.07); sh.lineTo(-0.45, -0.55); sh.lineTo(-0.12, -0.55); sh.closePath()
    return new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false })
  }, [])
  // componentes pequenos da placa, agrupados em volta dos CIs, como na placa real (sem texto): uma malha por cor
  const smd = useMemo(() => {
    const z = -0.176, t = (x: number, y: number, w = 0.04, h = 0.022): Block => [x, y, z, w, h, 0.012]
    return {
      tan: boxesGeometry([t(-0.57, -0.12), t(-0.57, -0.06), t(-0.45, -0.24, 0.022, 0.04), t(-0.39, -0.24, 0.022, 0.04), t(-0.34, -0.18), t(-0.52, 0.13), t(-0.52, 0.07), t(-0.33, 0.14, 0.022, 0.04), t(-0.33, 0.07, 0.022, 0.04), t(-0.27, -0.26)]),
      black: boxesGeometry([[-0.42, 0.09, z, 0.09, 0.09, 0.014], t(-0.29, 0.0), t(-0.29, -0.05), t(-0.29, -0.1), t(-0.6, 0.05, 0.022, 0.04)]),
      metal: boxesGeometry([[-0.61, 0.15, z, 0.07, 0.04, 0.016]]),
      white: boxesGeometry([[-0.27, -0.37, -0.168, 0.12, 0.06, 0.028]]), // conector branco dos dois fios do elemento sonoro
    }
  }, [])
  const antenna = useMemo(() => wire([[-0.7, 0.17, -0.175], [-0.74, 0.3, -0.1], [-0.66, 0.56, -0.02], [-0.5, 0.74, -0.02], [-0.2, 0.8, -0.02], [0.2, 0.78, -0.03]], 0.01), []) // passa por cima da meia-cana da bateria
  const piezoWireA = useMemo(() => wire([[0.0, -0.44, -0.185], [-0.1, -0.5, -0.165], [-0.22, -0.47, -0.16], [-0.3, -0.4, -0.165]], 0.009), [])
  const piezoWireB = useMemo(() => wire([[0.02, -0.4, -0.185], [-0.08, -0.45, -0.165], [-0.18, -0.43, -0.16], [-0.24, -0.38, -0.165]], 0.009), [])
  const whiteDS = useMemo(() => { const m = M.white.clone(); m.side = THREE.DoubleSide; return m }, [])
  const ringMat = useMemo(() => fxBasic('#8fb4ff', 0), [])
  const sparkMat = useMemo(() => fxBasic('#fff3b0', 0), [])
  const clicPhase = useActionPhase('encaixe', [2.6])
  // clique curto quando a sirene assenta no suporte (o beep respeita o botão de som)
  useEffect(() => { if (clicPhase === 0) beep('click') }, [clicPhase])

  const isOn = () => (sounding ? sounding() : interactive && useShowroom.getState().sirenOn)
  const sampleLed = (t: number, o: { color: string; on: number }) => { const on = isOn(); o.color = on ? '#ff2a2a' : '#2f6dff'; o.on = on ? (t % 0.3 < 0.15 ? 1 : 0) : 1 } // aceso em cheio, como o do módulo (meio aceso vira só um fundo azul)
  const level = () => (isOn() ? (interactive ? useShowroom.getState().sirenLevel : 2) : 0)

  useFrame(({ clock }) => {
    const lv = level()
    shell.current.position.x = lv ? Math.sin(clock.elapsedTime * 90) * 0.004 * lv : 0
    if (!interactive) return
    // encaixar: a sirene sobe para fora do suporte e desce de volta, só na vertical, sem girar
    const te = actionTime('encaixe')
    // retirar da parede: sobe e sai; o "Recolocar" volta pelo mesmo caminho
    const tr = actionTau('tamper')
    // bateria: retira (sobe), vira de costas (180°), o conector solta e a bateria sai do berço
    const tb = actionTau('bateria-sirene')
    const tq = tr >= 0 ? tr : tb
    const ease = (x: number) => x * x * (3 - 2 * x)
    let away = 0, settle = 0
    if (te >= 0) { away = ease(bump(te, 0.2, 1.0, 1.5, 2.6)); settle = bump(te, 2.6, 2.68, 2.7, 2.9) }
    else if (tq >= 0) { away = ease(seg(tq, 0, 1.1)); settle = tr >= 0 && tr < 0.2 ? bump(tr, 0, 0.06, 0.08, 0.2) * 0.6 : 0 }
    const flip = tb < 0 ? 0 : seg(tb, 1.2, 2.0)
    // sai um pouco do prato (a bateria e o encaixe entram nas aberturas dele) e sobe; no fim da descida, um pequeno assentamento
    body.current.position.set(0, away * LIFT - settle * 0.03, Math.min(1, away * 6) * 0.17)
    body.current.rotation.set(0, flip * Math.PI, 0)
    ringMat.opacity = te < 0 ? 0 : bump(te, 2.6, 2.7, 2.9, 3.7)
    plugRef.current.position.z = -(tb < 0 ? 0 : seg(tb, 2.2, 2.8)) * 0.14
    sparkMat.opacity = tb < 0 ? 0 : bump(tb, 2.3, 2.4, 2.45, 2.7)
    const out = tb < 0 ? 0 : seg(tb, 3.0, 3.8)
    batt.current.position.set(0, out * 0.1, -out * 0.55)
    // tamper: pressionado pelo suporte; solta quando a sirene se desprende dele
    const free = clamp01(Math.max(away * 5, explodeAmt.v * 4))
    // o botão da micro-chave: apertado pelo suporte; solto, sobe ~1 mm
    lever.current.position.z = -free * 0.016
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'sirene', interactive }}>
      <group ref={body}>
        <ClickablePart id="corpo">
          <group ref={shell}>
            <mesh geometry={dome} material={M.white} castShadow />
            {/* o mesmo símbolo do módulo em sulcos finos, no centro da face */}
            <LogoGroove r={0.26} position={[0, 0.02, FACE_Z + 0.004]} />
          </group>
        </ClickablePart>
        {/* LED: janela pequena na face, perto da borda, centralizada embaixo. Moldura escura, luz forte (azul; vermelho
            piscando ao tocar) e, por cima, a lente de cristal fina */}
        <ClickablePart id="led">
          <group position={[0, LED_Y, FACE_Z]}>
            <mesh geometry={slit} material={M.hole} position={[0, 0, -0.0035]} scale={[1.16, 1.4, 1]} />
            {/* o LED em si: ponto pequeno e forte no meio da janela (como o do módulo); a janela fica escura */}
            <Led on="shell" sample={sampleLed} boost={12} spread={1.8} baseColor="#14161b" position={[0, 0, 0.0008]}><circleGeometry args={[0.026, 24]} /></Led>
            <mesh geometry={slit} material={lens} position={[0, 0, 0.0012]} scale={[1, 1, 0.5]} />
          </group>
        </ClickablePart>

        <group rotation={[0, 0, CORE_ROT]}>
        {/* traseira: fecha a sirene por trás; tem o berço da bateria e os quatro rasgos quadrados do encaixe */}
        <ClickablePart follow="corpo" explode={[0, 0, -0.5]}>
          <mesh material={M.white} position={[0, 0, BACK + 0.027]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.95, 0.95, 0.05, 64]} /></mesh>
          <mesh material={M.grey} position={[0.02, BATT_Y, BACK]}><boxGeometry args={[1.05, 0.5, 0.006]} /></mesh>
          {LATCHES.map(([x, y], i) => (
            <mesh key={i} material={M.hole} position={[y, -x, BACK]}><boxGeometry args={[0.11, 0.11, 0.006]} /></mesh>
          ))}
          {/* etiqueta lisa, sem texto */}
          <mesh material={M.whiteRelief} position={[0.7, 0.42, BACK - 0.001]}><boxGeometry args={[0.13, 0.32, 0.004]} /></mesh>
          {/* por dentro, pelo CAD: a meia-cana que cobre a bateria pela frente (a bateria entra por trás) */}
          <mesh material={whiteDS} position={[0.0, BATT_Y, BACK + 0.13]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.265, 0.265, 1.1, 28, 1, true, -Math.PI / 2, Math.PI]} /></mesh>
          {[-1, 1].map((k) => <mesh key={k} material={M.white} position={[0, BATT_Y + k * 0.265, (MOLD_Z0 + BACK + 0.13) / 2]}><boxGeometry args={[1.1, 0.02, BACK + 0.13 - MOLD_Z0]} /></mesh>)}
          {/* a moldura da janela do tamper sobe até a placa: é nela que a placa se apoia */}
          {([[-0.43, -0.28, 0.46, 0.023], [-0.43, 0.11, 0.46, 0.023], [-0.65, -0.085, 0.023, 0.39], [-0.21, -0.085, 0.023, 0.39]] as const).map(([x, y, w, h], i) => (
            <mesh key={i} material={M.white} position={[x, y, (MOLD_Z0 + BOARD_Z0) / 2]}><boxGeometry args={[w, h, BOARD_Z0 - MOLD_Z0]} /></mesh>
          ))}
          {/* as duas abas que prendem a borda da placa: uma do lado, outra embaixo (perto do LED) */}
          {([[-0.885, 0.02, 0.025, 0.1, 0.03, 0], [-0.36, -0.655, 0.1, 0.025, 0, 0.03]] as const).map(([x, y, w, h, lx, ly], i) => (
            <group key={i}>
              <mesh material={M.white} position={[x, y, (MOLD_Z0 + BOARD_Z0 + 0.03) / 2]}><boxGeometry args={[w, h, BOARD_Z0 + 0.03 - MOLD_Z0]} /></mesh>
              <mesh material={M.white} position={[x + lx, y + ly, BOARD_Z0 + 0.026]}><boxGeometry args={[w + 2 * lx, h + 2 * ly, 0.012]} /></mesh>
            </group>
          ))}
        </ClickablePart>

        {/* encaixe moldado na traseira, atrás do elemento sonoro: disco levemente elevado, um anel e arcos em volta. É
            plástico fixo, que entra no furo redondo do prato e centraliza a sirene no suporte (NÃO é o tamper) */}
        <ClickablePart id="encaixe-suporte">
          <group position={[SOUND[0], SOUND[1], 0]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} material={M.white} position={[0, 0, BACK - 0.004]} rotation={[0, 0, i * 2.1 + 0.3]}><torusGeometry args={[0.335, 0.014, 8, 24, 1.7]} /></mesh>
            ))}
            <mesh geometry={tamperCap} material={M.white} position={[0, 0, BACK]} scale={[1, 1, 0.6]} />
          </group>
        </ClickablePart>
        {/* anti-sabotagem (tamper): micro-chave preta (~6 × 6 mm, com o botão no meio) numa plaquinha verde (~15 × 20 mm),
            na traseira, ao lado do conector branco da bateria; aparece por um recorte retangular. O suporte de parede
            tem o prato, que mantém o botão apertado; fora do suporte, o botão sobe ~1 mm */}
        <ClickablePart id="tamper">
          <mesh material={M.hole} position={[TAMPER[0], TAMPER[1] + 0.05, BACK - 0.001]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.3, 0.46]} /></mesh>
          <mesh material={M.pcb} position={[TAMPER[0], TAMPER[1] + 0.04, BACK - 0.008]}><boxGeometry args={[15 / 64, 20 / 64, 0.014]} /></mesh>
          <mesh material={M.chip} position={[TAMPER[0], TAMPER[1], BACK - 0.03]}><boxGeometry args={[6 / 64, 6 / 64, 0.035]} /></mesh>
          <group ref={lever}>
            <mesh material={M.greyDark} position={[TAMPER[0], TAMPER[1], BACK - 0.052]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.016, 12]} /></mesh>
          </group>
          {/* conector branco da bateria, no topo da plaquinha, com os fios vermelho e preto */}
          <group ref={plugRef}>
            <mesh material={M.white} position={[TAMPER[0], TAMPER[1] + 0.15, BACK - 0.03]}><boxGeometry args={[0.09, 0.06, 0.04]} /></mesh>
            <mesh material={M.red} position={[TAMPER[0] - 0.02, TAMPER[1] + 0.23, BACK - 0.035]}><cylinderGeometry args={[0.01, 0.01, 0.1, 6]} /></mesh>
            <mesh material={M.black} position={[TAMPER[0] + 0.02, TAMPER[1] + 0.23, BACK - 0.035]}><cylinderGeometry args={[0.01, 0.01, 0.1, 6]} /></mesh>
          </group>
        </ClickablePart>

        {/* por dentro: o elemento sonoro é uma pastilha branca redonda com um furo no centro */}
        <ClickablePart id="elemento-sonoro">
          <group position={[SOUND[0], SOUND[1], 0]} scale={[1.3, 1.3, 1]}>
            <mesh geometry={piezo} material={M.white} position={[0, 0, -0.06]} />
            <mesh material={M.hole} position={[0, 0, 0.0005]}><circleGeometry args={[0.04, 20]} /></mesh>
          </group>
        </ClickablePart>
        <ClickablePart id="bateria">
          <group ref={batt}>
            <group position={[0.02, BATT_Y, BACK + 0.13]} rotation={[0, 0, Math.PI / 2]}>
              <mesh material={M.black}><cylinderGeometry args={[0.24, 0.24, 0.95, 28]} /></mesh>
              <mesh material={M.orange} position={[0, 0.04, 0]}><cylinderGeometry args={[0.243, 0.243, 0.55, 28, 1, true, 2.2, 1.1]} /></mesh>
            </group>
          </group>
        </ClickablePart>
        <ClickablePart id="placa">
          {/* a placa inteira fica por dentro: contorno em cunha, chips, antena de fio preto e os dois fios brancos do elemento sonoro */}
          <group position={[0, -0.08, BOARD_Z0 + 0.2]}>
            <mesh geometry={board} material={M.pcb} position={[0, 0, -0.2]} />
            {/* o LED de verdade fica na placa, atrás da janela da face; com a sirene explodida, é ele que acende */}
            <Led on="board" sample={sampleLed} boost={4} position={[LED_Y, 0.08, -0.16]}><boxGeometry args={[0.05, 0.035, 0.02]} /></Led>
            <mesh material={M.chip} position={[-0.45, -0.12, -0.165]}><boxGeometry args={[0.14, 0.14, 0.02]} /></mesh>
            {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} material={M.gold} position={[-0.16, 0.0 - i * 0.045, -0.172]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.006, 8]} /></mesh>)}
            <mesh geometry={smd.tan} material={M.smdTan} />
            <mesh geometry={smd.black} material={M.chip} />
            <mesh geometry={smd.metal} material={M.metal} />
            <mesh geometry={smd.white} material={M.white} />
            <mesh geometry={antenna} material={M.chip} />
            <mesh geometry={piezoWireA} material={M.white} />
            <mesh geometry={piezoWireB} material={M.white} />
          </group>
        </ClickablePart>
        <mesh material={sparkMat} position={[TAMPER[0], TAMPER[1] + 0.15, BACK - 0.12]} userData={{ fx: true }} raycast={() => null}><sphereGeometry args={[0.05, 12, 8]} /></mesh>
        </group>

        <SoundWaves level={level} position={[0, 0, 0.36]} count={waves[0]} maxRadius={waves[1]} />
        <mesh material={ringMat} position={[0, 0, SEAM]} userData={{ fx: true }} raycast={() => null}><torusGeometry args={[1.02, 0.022, 8, 96]} /></mesh>
      </group>

      {/* suporte de parede: prato do diâmetro da sirene sobre três pés parafusados na parede. O prato tem o furo redondo
          do elemento sonoro, a calha da bateria e as quatro travas do encaixe; o prato fechado aperta o botão do tamper */}
      <ClickablePart id="suporte">
        <mesh geometry={plate} material={M.white} position={[0, 0, SEAM - PLATE_T]} castShadow />
        <mesh geometry={feet} material={whiteDS} castShadow />
        {/* calha da bateria: meia-cana para o lado da parede */}
        <mesh material={whiteDS} position={[-(BATT_Y - 0.015), -0.01, SEAM - 0.03]} scale={[1, 1, 0.55]}><cylinderGeometry args={[0.215, 0.215, 1.22, 20, 1, false, Math.PI / 2, Math.PI]} /></mesh>
        {/* parafusos, no fundo de cada pé */}
        {FOOT_AT.map((a) => (
          <mesh key={a} material={M.metal} position={[0.87 * Math.cos(a), 0.87 * Math.sin(a), WALL + 0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 0.02, 12]} /></mesh>
        ))}
        {/* travas do encaixe */}
        {LATCHES.map(([x, y], i) => (
          <mesh key={i} material={M.whiteRelief} position={[x, y, SEAM + 0.015]}><boxGeometry args={[0.08, 0.09, 0.04]} /></mesh>
        ))}
      </ClickablePart>

      {interactive && clicPhase >= 0 && (
        <Html position={[0, 1.3, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="fx-tag rounded-full bg-ok px-4 py-1.5 text-sm font-bold text-[#05210c]">Clic! Travada no suporte</div>
        </Html>
      )}
    </DeviceCtx.Provider>
  )
}
