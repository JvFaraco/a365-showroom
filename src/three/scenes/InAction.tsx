import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { IA_DURATION } from '../../data/inAction'
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
import { bump, seg } from '../common/util'
import { aiPhotoDataUrl } from '../common/textures'

const T = () => ia.t
const smooth = (x: number) => x * x * (3 - 2 * x)
// a porta abre empurrada pelo invasor: acelera, desacelera e balança um pouco no fim (fica aberta)
const doorOpen = () => { const t = T(), k = smooth(seg(t, 3.2, 4.5)); return k + Math.sin(seg(t, 4.5, 5.3) * Math.PI) * 0.05 }
const flashP = () => bump(T(), 7.6, 7.66, 7.74, 8.2)
const SIREN = [10, 16.5] as const
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
const PATH_OUT = new THREE.CatmullRomCurve3([[0.5, 0, -1.2], [0.85, 0, -1.85], [1.45, 0, -2.55], [1.6, 0, -3.2], [1.6, 0, -4.3]].map((p) => new THREE.Vector3(...p)))
const IN = [4.4, 7.4] as const, OUT = [10.35, 12.1] as const
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)
const easeIn = (x: number) => x * x * (1.6 - 0.6 * x)
/** Onde o invasor está, para onde anda, a fase da passada e o quanto está correndo (0..1). */
function intruderAt(t: number, out: THREE.Vector3) {
  if (t < OUT[0]) {
    const u = easeInOut(seg(t, IN[0], IN[1]))
    PATH_IN.getPointAt(u, out)
    return { u, moving: t > IN[0] && t < IN[1], phase: u * 26, run: 0 }
  }
  const u = easeIn(seg(t, OUT[0], OUT[1]))
  PATH_OUT.getPointAt(u, out)
  return { u, moving: t < OUT[1], phase: u * 30, run: 1 }
}
const _a = new THREE.Vector3(), _tan = new THREE.Vector3()
const yawOf = (curve: THREE.CatmullRomCurve3, u: number) => { curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)), _tan); return Math.atan2(_tan.x, _tan.z) }
const YAW_IN_END = yawOf(PATH_IN, 1), YAW_OUT = yawOf(PATH_OUT, 0)
/** Para onde o invasor está virado em cada instante (calculado direto do tempo: certo mesmo pulando na linha do tempo). */
function intruderYaw(t: number) {
  if (t < OUT[0]) return yawOf(PATH_IN, easeInOut(seg(t, IN[0], IN[1])))
  // o giro para fugir: rápido, logo depois do susto
  const k = smooth(seg(t, OUT[0], OUT[0] + 0.3))
  const d = Math.atan2(Math.sin(YAW_OUT - YAW_IN_END), Math.cos(YAW_OUT - YAW_IN_END))
  return t < OUT[0] + 0.3 ? YAW_IN_END + d * k : yawOf(PATH_OUT, easeIn(seg(t, OUT[0], OUT[1])))
}

/** Ondas de rádio saindo de quem transmite (anéis que se abrem), enquanto `on` for verdadeiro. */
function Waves({ at, color, on }: { at: [number, number, number]; color: string; on: () => boolean }) {
  return <SoundWaves level={() => (on() ? 1.4 : 0)} color={color} count={3} maxRadius={0.55} speed={0.9} position={at} />
}

/**
 * O invasor: figura simples de roupa escura e capuz. Anda de verdade (pernas e braços alternados, corpo inclinado,
 * sobe e desce a cada passo), vira para onde anda, protege o rosto no flash, olha em volta e foge correndo.
 */
