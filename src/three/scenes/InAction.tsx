import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { IA_DURATION, IA_PHASES, PH } from '../../data/inAction'
import { ia, roomFx, useShowroom } from '../../store/showroomStore'
import { IA_STEPS } from '../../data/inAction'
import { Placed } from './Kit'
import { ModuloComando } from '../devices/ModuloComando'
import { Fotossensor } from '../devices/Fotossensor'
import { DOOR_TOP, HINGE_X, SensorMagnetico } from '../devices/SensorMagnetico'
import { Sirene } from '../devices/Sirene'
import { ControleRemoto } from '../devices/ControleRemoto'
import { RadioPulse } from '../fx/RadioPulse'
import { CameraFlash } from '../fx/CameraFlash'
import { DetectionFan } from '../fx/DetectionFan'
import { SoundWaves } from '../fx/SoundWaves'
import { bump, clamp01, reducedMotion, seg } from '../common/util'
import { aiPhotoDataUrl } from '../common/textures'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const T = () => ia.t
const smooth = (x: number) => x * x * (3 - 2 * x)
// a porta: o invasor abre (acelera, desacelera, balança no fim), entra e ela volta a se fechar atrás dele; na fuga ele
// abre de novo, com força, pouco antes de chegar nela, e sai deixando aberta
const doorOpen = () => {
  const t = T()
  const enter = smooth(seg(t, 3.2, 4.5)) + Math.sin(seg(t, 4.5, 5.3) * Math.PI) * 0.05
  const close = smooth(seg(t, 6.0, 7.2))
  // na fuga ele a empurra com força: abre de uma vez e desacelera no fim (sai do caminho antes de ele chegar)
  const f = clamp01((t - 10.9) / 0.35)
  const flee = 1 - (1 - f) ** 3 + Math.sin(seg(t, 11.25, 11.9) * Math.PI) * 0.08
  return t < 10.9 ? enter * (1 - close) : flee
}
const flashP = () => bump(T(), 7.6, 7.66, 7.74, 8.2)
// a sirene toca assim que o magnético detecta a porta abrindo (o módulo dispara na hora)
const SIREN = [4.05, 16.5] as const
const FLEE = 10 // o invasor desiste e foge
// a porta abre quase 90°: com menos, a folha fica no caminho e o invasor a atravessa ao entrar e ao fugir
const DOOR_SWING = 1.45
const sirenOn = () => T() >= SIREN[0] && T() < SIREN[1]
const MOD: [number, number, number] = [-2.7, 1.25, -2.2]
const MAG_S = 0.3
const DOOR_X = 1.2 // lado da fechadura
const HINGE = DOOR_X + 3.05 * MAG_S // dobradiça, à direita
// sensor no alto da folha: a dobradiça e o topo da folha do modelo coincidem com os desta porta
const MAG_POS: [number, number, number] = [HINGE - HINGE_X * MAG_S, 2.3 - DOOR_TOP * MAG_S, -2.93]

