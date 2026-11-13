import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { boxesGeometry, roundedRectGeometry, stadiumGeometry, type Block } from '../common/shapes'
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
// Por dentro (pela foto da placa). Ao longo do comprimento (Y): a tampinha e o borne ficam na ponta do LED (+Y); a
// antena em mola sai da outra ponta da placa (−Y) e ocupa o resto do corpo.
const CAP_Y = BODY.len * 0.36 // emenda da tampinha da ponta (a ~14% do comprimento)
const PCB = { len: mm(74), w: mm(19), y: BODY.len / 2 - mm(3) - mm(74) / 2, z: -0.1 }
const PCB_END = PCB.y - PCB.len / 2 // borda da placa do lado da antena
const CELL = { r: mm(5.2), len: mm(43), y: PCB.y - mm(1) } // pilha cilíndrica, deitada sobre a placa, entre as duas presilhas

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
  const slit = useMemo(() => stadiumGeometry(mm(6.5), mm(3.2), 0.01, 0.003), [])
  // emenda da tampinha: um aro fino com o mesmo perfil arredondado da tampa
  const capSeam = useMemo(() => roundedRectGeometry(BODY.w + 0.004, FRONT - SPLIT + 0.1 + 0.004, 0.047, 0.01, 0), [])
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b5a4a', roughness: 0.8 }), [])
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a3145', roughness: 0.9 }), [])
  // antena em mola de cobre
  const smd = useMemo(() => {
    const z = PCB.z + 0.015, x = BODY.x, b = (dx: number, y: number, w: number, h: number, d = 0.012): Block => [x + dx, y, z, w, h, d]
    return {
      // cinco pontos de teste estanhados em fila, numa das bordas compridas
      pads: boxesGeometry([0, 1, 2, 3, 4].map((i) => b(-0.15, PCB_END + 0.36 + i * 0.055, 0.03, 0.03, 0.004))),
      // sensor do ímã (preto), no canto da ponta da antena, e um componente pequeno na outra borda
      black: boxesGeometry([b(-0.13, PCB_END + 0.1, 0.07, 0.1, 0.03), b(0.16, PCB.y + 0.12, 0.03, 0.06, 0.02)]),
      tan: boxesGeometry([b(0.12, PCB_END + 0.12, 0.04, 0.022), b(0.12, PCB_END + 0.19, 0.04, 0.022), b(-0.12, PCB.y + 0.3, 0.022, 0.04), b(0.13, PCB.y + 0.45, 0.04, 0.022)]),
    }
  }, [])
  const spring = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 144; i++) { const t = i / 144; pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 18) * 0.055, -t * 0.27, Math.sin(t * Math.PI * 18) * 0.055)) }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 110, 0.009, 4)
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
                <RoundedBox args={[BODY.w, BODY.len, SPLIT - BACK]} radius={0.03} smoothness={4} position={[BODY.x, 0, (SPLIT + BACK) / 2]} material={M.white} castShadow />
                <RoundedBox args={[BODY.w + 0.004, BODY.len + 0.004, 0.012]} radius={0.006} smoothness={2} position={[BODY.x, 0, SPLIT]} material={M.partition} />
              </group>
            </ClickablePart>
            <ClickablePart id="corpo">
              <group rotation={DEITA}>
                <RoundedBox args={[BODY.w, BODY.len, FRONT - SPLIT + 0.1]} radius={0.045} smoothness={5} position={[BODY.x, 0, (FRONT + SPLIT - 0.1) / 2]} material={M.white} castShadow />
                {/* logo em relevo, pequeno, um pouco antes do meio */}
                <LogoGroove r={0.1} position={[BODY.x, -BODY.len * 0.03, FRONT + 0.0005]} />
                {/* emenda da tampinha da ponta: dá a volta na frente e nos dois lados */}
                <mesh geometry={capSeam} material={M.partition} position={[BODY.x, CAP_Y, (FRONT + SPLIT - 0.1) / 2]} rotation={[Math.PI / 2, 0, 0]} />
              </group>
            </ClickablePart>
            {/* janela do LED: pequena (~6 × 3 mm), atravessada na face, entre o logo e a tampinha da ponta */}
            <ClickablePart id="led">
              <group rotation={DEITA}>
                <mesh geometry={slit} material={M.blackGloss} position={[BODY.x, BODY.len / 6, FRONT - 0.007]} />
                <Led sample={(t, o) => {
                  const on = interactive ? alarmOn() : (open?.() ?? 0) > 0.08
                  o.color = on ? '#ff2a2a' : '#3d7bff'; o.on = on ? (t % 0.4 < 0.2 ? 1 : 0.05) : 0.12
                }} position={[BODY.x, BODY.len / 6, FRONT + 0.006]}>
                  <boxGeometry args={[0.09, 0.035, 0.004]} />
                </Led>
              </group>
            </ClickablePart>
            {/* placa eletrônica: comprida e estreita (~74 × 19 mm). Numa ponta, o borne preto de 2 parafusos, no canto; da
                outra sai a mola de cobre da antena, para fora da placa. Verde liso, sem etiqueta */}
            <ClickablePart id="placa">
              <group rotation={DEITA}>
                <mesh material={M.pcb} position={[BODY.x, PCB.y, PCB.z]}><boxGeometry args={[PCB.w, PCB.len, 0.022]} /></mesh>
                <mesh geometry={spring} material={copper} position={[BODY.x + 0.02, PCB_END - 0.012, PCB.z + 0.03]} />
                <mesh material={M.chip} position={[BODY.x - 0.12, PCB.y + PCB.len / 2 - 0.09, PCB.z + 0.05]}><boxGeometry args={[0.16, 0.17, 0.08]} /></mesh>
                {[-0.04, 0.04].map((dy) => <mesh key={dy} material={M.metal} position={[BODY.x - 0.12, PCB.y + PCB.len / 2 - 0.09 + dy, PCB.z + 0.092]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.026, 0.026, 0.008, 10]} /></mesh>)}
                {/* como na placa real: fila de pontos de teste, o sensor do ímã (preto, no canto da ponta da antena) e
                    alguns componentes pequenos. Sem etiqueta */}
                <mesh geometry={smd.pads} material={M.metal} />
                <mesh geometry={smd.black} material={M.chip} />
                <mesh geometry={smd.tan} material={M.smdTan} />
              </group>
            </ClickablePart>
            {/* sensor de choque: um CI pequeno na placa */}
            <ClickablePart id="choque">
              <group rotation={DEITA}>
                <mesh material={M.chip} position={[BODY.x + 0.05, PCB_END + 0.2, PCB.z + 0.021]}><boxGeometry args={[0.1, 0.1, 0.02]} /></mesh>
              </group>
            </ClickablePart>
            {/* pilha cilíndrica deitada sobre a placa, presa por duas presilhas metálicas; corpo preto e faixa dourada no + */}
            <ClickablePart id="bateria">
              <group rotation={DEITA}>
                <mesh material={M.black} position={[BODY.x, CELL.y, PCB.z + 0.02 + CELL.r]}><cylinderGeometry args={[CELL.r, CELL.r, CELL.len, 24]} /></mesh>
                <mesh material={M.gold} position={[BODY.x, CELL.y + CELL.len * 0.32, PCB.z + 0.02 + CELL.r]}><cylinderGeometry args={[CELL.r + 0.002, CELL.r + 0.002, CELL.len * 0.36, 24, 1, true]} /></mesh>
                <mesh material={M.metal} position={[BODY.x, CELL.y + CELL.len / 2 + 0.012, PCB.z + 0.02 + CELL.r]}><cylinderGeometry args={[0.035, 0.035, 0.024, 12]} /></mesh>
                {[1, -1].map((sy) => (
                  <group key={sy} position={[BODY.x, CELL.y + sy * (CELL.len / 2 + 0.035), PCB.z + 0.02 + CELL.r]}>
                    <mesh material={M.metal}><boxGeometry args={[0.24, 0.018, 0.21]} /></mesh>
                    <mesh material={M.metal} position={[0, -sy * 0.07, -CELL.r - 0.004]}><boxGeometry args={[0.24, 0.16, 0.012]} /></mesh>
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
          <RoundedBox args={[MAG.w, MAG.len, MAG.d * 0.45]} radius={0.02} smoothness={4} position={[MAG_X, 0, MAG_Z - MAG.d * 0.275]} material={M.white} castShadow />
          <RoundedBox args={[MAG.w, MAG.len, MAG.d * 0.62]} radius={0.035} smoothness={5} position={[MAG_X, 0, MAG_Z + MAG.d * 0.19]} material={M.white} castShadow />
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
