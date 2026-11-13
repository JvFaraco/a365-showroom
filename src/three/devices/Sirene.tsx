import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { latheZ, smoothLatheZ, stadiumGeometry, wire } from '../common/shapes'
import { DeviceCtx, bump, clamp01, explodeAmt, seg, useActionPhase, type DeviceProps } from '../common/util'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { SoundWaves } from '../fx/SoundWaves'
import { beep } from '../../ui/audio'

const TAMPER: [number, number] = [-0.5, 0.0] // micro-chave do anti-sabotagem (à direita, vista por trás)
const LIFT = 1.9 // quanto a sirene sobe para sair do suporte
// Ficha (1 unidade = 64 mm): 128 mm de diâmetro e 60 mm de projeção da parede.
const FACE_Z = 0.3 // face da frente
const WALL = FACE_Z - 60 / 64 // plano da parede: a borda de trás do corpo chega até aqui
const BACK = WALL + 0.15 // placa traseira: fica recuada dentro da borda, e o suporte de parede cabe nesse recuo
const FACE_R = 0.7 // raio da face plana (~90 mm de diâmetro)
const LED_Y = -0.57 // LED na face, perto da borda, centralizado embaixo (às 6 horas): fica voltado para o chão

/**
 * Perfil do corpo, visto de cima: NÃO é uma cúpula. É um copo numa peça só, sem emenda no meio: face plana, quina
 * curta e marcada, barriga que abre rápido até a largura total e daí segue reta até a parede. A borda de trás
 * dobra para dentro e forma o recuo que esconde o suporte. Pontos [raio, z], de trás para a frente.
 */
function shellProfile(): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= 6; i++) pts.push([Math.max(0.001, (FACE_R * i) / 6), FACE_Z])
  const RS = 0.05, A = Math.PI / 4 // quina da face: arco curto de 45°
  for (let i = 1; i <= 6; i++) { const a = (A * i) / 6; pts.push([FACE_R + RS * Math.sin(a), FACE_Z - RS * (1 - Math.cos(a))]) }
  // barriga: sai tangente à quina e chega reta na largura total
  const [sr, sz] = pts[pts.length - 1], RMAX = 0.992, zBelly = -0.2
  const cz = sz - ((RMAX - sr) / Math.cos(A)) * Math.sin(A)
  for (let i = 1; i <= 18; i++) {
    const k = i / 18, a = (1 - k) * (1 - k), m = 2 * k * (1 - k), c = k * k
    pts.push([a * sr + m * RMAX + c * RMAX, a * sz + m * cz + c * zBelly])
  }
  // lateral reta até a parede; a borda arredonda e volta para dentro até a placa traseira
  pts.push([RMAX, WALL + 0.03], [RMAX - 0.006, WALL + 0.008], [0.972, WALL], [0.955, WALL + 0.006], [0.95, BACK + 0.002])
  return pts.reverse()
}
// o suporte de parede é raso (escala em Z) e fica inteiro dentro do recuo da traseira: de lado e de cima, não aparece
const SUP_S = 0.42
const SUP_DZ = BACK + 0.277 * SUP_S // o suporte de parede acompanha a face traseira

/** Fundo do suporte: disco com furo grande deslocado e dois recortes triangulares. */
function supportFloor() {
  const s = new THREE.Shape()
  s.absarc(0, 0, 0.9, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0.24, 0.04, 0.3, 0, Math.PI * 2, true)
  const tri = (pts: [number, number][]) => { const p = new THREE.Path(); p.moveTo(...pts[0]); p.lineTo(...pts[1]); p.lineTo(...pts[2]); p.closePath(); return p }
  void tri // sem recortes triangulares: por fora, de lado, o suporte é liso
  s.holes.push(hole)
  return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 40 })
}

/**
 * Sirene: copo com a face plana na frente (em +Z) e a lateral abrindo até a parede. A traseira tem o berço da bateria, o elemento
 * sonoro, a placa e o tamper circular; tudo isso fica coberto pelo suporte de parede. A sirene NÃO gira
 * para encaixar: desce de cima para baixo no suporte e trava com um clique; para tirar, sobe e sai.
 */
