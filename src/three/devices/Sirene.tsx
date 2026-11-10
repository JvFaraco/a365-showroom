import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M } from '../common/materials'
import { LogoRelief } from '../common/Logo'
import { Led } from '../common/Led'
import { latheZ, stadiumGeometry } from '../common/shapes'
import { DeviceCtx, bump, useActionPhase, type DeviceProps } from '../common/util'
import { actionTime, useShowroom } from '../../store/showroomStore'
import { SoundWaves } from '../fx/SoundWaves'

/** Sirene: cúpula baixa com face plana, presa a um suporte de parede redondo. Face em +Z. */
export function Sirene({ interactive = false, sounding }: DeviceProps & { sounding?: () => boolean }) {
  const body = useRef<THREE.Group>(null!)
  const shell = useRef<THREE.Group>(null!)
  const batt = useRef<THREE.Group>(null!)
  const plugRef = useRef<THREE.Group>(null!)
  const dome = useMemo(() => latheZ([[1.0, -0.25], [0.99, -0.15], [0.94, 0.03], [0.86, 0.18], [0.76, 0.27], [0.62, 0.3], [0.001, 0.3]]), [])
  const slit = useMemo(() => stadiumGeometry(0.12, 0.04, 0.008, 0.003), [])
  const clicPhase = useActionPhase('encaixe', [3.5])

  const isOn = () => (sounding ? sounding() : interactive && useShowroom.getState().sirenOn)
  const level = () => (isOn() ? (interactive ? useShowroom.getState().sirenLevel : 2) : 0)

  useFrame(({ clock }) => {
    const on = isOn()
    const lv = level()
    shell.current.position.x = on ? Math.sin(clock.elapsedTime * 90) * 0.004 * lv : 0
    if (!interactive) return
    // encaixe: afasta, gira ~20° e trava de volta
    const te = actionTime('encaixe')
    const away = te < 0 ? 0 : bump(te, 0, 1.1, 1.9, 2.9)
    const twist = te < 0 ? 0 : bump(te, 0.9, 1.6, 2.9, 3.5)
    body.current.position.z = away * 0.7
    body.current.rotation.z = twist * 0.35
    // bateria: tampa abre, conector solta, bateria sai do berço
    const tb = actionTime('bateria-sirene')
    shell.current.position.z = tb < 0 ? 0 : bump(tb, 0, 1.1, 5.6, 6.8) * 1.3
    plugRef.current.position.x = tb < 0 ? 0 : bump(tb, 1.3, 2.0, 4.6, 5.2) * -0.12
    const out = tb < 0 ? 0 : bump(tb, 2.1, 3.2, 4.2, 5.0)
    batt.current.position.set(0, out * 0.25, out * 0.7)
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'sirene', interactive }}>
      <group ref={body}>
        <ClickablePart id="corpo">
          <group ref={shell}>
            <mesh geometry={dome} material={M.white} castShadow />
            <LogoRelief r={0.19} position={[0.1, -0.02, 0.3]} depth={0.008} />
            <RoundedBox args={[0.34, 0.22, 0.16]} radius={0.05} smoothness={4} position={[0, 0.98, -0.17]} material={M.whiteRelief} />
          </group>
        </ClickablePart>
        <ClickablePart id="led">
          <mesh geometry={slit} material={M.blackGloss} position={[0, -0.55, 0.296]} />
          <Led sample={(t, o) => {
            const on = isOn()
            o.color = '#ff2a2a'; o.on = on ? (t % 0.3 < 0.15 ? 1 : 0.05) : 0.03
          }} position={[0, -0.55, 0.306]}>
            <boxGeometry args={[0.08, 0.02, 0.004]} />
          </Led>
        </ClickablePart>

        {/* chassi traseiro (fica no lugar quando a face sai) */}
        <ClickablePart internal>
          <mesh material={M.whiteRelief} position={[0, 0, -0.25]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.96, 0.96, 0.05, 64]} /></mesh>
          <mesh material={M.white} position={[0, 0.52, -0.16]}><boxGeometry args={[0.86, 0.34, 0.14]} /></mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} material={M.white} position={[Math.cos(i * 1.57 + 0.78) * 0.5, Math.sin(i * 1.57 + 0.78) * 0.5 - 0.12, -0.2]} rotation={[0, 0, i * 1.57 + 0.78]}><boxGeometry args={[0.3, 0.03, 0.06]} /></mesh>
          ))}
        </ClickablePart>
        <ClickablePart id="tamper">
          <mesh material={M.greyDark} position={[0.6, -0.6, -0.3]}><boxGeometry args={[0.16, 0.16, 0.07]} /></mesh>
          <mesh material={M.metal} position={[0.6, -0.6, -0.35]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.06, 12]} /></mesh>
        </ClickablePart>

        <ClickablePart id="elemento-sonoro">
          <group position={[0, -0.12, -0.14]}>
            <mesh material={M.whiteRelief} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.36, 0.38, 0.14, 48]} /></mesh>
            {[0.3, 0.22, 0.14].map((r) => (
              <mesh key={r} material={M.grey} position={[0, 0, 0.072]}><torusGeometry args={[r, 0.012, 8, 48]} /></mesh>
            ))}
            <mesh material={M.metal} position={[0, 0, 0.075]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 0.02, 24]} /></mesh>
          </group>
        </ClickablePart>
        <ClickablePart id="bateria">
          <group ref={batt}>
            <group position={[0, 0.52, -0.06]} rotation={[0, 0, Math.PI / 2]}>
              <mesh material={M.black}><cylinderGeometry args={[0.13, 0.13, 0.72, 28]} /></mesh>
              <mesh material={M.orange} position={[0, 0.05, 0]}><cylinderGeometry args={[0.132, 0.132, 0.3, 28]} /></mesh>
              <mesh material={M.metal} position={[0, 0.375, 0]}><cylinderGeometry args={[0.05, 0.05, 0.04, 12]} /></mesh>
            </group>
          </group>
        </ClickablePart>
        <ClickablePart id="placa">
          <mesh material={M.pcb} position={[0.58, 0.14, -0.2]}><boxGeometry args={[0.3, 0.42, 0.03]} /></mesh>
          <mesh material={M.chip} position={[0.58, 0.08, -0.175]}><boxGeometry args={[0.14, 0.14, 0.025]} /></mesh>
          <group ref={plugRef}>
            <mesh material={M.white} position={[0.52, 0.3, -0.17]}><boxGeometry args={[0.1, 0.07, 0.05]} /></mesh>
            <mesh material={M.red} position={[0.44, 0.4, -0.15]} rotation={[0, 0, 0.6]}><cylinderGeometry args={[0.012, 0.012, 0.26, 6]} /></mesh>
            <mesh material={M.black} position={[0.47, 0.42, -0.13]} rotation={[0, 0, 0.6]}><cylinderGeometry args={[0.012, 0.012, 0.26, 6]} /></mesh>
          </group>
        </ClickablePart>

        <SoundWaves level={level} position={[0, 0, 0.36]} count={5} maxRadius={1.9} />
      </group>

      {/* suporte de parede: disco com nervuras em cruz e furo central */}
      <ClickablePart id="suporte">
        <group position={[0, 0, -0.34]}>
          <mesh material={M.white} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.8, 0.8, 0.07, 64]} /></mesh>
          <mesh material={M.hole} position={[0, 0, 0.001]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.074, 32]} /></mesh>
          {[0, Math.PI / 2].map((a) => (
            <group key={a} rotation={[0, 0, a]}>
              <mesh material={M.whiteRelief} position={[0.47, 0, 0.045]}><boxGeometry args={[0.58, 0.05, 0.03]} /></mesh>
              <mesh material={M.whiteRelief} position={[-0.47, 0, 0.045]}><boxGeometry args={[0.58, 0.05, 0.03]} /></mesh>
              <mesh material={M.whiteRelief} position={[0.47, 0, -0.045]}><boxGeometry args={[0.58, 0.05, 0.03]} /></mesh>
              <mesh material={M.whiteRelief} position={[-0.47, 0, -0.045]}><boxGeometry args={[0.58, 0.05, 0.03]} /></mesh>
            </group>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} material={M.metal} position={[Math.cos(i * 1.57 + 0.78) * 0.52, Math.sin(i * 1.57 + 0.78) * 0.52, -0.036]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.012, 12]} /></mesh>
          ))}
        </group>
      </ClickablePart>

      {interactive && clicPhase >= 0 && (
        <Html position={[0, 1.25, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="fx-tag rounded-full bg-ok px-4 py-1.5 text-sm font-bold text-[#05210c]">Clic! Travada no suporte</div>
        </Html>
      )}
    </DeviceCtx.Provider>
  )
}
