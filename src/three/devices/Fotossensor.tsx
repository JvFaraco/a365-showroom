import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { fresnelTexture, polaroidTexture } from '../common/textures'
import { roundedRectGeometry, stadiumGeometry, stadiumRingGeometry } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import { actionTau, actionTime, useShowroom } from '../../store/showroomStore'
import { DetectionFan, LowPolyDog, LowPolyPerson } from '../fx/DetectionFan'
import { CameraFlash } from '../fx/CameraFlash'

const PY = -0.5 // altura do pivô do suporte: preso à peça de fixação, na metade de baixo da traseira
const PIVOT: [number, number, number] = [0, PY, -0.42]
const CELL_X = [-0.15, 0, 0.15]
const BAY_Y = 0.38 // centro do compartimento das pilhas (metade de cima da traseira)
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
  const flip = useRef<THREE.Group>(null!)
  const pin = useRef<THREE.Mesh>(null!)
  const cellRefs = useRef<(THREE.Group | null)[]>([])
  const arrowPhase = useActionPhase('tampa-foto', [0.8, 1.5], true)
  const polaroid = useRef<THREE.Group>(null!)
  const person = useRef<THREE.Group>(null!)
  const dog = useRef<THREE.Group>(null!)
  const ruler = useRef<THREE.Group>(null!)
  const alertV = useRef(0)
  const oval = useMemo(() => stadiumGeometry(0.36, 0.76, 0.062, 0.028), [])
  const ovalSeam = useMemo(() => stadiumRingGeometry(0.5, 0.9, 0.01, 0.004, 0), [])
  const win = useMemo(() => stadiumGeometry(0.085, 0.21, 0.012, 0.004), [])
  // corpo: seção quase elíptica extrudada na vertical, com topo plano e ombros arredondados
  const body = useMemo(() => { const g = roundedRectGeometry(0.68, 0.38, 0.14, 1.66, 0.06); g.rotateX(-Math.PI / 2); return g }, [])
  // capuz do PIR: bloco trapezoidal (mais largo embaixo), com chanfro
  const hood = useMemo(() => {
    const sh = new THREE.Shape()
    // ombros inclinados em cima; desce até a base e leva o logo no queixo
    sh.moveTo(-0.24, 0.32); sh.lineTo(0.24, 0.32); sh.lineTo(0.33, 0.06); sh.lineTo(0.35, -0.6); sh.lineTo(-0.35, -0.6); sh.lineTo(-0.33, 0.06); sh.closePath()
    return new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4 })
  }, [])
  const topSeam = useMemo(() => { const g = roundedRectGeometry(0.802, 0.502, 0.2, 0.008, 0); g.rotateX(-Math.PI / 2); return g }, [])
  // peça de fixação: trapézio (mais largo em cima) com o canal em cunha por onde o suporte desliza
  const mount = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-0.27, 0.36); sh.lineTo(0.27, 0.36); sh.lineTo(0.27, -0.2); sh.lineTo(0.2, -0.4); sh.lineTo(-0.2, -0.4); sh.lineTo(-0.27, -0.2); sh.closePath()
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3 })
    g.rotateY(Math.PI); return g
  }, [])
  const mountSlot = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-0.09, 0.3); sh.lineTo(0.09, 0.3); sh.lineTo(0.03, -0.34); sh.lineTo(-0.03, -0.34); sh.closePath()
    const hole = new THREE.Path(); hole.moveTo(-0.075, 0.285); hole.lineTo(-0.02, -0.325); hole.lineTo(0.02, -0.325); hole.lineTo(0.075, 0.285); hole.closePath(); sh.holes.push(hole)
    const g = new THREE.ShapeGeometry(sh); g.rotateY(Math.PI); return g
  }, [])
  const mountMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c3c7ce', roughness: 0.6 }), [])
  const ovalRecess = useMemo(() => stadiumGeometry(0.5, 0.9, 0.004, 0), [])
  const winMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#0c2416', roughness: 0.12, clearcoat: 1 }), [])
  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b4b8c0', roughness: 0.6 }), [])
  const lensBack = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9cdd5', roughness: 0.7 }), [])
  const pirMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#e9ecf1', map: fresnelTexture(), roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.78, envMapIntensity: 1.4 }), [])
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
    // tampa: o sensor vira de costas, a tampa solta pela borda de cima, inclina ~25° e sai para trás;
    // o pino do anti-sabotagem salta e as 3 pilhas AAA deslizam para fora, uma de cada vez
    const tt = actionTau('tampa-foto')
    flip.current.rotation.y = tt < 0 ? 0 : seg(tt, 0, 0.8) * Math.PI
    const off = tt < 0 ? 0 : seg(tt, 2.0, 2.6)
    // "clic" ao fechar: a tampa assenta com um leve pulso
    const clic = tt >= 0 && tt < 1.5 ? bump(tt, 1.2, 1.35, 1.4, 1.5) * 0.015 : 0
    cover.current.rotation.x = -(tt < 0 ? 0 : seg(tt, 1.5, 2.0)) * 0.44
    // sai para trás e para o lado, deixando o compartimento à vista
    cover.current.position.set(off * 0.62, -off * 0.1, -off * 0.45 + clic)
    pin.current.position.z = -0.262 - (tt < 0 ? 0 : seg(tt, 2.6, 2.8)) * 0.04
    for (let i = 0; i < 3; i++) {
      const c = cellRefs.current[i]
      if (c) { const k = tt < 0 ? 0 : seg(tt, 2.9 + i * 0.15, 3.4 + i * 0.15); c.position.set(0, k * 0.1, -k * 0.5) }
    }
    // câmera: polaroid voa para fora
    const tc = actionTime('camera')
    const k = tc < 0 ? 0 : bump(tc, 0.9, 2.0, 6.3, 6.9)
    // no aquecimento, os efeitos que só aparecem numa ação ficam visíveis uma vez, para compilar os shaders deles
    const warm = useShowroom.getState().warm
    polaroid.current.visible = warm || k > 0.001
    polaroid.current.position.set(k * 1.0, 0.62 - k * 0.25, 0.42 + k * 0.3)
    polaroid.current.scale.setScalar(0.05 + k * 0.95)
    polaroid.current.rotation.set(0, -0.25 * k, (1 - k) * 1.2 - 0.08)
    // PIR: pessoa dispara, cachorro não
    const tp = actionTime('pir')
    person.current.visible = warm || (tp > 2.3 && tp < 6.8)
    dog.current.visible = warm || (tp > 7.8 && tp < 12.3)
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
      <group ref={flip}>
      <group position={PIVOT}>
        <group ref={tilt}>
          <group position={[-PIVOT[0], -PIVOT[1], -PIVOT[2]]}>
            {/* corpo em cápsula */}
            <ClickablePart follow="corpo">
              <mesh geometry={body} material={M.white} position={[0, 0.06, 0]} castShadow />
              <mesh geometry={hood} material={M.white} position={[0, -0.14, 0.21]} />
              <LogoGroove r={0.075} position={[0, -0.58, 0.2862]} />
              {/* linhas de partição: no topo, entre o corpo e a base, e em volta da tampa das pilhas */}
              <mesh geometry={topSeam} material={M.partition} position={[0, 0.86, 0]} />
              <RoundedBox args={[0.77, 0.014, 0.475]} radius={0.006} smoothness={2} position={[0, -0.782, 0]} material={M.partition} />
              <RoundedBox args={[0.6, 1.0, 0.012]} radius={0.006} smoothness={2} position={[0, BAY_Y, -0.2475]} material={M.partition} />
              {/* compartimento: berço preto, com mola numa ponta e contato na outra (polaridades alternadas) */}
              <mesh material={M.chip} position={[0, BAY_Y, -0.2545]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.52, 0.7]} /></mesh>
              {[-0.075, 0.075].map((x) => <mesh key={x} material={M.chip} position={[x, BAY_Y, -0.27]}><boxGeometry args={[0.012, 0.6, 0.04]} /></mesh>)}
              {CELL_X.map((x, i) => (
                <group key={x}>
                  <mesh material={M.metal} position={[x, BAY_Y + (i % 2 ? 0.275 : -0.275), -0.27]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.04, 0.007, 6, 16]} /></mesh>
                  <mesh material={M.metal} position={[x, BAY_Y + (i % 2 ? -0.27 : 0.27), -0.27]}><boxGeometry args={[0.08, 0.01, 0.06]} /></mesh>
                </group>
              ))}
              {/* estrias de pega nas laterais, embaixo */}
              {[-1, 1].flatMap((sx) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <mesh key={`${sx}${i}`} material={M.partition} position={[sx * 0.4, -0.72 + i * 0.03, -0.06]}><boxGeometry args={[0.004, 0.008, 0.22]} /></mesh>
              )))}
            </ClickablePart>

            {/* módulo oval em relevo: câmera + janela do flash/LED */}
            <ClickablePart follow="camera">
              <mesh geometry={oval} material={M.white} position={[0, 0.47, 0.245]} />
              <mesh geometry={ovalRecess} material={M.whiteRelief} position={[0, 0.47, 0.2495]} />
              <mesh geometry={ovalSeam} material={M.partition} position={[0, 0.47, 0.2505]} />
            </ClickablePart>
            <ClickablePart id="camera">
              <mesh material={M.blackGloss} position={[0, 0.66, 0.335]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.062, 0.062, 0.03, 32]} /></mesh>
              <mesh material={M.lens} position={[0, 0.66, 0.352]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.042, 0.042, 0.012, 32]} /></mesh>
              {/* anéis internos da íris */}
              {[0.014, 0.024, 0.034].map((r) => <mesh key={r} material={M.greyDark} position={[0, 0.66, 0.3585]}><torusGeometry args={[r, 0.0022, 6, 32]} /></mesh>)}
            </ClickablePart>
            <ClickablePart id="flash">
              <mesh geometry={win} material={winMat} position={[0, 0.4, 0.334]} />
              <Led sample={(_, o) => { const p = flashPower(); o.color = '#ffffff'; o.on = 0.04 + p * 3 }} position={[0, 0.445, 0.352]}>
                <boxGeometry args={[0.045, 0.07, 0.004]} />
              </Led>
            </ClickablePart>
            <ClickablePart id="led">
              <Led sample={(t, o) => {
                const a = interactive ? alertV.current : 0
                o.color = a > 0.5 ? '#ff2a2a' : '#27d455'
                o.on = a > 0.5 ? 1 : t % 3 < 0.25 ? 0.9 : 0.12
              }} position={[0, 0.345, 0.352]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 0.005, 16]} />
              </Led>
            </ClickablePart>

            {/* lente Fresnel do PIR */}
            <ClickablePart id="pir">
              {/* moldura fina e fundo claro; a lente é uma janela fosca levemente curva, à frente do capuz */}
              <RoundedBox args={[0.55, 0.45, 0.008]} radius={0.004} smoothness={2} position={[0, -0.11, 0.2852]} material={M.partition} />
              <RoundedBox args={[0.52, 0.42, 0.008]} radius={0.004} smoothness={2} position={[0, -0.11, 0.287]} material={lensBack} />
              <mesh material={pirMat} position={[0, -0.11, -0.8836]}>
                <cylinderGeometry args={[1.2, 1.2, 0.42, 40, 1, true, -0.218, 0.436]} />
              </mesh>
            </ClickablePart>

            <ClickablePart id="base">
              <RoundedBox args={[0.77, 0.18, 0.475]} radius={0.085} smoothness={6} position={[0, -0.88, 0]} material={baseMat} castShadow />
            </ClickablePart>

            {/* tampa das pilhas: cobre a metade de cima da traseira; trava no topo (alavanca) e duas abas embaixo */}
            <ClickablePart id="tampa-traseira">
              <group position={[0, BAY_Y - 0.48, -0.285]}>
                <group ref={cover}>
                  <RoundedBox args={[0.58, 0.96, 0.07]} radius={0.03} smoothness={4} position={[0, 0.48, 0]} material={M.white} castShadow />
                  <RoundedBox args={[0.12, 0.07, 0.05]} radius={0.012} smoothness={2} position={[0, 0.97, 0.005]} material={M.white} />
                  <mesh material={M.hole} position={[0, 0.94, -0.036]}><boxGeometry args={[0.07, 0.02, 0.004]} /></mesh>
                  {[-0.2, 0.2].map((x) => <RoundedBox key={x} args={[0.08, 0.05, 0.03]} radius={0.008} smoothness={2} position={[x, -0.015, 0.02]} material={M.white} />)}
                  {/* por dentro: duas nervuras e a etiqueta lisa */}
                  {[0.3, 0.62].map((y) => <mesh key={y} material={M.whiteRelief} position={[0, y, 0.04]}><boxGeometry args={[0.36, 0.03, 0.03]} /></mesh>)}
                  <mesh material={M.white} position={[0, 0.46, 0.0355]}><planeGeometry args={[0.2, 0.12]} /></mesh>
                </group>
              </group>
            </ClickablePart>
            {/* 3 pilhas lado a lado, na vertical, com as polaridades alternadas (sem marca) */}
            <ClickablePart id="pilhas">
              {CELL_X.map((x, i) => (
                <group key={x} ref={(gr) => { cellRefs.current[i] = gr }}>
                  <group position={[x, BAY_Y, -0.262]} rotation={[0, 0, i % 2 ? Math.PI : 0]}>
                    <mesh material={M.cell}><capsuleGeometry args={[0.07, 0.36, 4, 24]} /></mesh>
                    <mesh material={M.metal} position={[0, 0.262, 0]}><cylinderGeometry args={[0.026, 0.026, 0.03, 12]} /></mesh>
                    <mesh material={M.metal} position={[0, -0.255, 0]}><cylinderGeometry args={[0.05, 0.05, 0.008, 16]} /></mesh>
                    <mesh material={M.partition} position={[0, 0.17, 0]}><cylinderGeometry args={[0.0712, 0.0712, 0.012, 24]} /></mesh>
                  </group>
                </group>
              ))}
            </ClickablePart>
            {/* pino do anti-sabotagem, ao lado do berço: a tampa o mantém pressionado */}
            <ClickablePart follow="tampa-traseira" internal>
              <mesh ref={pin} material={M.grey} position={[0.275, BAY_Y + 0.1, -0.262]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.05, 12]} /></mesh>
            </ClickablePart>
            {interactive && arrowPhase === 0 && (
              <Html position={[0, BAY_Y + 0.52, -0.36]} center style={{ pointerEvents: 'none' }}>
                <div className="fx-tag -translate-y-7 text-center text-xs font-semibold text-accent">trava<div className="text-xl leading-none">▼</div></div>
              </Html>
            )}
            {/* peça de fixação: peça cinza-clara na metade de baixo da traseira, com canal em cunha e parafuso de trava */}
            <ClickablePart id="fixacao">
              <mesh geometry={mount} material={mountMat} position={[0, PY, -0.25]} />
              <mesh geometry={mountSlot} material={M.partition} position={[0, PY, -0.332]} />
              <mesh material={M.metal} position={[-0.12, PY - 0.2, -0.335]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.02, 12]} /></mesh>
              <mesh material={M.metal} position={[0.33, PY - 0.3, -0.18]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.022, 0.022, 0.03, 10]} /></mesh>
            </ClickablePart>
          </group>
        </group>
      </group>

      {/* suporte articulado: esfera do pivô, braço curto e placa de parede */}
      <ClickablePart id="suporte">
        <mesh material={M.white} position={PIVOT}><sphereGeometry args={[0.1, 24, 16]} /></mesh>
        <mesh material={M.white} position={[0, PY, -0.58]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.058, 0.2, 6, 20]} /></mesh>
        <mesh material={M.partition} position={PIVOT} rotation={[0, 0, 0]}><torusGeometry args={[0.101, 0.004, 6, 32]} /></mesh>
        <RoundedBox args={[0.42, 0.46, 0.05]} radius={0.022} smoothness={4} position={[0, PY, -0.75]} material={M.white} castShadow />
        {[0.2, -0.2].map((y) => (
          <mesh key={y} material={M.metal} position={[0, PY + y * 0.85, -0.722]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.01, 12]} /></mesh>
        ))}
      </ClickablePart>

      </group>

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
