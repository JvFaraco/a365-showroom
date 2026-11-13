import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic, mat } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { iconTexture, type IconId } from '../common/textures'
import { ringSectorGeometry, smoothLatheZ, stadiumGeometry, wire } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import type { ActionId } from '../../data/devices'
import { actionTau, actionTime, useShowroom, type ArmState } from '../../store/showroomStore'
import { RadioPulse } from '../fx/RadioPulse'
import { HoldRing } from '../fx/HoldRing'
import { MiniModulo } from '../fx/MiniModulo'
import { beep } from '../../ui/audio'

const D2R = Math.PI / 180
const BUTTONS: { id: string; icon: IconId; angle: number; action: ActionId; arm?: ArmState }[] = [
  { id: 'btn-panico', icon: 'panico', angle: 90, action: 'panico' },
  { id: 'btn-desarmar', icon: 'desarmar', angle: 180, action: 'btn-desarmar', arm: 'disarmed' },
  { id: 'btn-armar', icon: 'armar', angle: 0, action: 'btn-armar', arm: 'armed' },
  { id: 'btn-parcial', icon: 'parcial', angle: 270, action: 'btn-parcial', arm: 'partial' },
]
const CMD: ActionId[] = ['btn-desarmar', 'btn-armar', 'btn-parcial']
const MINI: [number, number, number] = [2.5, 0.75, 0]
const cmdTime = () => { for (const c of CMD) { const t = actionTime(c); if (t >= 0) return t } return -1 }

// Ficha: 45 de largura × 51 de altura (com a cauda da argola) × 13 mm de espessura. 1 unidade = 25,9 mm.
const THICK = 1.48 // a espessura modelada (0,34) vira 13 mm
const KY = 0.06 // o teclado (~32 mm de diâmetro) fica um pouco acima do centro
// corpo redondo com cauda CURTA (só o furo da argola, colado ao corpo): altura total ≈ 1,2× a largura
const R = 0.87, TAIL_Y = -0.9, TAIL_R = 0.2, FILLET = 0.1

/**
 * Contorno do corpo: um círculo com uma aba curta embaixo (o olhal da argola), ligada por duas concordâncias
 * côncavas. É um bloco só. `grow` engorda o contorno (usado no filete azul).
 */
function teardrop(grow = 0) {
  const R0 = R + grow, r = TAIL_R + grow, f = FILLET - grow
  // centro da concordância: tangente por fora ao círculo do corpo e ao da aba
  const cy = ((R0 + f) ** 2 - (r + f) ** 2 + TAIL_Y * TAIL_Y) / (2 * TAIL_Y)
  const cx = Math.sqrt((R0 + f) ** 2 - cy * cy)
  const a0 = Math.atan2(cy, cx) // onde o corpo encontra a concordância (lado direito)
  const a1 = Math.atan2(cy - TAIL_Y, cx) // onde a aba encontra a concordância (lado direito)
  const s = new THREE.Shape()
  s.absarc(0, 0, R0, a0, Math.PI - a0, false)
  s.absarc(-cx, cy, f, -a0, -a1, true)
  s.absarc(0, TAIL_Y, r, Math.PI - a1, Math.PI * 2 + a1, false)
  s.absarc(cx, cy, f, Math.PI + a1, Math.PI + a0, true)
  s.closePath()
  return s
}
const ringHole = () => { const h = new THREE.Path(); h.absarc(0, TAIL_Y, 0.11, 0, Math.PI * 2, true); return h }