// Caminho do invasor: espera do lado de fora, abre a porta, entra em curva desacelerando até o meio da sala; no flash
// para e protege o rosto; olha em volta; quando a sirene toca, se assusta, vira e foge correndo pela porta.
const PATH_IN = new THREE.CatmullRomCurve3([[1.6, 0, -3.7], [1.6, 0, -2.95], [1.35, 0, -2.25], [0.85, 0, -1.6], [0.5, 0, -1.2]].map((p) => new THREE.Vector3(...p)))
const PATH_OUT = new THREE.CatmullRomCurve3([[0.5, 0, -1.2], [0.85, 0, -1.85], [1.45, 0, -2.55], [1.6, 0, -3.2], [1.6, 0, -5.2]].map((p) => new THREE.Vector3(...p)))
const IN = [4.4, 7.4] as const, OUT = [10.35, 12.3] as const
const LEN_IN = PATH_IN.getLength(), LEN_OUT = PATH_OUT.getLength()
// comprimento de um ciclo da passada (dois passos), andando e correndo: a perna acompanha a distância percorrida
const CYCLE_WALK = 1.1, CYCLE_RUN = 1.7
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)
const easeIn = (x: number) => x * x * (1.6 - 0.6 * x)
/** Onde o invasor está, para onde anda, a fase da passada e o quanto está correndo (0..1). */
function intruderAt(t: number, out: THREE.Vector3) {
  // o `seg` já suaviza; aqui a base é linear para a curva de velocidade não ser suavizada duas vezes
  if (t < OUT[0]) {
    const u = easeInOut(clamp01((t - IN[0]) / (IN[1] - IN[0])))
    PATH_IN.getPointAt(u, out)
    return { u, moving: t > IN[0] && t < IN[1], phase: (u * LEN_IN / CYCLE_WALK) * Math.PI * 2, run: 0 }
  }
  const u = easeIn(clamp01((t - OUT[0]) / (OUT[1] - OUT[0])))
  PATH_OUT.getPointAt(u, out)
  return { u, moving: t < OUT[1], phase: (u * LEN_OUT / CYCLE_RUN) * Math.PI * 2, run: 1 }
}
const _a = new THREE.Vector3(), _tan = new THREE.Vector3()
const yawOf = (curve: THREE.CatmullRomCurve3, u: number) => { curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)), _tan); return Math.atan2(_tan.x, _tan.z) }
const YAW_IN_END = yawOf(PATH_IN, 1), YAW_OUT = yawOf(PATH_OUT, 0)
/** Para onde o invasor está virado em cada instante (calculado direto do tempo: certo mesmo pulando na linha do tempo). */
function intruderYaw(t: number) {
  if (t < OUT[0]) return yawOf(PATH_IN, easeInOut(clamp01((t - IN[0]) / (IN[1] - IN[0]))))
  // o giro para fugir: rápido, logo depois do susto
  const k = smooth(seg(t, OUT[0], OUT[0] + 0.3))
  const d = Math.atan2(Math.sin(YAW_OUT - YAW_IN_END), Math.cos(YAW_OUT - YAW_IN_END))
  return t < OUT[0] + 0.3 ? YAW_IN_END + d * k : yawOf(PATH_OUT, easeIn(clamp01((t - OUT[0]) / (OUT[1] - OUT[0]))))
}
// para onde ele olha, parado no meio da sala: primeiro o fotossensor (logo depois do flash), depois a sirene
const STAND: [number, number, number] = [0.5, 0, -1.2]
const HEAD_Y = 1.6 // altura dos olhos
const lookAt = (x: number, y: number, z: number) => {
  const dx = x - STAND[0], dz = z - STAND[2]
  const yaw = Math.atan2(dx, dz) - YAW_IN_END
  return { yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), pitch: Math.atan2(y - HEAD_Y, Math.hypot(dx, dz)) }
}
const LOOK_FOTO = lookAt(-3.6, 2.35, -2.65), LOOK_SIRENE = lookAt(-1.2, 2.7, -2.88)

/** Ondas de rádio saindo de quem transmite (anéis que se abrem), enquanto `on` for verdadeiro. */
function Waves({ at, color, on }: { at: [number, number, number]; color: string; on: () => boolean }) {
  // discretas: dois anéis finos e curtos, só para marcar quem transmite (anéis grandes poluíam a sala)
  return <SoundWaves level={() => (on() ? 0.6 : 0)} color={color} count={2} maxRadius={0.22} speed={0.9} position={at} />
}

/**
 * O invasor: figura simples de roupa escura e capuz. Anda de verdade (pernas e braços alternados, corpo inclinado,
 * sobe e desce a cada passo), vira para onde anda, protege o rosto no flash, olha em volta e foge correndo.
 */
