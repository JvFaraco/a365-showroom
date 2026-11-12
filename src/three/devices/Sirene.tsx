import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { smoothLatheZ, stadiumGeometry, wire } from '../common/shapes'
import { DeviceCtx, bump, clamp01, explodeAmt, seg, useActionPhase, type DeviceProps } from '../common/util'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { SoundWaves } from '../fx/SoundWaves'
import { beep } from '../../ui/audio'

const LED_A = (-62 * Math.PI) / 180 // posição angular do LED na borda (embaixo, à direita)
const LIFT = 1.9 // quanto a sirene sobe para sair do suporte
// Ficha (1 unidade = 64 mm): cúpula de 128 mm de diâmetro; 60 mm de projeção da parede: a cúpula (~36)
// por cima de uma base traseira (~32), com sobreposição.
const DOME_BACK = -0.26 // borda de trás da cúpula
const BACK = 0.3 - 60 / 64 // face traseira da base (a que encosta no suporte)
const SUP_DZ = BACK + 0.277 // o suporte de parede acompanha a face traseira

/** Fundo do suporte: disco com furo grande deslocado e dois recortes triangulares. */
function supportFloor() {
  const s = new THREE.Shape()
  s.absarc(0, 0, 0.9, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0.24, 0.04, 0.3, 0, Math.PI * 2, true)
  const tri = (pts: [number, number][]) => { const p = new THREE.Path(); p.moveTo(...pts[0]); p.lineTo(...pts[1]); p.lineTo(...pts[2]); p.closePath(); return p }
  s.holes.push(hole, tri([[-0.2, 0.78], [0.2, 0.78], [0, 0.5]]), tri([[0.42, -0.6], [0.7, -0.42], [0.36, -0.36]]))
  return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 40 })
}

/**
 * Sirene: cúpula baixa com face plana (em +Z). A traseira tem o berço da bateria, o elemento
 * sonoro, a placa e o tamper circular; tudo isso fica coberto pelo suporte de parede. A sirene NÃO gira
 * para encaixar: desce de cima para baixo no suporte e trava com um clique; para tirar, sobe e sai.
 */
