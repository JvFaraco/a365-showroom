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
// Medidas externas (1 unidade = 49,5 mm): corpo de 92,6 de comprimento × 24 de altura da face × 27,6 de espessura;
// ímã de 92,3 × 11 × 15; vão de 7 mm na montagem (o card diz "máximo 1 cm").
const mm = (v: number) => v / 49.5
const BODY = { w: mm(24), len: mm(92.6), d: mm(27.6), x: -mm(9.5) }
const MAG = { w: mm(11), len: mm(92.3), d: mm(15), gap: mm(7) }
const LED_Y = mm(18) // janela do LED: a 18 mm do meio, do lado da tampinha
const BZ = 0.04, FRONT = BZ + BODY.d / 2, BACK = BZ - BODY.d / 2 // centro, frente e costas do corpo em Z
const SPLIT = BACK + BODY.d * 0.42 // emenda entre a base (atrás) e a tampa (na frente)
const MAG_X = BODY.x + BODY.w / 2 + MAG.gap + MAG.w / 2
const MAG_Z = BACK + MAG.d / 2 // as costas das duas peças no mesmo plano
export const DOOR_TOP = BODY.x + BODY.w / 2 + MAG.gap / 2 // o topo da folha passa no meio do vão
export const HINGE_X = 1.85 // o sensor fica no canto de cima da folha, do lado que abre
const MINI: [number, number, number] = [-2.0, 1.05, 1.0]
// Por dentro (pela foto da placa). Ao longo do comprimento (Y): a tampinha e o borne ficam na ponta do LED (+Y); a
// antena em mola sai da outra ponta da placa (−Y) e ocupa o resto do corpo.
const CAP_Y = BODY.len / 2 - mm(12.8) // emenda da tampinha da ponta (a ~13 mm dela)
const PCB = { len: mm(74), w: mm(19), y: BODY.len / 2 - mm(3) - mm(74) / 2, z: -0.1 }
const PCB_END = PCB.y - PCB.len / 2 // borda da placa do lado da antena
const CELL = { r: mm(5.2), len: mm(43), y: PCB.y - mm(1) } // pilha cilíndrica, deitada sobre a placa, entre as duas presilhas