function Intruder() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b3040', roughness: 0.85, flatShading: true }), [])
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9a58c', roughness: 0.8, flatShading: true }), [])
  const legL = useRef<THREE.Group>(null!), legR = useRef<THREE.Group>(null!), armL = useRef<THREE.Group>(null!), armR = useRef<THREE.Group>(null!), body = useRef<THREE.Group>(null!), head = useRef<THREE.Group>(null!)
  const st = useRef({ lean: 0.04, shield: 0, look: 0, turn: 0, pitch: 0 })
  useFrame((_, dt) => {
    const t = T(), s = st.current, k = 1 - Math.exp(-10 * Math.min(dt, 0.1))
    const { moving, phase, run } = intruderAt(t, _a)
    // a passada some suave nas pontas do caminho (não para de uma vez) e abre mais correndo
    const ends = run ? clamp01((t - OUT[0]) / 0.25) : Math.min(clamp01((t - IN[0]) / 0.35), clamp01((IN[1] - t) / 0.45))
    const swing = moving ? Math.sin(phase) * ends : 0, amp = run ? 0.7 : 0.45
    legL.current.rotation.x = swing * amp; legR.current.rotation.x = -swing * amp
    // no flash, o braço direito sobe para tapar o rosto; depois desce devagar
    const shieldT = bump(t, 7.62, 7.8, 8.9, 9.5)
    s.shield += (shieldT - s.shield) * k
    // a mão na porta enquanto a empurra para entrar
    const push = bump(t, 3.25, 3.5, 4.1, 4.5)
    armL.current.rotation.x = -swing * amp * 0.8
    armR.current.rotation.x = (swing * amp * 0.8 * (1 - s.shield) - s.shield * 2.3) * (1 - push) - push * 1.35
    armR.current.rotation.z = s.shield * 0.5
    // sustos: a sirene começa (ainda atrás da porta) e a decisão de fugir (endireita de repente); antes de correr,
    // agacha um pouco para tomar impulso
    const startle = Math.max(bump(t, SIREN[0], SIREN[0] + 0.08, SIREN[0] + 0.2, SIREN[0] + 0.4) * 0.7, bump(t, FLEE, FLEE + 0.08, FLEE + 0.2, FLEE + 0.35))
    const crouch = bump(t, FLEE + 0.15, FLEE + 0.28, FLEE + 0.33, FLEE + 0.48)
    s.lean += ((moving ? (run ? 0.32 : 0.12) : 0.04) - startle * 0.2 + crouch * 0.25 - s.lean) * k
    body.current.rotation.x = s.lean
    // cabeça: olha em volta ao entrar; depois do flash, para o fotossensor e então para a sirene (o que vira além do
    // pescoço, o corpo acompanha)
    const wander = t > 5.2 && t < 7.2 ? Math.sin((t - 5.2) * 1.9) * 0.45 : 0
    const aF = bump(t, 8.95, 9.15, 9.45, 9.6), aS = bump(t, 9.45, 9.6, 9.85, 10.05)
    const wantYaw = wander + LOOK_FOTO.yaw * aF + LOOK_SIRENE.yaw * aS
    const wantPitch = LOOK_FOTO.pitch * aF + LOOK_SIRENE.pitch * aS
    s.look += (Math.max(-0.9, Math.min(0.9, wantYaw)) - s.look) * k
    s.turn += (wantYaw - Math.max(-0.9, Math.min(0.9, wantYaw)) - s.turn) * k
    s.pitch += (wantPitch - s.pitch) * k
    head.current.rotation.y = s.look
    head.current.rotation.x = -startle * 0.25 - s.pitch
    const g = body.current.parent!.parent as THREE.Group
    g.rotation.y = intruderYaw(t) + s.turn
    // passada: o corpo sobe e desce duas vezes por ciclo
    g.position.y = (moving ? Math.abs(Math.sin(phase)) * (run ? 0.05 : 0.025) * ends : 0) - crouch * 0.06
  })
  const fx = { userData: { fx: true } }
  return (
    <group>
      <group scale={1.8}>
        <group ref={legL} position={[-0.06, 0.44, 0]}><mesh material={mat} position={[0, -0.22, 0]} {...fx}><cylinderGeometry args={[0.05, 0.04, 0.44, 6]} /></mesh></group>
        <group ref={legR} position={[0.06, 0.44, 0]}><mesh material={mat} position={[0, -0.22, 0]} {...fx}><cylinderGeometry args={[0.05, 0.04, 0.44, 6]} /></mesh></group>
        <group ref={body} position={[0, 0.44, 0]}>
          <mesh material={mat} position={[0, 0.18, 0]} {...fx}><cylinderGeometry args={[0.13, 0.1, 0.36, 8]} /></mesh>
          {/* cabeça com capuz: o rosto fica na sombra */}
          <group ref={head} position={[0, 0.45, 0]} rotation-order="YXZ">
            <mesh material={skin} position={[0, 0, 0.012]} {...fx}><icosahedronGeometry args={[0.075, 1]} /></mesh>
            <mesh material={mat} position={[0, 0.02, -0.02]} {...fx}><sphereGeometry args={[0.1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62]} /></mesh>
          </group>
          <group ref={armL} position={[-0.17, 0.33, 0]}><mesh material={mat} position={[0, -0.17, 0]} {...fx}><cylinderGeometry args={[0.035, 0.03, 0.36, 6]} /></mesh></group>
          <group ref={armR} position={[0.17, 0.33, 0]}><mesh material={mat} position={[0, -0.17, 0]} {...fx}><cylinderGeometry args={[0.035, 0.03, 0.36, 6]} /></mesh></group>
        </group>
      </group>
    </group>
  )
}

