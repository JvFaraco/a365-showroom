import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoRelief } from '../common/Logo'
import { Led } from '../common/Led'
import { iconTexture, type IconId } from '../common/textures'
import { latheZ, ringSectorGeometry, stadiumGeometry } from '../common/shapes'
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

/** Controle remoto: chaveiro redondo preto fosco com filete azul, 4 botões em cruz e argola. Frente em +Z. */
export function ControleRemoto({ interactive = false, pressed }: DeviceProps & { pressed?: () => string | null }) {
  const body = useMemo(() => latheZ([[0.68, -0.17], [0.8, -0.17], [0.875, -0.12], [0.9, 0], [0.875, 0.12], [0.8, 0.17], [0.001, 0.17]]), [])
  const sector = useMemo(() => ringSectorGeometry(0.34, 0.7, -38 * D2R, 38 * D2R, 0.03, 0.012), [])
  const tail = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.62, -0.6); s.lineTo(0.62, -0.6); s.quadraticCurveTo(0.3, -1.0, 0.2, -1.2); s.lineTo(-0.2, -1.2); s.quadraticCurveTo(-0.3, -1.0, -0.62, -0.6)
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 })
    g.translate(0, 0, -0.1)
    return g
  }, [])
  // corpo oco atrás (a tampa fecha a abertura), por isso o material tem dois lados
  const shellMat = useMemo(() => { const m = M.black.clone(); m.side = THREE.DoubleSide; return m }, [])
  const coinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dfe2e8', roughness: 0.35, metalness: 0.55 }), [])
  const coverMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b3e46', roughness: 0.6 }), [])
  const slit = useMemo(() => stadiumGeometry(0.22, 0.045, 0.01, 0.003), [])
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
    coin.current.position.set(0, slide * 0.62, -slide * 0.08)
    const ta = actionTime('alcance')
    const k = ta < 0 ? 0 : seg(ta, 0.2, 2.6)
    range.current.scale.setScalar(0.2 + k * 5.2)
    rangeMat.opacity = ta < 0 ? 0 : 0.8 * (1 - seg(ta, 4.8, 5.8)) * seg(ta, 0.1, 0.5)
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'controle', interactive }}>
      <group ref={root} position={[0, 0.1, 0]}>
        <ClickablePart id="corpo">
          <mesh geometry={body} material={shellMat} castShadow />
          <mesh material={M.black} position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.7, 0.7, 0.02, 48]} /></mesh>
          <mesh geometry={tail} material={M.black} castShadow />
          <mesh material={M.blueGlow}><torusGeometry args={[0.895, 0.028, 12, 96]} /></mesh>
          <mesh material={M.blackGloss} position={[0, 0, 0.171]}><ringGeometry args={[0.72, 0.8, 64]} /></mesh>
        </ClickablePart>
        <ClickablePart id="argola">
          <mesh material={M.black} position={[0, -1.2, 0]}><torusGeometry args={[0.15, 0.06, 14, 40]} /></mesh>
          <mesh material={M.blueGlow} position={[0, -1.2, 0]}><torusGeometry args={[0.215, 0.012, 8, 40]} /></mesh>
        </ClickablePart>
        <ClickablePart id="led">
          <mesh geometry={slit} material={M.blackGloss} position={[0, 0.775, 0.128]} rotation={[-0.75, 0, 0]} />
          <Led sample={(t, o) => { o.color = '#ff3030'; o.on = tx() ? (t % 0.24 < 0.12 ? 1 : 0.1) : 0.03 }} position={[0, 0.782, 0.138]} rotation={[-0.75, 0, 0]}>
            <boxGeometry args={[0.16, 0.022, 0.004]} />
          </Led>
        </ClickablePart>

        {/* 4 botões em cruz + botão central com o logo */}
        {BUTTONS.map((b, i) => (
          <ClickablePart key={b.id} id={b.id}>
            <group ref={(g) => { btnRefs.current[i] = g }}
              onPointerDown={b.action === 'panico' ? (e) => { if (panicOn) { e.stopPropagation(); useShowroom.getState().set({ holding: true, holdMsg: '' }) } } : undefined}
              onPointerUp={b.action === 'panico' ? () => panicOn && useShowroom.getState().set({ holding: false }) : undefined}
              onPointerLeave={b.action === 'panico' ? () => panicOn && useShowroom.getState().set({ holding: false }) : undefined}>
              <mesh geometry={sector} material={M.greyDark} position={[0, 0, 0.165]} rotation={[0, 0, b.angle * D2R]} />
              <mesh material={icons[i]} position={[Math.cos(b.angle * D2R) * 0.52, Math.sin(b.angle * D2R) * 0.52, 0.212]}><planeGeometry args={[0.24, 0.24]} /></mesh>
            </group>
            {interactive && b.action === 'panico' && <HoldRing radius={0.2} position={[0, 0.52, 0.23]} />}
          </ClickablePart>
        ))}
        <ClickablePart id="btn-central">
          <mesh material={M.black} position={[0, 0, 0.19]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.29, 0.3, 0.06, 48]} /></mesh>
          <LogoRelief r={0.13} position={[0, 0, 0.22]} depth={0.008} material={M.grey} />
        </ClickablePart>

        {/* traseira e interior */}
        {/* tampa traseira lisa, com o entalhe no topo e um símbolo em baixo-relevo; levanta pela borda de cima */}
        <ClickablePart id="tampa">
          <group position={[0, -0.66, -0.175]}>
            <group ref={cover}>
              <mesh material={coverMat} position={[0, 0.66, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.68, 0.68, 0.025, 56]} /></mesh>
              <mesh material={M.hole} position={[0, 1.26, -0.006]}><boxGeometry args={[0.2, 0.07, 0.02]} /></mesh>
              <mesh material={M.black} position={[0, 0.95, -0.014]} rotation={[Math.PI / 2, Math.PI / 6, 0]}><cylinderGeometry args={[0.07, 0.07, 0.006, 3]} /></mesh>
              <mesh material={M.black} position={[0, 0.82, -0.014]}><boxGeometry args={[0.2, 0.035, 0.006]} /></mesh>
            </group>
          </group>
        </ClickablePart>
        {/* placa verde com o suporte metálico dourado e a etiqueta (lisa, sem texto) */}
        <ClickablePart internal>
          <mesh material={M.pcb} position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.62, 0.62, 0.02, 48]} /></mesh>
          <mesh material={M.gold} position={[0, -0.05, -0.085]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.46, 0.46, 0.03, 40, 1, true, 2.2, 5.0]} /></mesh>
          <mesh material={M.gold} position={[0, -0.05, -0.145]}><boxGeometry args={[0.18, 0.5, 0.008]} /></mesh>
          <mesh material={M.white} position={[0, -0.5, -0.072]}><boxGeometry args={[0.5, 0.1, 0.004]} /></mesh>
        </ClickablePart>
        <ClickablePart id="bateria">
          <group ref={coin}>
            <mesh material={coinMat} position={[0, -0.05, -0.11]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.42, 0.42, 0.06, 48]} /></mesh>
          </group>
        </ClickablePart>
        {interactive && coverPhase === 0 && (
          <Html position={[0, 0.78, -0.2]} center style={{ pointerEvents: 'none' }}>
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