/** Retângulo de cantos redondos centrado (contorno de casca). */
function rrect(w: number, h: number, r: number, hole = false) {
  const s = hole ? new THREE.Path() : new THREE.Shape(), x = w / 2 - r, y = h / 2 - r
  if (hole) { s.absarc(x, -y, r, -Math.PI / 2, 0, false); s.absarc(x, y, r, 0, Math.PI / 2, false); s.absarc(-x, y, r, Math.PI / 2, Math.PI, false); s.absarc(-x, -y, r, Math.PI, Math.PI * 1.5, false) }
  else { s.absarc(x, y, r, 0, Math.PI / 2, false); s.absarc(-x, y, r, Math.PI / 2, Math.PI, false); s.absarc(-x, -y, r, Math.PI, Math.PI * 1.5, false); s.absarc(x, -y, r, Math.PI * 1.5, Math.PI * 2, false) }
  return s
}
/** Paredes de uma casca: anel de espessura `t` em volta do contorno, extrudado de z0 a z1. */
function shellWalls(w: number, h: number, r: number, t: number, z0: number, z1: number) {
  const sh = rrect(w, h, r) as THREE.Shape
  sh.holes.push(rrect(w - 2 * t, h - 2 * t, Math.max(0.004, r - t), true) as THREE.Path)
  const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 6 })
  g.translate(0, 0, z0)
  return g
}
const WALL_T = mm(2.2), FLOOR_T = mm(2) // paredes e fundo das duas cascas (medidas externas; por dentro, aproximado)
// Ímã: base de 5 mm (presa no batente) e tampa por cima. Por dentro da base, nervuras atravessadas; o ímã fica
// deitado sobre elas.
const MB = BACK, MAG_SEAM = mm(5.1)
let magGeo: ReturnType<typeof buildMag> | null = null
function buildMag() {
  const ribs = [-35.6, -25.6, -15.5, -5.2, 5.2, 15.5, 25.6, 35.6].map((y): Block => [0, mm(y), MB + mm(3.1), MAG.w - 2 * mm(2.1), mm(1), mm(2.4)])
  return {
    baseWalls: shellWalls(MAG.w, MAG.len, mm(1.2), mm(2.1), MB + mm(1), MB + MAG_SEAM),
    tongue: shellWalls(MAG.w - mm(2), MAG.len - mm(6), mm(0.8), mm(1), MB + MAG_SEAM - 0.001, MB + mm(10)),
    inside: boxesGeometry(ribs),
    coverWalls: shellWalls(MAG.w, MAG.len, mm(1.2), mm(1), MB + MAG_SEAM + mm(0.1), MB + mm(13.5)),
    coverInner: shellWalls(MAG.w - mm(2), MAG.len - mm(2), mm(0.8), mm(1.1), MB + mm(10.1), MB + mm(13.5)),
    // linha da emenda: só um aro fino na borda (uma chapa cheia tamparia o miolo na vista explodida)
    seam: shellWalls(MAG.w + 0.004, MAG.len + 0.004, mm(1.3), mm(0.8), MB + MAG_SEAM - 0.005, MB + MAG_SEAM + 0.005),
  }
}

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
  const mg = (magGeo ??= buildMag())
  const door = useRef<THREE.Group>(null!)
  // anel em volta da janela do LED, por dentro da tampa (guia de luz)
  const ledPipe = useMemo(() => {
    // oval deitado, como a janela: mais comprido na largura da face
    const sh = new THREE.Shape(); const o = mm(4), i = mm(2.4), hx = mm(2.2)
    sh.absarc(hx, 0, o, -Math.PI / 2, Math.PI / 2, false); sh.absarc(-hx, 0, o, Math.PI / 2, Math.PI * 1.5, false)
    const hole = new THREE.Path(); hole.absarc(-hx, 0, i, Math.PI * 1.5, Math.PI / 2, true); hole.absarc(hx, 0, i, Math.PI / 2, -Math.PI / 2, true); sh.holes.push(hole)
    return new THREE.ExtrudeGeometry(sh, { depth: mm(4), bevelEnabled: false, curveSegments: 12 })
  }, [])
  const slit = useMemo(() => stadiumGeometry(mm(8), mm(3.9), 0.01, 0.003), [])
  // emenda da tampinha: um aro fino com o mesmo perfil arredondado da tampa
  const capSeam = useMemo(() => roundedRectGeometry(BODY.w + 0.004, FRONT - SPLIT + 0.1 + 0.004, 0.047, 0.01, 0), [])
  // cena da porta (só nas ações): canto de cima de uma porta de madeira com almofada, no vão de uma parede clara com
  // batente branco; o ímã fica no batente de cima
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a4e', roughness: 0.7 }), [])
  const doorDark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6f533c', roughness: 0.75 }), [])
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c3c7cf', roughness: 0.95 }), [])
  const doorPanel = useMemo(() => {
    const x0 = HINGE_X - 2.55, x1 = HINGE_X - 0.35, y0 = DOOR_TOP - 4.1, y1 = DOOR_TOP - 0.5, z = -0.16, t = 0.07
    return boxesGeometry([[(x0 + x1) / 2, y1, z, x1 - x0, t, 0.025], [(x0 + x1) / 2, y0, z, x1 - x0, t, 0.025], [x0, (y0 + y1) / 2, z, t, y1 - y0, 0.025], [x1, (y0 + y1) / 2, z, t, y1 - y0, 0.025]])
  }, [])
  const jambs = useMemo(() => boxesGeometry([
    [HINGE_X - 1.45, DOOR_TOP + 0.36, -0.155, 2.9 + 0.84 + 0.06, 0.5, 0.03], // batente de cima (onde fica o ímã)
    [HINGE_X - 2.93 - 0.21, DOOR_TOP - 2.0, -0.155, 0.42, 4.2, 0.03], // lado da fechadura
    [HINGE_X + 0.03 + 0.21, DOOR_TOP - 2.0, -0.155, 0.42, 4.2, 0.03], // lado da dobradiça
  ]), [])
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
  // as duas metades do corpo são cascas finas: a base (atrás, presa à porta) e a tampa (na frente)
  const shells = useMemo(() => {
    const capD = 0.1
    return {
      baseWalls: shellWalls(BODY.w, BODY.len, 0.03, WALL_T, BACK + FLOOR_T, SPLIT),
      coverWalls: shellWalls(BODY.w, BODY.len, 0.045, WALL_T, SPLIT - 0.1, FRONT - capD + 0.046),
      // linha da emenda: aro fino na borda, não chapa cheia (senão tampa o miolo da base na vista explodida)
      seam: shellWalls(BODY.w + 0.004, BODY.len + 0.004, 0.032, mm(1), SPLIT - 0.006, SPLIT + 0.006),
      capD,
    }
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

  // LED: azul fraco em repouso; quando a porta abre (ou a batida dispara), pisca em azul forte
  const sampleLed = (t: number, o: { color: string; on: number }) => {
    const on = interactive ? alarmOn() : (open?.() ?? 0) > 0.08
    o.color = '#3d7bff'; o.on = on ? (t % 0.4 < 0.2 ? 1 : 0) : 0 // apagado em repouso; pisca forte ao detectar
  }

  return (
    <DeviceCtx.Provider value={{ deviceId: 'magnetico', interactive }}>
      {/* a folha da porta gira na dobradiça (eixo vertical) e leva o corpo do sensor junto */}
      <group position={[HINGE_X, 0, -0.3]}>
        <group ref={door}>
          <group position={[-HINGE_X, 0, 0.3]}>
            {/* corpo em duas peças: a base (atrás, presa à porta) e a tampa (na frente), com a emenda entre elas */}
            <ClickablePart follow="corpo" explode={[0, 0, 0]}>
              <group rotation={DEITA}>
                {/* base: fundo e paredes; por dentro, o ressalto em cruz, as guias da placa, a divisória da ponta, o rasgo e o
                    furo dos parafusos de fixação na porta */}
                <RoundedBox args={[BODY.w, BODY.len, FLOOR_T]} radius={0.012} smoothness={2} position={[BODY.x, 0, BACK + FLOOR_T / 2]} material={M.white} castShadow />
                <mesh geometry={shells.baseWalls} material={M.white} position={[BODY.x, 0, 0]} castShadow />
                <group position={[BODY.x, 0, BACK + FLOOR_T]}>
                  {[[0, mm(5)], [mm(5), 0]].map(([w, h], i) => <mesh key={i} material={M.white} position={[BODY.w / 2 - WALL_T - mm(5), mm(-24.5), mm(1)]}><boxGeometry args={[w + mm(2), h + mm(2), mm(2)]} /></mesh>)}
                  <mesh material={M.white} position={[0, mm(-22.5), mm(0.8)]}><boxGeometry args={[mm(6), mm(1.6), mm(1.6)]} /></mesh>
                  <mesh material={M.white} position={[0, mm(35.5), mm(3)]}><boxGeometry args={[BODY.w - 2 * WALL_T, mm(1.6), mm(6)]} /></mesh>
                  <mesh material={M.hole} position={[0, mm(31.5), 0.001]} rotation={[0, 0, Math.PI / 2]}><planeGeometry args={[mm(13), mm(3)]} /></mesh>
                  {/* pino que aperta o anti-sabotagem da placa (pelo CAD: a 39 mm do meio, do lado do LED) */}
                  <mesh material={M.white} position={[0, mm(39), (PCB.z - 0.045 - (BACK + FLOOR_T)) / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(1.7), mm(1.7), PCB.z - 0.045 - (BACK + FLOOR_T), 12]} /></mesh>
                  <mesh material={M.hole} position={[0, mm(39), 0.001]}><circleGeometry args={[mm(2.6), 16]} /></mesh>
                  <mesh material={M.metal} position={[0, mm(39), mm(0.6)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(2.2), mm(2.2), mm(1.2), 16]} /></mesh>
                  {[-11.5, 25.5].flatMap((y) => [-1, 1].map((sx) => (
                    <mesh key={`${y}${sx}`} material={M.white} position={[sx * (BODY.w / 2 - WALL_T - mm(0.8)), mm(y), mm(3)]}><boxGeometry args={[mm(1.6), mm(2.5), mm(6)]} /></mesh>
                  )))}
                </group>
                <mesh geometry={shells.seam} material={M.partition} position={[BODY.x, 0, 0]} />
              </group>
            </ClickablePart>
            <ClickablePart id="corpo">
              <group rotation={DEITA}>
                {/* tampa: frente arredondada e paredes ocas; por dentro, o anel da luz do LED e o apoio da placa */}
                <RoundedBox args={[BODY.w, BODY.len, shells.capD]} radius={0.045} smoothness={5} position={[BODY.x, 0, FRONT - shells.capD / 2]} material={M.white} castShadow />
                <mesh geometry={shells.coverWalls} material={M.white} position={[BODY.x, 0, 0]} castShadow />
                <group position={[BODY.x, 0, FRONT - shells.capD]} rotation={[Math.PI, 0, 0]}>
                  <mesh geometry={ledPipe} material={M.white} position={[0, -LED_Y, 0]} />
                  <mesh material={M.white} position={[0, mm(31.5), mm(4)]}><boxGeometry args={[mm(5), mm(2), mm(8)]} /></mesh>
                </group>
                {/* logo em relevo, no meio do comprimento */}
                <LogoGroove r={0.12} position={[BODY.x, 0, FRONT + 0.0005]} />
                {/* emenda da tampinha da ponta: dá a volta na frente e nos dois lados */}
                <mesh geometry={capSeam} material={M.partition} position={[BODY.x, CAP_Y, (FRONT + SPLIT - 0.1) / 2]} rotation={[Math.PI / 2, 0, 0]} />
              </group>
            </ClickablePart>
            {/* janela do LED: pequena (~8 × 4 mm), atravessada na face, entre o logo e a tampinha da ponta */}
            <ClickablePart id="led">
              <group rotation={DEITA}>
                <mesh geometry={slit} material={M.blackGloss} position={[BODY.x, LED_Y, FRONT - 0.007]} />
                {/* o LED em si: ponto pequeno e forte no meio da janela (como o do módulo); a janela fica escura */}
                <Led on="shell" sample={sampleLed} boost={12} spread={2.4} baseColor="#14161b" position={[BODY.x, LED_Y, FRONT + 0.0035]}><circleGeometry args={[0.03, 24]} /></Led>
              </group>
            </ClickablePart>
            {/* placa eletrônica: comprida e estreita (~74 × 19 mm). Numa ponta, o borne preto de 2 parafusos, no canto; da
                outra sai a mola de cobre da antena, para fora da placa. Verde liso, sem etiqueta */}
            <ClickablePart id="placa">
              <group rotation={DEITA}>
                <mesh material={M.pcb} position={[BODY.x, PCB.y, PCB.z]}><boxGeometry args={[PCB.w, PCB.len, 0.022]} /></mesh>
                {/* o LED de verdade fica na placa, embaixo da janela; com o aparelho explodido, é ele que acende */}
                <Led on="board" sample={sampleLed} position={[BODY.x, LED_Y, PCB.z + 0.016]}><boxGeometry args={[0.06, 0.035, 0.012]} /></Led>
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
            {/* anti-sabotagem: micro-chave atrás da placa, perto da ponta do LED, apertada pelo pino da base (pelo CAD) */}
            <ClickablePart id="tamper">
              <group rotation={DEITA}>
                <mesh material={M.chip} position={[BODY.x, mm(39), PCB.z - 0.011 - 0.012]}><boxGeometry args={[mm(6), mm(6), 0.024]} /></mesh>
                <mesh material={M.greyDark} position={[BODY.x, mm(39), PCB.z - 0.011 - 0.024 - 0.01]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[mm(1.3), mm(1.3), 0.02, 12]} /></mesh>
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
              <mesh geometry={doorPanel} material={doorDark} userData={{ fx: true }} raycast={() => null} />
            </group>
          </group>
        </group>
      </group>

      {/* ímã: fica parado no batente, acima do corpo, paralelo e alinhado no comprimento. Tampa (na frente) e base
          (atrás, 5 mm), com a emenda; explodido, a tampa sai e mostra a base por dentro */}
      <ClickablePart id="ima">
        <group rotation={DEITA}>
          <RoundedBox args={[MAG.w, MAG.len, mm(3)]} radius={mm(1)} smoothness={4} position={[MAG_X, 0, MB + mm(13.5)]} material={M.white} castShadow />
          <mesh geometry={mg.coverWalls} material={M.white} position={[MAG_X, 0, 0]} castShadow />
          <mesh geometry={mg.coverInner} material={M.white} position={[MAG_X, 0, 0]} />
        </group>
      </ClickablePart>
      <ClickablePart follow="ima" explode={[0, 0.42, 0]}>
        <group rotation={DEITA}>
          <RoundedBox args={[MAG.w, MAG.len, mm(1.9)]} radius={mm(0.8)} smoothness={2} position={[MAG_X, 0, MB + mm(0.95)]} material={M.white} castShadow />
          <mesh geometry={mg.baseWalls} material={M.white} position={[MAG_X, 0, 0]} castShadow />
          <mesh geometry={mg.tongue} material={M.white} position={[MAG_X, 0, 0]} />
          <mesh geometry={mg.inside} material={M.white} position={[MAG_X, 0, 0]} />
          <mesh geometry={mg.seam} material={M.partition} position={[MAG_X, 0, 0]} />
        </group>
      </ClickablePart>
      {/* o ímã em si: barra cinza deitada sobre as nervuras, no meio do comprimento (posição aproximada) */}
      <ClickablePart follow="ima" internal explode={[0, 0.42, 0]}>
        <group rotation={DEITA}>
          <mesh material={M.cell} position={[MAG_X, 0, MB + mm(6.8)]}><boxGeometry args={[mm(5.4), mm(30), mm(5)]} /></mesh>
        </group>
      </ClickablePart>

      {interactive && (
        <>
          {/* batente: a parede em cima e dos lados da folha */}
          <group visible={sceneOn}>
            <mesh material={wallMat} position={[HINGE_X - 1.45, DOOR_TOP + 0.03 + 1.7, -0.26]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[12, 3.4, 0.18]} /></mesh>
            <mesh material={wallMat} position={[HINGE_X - 2.93 - 2.25, DOOR_TOP - 2.2, -0.26]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[4.5, 4.46, 0.18]} /></mesh>
            <mesh material={wallMat} position={[HINGE_X + 0.03 + 2.25, DOOR_TOP - 2.2, -0.26]} userData={{ fx: true }} raycast={() => null}><boxGeometry args={[4.5, 4.46, 0.18]} /></mesh>
            <mesh geometry={jambs} material={M.white} userData={{ fx: true }} raycast={() => null} />
          </group>
          <group rotation={DEITA}>
            <MagneticField position={[BODY.x + BODY.w / 2, 0, 0.05]} gap={MAG.gap} height={1.5} strength={() => (sceneOn ? Math.max(0, 1 - doorOpen() * 6) : 0)} />
          </group>
          {sceneOn && (
            <>
              <MiniModulo position={MINI} led={() => (alarmOn() ? 'disparo' : 'armado')} />
              <RadioPulse from={[-LED_Y, BODY.x, FRONT + 0.03]} to={MINI} on={alarmOn} />
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