type Bx = [number, number, number, number, number, number, number?] // centro, tamanho e giro em Y
const boxes = (items: Bx[]) => mergeGeometries(items.map(([x, y, z, w, h, d, ry = 0]) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(ry); g.translate(x, y, z); return g }))
const cyl = (x: number, y: number, z: number, r0: number, r1: number, h: number, seg = 16) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y, z); return g }

/**
 * Detalhes que fazem a sala parecer uma casa: cortina e peitoril na janela, abajur de chão e almofadas no sofá,
 * planta no canto, livros no aparador, quadro, tomadas, interruptor e moldura no alto das paredes. Cada material é uma
 * malha só (poucas chamadas de desenho); materiais padrão, sem textura (o mesmo programa de shader da sala).
 */
function Decor({ trim, wood, rug }: { trim: THREE.Material; wood: THREE.Material; rug: THREE.Material }) {
  const m = useMemo(() => {
    const mk = (color: string, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness })
    return { curtain: mk('#cfc6b5', 0.95), metal: mk('#2c2f36', 0.45), shade: mk('#ece4d2', 0.8), pot: mk('#a2603f', 0.85), leaf: mk('#3e6e48', 0.8), pillow: mk('#b8995e', 0.95), bookA: mk('#8a3b34', 0.8), bookB: mk('#2f4f6e', 0.8) }
  }, [])
  const g = useMemo(() => {
    // cortina: dois painéis com pregas (faixas alternadas para frente e para trás), dos lados da janela
    const folds: Bx[] = []
    for (const z0 of [0.18, 1.86]) for (let i = 0; i < 6; i++) folds.push([-3.9 + (i % 2) * 0.035, 1.62, z0 + i * 0.07, 0.03, 2.3, 0.075])
    const leaves = mergeGeometries([[0, 0.62, 0, 0.32], [0.12, 0.8, 0.05, 0.24], [-0.1, 0.86, -0.06, 0.22], [0.02, 1.02, 0.02, 0.2], [-0.04, 0.7, 0.13, 0.22]].map(([x, y, z, r]) => {
      const s = new THREE.IcosahedronGeometry(r, 1); s.scale(1, 0.75, 1); s.translate(x, y, z); return s
    }))
    leaves.translate(-3.62, 0, -2.6)
    return {
      curtain: boxes(folds),
      // varão da cortina, base e haste do abajur
      metal: mergeGeometries([(() => { const r = cyl(0, 0, 0, 0.018, 0.018, 2.3, 10); r.rotateX(Math.PI / 2); r.translate(-3.9, 2.82, 1.2); return r })(),
        cyl(2.3, 0.05, 0.3, 0.17, 0.19, 0.04, 24), cyl(2.3, 0.85, 0.3, 0.014, 0.014, 1.6, 8)]),
      shade: cyl(2.3, 1.72, 0.3, 0.17, 0.26, 0.32, 24),
      pot: cyl(-3.62, 0.2, -2.6, 0.2, 0.15, 0.4, 20),
      leaf: leaves,
      // almofadas nos cantos do sofá, um pouco tortas
      pillow: boxes([[-0.32, 0.82, 0.44, 0.42, 0.4, 0.13, 0.25], [1.52, 0.82, 0.44, 0.42, 0.4, 0.13, -0.3]]),
      // livros deitados na ponta do aparador
      bookA: boxes([[-3.2, 1.03, -2.3, 0.3, 0.05, 0.22, 0.1], [-3.2, 1.13, -2.3, 0.26, 0.05, 0.2, -0.05]]),
      bookB: boxes([[-3.2, 1.08, -2.3, 0.28, 0.05, 0.21, -0.15]]),
      // peitoril da janela, moldura no alto das paredes, interruptor ao lado da porta e tomadas
      trim: boxes([[-3.93, 1.14, 1.2, 0.12, 0.04, 1.8], [-1.45, 3.36, -2.985, 5.1, 0.08, 0.06], [3.06, 3.36, -2.985, 1.9, 0.08, 0.06], [-3.985, 3.36, 0, 0.06, 0.08, 6],
        [0.86, 1.1, -2.996, 0.08, 0.12, 0.012], [-1.0, 0.3, -2.996, 0.08, 0.08, 0.012], [-3.996, 0.3, -1.0, 0.012, 0.08, 0.08], [2.6, 0.3, -2.996, 0.08, 0.08, 0.012]]),
      // quadro na parede da esquerda: moldura e tela
      frame: boxes([[-3.985, 1.85, -1.1, 0.03, 0.7, 0.55]]),
      canvas: boxes([[-3.968, 1.85, -1.1, 0.004, 0.58, 0.43]]),
    }
  }, [])
  return (
    <group raycast={() => null}>
      <mesh geometry={g.curtain} material={m.curtain} />
      <mesh geometry={g.metal} material={m.metal} />
      <mesh geometry={g.shade} material={m.shade} />
      <mesh geometry={g.pot} material={m.pot} />
      <mesh geometry={g.leaf} material={m.leaf} />
      <mesh geometry={g.pillow} material={m.pillow} />
      <mesh geometry={g.bookA} material={m.bookA} />
      <mesh geometry={g.bookB} material={m.bookB} />
      <mesh geometry={g.trim} material={trim} />
      <mesh geometry={g.frame} material={wood} />
      <mesh geometry={g.canvas} material={rug} />
    </group>
  )
}