export function Sirene({ interactive = false, sounding }: DeviceProps & { sounding?: () => boolean }) {
  const body = useRef<THREE.Group>(null!)
  const shell = useRef<THREE.Group>(null!)
  const batt = useRef<THREE.Group>(null!)
  const plugRef = useRef<THREE.Group>(null!)
  const lever = useRef<THREE.Group>(null!)
  // face plana, chanfro largo e macio até a lateral, e a lateral descendo com leve conicidade
  const dome = useMemo(() => smoothLatheZ([[1.0, -0.25], [0.995, -0.18], [0.975, -0.02], [0.95, 0.1], [0.905, 0.2], [0.83, 0.265], [0.74, 0.296], [0.7, 0.3], [0.5, 0.3], [0.25, 0.3], [0.001, 0.3]], 128, 80), [])
  // aro do suporte: aberto em cima, que é por onde a sirene desce para encaixar
  const rim = useMemo(() => {
    const prof: [number, number][] = [[0.9, -0.63], [0.86, -0.45], [0.82, -0.29]], N = 72, a0 = (150 * Math.PI) / 180, a1 = (390 * Math.PI) / 180
    const pos: number[] = [], idx: number[] = []
    for (let i = 0; i <= N; i++) { const a = a0 + ((a1 - a0) * i) / N; for (const [r, z] of prof) pos.push(r * Math.cos(a), r * Math.sin(a), z) }
    for (let i = 0; i < N; i++) for (let j = 0; j < prof.length - 1; j++) { const a = i * prof.length + j, b = a + prof.length; idx.push(a, b, a + 1, a + 1, b, b + 1) }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
    return g
  }, [])
  const floor = useMemo(supportFloor, [])
  // base traseira: anel um pouco menor que a cúpula, que entra por baixo dela e vai até a face de trás
  const baseWall = useMemo(() => smoothLatheZ([[0.975, DOME_BACK + 0.12], [0.975, BACK + 0.1], [0.965, BACK + 0.03], [0.94, BACK]], 128, 24), [])
  const slit = useMemo(() => stadiumGeometry(15 / 64, 8 / 64, 0.008, 0.003), []) // guia de luz do LED: ~8 × 15 mm
  // tampa do tamper: disco em degraus (anéis concêntricos) com o miolo abaulado, virado para trás
  const tamperCap = useMemo(() => smoothLatheZ([[0.31, 0.0], [0.305, -0.03], [0.28, -0.04], [0.225, -0.042], [0.21, -0.07], [0.13, -0.075], [0.1, -0.1], [0.04, -0.115], [0.001, -0.118]], 64, 48), [])
  const tail = useMemo(() => {
    const sh = new THREE.Shape()
    // cauda pequena, embaixo (a sirene vai na parede com a cauda e o LED para o chão)
    sh.moveTo(0.34, -0.86); sh.quadraticCurveTo(0.2, -1.0, 0.15, -1.08); sh.quadraticCurveTo(0, -1.13, -0.15, -1.08); sh.quadraticCurveTo(-0.2, -1.0, -0.34, -0.86); sh.closePath()
    return new THREE.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 16 })
  }, [])
  const piezo = useMemo(() => smoothLatheZ([[0.04, 0.06], [0.2, 0.06], [0.225, 0.05], [0.23, 0.03], [0.23, -0.04], [0.22, -0.05], [0.001, -0.05]], 48, 24), [])
  const board = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-0.72, 0.22); sh.lineTo(-0.24, 0.22); sh.lineTo(-0.24, 0.1); sh.lineTo(-0.14, 0.1); sh.lineTo(-0.14, -0.42); sh.lineTo(-0.5, -0.42); sh.lineTo(-0.74, -0.05); sh.closePath()
    return new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false })
  }, [])
  const antenna = useMemo(() => wire([[-0.7, 0.2, -0.175], [-0.72, 0.4, -0.12], [-0.55, 0.62, -0.06], [-0.2, 0.72, -0.02], [0.2, 0.68, 0.0]], 0.01), [])
  const piezoWireA = useMemo(() => wire([[0.0, -0.44, -0.09], [-0.12, -0.5, -0.13], [-0.25, -0.46, -0.17], [-0.3, -0.38, -0.178]], 0.009), [])
  const piezoWireB = useMemo(() => wire([[0.02, -0.4, -0.09], [-0.1, -0.44, -0.13], [-0.2, -0.42, -0.17], [-0.24, -0.36, -0.178]], 0.009), [])
  const whiteDS = useMemo(() => { const m = M.white.clone(); m.side = THREE.DoubleSide; return m }, [])
  const ringMat = useMemo(() => fxBasic('#8fb4ff', 0), [])
  const sparkMat = useMemo(() => fxBasic('#fff3b0', 0), [])
  const clicPhase = useActionPhase('encaixe', [2.6])
  // clique curto quando a sirene assenta no suporte (o beep respeita o botão de som)
  useEffect(() => { if (clicPhase === 0) beep('click') }, [clicPhase])

  const isOn = () => (sounding ? sounding() : interactive && useShowroom.getState().sirenOn)
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
    // no fim da descida, um pequeno assentamento para baixo
    body.current.position.set(0, away * LIFT - settle * 0.03, 0)
    body.current.rotation.set(0, flip * Math.PI, 0)
    ringMat.opacity = te < 0 ? 0 : bump(te, 2.6, 2.7, 2.9, 3.7)
    plugRef.current.position.z = -(tb < 0 ? 0 : seg(tb, 2.2, 2.8)) * 0.14
    sparkMat.opacity = tb < 0 ? 0 : bump(tb, 2.3, 2.4, 2.45, 2.7)
    const out = tb < 0 ? 0 : seg(tb, 3.0, 3.8)
    batt.current.position.set(0, out * 0.1, -out * 0.55)
    // tamper: pressionado pelo suporte; solta quando a sirene se desprende dele
    const free = clamp01(Math.max(away * 5, explodeAmt.v * 4))
    lever.current.position.z = -free * 0.045
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'sirene', interactive }}>
      <group ref={body}>
        <ClickablePart id="corpo">
          <group ref={shell}>
            <mesh geometry={dome} material={M.white} castShadow />
            {/* linha de partição entre a face e o corpo, e o mesmo símbolo do módulo em sulcos finos */}
            <mesh material={M.partition} position={[0, 0, 0.2985]} scale={[1, 1, 0.3]}><torusGeometry args={[0.715, 0.006, 6, 128]} /></mesh>
            <mesh material={M.partition} position={[0, 0, -0.235]}><torusGeometry args={[0.997, 0.006, 6, 128]} /></mesh>
            <LogoGroove r={0.3} position={[0, 0.02, 0.3005]} />
          </group>
        </ClickablePart>
        {/* LED pequeno no chanfro da frente, do lado de baixo (fica voltado para o chão): azul; vermelho ao tocar */}
        <ClickablePart id="led">
          <group rotation={[0, 0, LED_A + Math.PI / 2]}>
            <group position={[0, -0.868, 0.238]} rotation={[0.72, 0, 0]}>
              <mesh geometry={slit} material={M.frosted} />
              <Led sample={(t, o) => { const on = isOn(); o.color = on ? '#ff2a2a' : '#3d7bff'; o.on = on ? (t % 0.3 < 0.15 ? 1 : 0.05) : 0.14 }} position={[0, 0, 0.008]}>
                <boxGeometry args={[0.12, 0.05, 0.004]} />
              </Led>
            </group>
          </group>
        </ClickablePart>

        {/* base traseira, com a cauda pequena embaixo: fecha a sirene por trás; tem os rasgos do encaixe e os ganchos */}
        <ClickablePart follow="corpo" explode={[0, 0, -0.5]}>
          <mesh geometry={baseWall} material={whiteDS} castShadow />
          <mesh geometry={tail} material={M.white} position={[0, 0, BACK + 0.04]} />
          <mesh material={M.white} position={[0, 0, BACK + 0.027]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.94, 0.94, 0.05, 64]} /></mesh>
          <mesh material={M.grey} position={[-0.03, 0.45, BACK]}><boxGeometry args={[0.98, 0.44, 0.006]} /></mesh>
          <mesh material={M.white} position={[-0.03, 0.7, BACK - 0.03]}><boxGeometry args={[0.2, 0.08, 0.06]} /></mesh>
          <mesh material={M.white} position={[0.05, 0.2, BACK - 0.03]}><boxGeometry args={[0.16, 0.06, 0.06]} /></mesh>
          {[[0.2, 0.73], [-0.86, 0.19], [0.7, -0.41], [-0.78, -0.42]].map(([x, y], i) => (
            <mesh key={i} material={M.hole} position={[x, y, BACK]}><boxGeometry args={[0.09, 0.09, 0.006]} /></mesh>
          ))}
          {/* etiqueta lisa, sem texto */}
          <mesh material={M.whiteRelief} position={[0.66, 0.42, BACK - 0.001]}><boxGeometry args={[0.13, 0.32, 0.004]} /></mesh>
          <mesh material={M.whiteRelief} position={[0.63, -0.12, BACK - 0.02]}><boxGeometry args={[0.03, 0.12, 0.04]} /></mesh>
          <mesh material={M.whiteRelief} position={[0.67, -0.18, BACK - 0.02]}><boxGeometry args={[0.1, 0.03, 0.04]} /></mesh>
        </ClickablePart>

        {/* tamper: botão circular no centro da traseira (anéis concêntricos); salta quando a sirene sai do suporte */}
        <ClickablePart id="tamper">
          <group position={[0.2, -0.42, 0]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} material={M.grey} position={[0, 0, BACK - 0.004]} rotation={[0, 0, i * 2.1 + 0.3]}><torusGeometry args={[0.37, 0.014, 8, 24, 1.7]} /></mesh>
            ))}
            <group ref={lever}>
              <mesh geometry={tamperCap} material={M.white} position={[0, 0, BACK]} />
            </group>
          </group>
        </ClickablePart>

        {/* por dentro: o elemento sonoro é uma pastilha branca redonda com um furo no centro */}
        <ClickablePart id="elemento-sonoro">
          <group position={[0.2, -0.42, 0]}>
            <mesh geometry={piezo} material={M.white} position={[0, 0, -0.06]} />
            <mesh material={M.hole} position={[0, 0, 0.0005]}><circleGeometry args={[0.04, 20]} /></mesh>
          </group>
        </ClickablePart>
        <ClickablePart id="bateria">
          <group ref={batt}>
            <group position={[-0.03, 0.45, BACK - 0.02]} rotation={[0, 0, Math.PI / 2]}>
              <mesh material={M.black}><cylinderGeometry args={[0.15, 0.15, 0.86, 28]} /></mesh>
              <mesh material={M.orange} position={[0, 0.04, 0]}><cylinderGeometry args={[0.152, 0.152, 0.5, 28, 1, true, 2.2, 1.1]} /></mesh>
            </group>
          </group>
        </ClickablePart>
        <ClickablePart id="placa">
          <mesh material={M.pcb} position={[-0.43, 0.06, BACK - 0.008]}><boxGeometry args={[0.2, 0.34, 0.016]} /></mesh>
          {/* a placa inteira fica por dentro: contorno em cunha, chips, antena de fio preto e os dois fios brancos do elemento sonoro */}
          <mesh geometry={board} material={M.pcb} position={[0, 0, -0.2]} />
          <mesh material={M.chip} position={[-0.45, -0.12, -0.165]}><boxGeometry args={[0.14, 0.14, 0.02]} /></mesh>
          <mesh material={M.chip} position={[-0.3, -0.26, -0.168]}><boxGeometry args={[0.09, 0.09, 0.016]} /></mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} material={M.gold} position={[-0.16, 0.0 - i * 0.045, -0.172]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.006, 8]} /></mesh>)}
          <mesh geometry={antenna} material={M.chip} />
          <mesh geometry={piezoWireA} material={M.white} />
          <mesh geometry={piezoWireB} material={M.white} />
          <mesh material={M.chip} position={[-0.43, 0.02, BACK - 0.024]}><boxGeometry args={[0.07, 0.07, 0.016]} /></mesh>
          <group ref={plugRef}>
            <mesh material={M.white} position={[-0.43, 0.19, BACK - 0.03]}><boxGeometry args={[0.09, 0.06, 0.04]} /></mesh>
            <mesh material={M.red} position={[-0.485, 0.31, BACK - 0.04]}><cylinderGeometry args={[0.01, 0.01, 0.24, 6]} /></mesh>
            <mesh material={M.black} position={[-0.505, 0.31, BACK - 0.04]}><cylinderGeometry args={[0.01, 0.01, 0.24, 6]} /></mesh>
          </group>
        </ClickablePart>

        <SoundWaves level={level} position={[0, 0, 0.36]} count={5} maxRadius={1.9} />
        <mesh material={ringMat} position={[0, 0, -0.2]} userData={{ fx: true }} raycast={() => null}><torusGeometry args={[1.02, 0.022, 8, 96]} /></mesh>
        <mesh material={sparkMat} position={[-0.43, 0.19, BACK - 0.12]} userData={{ fx: true }} raycast={() => null}><sphereGeometry args={[0.05, 12, 8]} /></mesh>
      </group>

      {/* suporte de parede: prato com furo grande, canal vertical, recortes e travas do encaixe */}
      <ClickablePart id="suporte">
        <group position={[0, 0, SUP_DZ]}>
          <mesh geometry={rim} material={whiteDS} castShadow />
          <mesh geometry={floor} material={whiteDS} position={[0, 0, -0.63]} />
          <mesh material={M.whiteRelief} position={[-0.42, -0.02, -0.54]}><boxGeometry args={[0.22, 0.95, 0.14]} /></mesh>
          {[[0.62, 0.36], [-0.62, 0.36], [0.2, -0.7], [-0.2, 0.36]].map(([x, y], i) => (
            <mesh key={i} material={M.whiteRelief} position={[x, y, -0.55]}><boxGeometry args={[0.05, 0.1, 0.12]} /></mesh>
          ))}
          {[[0.6, -0.1], [-0.68, -0.3]].map(([x, y], i) => (
            <mesh key={i} material={M.metal} position={[x, y, -0.59]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 0.02, 12]} /></mesh>
          ))}
        </group>
      </ClickablePart>

      {interactive && clicPhase >= 0 && (
        <Html position={[0, 1.3, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="fx-tag rounded-full bg-ok px-4 py-1.5 text-sm font-bold text-[#05210c]">Clic! Travada no suporte</div>
        </Html>
      )}
    </DeviceCtx.Provider>
  )
}