type Geo = ReturnType<typeof build>
let cache: Geo | null = null
function build() {
  const bevel = { bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 5, curveSegments: 48 }
  // metade da frente: maciça. Metade de trás: aro grosso com a cavidade da bateria (fechada pela tampa).
  const fs = teardrop(); fs.holes.push(ringHole())
  const front = new THREE.ExtrudeGeometry(fs, { depth: 0.13, ...bevel }); front.translate(0, 0, 0.01)
  const bs = teardrop(); bs.holes.push(ringHole())
  const cav = new THREE.Path(); cav.absarc(0, 0, 0.61, 0, Math.PI * 2, true); bs.holes.push(cav)
  const back = new THREE.ExtrudeGeometry(bs, { depth: 0.12, ...bevel }); back.translate(0, 0, -0.14)
  // filete azul: anel fino (~1,5 mm) no meio da espessura, quase rente às cascas
  const fl = teardrop(0.03)
  // é um anel de verdade (não um disco): na vista explodida aparece fino, só o contorno
  fl.holes.push(new THREE.Path(teardrop(-0.05).getPoints(120).reverse()))
  const fillet = new THREE.ExtrudeGeometry(fl, { depth: 0.03, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 64 }); fillet.translate(0, 0, -0.015)
  // tampa: circular com o topo levemente reto
  const cs = new THREE.Shape()
  const ca = Math.asin(0.6 / 0.69)
  cs.absarc(0, 0, 0.69, Math.PI - ca, Math.PI * 2 + ca, false); cs.closePath()
  const cover = new THREE.ExtrudeGeometry(cs, { depth: 0.014, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 48 }); cover.translate(0, 0, -0.022)
  return {
    front, back, fillet, cover,
    sector: ringSectorGeometry(0.3, 0.62, -38 * D2R, 38 * D2R, 0.018, 0.022),
    // disco central fixo: baixo, sem contorno de tecla
    center: smoothLatheZ([[0.27, 0.168], [0.266, 0.182], [0.245, 0.19], [0.001, 0.192]], 96, 24),
    coin: smoothLatheZ([[0.001, -0.14], [0.39, -0.14], [0.415, -0.135], [0.42, -0.12], [0.42, -0.09], [0.41, -0.08], [0.001, -0.08]], 64, 32),
    slit: stadiumGeometry(0.27, 0.075, 0.01, 0.003), // fenda do LED: ~7 × 2 mm
    aerial: wire([[0.5, 0.42, -0.045], [0.63, 0.2, -0.04], [0.66, -0.1, -0.04], [0.56, -0.36, -0.04]], 0.012),
    rib: wire([[-0.42, 0.25, 0], [-0.45, -0.1, 0], [-0.3, -0.42, 0], [0, -0.52, 0], [0.3, -0.42, 0], [0.45, -0.1, 0], [0.42, 0.25, 0]], 0.014),
  }
}
const G = () => (cache ??= build())

/**
 * Controle remoto: corpo redondo com uma cauda curta para o furo da argola, preto/grafite brilhante
 * com filete azul, 4 botões em cunha (em X) em volta de um disco central fixo, que não é botão. Atrás, a tampa redonda de topo reto
 * fecha a cavidade com a placa verde, o suporte e a bateria CR2032. Frente em +Z.
 */