/** Em ação: corte de uma sala com os aparelhos instalados e a sequência de um disparo. */
export function InAction() {
  const mk = (color: string, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness })
  const wall = useMemo(() => mk('#aeb5c4', 0.95), [])
  const floor = useMemo(() => mk('#7a5d45', 0.7), [])
  const plank = useMemo(() => mk('#5f4735', 0.8), [])
  const trim = useMemo(() => mk('#e6e8ec', 0.6), [])
  const wood = useMemo(() => mk('#8a6b50', 0.75), [])
  const sofa = useMemo(() => mk('#4f5873', 0.95), [])
  const cushion = useMemo(() => mk('#7f88a3', 0.95), [])
  const rug = useMemo(() => mk('#39415a', 1), [])
  const glass = useMemo(() => mk('#1c2c4a', 0.25), [])
  const door = useRef<THREE.Group>(null!)
  const intruder = useRef<THREE.Group>(null!)
  const phase = useShowroom((s) => s.iaPhase)
  // no celular em pé, a notificação da imagem vai para o espaço vazio acima da sala, menor
  const tall = useThree((s) => s.size.width / s.size.height < 0.8)
  // a IA marca a pessoa logo depois do flash (a foto já foi analisada) e tira a marcação quando ele foge
  const boxOn = phase === PH.box

  useFrame((_, dt) => {
    const s = useShowroom.getState()
    if (s.iaPlaying) {
      ia.t = Math.min(IA_DURATION, ia.t + dt)
      if (ia.t >= IA_DURATION) s.set({ iaPlaying: false })
    }
    const t = ia.t
    // o passo só vai para o estado quando muda (5 vezes na cena inteira)
    let st = 0
    for (let i = 0; i < IA_STEPS.length; i++) if (t >= IA_STEPS[i].t) st = i
    if (st !== s.iaStep) s.set({ iaStep: st })
    let ph = 0
    for (const m of IA_PHASES) if (t >= m) ph++
    if (ph !== s.iaPhase) s.set({ iaPhase: ph })
    if (sirenOn() !== s.iaSiren) s.set({ iaSiren: sirenOn() })
    door.current.rotation.y = -doorOpen() * DOOR_SWING
    // aparece atrás da porta quando ela começa a abrir; some depois de sair pela porta
    intruder.current.visible = t > 3.3 && t < OUT[1]
    intruderAt(t, intruder.current.position)
    // luz da sala: noite; o flash clareia; a sirene pisca em vermelho no ritmo do LED dela
    roomFx.night = 1
    roomFx.flash = flashP()
    // a luz vermelha da sirene pulsa suave (sem pisca-pisca rápido, que incomoda e pode fazer mal) e cede no flash
    const red = reducedMotion() ? 0.7 : 0.6 + 0.3 * Math.sin((t - SIREN[0]) * Math.PI * 2 * 1.6)
    roomFx.red = sirenOn() ? red * seg(t, SIREN[0], SIREN[0] + 0.3) * (1 - flashP()) : 0
  })

  const hinge = HINGE
  return (
    <>
      {/* sala em corte: piso de madeira com as juntas das tábuas, paredes claras, rodapé, janela, porta com batente e maçaneta */}
      <group raycast={() => null}>
        <mesh material={floor} position={[0, 0.02, 0]}><boxGeometry args={[8, 0.04, 6]} /></mesh>
        {[-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4].map((z) => <mesh key={z} material={plank} position={[0, 0.041, z]}><boxGeometry args={[8, 0.002, 0.018]} /></mesh>)}
        <mesh material={wall} position={[-4.05, 1.7, 0]}><boxGeometry args={[0.1, 3.4, 6]} /></mesh>
        <mesh material={wall} position={[-1.45, 1.7, -3.05]}><boxGeometry args={[5.1, 3.4, 0.1]} /></mesh>
        <mesh material={wall} position={[3.06, 1.7, -3.05]}><boxGeometry args={[1.9, 3.4, 0.1]} /></mesh>
        <mesh material={wall} position={[1.6, 2.85, -3.05]}><boxGeometry args={[1.1, 1.1, 0.1]} /></mesh>
        {/* rodapés */}
        <mesh material={trim} position={[-1.45, 0.1, -2.985]}><boxGeometry args={[5.1, 0.12, 0.03]} /></mesh>
        <mesh material={trim} position={[3.06, 0.1, -2.985]}><boxGeometry args={[1.9, 0.12, 0.03]} /></mesh>
        <mesh material={trim} position={[-3.985, 0.1, 0]}><boxGeometry args={[0.03, 0.12, 6]} /></mesh>
        {/* batente da porta */}
        <mesh material={trim} position={[1.02, 1.17, -2.99]}><boxGeometry args={[0.08, 2.34, 0.14]} /></mesh>
        <mesh material={trim} position={[2.18, 1.17, -2.99]}><boxGeometry args={[0.08, 2.34, 0.14]} /></mesh>
        <mesh material={trim} position={[1.6, 2.34, -2.99]}><boxGeometry args={[1.24, 0.08, 0.14]} /></mesh>
        {/* janela na parede da esquerda, à noite */}
        <mesh material={trim} position={[-3.99, 1.75, 1.2]}><boxGeometry args={[0.04, 1.3, 1.7]} /></mesh>
        <mesh material={glass} position={[-3.965, 1.75, 1.2]}><boxGeometry args={[0.01, 1.14, 1.54]} /></mesh>
        <mesh material={trim} position={[-3.96, 1.75, 1.2]}><boxGeometry args={[0.012, 1.14, 0.04]} /></mesh>
        {/* quadro na parede do fundo */}
        <mesh material={wood} position={[-0.1, 1.75, -2.985]}><boxGeometry args={[0.9, 0.62, 0.03]} /></mesh>
        <mesh material={rug} position={[-0.1, 1.75, -2.968]}><boxGeometry args={[0.78, 0.5, 0.004]} /></mesh>
      </group>
      <group position={[hinge, 0, -3.02]}>
        <group ref={door}>
          <mesh material={wood} position={[-0.5, 1.15, 0]} raycast={() => null}><boxGeometry args={[1.0, 2.3, 0.06]} /></mesh>
          <mesh material={trim} position={[-0.5, 1.6, 0.031]} raycast={() => null}><boxGeometry args={[0.72, 0.9, 0.006]} /></mesh>
          <mesh material={trim} position={[-0.5, 0.55, 0.031]} raycast={() => null}><boxGeometry args={[0.72, 0.8, 0.006]} /></mesh>
          <mesh material={glass} position={[-0.9, 1.08, 0.06]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}><cylinderGeometry args={[0.016, 0.016, 0.14, 8]} /></mesh>
        </group>
      </group>
      <Decor trim={trim} wood={wood} rug={rug} />
      {/* móveis: aparador com pés (o módulo fica em cima), sofá com almofadas e tapete */}
      <group raycast={() => null}>
        <mesh material={wood} position={[-2.7, 0.56, -2.3]}><boxGeometry args={[1.3, 0.88, 0.7]} /></mesh>
        <mesh material={plank} position={[-2.7, 0.56, -1.948]}><boxGeometry args={[0.012, 0.8, 0.006]} /></mesh>
        {[[-3.28, -2.58], [-2.12, -2.58], [-3.28, -2.02], [-2.12, -2.02]].map(([x, z], i) => <mesh key={i} material={plank} position={[x, 0.08, z]}><boxGeometry args={[0.06, 0.12, 0.06]} /></mesh>)}
        <mesh material={rug} position={[0.5, 0.045, 1.2]}><boxGeometry args={[3.4, 0.012, 2.3]} /></mesh>
        <mesh material={sofa} position={[0.6, 0.36, 0.62]}><boxGeometry args={[2.2, 0.36, 0.9]} /></mesh>
        <mesh material={sofa} position={[0.6, 0.72, 0.22]}><boxGeometry args={[2.2, 0.62, 0.2]} /></mesh>
        <mesh material={sofa} position={[-0.58, 0.52, 0.62]}><boxGeometry args={[0.16, 0.62, 0.9]} /></mesh>
        <mesh material={sofa} position={[1.78, 0.52, 0.62]}><boxGeometry args={[0.16, 0.62, 0.9]} /></mesh>
        <mesh material={cushion} position={[0.05, 0.6, 0.72]}><boxGeometry args={[1.0, 0.14, 0.7]} /></mesh>
        <mesh material={cushion} position={[1.15, 0.6, 0.72]}><boxGeometry args={[1.0, 0.14, 0.7]} /></mesh>
        <mesh material={plank} position={[0.6, 0.12, 0.62]}><boxGeometry args={[2.0, 0.12, 0.7]} /></mesh>
      </group>

      {/* aparelhos instalados nas posições certas */}
      <Placed p={{ id: 'modulo', position: [MOD[0], 1.0, MOD[2]], scale: 0.42, rotation: [0, 0.6, 0] }}>
        <ModuloComando ledOverride={() => { const t = T(); return t < 1.6 ? 'desarmado' : t < 3.7 ? 'armado' : 'disparo' }} />
      </Placed>
      <group position={[-3.6, 2.35, -2.65]} rotation={[0.25, Math.PI / 4, 0]} scale={0.34}
        onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('fotossensor') }}>
        <Fotossensor flash={flashP} />
        <CameraFlash power={flashP} position={[0, 0.45, 0.5]} />
      </group>
      <group position={MAG_POS} scale={MAG_S} onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('magnetico') }}>
        <SensorMagnetico open={doorOpen} swing={DOOR_SWING} />
      </group>
      <group position={[-1.2, 2.7, -2.88]} scale={0.36} onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('sirene') }}>
        <Sirene sounding={sirenOn} waves={[3, 1.0]} />
      </group>
      <group position={[-2.6, 1.3, 2.3]} rotation={[-0.2, 0.3, 0]} scale={0.34} onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('controle') }}>
        <ControleRemoto pressed={() => { const t = T(); return t > 0.5 && t < 1.3 ? 'btn-armar' : null }} />
      </group>
      <Placed p={{ id: 'app', position: [3.0, 0.75, 2.4], scale: 0.62, rotation: [-0.15, -0.35, 0] }} />

      {/* leque de detecção do fotossensor no chão: aparece quando o invasor entra e fica vermelho quando ele é detectado */}
      <group position={[-3.6, 0.05, -2.65]} rotation={[0, Math.PI / 4, 0]}>
        <DetectionFan length={5.2} labels={false} alert={() => (T() > 7.0 && T() < 9.4 ? 1 : 0)} show={() => bump(T(), 5.4, 6.0, 9.0, 9.8)} />
      </group>
      {/* rádio, em ordem de causa e efeito: cada rajada sai de quem transmite e chega na hora em que o outro reage.
          controle → módulo (arma em 1,6 s); magnético → módulo (dispara em 3,7 s) → sirene (toca em 4,05 s) e
          celular ("Disparo do sensor" em 4,2 s); fotossensor → módulo (a foto); módulo → celular ("Imagem do disparo" em 13 s) */}
      <Waves at={[-2.6, 1.42, 2.36]} color="#5b8cff" on={() => { const t = T(); return t > 0.6 && t < 1.5 }} />
      <Waves at={[MAG_POS[0], 2.2, -2.86]} color="#ff5050" on={() => { const t = T(); return t > 3.25 && t < 4.0 }} />
      <Waves at={[-3.5, 2.5, -2.45]} color="#ffffff" on={() => { const t = T(); return t > 7.75 && t < 8.9 }} />
      <Waves at={[MOD[0] - 0.12, MOD[1] + 0.42, MOD[2] + 0.1]} color="#35d46a" on={() => { const t = T(); return (t > 3.65 && t < 4.3) || (t > 12.3 && t < 13.0) }} />
      <RadioPulse from={[-2.6, 1.7, 2.3]} to={MOD} time={T} bursts={[0.6, 0.95]} travel={0.5} />
      <RadioPulse from={[MAG_POS[0], 2.2, -2.9]} to={MOD} color="#ff5050" time={T} bursts={[3.3]} travel={0.4} />
      <RadioPulse from={MOD} to={[-1.2, 2.7, -2.8]} color="#ff5050" time={T} bursts={[3.7]} travel={0.35} />
      <RadioPulse from={MOD} to={[3.0, 1.9, 2.4]} color="#35d46a" time={T} bursts={[3.75, 12.4]} travel={0.45} />
      <RadioPulse from={[-3.5, 2.5, -2.5]} to={MOD} color="#ffffff" time={T} bursts={[7.8, 8.3]} travel={0.4} />

      <group ref={intruder} visible={false}>
        <Intruder />
        {boxOn && (
          <Html position={[0, 0.95, 0]} center style={{ pointerEvents: 'none' }}>
            <div className="fx-tag flex flex-col items-center">
              <div className="h-[150px] w-[70px] border-2 border-ok bg-ok/30" />
              <div className="mt-1 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">Pessoa (100% de previsão)</div>
            </div>
          </Html>
        )}
      </group>
      {/* a notificação que chega no celular, ampliada, com os nomes do app: primeiro o disparo (acima do celular), depois a
          imagem (ao lado dele, para não cobrir o celular quando a câmera se aproxima) */}
      {phase >= PH.alarm && (
        <Html position={phase >= PH.image ? (tall ? [2.2, 3.6, 2.4] : [1.6, 1.55, 2.4]) : [3.0, 2.75, 2.4]} center style={{ pointerEvents: 'none' }}>
          <div className={`fx-tag ${tall ? 'w-40' : 'w-52'} rounded-2xl bg-white/95 p-2 text-left shadow-xl`} lang="pt-BR">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="grid h-4 w-4 place-items-center rounded bg-[#1E398D] text-[8px] font-bold text-[#F9E000]">O</span>
              <span className="flex-1 font-semibold">Alarme 365</span><span>agora</span>
            </div>
            {phase >= PH.image ? (
              <>
                <div className="mt-1 text-[12px] font-bold text-slate-900">Imagem do disparo</div>
                <div className="text-[11px] text-slate-600">Sala de estar</div>
                <img src={aiPhotoDataUrl(true)} alt="" width={192} height={144} className="mt-1.5 rounded-lg" />
              </>
            ) : (
              <>
                <div className="mt-1 text-[12px] font-bold text-[#e03131]">Disparo do sensor</div>
                <div className="text-[11px] text-slate-600">Porta de entrada</div>
              </>
            )}
          </div>
        </Html>
      )}
    </>
  )
}
