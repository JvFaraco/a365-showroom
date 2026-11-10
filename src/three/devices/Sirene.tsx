import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoRelief } from '../common/Logo'
import { Led } from '../common/Led'
import { latheZ, stadiumGeometry } from '../common/shapes'
import { DeviceCtx, bump, clamp01, explodeAmt, seg, useActionPhase, type DeviceProps } from '../common/util'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { SoundWaves } from '../fx/SoundWaves'

const BACK = -0.277 // face traseira da sirene (a que encosta no suporte)

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
 * sonoro, a placa e a alavanca do tamper; tudo isso fica coberto pelo suporte de parede, um
 * prato onde a sirene encaixa e gira para travar.
 */
export function Sirene({ interactive = false, sounding }: DeviceProps & { sounding?: () => boolean }) {
  const body = useRef<THREE.Group>(null!)
  const shell = useRef<THREE.Group>(null!)
  const batt = useRef<THREE.Group>(null!)
  const plugRef = useRef<THREE.Group>(null!)
  const lever = useRef<THREE.Group>(null!)
  const dome = useMemo(() => latheZ([[1.0, -0.25], [0.99, -0.15], [0.94, 0.03], [0.86, 0.18], [0.76, 0.27], [0.62, 0.3], [0.001, 0.3]]), [])
  const rim = useMemo(() => latheZ([[0.9, -0.63], [0.86, -0.45], [0.82, -0.29]]), [])
  const floor = useMemo(supportFloor, [])
  const slit = useMemo(() => stadiumGeometry(0.12, 0.04, 0.008, 0.003), [])
  const whiteDS = useMemo(() => { const m = M.white.clone(); m.side = THREE.DoubleSide; return m }, [])
  const ringMat = useMemo(() => fxBasic('#8fb4ff', 0), [])
  const sparkMat = useMemo(() => fxBasic('#fff3b0', 0), [])
  const clicPhase = useActionPhase('encaixe', [2.6])
  const tamperPhase = useActionPhase('tamper', [0.6], true)

  const isOn = () => (sounding ? sounding() : interactive && useShowroom.getState().sirenOn)
  const level = () => (isOn() ? (interactive ? useShowroom.getState().sirenLevel : 2) : 0)

  useFrame(({ clock }) => {
    const lv = level()
    shell.current.position.x = lv ? Math.sin(clock.elapsedTime * 90) * 0.004 * lv : 0
    if (!interactive) return
    // encaixar: a sirene chega de frente, assenta e gira ~20° até travar ("clic")
    const te = actionTime('encaixe')
    // retirar da parede: gira ~20° no sentido oposto, destrava e sai para a frente
    const tr = actionTau('tamper')
    // bateria: retira, vira de costas (180°), o conector solta e a bateria sobe do nicho
    const tb = actionTau('bateria-sirene')
    const tq = tr >= 0 ? tr : tb
    let twist = 0, away = 0
    if (te >= 0) { twist = bump(te, 0, 0.4, 2.2, 2.6); away = bump(te, 0.3, 0.9, 1.6, 2.2) }
    else if (tq >= 0) { twist = seg(tq, 0, 0.5); away = seg(tq, 0.5, 1.2) }
    const flip = tb < 0 ? 0 : seg(tb, 1.2, 2.0)
    body.current.position.z = away * 0.9
    body.current.rotation.set(0, flip * Math.PI, -twist * 0.35)
    const clic = te >= 2.6 ? 1 - seg(te, 2.6, 2.95) : 0
    body.current.scale.setScalar(1 + clic * 0.02)
    ringMat.opacity = te < 0 ? 0 : bump(te, 2.6, 2.7, 2.9, 3.7)
    plugRef.current.position.z = -(tb < 0 ? 0 : seg(tb, 2.2, 2.8)) * 0.14
    sparkMat.opacity = tb < 0 ? 0 : bump(tb, 2.3, 2.4, 2.45, 2.7)
    const out = tb < 0 ? 0 : seg(tb, 3.0, 3.8)
    batt.current.position.set(0, out * 0.1, -out * 0.55)
    // tamper: pressionado pelo suporte; solta quando a sirene se desprende dele
    const free = clamp01(Math.max(away * 5, explodeAmt.v * 4))
    lever.current.position.z = -free * 0.07
    lever.current.rotation.x = free * 0.35
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'sirene', interactive }}>
      <group ref={body}>
        <ClickablePart id="corpo">
          <group ref={shell}>
            <mesh geometry={dome} material={M.white} castShadow />
            <LogoRelief r={0.19} position={[0.1, -0.02, 0.3]} depth={0.008} />
          </group>
        </ClickablePart>
        <ClickablePart id="led">
          <mesh geometry={slit} material={M.blackGloss} position={[0, -0.55, 0.296]} />
          <Led sample={(t, o) => { o.color = '#ff2a2a'; o.on = isOn() ? (t % 0.3 < 0.15 ? 1 : 0.05) : 0.03 }} position={[0, -0.55, 0.306]}>
            <boxGeometry args={[0.08, 0.02, 0.004]} />
          </Led>
        </ClickablePart>

        {/* tampa traseira: fica presa ao corpo; tem os rasgos do encaixe e os ganchos */}
        <ClickablePart internal>
          <mesh material={M.white} position={[0, 0, -0.25]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.96, 0.96, 0.05, 64]} /></mesh>
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

        {/* tamper: alavanca de gatilho, protegida por uma guia em U */}
        <ClickablePart id="tamper">
          <group position={[-0.34, -0.64, BACK]}>
            <mesh material={M.whiteRelief} position={[0.075, 0, -0.02]}><boxGeometry args={[0.03, 0.16, 0.04]} /></mesh>
            <mesh material={M.whiteRelief} position={[0, 0.075, -0.02]}><boxGeometry args={[0.16, 0.03, 0.04]} /></mesh>
            <mesh material={M.hole} position={[-0.02, -0.01, 0.001]}><boxGeometry args={[0.13, 0.12, 0.006]} /></mesh>
            <group ref={lever} position={[-0.02, 0.04, 0]}>
              <mesh material={M.grey} position={[0, -0.05, -0.015]}><boxGeometry args={[0.1, 0.1, 0.03]} /></mesh>
              <mesh material={M.metal} position={[0, -0.07, -0.035]}><boxGeometry args={[0.06, 0.04, 0.02]} /></mesh>
            </group>
          </group>
        </ClickablePart>

        <ClickablePart id="elemento-sonoro">
          <group position={[0.2, -0.42, 0]}>
            <mesh material={M.whiteRelief} position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.3, 0.3, 0.3, 40]} /></mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} material={M.grey} position={[0, 0, BACK - 0.004]} rotation={[0, 0, i * 2.1 + 0.3]}><torusGeometry args={[0.37, 0.014, 8, 24, 1.7]} /></mesh>
            ))}
            <mesh material={M.white} position={[0, 0, BACK - 0.02]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.3, 0.31, 0.04, 48]} /></mesh>
            <mesh material={M.whiteRelief} position={[0, 0, BACK - 0.05]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.22, 0.04, 40]} /></mesh>
            <mesh material={M.white} position={[0, 0, BACK - 0.05]} scale={[1, 1, 0.5]}><sphereGeometry args={[0.11, 24, 16]} /></mesh>
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
        <group>
          <mesh geometry={rim} material={whiteDS} castShadow />
          <mesh geometry={floor} material={whiteDS} position={[0, 0, -0.63]} />
          <mesh material={M.whiteRelief} position={[-0.42, -0.02, -0.54]}><boxGeometry args={[0.22, 0.95, 0.14]} /></mesh>
          <RoundedBox args={[0.34, 0.22, 0.08]} radius={0.035} smoothness={3} position={[0, 0.93, -0.59]} material={M.white} />
          {[[0.62, 0.36], [-0.62, 0.36], [0.2, -0.7], [-0.2, 0.36]].map(([x, y], i) => (
            <mesh key={i} material={M.whiteRelief} position={[x, y, -0.55]}><boxGeometry args={[0.05, 0.1, 0.12]} /></mesh>
          ))}
          {[[0.6, -0.1], [-0.68, -0.3]].map(([x, y], i) => (
            <mesh key={i} material={M.metal} position={[x, y, -0.59]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 0.02, 12]} /></mesh>
          ))}
        </group>
      </ClickablePart>

      {interactive && clicPhase >= 0 && (
        <Html position={[0, 1.25, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="fx-tag rounded-full bg-ok px-4 py-1.5 text-sm font-bold text-[#05210c]">Clic! Travada no suporte</div>
        </Html>
      )}
      {interactive && tamperPhase >= 0 && (
        <Html position={[0, -1.3, 0.9]} center style={{ pointerEvents: 'none' }}>
          <div className="fx-tag flex items-center gap-2 rounded-full bg-alert px-4 py-1.5 text-sm font-bold text-white">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-white" style={{ animation: 'blink 0.6s steps(2) infinite' }} />
            Sirene aberta: o sistema não arma
          </div>
        </Html>
      )}
    </DeviceCtx.Provider>
  )
}
