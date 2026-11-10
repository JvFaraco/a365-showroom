import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoRelief } from '../common/Logo'
import { Led } from '../common/Led'
import { fresnelTexture, polaroidTexture } from '../common/textures'
import { stadiumGeometry } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import { actionTime } from '../../store/showroomStore'
import { DetectionFan, LowPolyDog, LowPolyPerson } from '../fx/DetectionFan'
import { CameraFlash } from '../fx/CameraFlash'

const PIVOT: [number, number, number] = [0, 0.3, -0.42]
const FAN_Y = -0.93
const personX = (t: number) => -3.4 + seg(t, 2.5, 6.5) * 6.8
const dogX = (t: number) => -3.4 + seg(t, 8, 12) * 6.8
const PERSON_Z = 2.5

/** Alerta do PIR durante a ação: a pessoa está dentro do leque de 90°? */
function pirAlert() {
  const t = actionTime('pir')
  if (t < 2.5 || t > 6.5) return 0
  return Math.abs(personX(t)) < PERSON_Z ? 1 : 0
}

/** Fotossensor: cápsula vertical com câmera, flash, lente PIR, base cinza e suporte articulado. Frente em +Z. */
export function Fotossensor({ interactive = false, flash }: DeviceProps & { flash?: () => number }) {
  const tilt = useRef<THREE.Group>(null!)
  const cover = useRef<THREE.Group>(null!)
  const cells = useRef<THREE.Group>(null!)
  const polaroid = useRef<THREE.Group>(null!)
  const person = useRef<THREE.Group>(null!)
  const dog = useRef<THREE.Group>(null!)
  const ruler = useRef<THREE.Group>(null!)
  const alertV = useRef(0)
  const oval = useMemo(() => stadiumGeometry(0.36, 0.7, 0.07, 0.025), [])
  const win = useMemo(() => stadiumGeometry(0.1, 0.17, 0.012, 0.004), [])
  const pirMat = useMemo(() => { const m = M.frosted.clone(); m.map = fresnelTexture(); return m }, [])
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
    // suporte: inclina para os lados no pivô
    const ts = actionTime('suporte')
    const amp = ts < 0 ? 0 : bump(ts, 0, 0.8, 7, 8)
    tilt.current.rotation.y = Math.sin(ts * 1.6) * 0.42 * amp
    tilt.current.rotation.x = Math.sin(ts * 0.8) * 0.12 * amp
    ruler.current.visible = ts >= 0
    // tampa traseira abre e as pilhas deslizam
    const tt = actionTime('tampa-foto')
    const open = tt < 0 ? 0 : bump(tt, 0, 1.2, 4.6, 5.8)
    cover.current.rotation.x = open * 1.9
    cells.current.position.z = -(tt < 0 ? 0 : bump(tt, 1.2, 2.4, 3.6, 4.6)) * 0.55
    // câmera: polaroid voa para fora
    const tc = actionTime('camera')
    const k = tc < 0 ? 0 : bump(tc, 0.9, 2.0, 6.3, 6.9)
    polaroid.current.visible = k > 0.001
    polaroid.current.position.set(k * 1.0, 0.62 - k * 0.25, 0.42 + k * 0.3)
    polaroid.current.scale.setScalar(0.05 + k * 0.95)
    polaroid.current.rotation.set(0, -0.25 * k, (1 - k) * 1.2 - 0.08)
    // PIR: pessoa dispara, cachorro não
    const tp = actionTime('pir')
    person.current.visible = tp > 2.3 && tp < 6.8
    dog.current.visible = tp > 7.8 && tp < 12.3
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
      <group position={PIVOT}>
        <group ref={tilt}>
          <group position={[-PIVOT[0], -PIVOT[1], -PIVOT[2]]}>
            {/* corpo em cápsula */}
            <ClickablePart follow="corpo">
              <RoundedBox args={[0.8, 1.76, 0.5]} radius={0.2} smoothness={6} position={[0, 0.07, 0]} material={M.white} castShadow />
              <RoundedBox args={[0.74, 0.66, 0.1]} radius={0.045} smoothness={4} position={[0, -0.14, 0.23]} material={M.white} />
              <LogoRelief r={0.065} position={[0, -0.62, 0.251]} depth={0.006} />
            </ClickablePart>

            {/* módulo oval em relevo: câmera + janela do flash/LED */}
            <ClickablePart follow="camera">
              <mesh geometry={oval} material={M.white} position={[0, 0.5, 0.24]} />
            </ClickablePart>
            <ClickablePart id="camera">
              <mesh material={M.blackGloss} position={[0, 0.62, 0.345]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.075, 0.075, 0.03, 32]} /></mesh>
              <mesh material={M.lens} position={[0, 0.62, 0.362]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.045, 0.045, 0.012, 32]} /></mesh>
              <mesh material={M.blue} position={[0, 0.62, 0.3685]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.004, 16]} /></mesh>
            </ClickablePart>
            <ClickablePart id="flash">
              <mesh geometry={win} material={M.blackGloss} position={[0, 0.44, 0.335]} />
              <Led sample={(_, o) => { const p = flashPower(); o.color = '#ffffff'; o.on = 0.04 + p * 3 }} position={[0, 0.455, 0.353]}>
                <boxGeometry args={[0.05, 0.06, 0.004]} />
              </Led>
            </ClickablePart>
            <ClickablePart id="led">
              <mesh material={M.blackGloss} position={[0, 0.3, 0.342]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 0.012, 24]} /></mesh>
              <Led sample={(t, o) => {
                const a = interactive ? alertV.current : 0
                o.color = a > 0.5 ? '#ff2a2a' : '#27d455'
                o.on = a > 0.5 ? 1 : t % 3 < 0.25 ? 0.9 : 0.12
              }} position={[0, 0.3, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.004, 16]} />
              </Led>
            </ClickablePart>

            {/* lente Fresnel do PIR */}
            <ClickablePart id="pir">
              <mesh material={M.whiteRelief} position={[0, -0.14, 0.282]}><boxGeometry args={[0.62, 0.52, 0.01]} /></mesh>
              <mesh material={pirMat} position={[0, -0.14, -0.19]}>
                <cylinderGeometry args={[0.5, 0.5, 0.46, 32, 1, true, -0.594, 1.188]} />
              </mesh>
            </ClickablePart>

            <ClickablePart id="base">
              <RoundedBox args={[0.81, 0.2, 0.51]} radius={0.09} smoothness={5} position={[0, -0.87, 0]} material={M.greyDark} castShadow />
            </ClickablePart>

            {/* traseira */}
            <ClickablePart id="tampa-traseira">
              <group position={[0, -0.8, -0.26]}>
                <group ref={cover}>
                  <RoundedBox args={[0.56, 1.0, 0.035]} radius={0.015} smoothness={3} position={[0, 0.5, 0]} material={M.whiteRelief} />
                  <mesh material={M.grey} position={[0, 0.92, -0.02]}><boxGeometry args={[0.16, 0.05, 0.02]} /></mesh>
                </group>
              </group>
            </ClickablePart>
            <ClickablePart id="pilhas">
              <group ref={cells}>
                {[-0.13, 0.13].map((x) => (
                  <group key={x} position={[x, -0.3, -0.1]}>
                    <mesh material={M.chip}><cylinderGeometry args={[0.1, 0.1, 0.62, 24]} /></mesh>
                    <mesh material={M.orange} position={[0, 0.12, 0]}><cylinderGeometry args={[0.102, 0.102, 0.2, 24]} /></mesh>
                    <mesh material={M.metal} position={[0, 0.33, 0]}><cylinderGeometry args={[0.035, 0.035, 0.05, 12]} /></mesh>
                  </group>
                ))}
              </group>
            </ClickablePart>
            <ClickablePart id="fixacao">
              <RoundedBox args={[0.46, 0.5, 0.03]} radius={0.012} smoothness={3} position={[0, 0.3, -0.3]} material={M.grey} />
              {[[-0.16, 0.16], [0.16, 0.16], [-0.16, -0.16], [0.16, -0.16]].map(([x, y], i) => (
                <mesh key={i} material={M.hole} position={[x, 0.3 + y, -0.316]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.004, 12]} /></mesh>
              ))}
              {[-0.2, 0.2].map((x) => (
                <mesh key={x} material={M.metal} position={[x, 0.3, -0.322]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.02, 6]} /></mesh>
              ))}
            </ClickablePart>
          </group>
        </group>
      </group>

      {/* suporte articulado: esfera do pivô, braço curto e placa de parede */}
      <ClickablePart id="suporte">
        <mesh material={M.white} position={PIVOT}><sphereGeometry args={[0.1, 24, 16]} /></mesh>
        <mesh material={M.white} position={[0, 0.3, -0.58]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.055, 0.07, 0.3, 20]} /></mesh>
        <RoundedBox args={[0.42, 0.62, 0.05]} radius={0.02} smoothness={3} position={[0, 0.3, -0.75]} material={M.white} castShadow />
        {[0.2, -0.2].map((y) => (
          <mesh key={y} material={M.metal} position={[0, 0.3 + y, -0.722]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.01, 12]} /></mesh>
        ))}
      </ClickablePart>

      {interactive && (
        <>
          <CameraFlash power={flashPower} position={[0, 0.45, 0.42]} />
          <group ref={polaroid} visible={false}>
            <mesh material={polMat} userData={{ fx: true }} raycast={() => null}><planeGeometry args={[0.8, 0.8]} /></mesh>
          </group>
          <DetectionFan position={[0, FAN_Y, 0.3]} length={4.2} labels={pirPhase >= 0} alert={() => alertV.current}
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