function Intruder() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b3040', roughness: 0.85, flatShading: true }), [])
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9a58c', roughness: 0.8, flatShading: true }), [])
  const legL = useRef<THREE.Group>(null!), legR = useRef<THREE.Group>(null!), armL = useRef<THREE.Group>(null!), armR = useRef<THREE.Group>(null!), body = useRef<THREE.Group>(null!), head = useRef<THREE.Group>(null!)
  const st = useRef({ lean: 0.04, shield: 0, look: 0 })
  useFrame((_, dt) => {
    const t = T(), s = st.current, k = 1 - Math.exp(-10 * Math.min(dt, 0.1))
    const { moving, phase, run } = intruderAt(t, _a)
    const swing = moving ? Math.sin(phase) : 0, amp = run ? 0.85 : 0.55
    legL.current.rotation.x = swing * amp; legR.current.rotation.x = -swing * amp
    // no flash, o braço direito sobe para tapar o rosto; depois desce devagar
    const shieldT = bump(t, 7.62, 7.8, 8.9, 9.5)
    s.shield += (shieldT - s.shield) * k
    armL.current.rotation.x = -swing * amp * 0.8
    armR.current.rotation.x = swing * amp * 0.8 * (1 - s.shield) - s.shield * 2.3
    armR.current.rotation.z = s.shield * 0.5
    // corpo: inclina mais correndo; susto quando a sirene começa (endireita de repente)
    const startle = bump(t, SIREN[0], SIREN[0] + 0.08, SIREN[0] + 0.2, SIREN[0] + 0.35)
    s.lean += ((moving ? (run ? 0.32 : 0.12) : 0.04) - startle * 0.2 - s.lean) * k
    body.current.rotation.x = s.lean
    // cabeça: olha para o fotossensor no flash e para os lados enquanto está parado
    const lookAround = t > 8.9 && t < SIREN[0] ? Math.sin((t - 8.9) * 2.6) * 0.7 : 0
    s.look += (lookAround - s.look) * k
    head.current.rotation.y = s.look
    head.current.rotation.x = -startle * 0.25
    const g = body.current.parent!.parent as THREE.Group
    g.rotation.y = intruderYaw(t)
    // passada: o corpo sobe e desce duas vezes por ciclo
    g.position.y = moving ? Math.abs(Math.sin(phase)) * (run ? 0.05 : 0.025) : 0
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
          <group ref={head} position={[0, 0.45, 0]}>
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
  const step = useShowroom((s) => s.iaStep)
  const boxOn = step === 2

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
    door.current.rotation.y = -doorOpen() * 0.6
    // aparece atrás da porta quando ela começa a abrir; some depois de sair pela porta
    intruder.current.visible = t > 3.3 && t < OUT[1]
    intruderAt(t, intruder.current.position)
    // luz da sala: noite; o flash clareia; a sirene pisca em vermelho no ritmo do LED dela
    roomFx.night = 1
    roomFx.flash = flashP()
    roomFx.red = sirenOn() ? (t % 0.3 < 0.15 ? 1 : 0.25) : 0
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
        <ModuloComando ledOverride={() => { const t = T(); return t < 1.6 ? 'desarmado' : t < 3.6 ? 'armado' : 'disparo' }} />
      </Placed>
      <group position={[-3.6, 2.35, -2.65]} rotation={[0.25, Math.PI / 4, 0]} scale={0.34}
        onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('fotossensor') }}>
        <Fotossensor flash={flashP} />
        <CameraFlash power={flashP} position={[0, 0.45, 0.5]} />
      </group>
      <group position={MAG_POS} scale={MAG_S} onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('magnetico') }}>
        <SensorMagnetico open={doorOpen} />
      </group>
      <group position={[-1.2, 2.7, -2.88]} scale={0.36} onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('sirene') }}>
        <Sirene sounding={sirenOn} />
      </group>
      <group position={[-2.6, 1.3, 2.3]} rotation={[-0.2, 0.3, 0]} scale={0.34} onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('controle') }}>
        <ControleRemoto pressed={() => { const t = T(); return t > 0.5 && t < 1.3 ? 'btn-armar' : null }} />
      </group>
      <Placed p={{ id: 'app', position: [3.0, 0.75, 2.4], scale: 0.62, rotation: [-0.15, -0.35, 0] }} />

      {/* leque de detecção do fotossensor no chão: aparece quando o invasor entra e fica vermelho quando ele é detectado */}
      <group position={[-3.6, 0.05, -2.65]} rotation={[0, Math.PI / 4, 0]}>
        <DetectionFan length={5.2} labels={false} alert={() => (T() > 7.0 && T() < 9.4 ? 1 : 0)} show={() => bump(T(), 5.4, 6.0, 9.0, 9.8)} />
      </group>
      {/* ondas de rádio saindo de quem transmite, em cada etapa: controle, sensor da porta, fotossensor, módulo e celular */}
      <Waves at={[-2.6, 1.42, 2.36]} color="#5b8cff" on={() => { const t = T(); return t > 0.6 && t < 2.4 }} />
      <Waves at={[MAG_POS[0], 2.2, -2.86]} color="#ff5050" on={() => { const t = T(); return t > 3.5 && t < 5.6 }} />
      <Waves at={[-3.5, 2.5, -2.45]} color="#ffffff" on={() => { const t = T(); return t > 7.8 && t < 9.4 }} />
      <Waves at={[MOD[0] - 0.12, MOD[1] + 0.42, MOD[2] + 0.1]} color="#35d46a" on={() => { const t = T(); return (t > 9.6 && t < 10.8) || (t > 12.4 && t < 14.4) }} />
      <Waves at={[3.0, 1.55, 2.5]} color="#35d46a" on={() => { const t = T(); return t > 13.4 && t < 15.2 }} />
      <RadioPulse from={[-2.6, 1.7, 2.3]} to={MOD} on={() => { const t = T(); return t > 0.6 && t < 2.6 }} />
      <RadioPulse from={[MAG_POS[0], 2.2, -2.9]} to={MOD} color="#ff5050" on={() => { const t = T(); return t > 3.5 && t < 6 }} />
      <RadioPulse from={[-3.5, 2.5, -2.5]} to={MOD} color="#ffffff" on={() => { const t = T(); return t > 7.8 && t < 9.6 }} />
      <RadioPulse from={MOD} to={[-1.2, 2.7, -2.8]} color="#ff5050" on={() => { const t = T(); return t > 9.6 && t < 11 }} />
      <RadioPulse from={MOD} to={[3.0, 1.9, 2.4]} color="#35d46a" on={() => { const t = T(); return t > 12.4 && t < 14.5 }} />

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
      {/* a notificação que chega no celular, ampliada: primeiro o disparo, depois a foto com a pessoa marcada */}
      {step >= 3 && (
        <Html position={[3.0, 2.55, 2.4]} center style={{ pointerEvents: 'none' }}>
          <div className="fx-tag w-52 rounded-2xl bg-white/95 p-2 text-left shadow-xl" lang="pt-BR">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="grid h-4 w-4 place-items-center rounded bg-[#1E398D] text-[8px] font-bold text-[#F9E000]">O</span>
              <span className="flex-1 font-semibold">Alarme 365</span><span>agora</span>
            </div>
            <div className="mt-1 text-[12px] font-bold text-[#e03131]">Disparo: movimento detectado</div>
            <div className="text-[11px] text-slate-600">Fotossensor · Sala de estar</div>
            {step >= 4 && <img src={aiPhotoDataUrl(true)} alt="" width={192} height={144} className="mt-1.5 rounded-lg" />}
          </div>
        </Html>
      )}
    </>
  )
}
