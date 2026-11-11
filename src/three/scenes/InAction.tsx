import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { IA_DURATION } from '../../data/inAction'
import { ia, useShowroom } from '../../store/showroomStore'
import { IA_STEPS } from '../../data/inAction'
import { Placed } from './Kit'
import { ModuloComando } from '../devices/ModuloComando'
import { Fotossensor } from '../devices/Fotossensor'
import { SensorMagnetico } from '../devices/SensorMagnetico'
import { Sirene } from '../devices/Sirene'
import { ControleRemoto } from '../devices/ControleRemoto'
import { RadioPulse } from '../fx/RadioPulse'
import { CameraFlash } from '../fx/CameraFlash'
import { LowPolyPerson } from '../fx/DetectionFan'
import { bump, seg } from '../common/util'
import { aiPhotoDataUrl } from '../common/textures'

const T = () => ia.t
const doorOpen = () => seg(T(), 3.2, 4.6)
const flashP = () => bump(T(), 7.6, 7.7, 7.8, 8.3)
const MOD: [number, number, number] = [-2.7, 1.25, -2.2]
const MAG_S = 0.3
const DOOR_X = 1.2 // lado da fechadura; a dobradiça fica a 3,05 × escala para a direita

/** Em ação: corte de um cômodo low-poly com os aparelhos instalados e a sequência de um disparo. */
export function InAction() {
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ color: '#27304a', roughness: 0.95 }), [])
  const floor = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3248', roughness: 0.9 }), [])
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a6450', roughness: 0.8 }), [])
  const door = useRef<THREE.Group>(null!)
  const intruder = useRef<THREE.Group>(null!)
  const step = useShowroom((s) => s.iaStep)
  const boxOn = useShowroom((s) => s.iaStep >= 2 && s.iaPlaying) || step >= 3

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
    intruder.current.visible = t > 4.4
    intruder.current.position.set(1.65 - seg(t, 4.6, 7.4) * 1.2, Math.abs(Math.sin(t * 6)) * 0.03 * (t < 7.4 ? 1 : 0), -3.4 + seg(t, 4.6, 7.4) * 2.4)
  })

  const hinge = DOOR_X + 3.05 * MAG_S
  return (
    <>
      {/* cômodo em corte */}
      <mesh material={floor} position={[0, 0.02, 0]} raycast={() => null}><boxGeometry args={[8, 0.04, 6]} /></mesh>
      <mesh material={wall} position={[-4.05, 1.7, 0]} raycast={() => null}><boxGeometry args={[0.1, 3.4, 6]} /></mesh>
      <mesh material={wall} position={[-1.45, 1.7, -3.05]} raycast={() => null}><boxGeometry args={[5.1, 3.4, 0.1]} /></mesh>
      <mesh material={wall} position={[3.06, 1.7, -3.05]} raycast={() => null}><boxGeometry args={[1.9, 3.4, 0.1]} /></mesh>
      <mesh material={wall} position={[1.6, 2.85, -3.05]} raycast={() => null}><boxGeometry args={[1.1, 1.1, 0.1]} /></mesh>
      <group position={[hinge, 0, -3.02]}>
        <group ref={door}>
          <mesh material={wood} position={[-0.5, 1.15, 0]} raycast={() => null}><boxGeometry args={[1.0, 2.3, 0.06]} /></mesh>
        </group>
      </group>
      {/* móveis simples */}
      <mesh material={wood} position={[-2.7, 0.5, -2.3]} raycast={() => null}><boxGeometry args={[1.3, 1.0, 0.7]} /></mesh>
      <mesh material={wall} position={[0.6, 0.35, 0.6]} raycast={() => null}><boxGeometry args={[2.2, 0.5, 0.9]} /></mesh>
      <mesh material={wall} position={[0.6, 0.75, 0.2]} raycast={() => null}><boxGeometry args={[2.2, 0.5, 0.2]} /></mesh>

      {/* aparelhos instalados nas posições certas */}
      <Placed p={{ id: 'modulo', position: [MOD[0], 1.0, MOD[2]], scale: 0.42, rotation: [0, 0.6, 0] }}>
        <ModuloComando ledOverride={() => { const t = T(); return t < 1.6 ? 'desarmado' : t < 3.6 ? 'armado' : 'disparo' }} />
      </Placed>
      <group position={[-3.6, 2.35, -2.65]} rotation={[0.25, Math.PI / 4, 0]} scale={0.34}
        onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('fotossensor') }}>
        <Fotossensor flash={flashP} />
        <CameraFlash power={flashP} position={[0, 0.45, 0.5]} />
      </group>
      <group position={[DOOR_X + 0.06, 1.9, -2.93]} scale={MAG_S} onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('magnetico') }}>
        <SensorMagnetico open={doorOpen} />
      </group>
      <group position={[-1.2, 2.7, -2.88]} scale={0.36} onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('sirene') }}>
        <Sirene sounding={() => T() >= 10 && T() < 16.5} />
      </group>
      <group position={[-2.6, 1.3, 2.3]} rotation={[-0.2, 0.3, 0]} scale={0.34} onClick={(e) => { e.stopPropagation(); useShowroom.getState().setDevice('controle') }}>
        <ControleRemoto pressed={() => { const t = T(); return t > 0.5 && t < 1.3 ? 'btn-armar' : null }} />
      </group>
      <Placed p={{ id: 'app', position: [3.0, 0.75, 2.4], scale: 0.62, rotation: [-0.15, -0.35, 0] }} />

      <RadioPulse from={[-2.6, 1.7, 2.3]} to={MOD} on={() => { const t = T(); return t > 0.6 && t < 2.6 }} />
      <RadioPulse from={[DOOR_X, 2.2, -2.9]} to={MOD} color="#ff5050" on={() => { const t = T(); return t > 3.5 && t < 6 }} />
      <RadioPulse from={[-3.5, 2.5, -2.5]} to={MOD} color="#ffffff" on={() => { const t = T(); return t > 7.8 && t < 9.6 }} />
      <RadioPulse from={MOD} to={[-1.2, 2.7, -2.8]} color="#ff5050" on={() => { const t = T(); return t > 9.6 && t < 11 }} />
      <RadioPulse from={MOD} to={[3.0, 1.9, 2.4]} color="#35d46a" on={() => { const t = T(); return t > 12.4 && t < 14.5 }} />

      <group ref={intruder} visible={false}>
        <LowPolyPerson scale={1.8} color="#3b4256" />
        {boxOn && (
          <Html position={[0, 0.95, 0]} center style={{ pointerEvents: 'none' }}>
            <div className="fx-tag flex flex-col items-center">
              <div className="h-[150px] w-[70px] border-2 border-ok bg-ok/30" />
              <div className="mt-1 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">Pessoa (100% de previsão)</div>
            </div>
          </Html>
        )}
      </group>
      {step >= 4 && (
        <Html position={[3.0, 2.55, 2.4]} center style={{ pointerEvents: 'none' }}>
          <div className="fx-tag w-40 rounded-xl bg-white p-1.5 text-center text-[11px] font-semibold text-[#1E398D] shadow-xl">
            <img src={aiPhotoDataUrl(true)} alt="" width={148} height={111} className="mb-1 rounded-lg" />
            Nova imagem do disparo
          </div>
        </Html>
      )}
    </>
  )
}
