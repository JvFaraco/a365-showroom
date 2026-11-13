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

// Montagem da foto de instalação: as duas peças na horizontal, no alto da porta, paralelas e alinhadas no
// comprimento. O corpo vai na folha (embaixo) e o ímã no batente (em cima), com vão de poucos milímetros.
// As peças são modeladas "de pé" (comprimento em Y) e deitadas por DEITA dentro de cada parte.
const DEITA: [number, number, number] = [0, 0, Math.PI / 2]
// Ficha (1 unidade = 49,5 mm): corpo de 93 de comprimento × 25 de altura da face × 28 de espessura;
// ímã de 92 × 12 × 15; vão de 7 mm na montagem (o card diz "máximo 1 cm").
const mm = (v: number) => v / 49.5
const BODY = { w: mm(25), len: mm(93), d: mm(28), x: -mm(9.5) }
const MAG = { w: mm(12), len: mm(92), d: mm(15), gap: mm(7) }
const BZ = 0.04, FRONT = BZ + BODY.d / 2, BACK = BZ - BODY.d / 2 // centro, frente e costas do corpo em Z
const SPLIT = BACK + BODY.d * 0.42 // emenda entre a base (atrás) e a tampa (na frente)
const MAG_X = BODY.x + BODY.w / 2 + MAG.gap + MAG.w / 2
const MAG_Z = BACK + MAG.d / 2 // as costas das duas peças no mesmo plano
export const DOOR_TOP = BODY.x + BODY.w / 2 + MAG.gap / 2 // o topo da folha passa no meio do vão
export const HINGE_X = 1.85 // o sensor fica no canto de cima da folha, do lado que abre
const MINI: [number, number, number] = [-2.3, 1.35, 0.6]

const knockT = () => { const k = useShowroom.getState().knock; return k ? now() - k.t0 : -1 }
const knockFired = () => { const k = useShowroom.getState().knock; return !!k && k.fired && now() - k.t0 > 0.5 && now() - k.t0 < 3.5 }
const doorOpen = () => { const t = actionTime('ima'); return t < 0 ? 0 : bump(t, 1, 2.6, 5.2, 6.6) }
const alarmOn = () => doorOpen() > 0.08 || knockFired()

/**
 * Sensor magnético: corpo (barra de cantos arredondados, com o LED perto de uma ponta, o círculo em
 * baixo-relevo no meio e a base de fixação na outra ponta) + ímã (barra fina e longa, paralela ao corpo).
 * Frente em +Z.
 */
