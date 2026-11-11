import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { stadiumGeometry } from '../common/shapes'
import { DeviceCtx, bump, useActionPhase, type DeviceProps } from '../common/util'
import { actionTime, now, useShowroom } from '../../store/showroomStore'
import { MagneticField } from '../fx/MagneticField'
import { RadioPulse } from '../fx/RadioPulse'
import { SoundWaves } from '../fx/SoundWaves'
import { MiniModulo } from '../fx/MiniModulo'

const HINGE_X = 3.05
const MINI: [number, number, number] = [-1.9, 1.25, 0.6]

const knockT = () => { const k = useShowroom.getState().knock; return k ? now() - k.t0 : -1 }
const knockFired = () => { const k = useShowroom.getState().knock; return !!k && k.fired && now() - k.t0 > 0.5 && now() - k.t0 < 3.5 }
const doorOpen = () => { const t = actionTime('ima'); return t < 0 ? 0 : bump(t, 1, 2.6, 5.2, 6.6) }
const alarmOn = () => doorOpen() > 0.08 || knockFired()

/** Sensor magnético: corpo principal (no batente) + ímã (na folha da porta). Frente em +Z. */
export function SensorMagnetico({ interactive = false, open }: DeviceProps & { open?: () => number }) {
  const door = useRef<THREE.Group>(null!)
  const doorFx = useRef<THREE.Group>(null!)
  const slit = useMemo(() => stadiumGeometry(0.17, 0.04, 0.01, 0.003), [])
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b5a4a', roughness: 0.8 }), [])
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a3145', roughness: 0.9 }), [])
  const sceneOn = useActionPhase(['ima', 'choque']) >= 0
  const knock = useShowroom((s) => (interactive ? s.knock : null))

  useFrame(() => {
    const o = open ? open() : interactive ? doorOpen() : 0
    let rot = -o * 0.6
    if (interactive) {
      const tk = knockT()
      if (tk >= 0 && tk < 0.7) rot += Math.sin(tk * 70) * 0.012 * (1 - tk / 0.7)
    }
    door.current.rotation.y = rot
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'magnetico', interactive }}>
      {/* corpo principal */}
      <ClickablePart internal>
        <RoundedBox args={[0.6, 1.86, 0.08]} radius={0.035} smoothness={4} position={[-0.23, 0, -0.19]} material={M.white} />
      </ClickablePart>
      <ClickablePart id="corpo">
        <RoundedBox args={[0.62, 1.88, 0.38]} radius={0.1} smoothness={7} position={[-0.23, 0, 0.04]} material={M.white} castShadow />
        <LogoGroove r={0.11} position={[-0.23, -0.6, 0.2305]} />
        {/* linha de partição da tampa e marca de alinhamento com o ímã */}
        <RoundedBox args={[0.624, 1.884, 0.012]} radius={0.006} smoothness={2} position={[-0.23, 0, -0.148]} material={M.partition} />
        <mesh material={M.partition} position={[0.04, 0, 0.2305]}><boxGeometry args={[0.05, 0.012, 0.002]} /></mesh>
      </ClickablePart>
      <ClickablePart id="led">
        <mesh geometry={slit} material={M.blackGloss} position={[-0.23, 0.62, 0.223]} />
        <Led sample={(t, o) => {
          const on = interactive ? alarmOn() : (open?.() ?? 0) > 0.08
          o.color = '#ff2a2a'; o.on = on ? (t % 0.4 < 0.2 ? 1 : 0.05) : 0.03
        }} position={[-0.23, 0.62, 0.236]}>
          <boxGeometry args={[0.12, 0.018, 0.004]} />
        </Led>
      </ClickablePart>
      <ClickablePart id="choque">
        <mesh material={M.pcb} position={[-0.2, 0.28, -0.1]}><boxGeometry args={[0.4, 0.52, 0.025]} /></mesh>
        <mesh material={M.gold} position={[-0.2, 0.36, -0.06]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.11, 0.11, 0.03, 24]} /></mesh>
        <mesh material={M.metal} position={[-0.2, 0.36, -0.04]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.06, 0.06, 0.02, 20]} /></mesh>
        <mesh material={M.chip} position={[-0.2, 0.13, -0.075]}><boxGeometry args={[0.16, 0.12, 0.03]} /></mesh>
      </ClickablePart>
      <ClickablePart id="bateria">
        <mesh material={M.chip} position={[-0.2, -0.38, -0.01]}><cylinderGeometry args={[0.12, 0.12, 0.52, 24]} /></mesh>
        <mesh material={M.orange} position={[-0.2, -0.42, -0.01]}><cylinderGeometry args={[0.122, 0.122, 0.26, 24]} /></mesh>
        <mesh material={M.metal} position={[-0.2, -0.1, -0.01]}><cylinderGeometry args={[0.04, 0.04, 0.05, 12]} /></mesh>
      </ClickablePart>

      {/* ímã: preso à folha da porta, gira com ela */}
      <group position={[HINGE_X, 0, -0.3]}>
        <group ref={door}>
          <group position={[-HINGE_X, 0, 0.3]}>
            <ClickablePart id="ima">
              <RoundedBox args={[0.32, 1.25, 0.32]} radius={0.085} smoothness={7} position={[0.29, 0, 0.0]} material={M.white} castShadow />
              <mesh material={M.partition} position={[0.165, 0, 0.1605]}><boxGeometry args={[0.05, 0.012, 0.002]} /></mesh>
              <RoundedBox args={[0.324, 1.254, 0.012]} radius={0.006} smoothness={2} position={[0.29, 0, -0.1]} material={M.partition} />
            </ClickablePart>
            <group ref={doorFx} visible={sceneOn}>
              <mesh material={doorMat} position={[1.57, 0, -0.24]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[2.9, 4.4, 0.14]} /></mesh>
              <mesh material={M.metal} position={[0.5, -0.9, -0.12]} userData={{ fx: true }} raycast={() => null}><sphereGeometry args={[0.09, 16, 12]} /></mesh>
            </group>
          </group>
        </group>
      </group>

      {interactive && (
        <>
          <group visible={sceneOn}>
            <mesh material={wallMat} position={[-1.95, 0, -0.26]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[4, 4.6, 0.18]} /></mesh>
            <mesh material={wallMat} position={[5.1, 0, -0.26]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[4, 4.6, 0.18]} /></mesh>
          </group>
          <MagneticField position={[0.08, 0, 0.05]} gap={0.06} height={1.05} strength={() => (sceneOn ? Math.max(0, 1 - doorOpen() * 6) : 0)} />
          {sceneOn && (
            <>
              <MiniModulo position={MINI} led={() => (alarmOn() ? 'disparo' : 'armado')} />
              <RadioPulse from={[-0.2, 0.75, 0.25]} to={MINI} on={alarmOn} />
              <SoundWaves position={[1.5, 0, -0.1]} color="#ffb020" count={3} maxRadius={1.0} speed={1.4}
                level={() => { const t = knockT(); return t >= 0 && t < 1.1 ? 2 : 0 }} />
            </>
          )}
          {knock && (
            <Html key={knock.t0} position={[1.5, 1.3, 0]} center style={{ pointerEvents: 'none' }}>
              <div className={`fx-tag rounded-full px-4 py-1.5 text-sm font-bold text-white ${knock.fired ? 'bg-alert' : 'bg-black/70'}`}>
                {knock.fired ? 'Disparou antes de a porta abrir' : 'Vibração abaixo do nível: não dispara'}
              </div>
            </Html>
          )}
        </>
      )}
    </DeviceCtx.Provider>
  )
}