export function Sirene({ interactive = false, sounding }: DeviceProps & { sounding?: () => boolean }) {
  const body = useRef<THREE.Group>(null!)
  const shell = useRef<THREE.Group>(null!)
  const batt = useRef<THREE.Group>(null!)
  const plugRef = useRef<THREE.Group>(null!)
  const lever = useRef<THREE.Group>(null!)
  // corpo: face plana, ombro e lateral numa peça só (perfil exato, sem spline)
  const dome = useMemo(() => latheZ(shellProfile(), 128), [])
  // aro do suporte: raso e fechado; fica escondido atrás da base
  const rim = useMemo(() => {
    const prof: [number, number][] = [[0.9, -0.63], [0.86, -0.45], [0.82, -0.29]], N = 72, a0 = 0, a1 = Math.PI * 2
    const pos: number[] = [], idx: number[] = []
    for (let i = 0; i <= N; i++) { const a = a0 + ((a1 - a0) * i) / N; for (const [r, z] of prof) pos.push(r * Math.cos(a), r * Math.sin(a), z) }
    for (let i = 0; i < N; i++) for (let j = 0; j < prof.length - 1; j++) { const a = i * prof.length + j, b = a + prof.length; idx.push(a, b, a + 1, a + 1, b, b + 1) }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
    return g
  }, [])
  const floor = useMemo(supportFloor, [])
  const slit = useMemo(() => stadiumGeometry(0.13, 0.048, 0.004, 0.002), []) // janela do LED na face: ~9 × 3,5 mm
  const lens = useMemo(() => { const m = M.crystal.clone(); m.opacity = 0.2; return m }, []) // lente fina: deixa a cor do LED passar
  // tampa do tamper: disco em degraus (anéis concêntricos) com o miolo abaulado, virado para trás
  const tamperCap = useMemo(() => smoothLatheZ([[0.31, 0.0], [0.305, -0.03], [0.28, -0.04], [0.225, -0.042], [0.21, -0.07], [0.13, -0.075], [0.1, -0.1], [0.04, -0.115], [0.001, -0.118]], 64, 48), [])
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
    // sai um pouco da parede (o suporte fica dentro do recuo da traseira) e sobe; no fim da descida, um pequeno assentamento
    body.current.position.set(0, away * LIFT - settle * 0.03, Math.min(1, away * 6) * 0.17)
    body.current.rotation.set(0, flip * Math.PI, 0)
    ringMat.opacity = te < 0 ? 0 : bump(te, 2.6, 2.7, 2.9, 3.7)
    plugRef.current.position.z = -(tb < 0 ? 0 : seg(tb, 2.2, 2.8)) * 0.14
    sparkMat.opacity = tb < 0 ? 0 : bump(tb, 2.3, 2.4, 2.45, 2.7)
    const out = tb < 0 ? 0 : seg(tb, 3.0, 3.8)
    batt.current.position.set(0, out * 0.1, -out * 0.55)
    // tamper: pressionado pelo suporte; solta quando a sirene se desprende dele
    const free = clamp01(Math.max(away * 5, explodeAmt.v * 4))
    // o botão da micro-chave: apertado pelo suporte; solto, sobe ~1 mm
    lever.current.position.z = -free * 0.016
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'sirene', interactive }}>
      <group ref={body}>
        <ClickablePart id="corpo">
          <group ref={shell}>
            <mesh geometry={dome} material={M.white} castShadow />
            {/* o mesmo símbolo do módulo em sulcos finos, no centro da face */}
            <LogoGroove r={0.26} position={[0, 0.02, FACE_Z + 0.004]} />
          </group>
        </ClickablePart>
        {/* LED: janela pequena na face, perto da borda, centralizada embaixo. Moldura escura, luz forte (azul; vermelho
            piscando ao tocar) e, por cima, a lente de cristal fina */}
        <ClickablePart id="led">
          <group position={[0, LED_Y, FACE_Z]}>
            <mesh geometry={slit} material={M.hole} position={[0, 0, -0.0035]} scale={[1.16, 1.4, 1]} />
            <Led geometry={slit} boost={6} sample={(t, o) => { const on = isOn(); o.color = on ? '#ff2a2a' : '#2f6dff'; o.on = on ? (t % 0.3 < 0.15 ? 1 : 0.05) : 0.55 }} position={[0, 0, -0.003]} />
            <mesh geometry={slit} material={lens} position={[0, 0, 0.0012]} scale={[1, 1, 0.5]} />
          </group>
        </ClickablePart>

        {/* traseira: fecha a sirene por trás; tem os rasgos do encaixe e os ganchos. Sem cauda: de frente, o contorno é um círculo limpo */}
        <ClickablePart follow="corpo" explode={[0, 0, -0.5]}>
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

        {/* encaixe moldado no centro-baixo da traseira: disco levemente elevado, um anel e arcos em volta. É plástico
            fixo, que centraliza a sirene no suporte de parede (NÃO é o tamper) */}
        <ClickablePart id="encaixe-suporte">
          <group position={[0.2, -0.42, 0]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} material={M.white} position={[0, 0, BACK - 0.004]} rotation={[0, 0, i * 2.1 + 0.3]}><torusGeometry args={[0.37, 0.014, 8, 24, 1.7]} /></mesh>
            ))}
            <mesh geometry={tamperCap} material={M.white} position={[0, 0, BACK]} scale={[1, 1, 0.6]} />
          </group>
        </ClickablePart>
        {/* anti-sabotagem (tamper): micro-chave preta (~6 × 6 mm, com o botão no meio) numa plaquinha verde (~15 × 20 mm),
            à direita da traseira, logo abaixo do conector branco da bateria; aparece por um recorte retangular.
            O suporte de parede tem um ressalto que mantém o botão apertado; fora do suporte, o botão sobe ~1 mm */}
        <ClickablePart id="tamper">
          <mesh material={M.hole} position={[TAMPER[0], TAMPER[1] + 0.05, BACK - 0.001]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.3, 0.46]} /></mesh>
          <mesh material={M.pcb} position={[TAMPER[0], TAMPER[1] + 0.04, BACK - 0.008]}><boxGeometry args={[15 / 64, 20 / 64, 0.014]} /></mesh>
          <mesh material={M.chip} position={[TAMPER[0], TAMPER[1], BACK - 0.03]}><boxGeometry args={[6 / 64, 6 / 64, 0.035]} /></mesh>
          <group ref={lever}>
            <mesh material={M.greyDark} position={[TAMPER[0], TAMPER[1], BACK - 0.052]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.016, 12]} /></mesh>
          </group>
          {/* conector branco da bateria, no topo da plaquinha, com os fios vermelho e preto */}
          <group ref={plugRef}>
            <mesh material={M.white} position={[TAMPER[0], TAMPER[1] + 0.15, BACK - 0.03]}><boxGeometry args={[0.09, 0.06, 0.04]} /></mesh>
            <mesh material={M.red} position={[TAMPER[0] - 0.02, TAMPER[1] + 0.28, BACK - 0.04]}><cylinderGeometry args={[0.01, 0.01, 0.24, 6]} /></mesh>
            <mesh material={M.black} position={[TAMPER[0] + 0.02, TAMPER[1] + 0.28, BACK - 0.04]}><cylinderGeometry args={[0.01, 0.01, 0.24, 6]} /></mesh>
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
            <group position={[-0.03, 0.45, BACK + 0.07]} rotation={[0, 0, Math.PI / 2]}>
              <mesh material={M.black}><cylinderGeometry args={[0.15, 0.15, 0.86, 28]} /></mesh>
              <mesh material={M.orange} position={[0, 0.04, 0]}><cylinderGeometry args={[0.152, 0.152, 0.5, 28, 1, true, 2.2, 1.1]} /></mesh>
            </group>
          </group>
        </ClickablePart>
        <ClickablePart id="placa">
          {/* a placa inteira fica por dentro: contorno em cunha, chips, antena de fio preto e os dois fios brancos do elemento sonoro */}
          <mesh geometry={board} material={M.pcb} position={[0, 0, -0.2]} />
          <mesh material={M.chip} position={[-0.45, -0.12, -0.165]}><boxGeometry args={[0.14, 0.14, 0.02]} /></mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} material={M.gold} position={[-0.16, 0.0 - i * 0.045, -0.172]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.006, 8]} /></mesh>)}
          <mesh geometry={antenna} material={M.chip} />
          <mesh geometry={piezoWireA} material={M.white} />
          <mesh geometry={piezoWireB} material={M.white} />
        </ClickablePart>

        <SoundWaves level={level} position={[0, 0, 0.36]} count={5} maxRadius={1.9} />
        <mesh material={ringMat} position={[0, 0, -0.2]} userData={{ fx: true }} raycast={() => null}><torusGeometry args={[1.02, 0.022, 8, 96]} /></mesh>
        <mesh material={sparkMat} position={[TAMPER[0], TAMPER[1] + 0.15, BACK - 0.12]} userData={{ fx: true }} raycast={() => null}><sphereGeometry args={[0.05, 12, 8]} /></mesh>
      </group>

      {/* suporte de parede: prato com furo grande, canal vertical, recortes e travas do encaixe */}
      <ClickablePart id="suporte">
        <group position={[0, 0, SUP_DZ]} scale={[0.86, 0.86, SUP_S]}>
          <mesh geometry={rim} material={whiteDS} castShadow />
          <mesh geometry={floor} material={whiteDS} position={[0, 0, -0.63]} />
          {/* ressalto que mantém o botão da micro-chave apertado */}
          <mesh material={M.whiteRelief} position={[TAMPER[0] / 0.86, TAMPER[1] / 0.86, -0.46]}><boxGeometry args={[0.1, 0.1, 0.34]} /></mesh>
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