export function SensorMagnetico({ interactive = false, open }: DeviceProps & { open?: () => number }) {
  const door = useRef<THREE.Group>(null!)
  const slit = useMemo(() => stadiumGeometry(mm(8), mm(4), 0.01, 0.003), [])
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b5a4a', roughness: 0.8 }), [])
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a3145', roughness: 0.9 }), [])
  // antena em mola de cobre
  const spring = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 14) * 0.045, t * 0.16, Math.sin(t * Math.PI * 14) * 0.045)) }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 180, 0.009, 5)
  }, [])
  const copper = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b87333', roughness: 0.35, metalness: 0.9 }), [])
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
      {/* a folha da porta gira na dobradiça (eixo vertical) e leva o corpo do sensor junto */}
      <group position={[HINGE_X, 0, -0.3]}>
        <group ref={door}>
          <group position={[-HINGE_X, 0, 0.3]}>
            {/* corpo em duas peças: a base (atrás, presa à porta) e a tampa (na frente), com a emenda entre elas */}
            <ClickablePart follow="corpo" explode={[0, 0, 0]}>
              <group rotation={DEITA}>
                <RoundedBox args={[BODY.w, BODY.len, SPLIT - BACK]} radius={0.05} smoothness={6} position={[BODY.x, 0, (SPLIT + BACK) / 2]} material={M.white} castShadow />
                <RoundedBox args={[BODY.w + 0.004, BODY.len + 0.004, 0.012]} radius={0.006} smoothness={2} position={[BODY.x, 0, SPLIT]} material={M.partition} />
              </group>
            </ClickablePart>
            <ClickablePart id="corpo">
              <group rotation={DEITA}>
                <RoundedBox args={[BODY.w, BODY.len, FRONT - SPLIT + 0.1]} radius={0.1} smoothness={8} position={[BODY.x, 0, (FRONT + SPLIT - 0.1) / 2]} material={M.white} castShadow />
                {/* círculo em baixo-relevo no meio */}
                <LogoGroove r={0.13} position={[BODY.x, 0, FRONT + 0.0005]} />
              </group>
            </ClickablePart>
            {/* LED pequeno (~4 × 8 mm), a ~1/3 do comprimento a partir de uma ponta */}
            <ClickablePart id="led">
              <group rotation={DEITA}>
                <mesh geometry={slit} material={M.blackGloss} position={[BODY.x, BODY.len / 6, FRONT - 0.007]} rotation={[0, 0, Math.PI / 2]} />
                <Led sample={(t, o) => {
                  const on = interactive ? alarmOn() : (open?.() ?? 0) > 0.08
                  o.color = on ? '#ff2a2a' : '#3d7bff'; o.on = on ? (t % 0.4 < 0.2 ? 1 : 0.05) : 0.12
                }} position={[BODY.x, BODY.len / 6, FRONT + 0.006]}>
                  <boxGeometry args={[0.04, 0.11, 0.004]} />
                </Led>
              </group>
            </ClickablePart>
            {/* placa comprida e estreita: sensor de choque, chave de anti-sabotagem, borne de 2 parafusos,
                etiqueta lisa e a antena em mola de cobre numa ponta */}
            <ClickablePart id="choque">
              <group rotation={DEITA}>
                <mesh material={M.pcb} position={[BODY.x, 0, -0.1]}><boxGeometry args={[0.36, 1.62, 0.022]} /></mesh>
                <mesh material={M.chip} position={[BODY.x, 0.3, -0.08]}><boxGeometry args={[0.13, 0.13, 0.02]} /></mesh>
                <mesh material={M.metal} position={[BODY.x + 0.1, 0.5, -0.082]}><boxGeometry args={[0.07, 0.05, 0.016]} /></mesh>
                <mesh material={M.chip} position={[BODY.x - 0.12, 0.68, -0.07]}><boxGeometry args={[0.07, 0.09, 0.04]} /></mesh>
                <mesh material={M.white} position={[BODY.x, -0.02, -0.1115]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.3, 0.3]} /></mesh>
                <mesh material={M.chip} position={[BODY.x - 0.07, -0.72, -0.065]}><boxGeometry args={[0.16, 0.13, 0.07]} /></mesh>
                {[BODY.x - 0.105, BODY.x - 0.035].map((x) => <mesh key={x} material={M.metal} position={[x, -0.72, -0.028]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.022, 0.022, 0.008, 10]} /></mesh>)}
                <mesh geometry={spring} material={copper} position={[BODY.x, 0.76, -0.08]} />
              </group>
            </ClickablePart>
            {/* bateria cilíndrica presa por duas presilhas metálicas */}
            <ClickablePart id="bateria">
              <group rotation={DEITA}>
                <mesh material={M.cell} position={[BODY.x, -0.02, -0.005]}><capsuleGeometry args={[0.095, 0.62, 4, 24]} /></mesh>
                <mesh material={M.metal} position={[BODY.x, 0.42, -0.005]}><cylinderGeometry args={[0.035, 0.035, 0.03, 12]} /></mesh>
                {[0.46, -0.46].map((y) => (
                  <group key={y} position={[BODY.x, y, -0.03]}>
                    <mesh material={M.metal}><boxGeometry args={[0.26, 0.02, 0.2]} /></mesh>
                    <mesh material={M.metal} position={[0, y > 0 ? -0.08 : 0.08, -0.06]}><boxGeometry args={[0.26, 0.16, 0.012]} /></mesh>
                  </group>
                ))}
              </group>
            </ClickablePart>
            <group visible={sceneOn}>
              <mesh material={doorMat} position={[HINGE_X - 1.45, DOOR_TOP - 2.2, -0.24]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[2.9, 4.4, 0.14]} /></mesh>
              <mesh material={M.metal} position={[HINGE_X - 2.65, DOOR_TOP - 2.5, -0.12]} userData={{ fx: true }} raycast={() => null}><sphereGeometry args={[0.09, 16, 12]} /></mesh>
            </group>
          </group>
        </group>
      </group>

      {/* ímã: fica parado no batente, acima do corpo, paralelo e alinhado no comprimento */}
      <ClickablePart id="ima">
        <group rotation={DEITA}>
          {/* base (atrás) e tampa (na frente), com a emenda */}
          <RoundedBox args={[MAG.w, MAG.len, MAG.d * 0.45]} radius={0.03} smoothness={5} position={[MAG_X, 0, MAG_Z - MAG.d * 0.275]} material={M.white} castShadow />
          <RoundedBox args={[MAG.w, MAG.len, MAG.d * 0.62]} radius={0.06} smoothness={8} position={[MAG_X, 0, MAG_Z + MAG.d * 0.19]} material={M.white} castShadow />
          <RoundedBox args={[MAG.w + 0.004, MAG.len + 0.004, 0.01]} radius={0.005} smoothness={2} position={[MAG_X, 0, MAG_Z - MAG.d * 0.06]} material={M.partition} />
        </group>
      </ClickablePart>

      {interactive && (
        <>
          {/* batente: a parede em cima e dos lados da folha */}
          <group visible={sceneOn}>
            <mesh material={wallMat} position={[HINGE_X - 1.45, DOOR_TOP + 0.03 + 1.2, -0.26]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[7.2, 2.4, 0.18]} /></mesh>
            <mesh material={wallMat} position={[HINGE_X - 2.93 - 1.1, DOOR_TOP - 2.2, -0.26]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[2.2, 4.46, 0.18]} /></mesh>
            <mesh material={wallMat} position={[HINGE_X + 0.03 + 1.1, DOOR_TOP - 2.2, -0.26]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[2.2, 4.46, 0.18]} /></mesh>
          </group>
          <group rotation={DEITA}>
            <MagneticField position={[BODY.x + BODY.w / 2, 0, 0.05]} gap={MAG.gap} height={1.5} strength={() => (sceneOn ? Math.max(0, 1 - doorOpen() * 6) : 0)} />
          </group>
          {sceneOn && (
            <>
              <MiniModulo position={MINI} led={() => (alarmOn() ? 'disparo' : 'armado')} />
              <RadioPulse from={[-BODY.len / 6, BODY.x, FRONT + 0.03]} to={MINI} on={alarmOn} />
              <SoundWaves position={[1.0, -1.4, -0.1]} color="#ffb020" count={3} maxRadius={1.0} speed={1.4}
                level={() => { const t = knockT(); return t >= 0 && t < 1.1 ? 2 : 0 }} />
            </>
          )}
          {knock && (
            <Html key={knock.t0} position={[1.0, -0.75, 0.2]} center style={{ pointerEvents: 'none' }}>
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