export function ControleRemoto({ interactive = false, pressed }: DeviceProps & { pressed?: () => string | null }) {
  const g = G()
  // corpo preto/grafite brilhante, como na arte oficial
  const bodyMat = useMemo(() => mat({ color: '#1d1f24', roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.25 }), [])
  // filete: azul saturado, com brilho leve (fica abaixo do limiar do bloom)
  const filletMat = useMemo(() => mat({ color: '#2a5bff', roughness: 0.28, clearcoat: 0.8, emissive: '#2a5bff', emissiveIntensity: 0.55 }), [])
  const coinMat = useMemo(() => mat({ color: '#dfe2e8', roughness: 0.32, metalness: 0.6 }), [])
  const coverMat = useMemo(() => mat({ color: '#22242a', roughness: 0.7 }), [])
  const icons = useMemo(() => BUTTONS.map((b) => new THREE.MeshBasicMaterial({ map: iconTexture(b.icon), transparent: true, toneMapped: false })), [])
  const btnRefs = useRef<(THREE.Group | null)[]>([])
  const root = useRef<THREE.Group>(null!)
  const cover = useRef<THREE.Group>(null!)
  const coin = useRef<THREE.Group>(null!)
  const range = useRef<THREE.Mesh>(null!)
  const rangeMat = useMemo(() => fxBasic('#5b8cff', 0), [])
  const cmdPhase = useActionPhase(CMD, [0, 1.5])
  const panicOn = useActionPhase('panico') >= 0
  const rangePhase = useActionPhase('alcance', [1.2])
  const coverPhase = useActionPhase('tampa-controle', [0.8, 1.6], true)
  const tx = () => {
    if (!interactive) return !!pressed?.()
    const t = cmdTime(), s = useShowroom.getState()
    return (t > 0.25 && t < 2.2) || (s.action?.id === 'panico' && s.holdMsg === 'ok')
  }

  // o comando chega ao módulo: o estado do alarme muda
  useEffect(() => {
    if (cmdPhase !== 1) return
    const s = useShowroom.getState()
    const b = BUTTONS.find((x) => x.action === s.action?.id)
    if (b?.arm) s.setArm(b.arm)
  }, [cmdPhase])
  useEffect(() => { if (cmdPhase === 0) beep('click') }, [cmdPhase])

  useFrame(() => {
    const s = useShowroom.getState()
    BUTTONS.forEach((b, i) => {
      const g = btnRefs.current[i]
      if (!g) return
      let down = 0
      if (interactive) {
        const t = actionTime(b.action)
        if (b.action === 'panico') down = s.holding && t >= 0 ? 1 : 0
        else if (t >= 0) down = bump(t, 0.05, 0.2, 0.45, 0.6)
      } else if (pressed?.() === b.id) down = 1
      g.position.z = -down * 0.022
    })
    if (!interactive) return
    // tampa: o controle vira de costas, a tampa inclina ~25° pela borda de cima e sai para trás;
    // por fim a bateria-moeda desliza para fora do suporte
    const tt = actionTau('tampa-controle')
    root.current.rotation.y = tt < 0 ? 0 : seg(tt, 0, 0.8) * Math.PI
    const off = tt < 0 ? 0 : seg(tt, 2.0, 2.7)
    cover.current.rotation.x = -(tt < 0 ? 0 : seg(tt, 1.5, 2.0)) * 0.44
    cover.current.position.set(0, -off * 0.25, -off * 0.7)
    const slide = tt < 0 ? 0 : seg(tt, 2.9, 3.6)
    coin.current.position.set(-slide * 0.75, -slide * 0.25, -slide * 0.04)
    const ta = actionTime('alcance')
    const k = ta < 0 ? 0 : seg(ta, 0.2, 2.6)
    range.current.scale.setScalar(0.2 + k * 5.2)
    rangeMat.opacity = ta < 0 ? 0 : 0.8 * (1 - seg(ta, 4.8, 5.8)) * seg(ta, 0.1, 0.5)
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'controle', interactive }}>
      <group ref={root} position={[0, 0.1, 0]} scale={[1, 1, THICK]}>
        {/* casca da frente */}
        <ClickablePart id="corpo">
          <mesh geometry={g.front} material={bodyMat} castShadow />
          {/* linha de partição em volta do teclado */}
          <mesh material={M.groove} position={[0, KY, 0.1705]}><ringGeometry args={[0.652, 0.666, 96]} /></mesh>
        </ClickablePart>
        {/* anel do filete azul: ~1,5 mm, no MEIO da espessura (a emenda entre as duas cascas), em volta de tudo */}
        <ClickablePart follow="corpo" explode={[0, 0, 0.2]}>
          <mesh geometry={g.fillet} material={filletMat} />
        </ClickablePart>
        {/* casca de trás, com a argola */}
        <ClickablePart follow="corpo" explode={[0, 0, -0.6]}>
          <mesh geometry={g.back} material={bodyMat} castShadow />
        </ClickablePart>
        <ClickablePart id="argola">
          {/* furo da argola, na ponta do mesmo bloco, com a borda chanfrada */}
          {[0.172, -0.172].map((z) => (
            <mesh key={z} material={M.blackGloss} position={[0, TAIL_Y, z]} scale={[1, 1, 0.4]}><torusGeometry args={[0.117, 0.022, 12, 64]} /></mesh>
          ))}
        </ClickablePart>
        <ClickablePart id="led">
          <mesh geometry={g.slit} material={M.blackGloss} position={[0, 0.78, 0.158]} rotation={[-0.5, 0, 0]} />
          <Led sample={(t, o) => { o.color = '#3d7bff'; o.on = tx() ? (t % 0.24 < 0.12 ? 1 : 0.1) : 0.05 }} position={[0, 0.784, 0.168]} rotation={[-0.5, 0, 0]}>
            <boxGeometry args={[0.2, 0.04, 0.004]} />
          </Led>
        </ClickablePart>

        {/* 4 botões em cunha, em X: ✱ em cima, cadeado aberto à esquerda, fechado à direita, casa embaixo */}
        {BUTTONS.map((b, i) => (
          <ClickablePart key={b.id} id={b.id}>
            <group ref={(gr) => { btnRefs.current[i] = gr }}
              onPointerDown={b.action === 'panico' ? (e) => { if (panicOn) { e.stopPropagation(); useShowroom.getState().set({ holding: true, holdMsg: '' }) } } : undefined}
              onPointerUp={b.action === 'panico' ? () => panicOn && useShowroom.getState().set({ holding: false }) : undefined}
              onPointerLeave={b.action === 'panico' ? () => panicOn && useShowroom.getState().set({ holding: false }) : undefined}>
              <mesh geometry={g.sector} material={M.blackBtn} position={[0, KY, 0.172]} rotation={[0, 0, b.angle * D2R]} />
              <mesh material={icons[i]} position={[Math.cos(b.angle * D2R) * 0.46, KY + Math.sin(b.angle * D2R) * 0.46, 0.2135]}><planeGeometry args={[0.2, 0.2]} /></mesh>
            </group>
            {interactive && b.action === 'panico' && <HoldRing radius={0.18} position={[0, KY + 0.46, 0.24]} />}
          </ClickablePart>
        ))}
        {/* centro: disco escuro FIXO (não afunda, não tem contorno de tecla), com o logo em baixo-relevo bem discreto.
            TODO(usuário): confirmar o logo no disco (a arte de marketing mostra; o ícone do sistema mostra liso). */}
        <ClickablePart follow="corpo">
          <mesh geometry={g.center} material={bodyMat} position={[0, KY, 0]} />
          <LogoGroove r={0.12} position={[0, KY, 0.1925]} material={M.logoGrooveDark} />
        </ClickablePart>

        {/* tampa traseira: circular de topo reto, duas abas em cima e uma embaixo, entalhe e símbolo em relevo */}
        <ClickablePart id="tampa">
          <group position={[0, -0.574, -0.165]}>
            <group ref={cover}>
              <group position={[0, 0.574, 0]} scale={[0.87, 0.87, 1]}>
                <mesh geometry={g.cover} material={coverMat} />
                <mesh material={M.hole} position={[0, 0.585, -0.024]}><boxGeometry args={[0.2, 0.05, 0.016]} /></mesh>
                <mesh material={M.black} position={[0, 0.3, -0.031]} rotation={[Math.PI / 2, Math.PI / 6, 0]}><cylinderGeometry args={[0.07, 0.07, 0.006, 3]} /></mesh>
                <mesh material={M.black} position={[0, 0.17, -0.031]}><boxGeometry args={[0.2, 0.035, 0.006]} /></mesh>
                {[[-0.22, 0.62], [0.22, 0.62], [0, -0.7]].map(([x, y], i) => (
                  <mesh key={i} material={coverMat} position={[x, y, -0.006]}><boxGeometry args={[0.12, 0.06, 0.03]} /></mesh>
                ))}
                {/* por dentro: nervura em "U" e a etiqueta (lisa, sem texto) */}
                <mesh geometry={g.rib} material={coverMat} position={[0, 0, 0.004]} />
                <mesh material={M.white} position={[0, 0.02, 0.0005]}><planeGeometry args={[0.5, 0.34]} /></mesh>
              </group>
            </group>
          </group>
        </ClickablePart>
        {/* por dentro: placa verde, suporte preto da bateria com a lâmina de contato dourada e o bloco do encaixe */}
        <ClickablePart internal>
          <mesh material={M.pcb} position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.69, 0.69, 0.02, 64]} /></mesh>
          {/* frente da placa, sob os botões: 4 chaves em domo dourado, o chip no centro, o LED e a antena de fio amarelo */}
          {BUTTONS.map((b) => (
            <group key={b.id} position={[Math.cos(b.angle * D2R) * 0.47, Math.sin(b.angle * D2R) * 0.47, -0.047]} rotation={[0, 0, Math.PI / 4]}>
              <mesh material={M.chip}><boxGeometry args={[0.17, 0.17, 0.006]} /></mesh>
              <mesh material={M.gold} position={[0, 0, 0.004]} scale={[1, 1, 0.3]}><sphereGeometry args={[0.062, 20, 12]} /></mesh>
            </group>
          ))}
          <mesh material={M.chip} position={[0, 0, -0.043]}><boxGeometry args={[0.2, 0.2, 0.014]} /></mesh>
          <mesh material={M.white} position={[0.3, 0.56, -0.045]}><boxGeometry args={[0.05, 0.03, 0.01]} /></mesh>
          {[0, 1, 2, 3, 4].map((i) => <mesh key={i} material={M.gold} position={[-0.14 + i * 0.07, -0.6, -0.048]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.004, 10]} /></mesh>)}
          <mesh geometry={g.aerial} material={M.yellow} />
          <mesh material={M.black} position={[0, -0.05, -0.1]}><torusGeometry args={[0.455, 0.035, 8, 48, Math.PI * 1.45]} /></mesh>
          <mesh material={M.gold} position={[0.12, 0.3, -0.148]}><boxGeometry args={[0.2, 0.26, 0.008]} /></mesh>
          <mesh material={M.gold} position={[0.12, 0.44, -0.12]}><boxGeometry args={[0.24, 0.05, 0.06]} /></mesh>
          <mesh material={M.black} position={[-0.3, 0.57, -0.1]}><boxGeometry args={[0.3, 0.16, 0.1]} /></mesh>
          <mesh material={M.white} position={[0.52, -0.3, -0.071]} rotation={[0, Math.PI, -0.5]}><planeGeometry args={[0.1, 0.4]} /></mesh>
        </ClickablePart>
        <ClickablePart id="bateria">
          <group ref={coin}>
            <group position={[0, -0.03, 0]} scale={[0.92, 0.92, 1]}>
              <mesh geometry={g.coin} material={coinMat} />
              {/* o "+" gravado na face */}
              <mesh material={M.metal} position={[-0.1, -0.2, -0.141]}><boxGeometry args={[0.13, 0.022, 0.002]} /></mesh>
              <mesh material={M.metal} position={[-0.1, -0.2, -0.141]}><boxGeometry args={[0.022, 0.13, 0.002]} /></mesh>
            </group>
          </group>
        </ClickablePart>
        {interactive && coverPhase === 0 && (
          <Html position={[0, 0.7, -0.2]} center style={{ pointerEvents: 'none' }}>
            <div className="fx-tag -translate-y-7 text-center text-xs font-semibold text-accent">entalhe<div className="text-xl leading-none">▼</div></div>
          </Html>
        )}
      </group>

      {interactive && (
        <>
          {(cmdPhase >= 0 || panicOn) && (
            <>
              <MiniModulo position={MINI} led={() => { const s = useShowroom.getState(); return s.action?.id === 'panico' && s.holdMsg === 'ok' ? 'sos' : null }} />
              <RadioPulse from={[0, 0.95, 0.15]} to={MINI} on={tx} />
            </>
          )}
          <mesh ref={range} material={rangeMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} userData={{ fx: true }} raycast={() => null}>
            <ringGeometry args={[0.97, 1, 96]} />
          </mesh>
          {rangePhase >= 0 && (
            <Html position={[0, -0.3, 5.4]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white">Alcance de até 30 m</div>
            </Html>
          )}
        </>
      )}
    </DeviceCtx.Provider>
  )
}
