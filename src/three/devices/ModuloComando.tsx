import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoRelief } from '../common/Logo'
import { Led } from '../common/Led'
import { grilleTexture } from '../common/textures'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import { LED_BY_ID, ledSample } from '../../data/ledStates'
import { actionTime, useShowroom } from '../../store/showroomStore'
import { CommLinks } from '../fx/CommLinks'
import { VoiceWaves } from '../fx/VoiceWaves'
import { HoldRing } from '../fx/HoldRing'

const R = 1
const WEDGE = 0.3 // a face cai para a frente: atrás mais alto, na frente mais baixo
const VIAS_TO: [number, number, number][] = [[-1.5, 1.9, -0.6], [0, 2.3, -0.9], [1.5, 1.9, -0.6]]
const VIAS_FROM: [number, number, number] = [0, 0.35, 0]

function useLidGeometry() {
  return useMemo(() => {
    const pts = [[1.02, 0], [1.02, 0.04], [1.0, 0.14], [0.93, 0.24], [0.8, 0.285], [0.55, 0.3], [0.25, 0.302], [0.001, 0.302]]
      .map(([x, y]) => new THREE.Vector2(x, y))
    const g = new THREE.LatheGeometry(pts, 96, Math.PI) // emenda atrás
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 - (WEDGE * p.getZ(i)) / R))
    g.computeVertexNormals()
    return g
  }, [])
}

/** Módulo de Comando: disco baixo com tampa em cúpula, aletas, antena e fundo cinza. Y para cima, frente em +Z. */
export function ModuloComando({ interactive = false, ledOverride }: DeviceProps & { ledOverride?: () => keyof typeof LED_BY_ID | null }) {
  const lid = useLidGeometry()
  const antenna = useRef<THREE.Group>(null!)
  const fan = useRef<THREE.Group>(null!)
  const button = useRef<THREE.Group>(null!)
  const plug = useRef<THREE.Group>(null!)
  const grille = useMemo(() => new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.7 }), [])
  const cable = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, -0.02, -0.1), new THREE.Vector3(1.3, -0.02, 0.2), new THREE.Vector3(2.4, -0.02, 0.1),
  ]), 24, 0.03, 8), [])
  const cableMat = useMemo(() => fxBasic('#2a2d35'), [])
  const fins = useRef<THREE.InstancedMesh>(null!)
  const finsReady = useRef(false)
  const viasPhase = useActionPhase('antena', [4, 7.5, 10])
  const audioPhase = useActionPhase('audio', [1.2])
  const batPhase = useActionPhase('bateria-modulo', [2.2])
  const sosActive = useActionPhase('sos190') >= 0

  useFrame(({ clock }, dt) => {
    if (!finsReady.current && fins.current) {
      const o = new THREE.Object3D(), N = 52
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2
        o.position.set(Math.sin(a) * 0.88, -0.17, Math.cos(a) * 0.88)
        o.rotation.set(0, a, 0)
        o.updateMatrix(); fins.current.setMatrixAt(i, o.matrix)
      }
      fins.current.instanceMatrix.needsUpdate = true
      finsReady.current = true
    }
    fan.current.rotation.y -= dt * 9
    if (!interactive) return
    // antena: desrosqueia, sai e volta
    const ta = actionTime('antena')
    const out = ta < 0 ? 0 : bump(ta, 0, 1.5, 2.1, 3.6)
    antenna.current.position.z = -out * 0.4
    antenna.current.rotation.z = -out * Math.PI * 2
    // botão 190 afunda enquanto é segurado
    const s = useShowroom.getState()
    button.current.position.y = s.holding && s.action?.id === 'sos190' ? -0.012 : 0
    // tomada sai
    const tb = actionTime('bateria-modulo')
    const k = tb < 0 ? 0 : seg(tb, 0.6, 1.8)
    plug.current.visible = tb >= 0
    plug.current.position.x = 0.3 + k * 0.7
    void clock
  })

  const sampleLed = (t: number, out: { color: string; on: number }) => {
    const s = useShowroom.getState()
    let id = ledOverride?.() ?? s.ledState
    if (interactive) {
      if (actionTime('audio') >= 0) id = 'audio'
      else if (s.action?.id === 'sos190' && s.holdMsg === 'ok') id = 'sos'
    }
    ledSample(LED_BY_ID[id], t, out)
  }

  return (
    <DeviceCtx.Provider value={{ deviceId: 'modulo', interactive }}>
      {/* ---------- tampa em cúpula ---------- */}
      <ClickablePart id="tampa">
        <mesh geometry={lid} material={M.white} castShadow />
        <LogoRelief r={0.3} position={[0, 0.3, -0.05]} rotation={[-Math.PI / 2 + 0.09, 0, 0]} />
      </ClickablePart>

      <ClickablePart id="botao-sos">
        <group position={[0, 0.232, 0.68]} rotation={[0.16, 0, 0]}>
          <group ref={button}
            onPointerDown={(e) => { if (sosActive) { e.stopPropagation(); useShowroom.getState().set({ holding: true, holdMsg: '' }) } }}
            onPointerUp={() => sosActive && useShowroom.getState().set({ holding: false })}
            onPointerLeave={() => sosActive && useShowroom.getState().set({ holding: false })}>
            <mesh material={M.whiteRelief} scale={[1.55, 1, 1]}><cylinderGeometry args={[0.075, 0.08, 0.03, 40]} /></mesh>
            <mesh material={M.white} scale={[1.55, 1, 1]} position={[0, 0.012, 0]}><cylinderGeometry args={[0.06, 0.06, 0.02, 40]} /></mesh>
            <mesh material={M.greyDark} position={[0, 0.024, 0]}><cylinderGeometry args={[0.022, 0.022, 0.006, 20]} /></mesh>
          </group>
          {interactive && <HoldRing radius={0.19} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} />}
        </group>
      </ClickablePart>

      <ClickablePart id="led">
        <mesh material={M.whiteRelief} position={[0, 0.062, 1.008]} rotation={[-0.12, 0, 0]}><boxGeometry args={[0.3, 0.05, 0.02]} /></mesh>
        <Led sample={sampleLed} position={[0, 0.062, 1.016]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.24, 0.024, 0.016]} />
        </Led>
      </ClickablePart>

      {/* ---------- antena tipo pá, com conector rosqueado ---------- */}
      <ClickablePart id="antena">
        <group position={[0, 0.03, -0.96]}>
          <mesh material={M.gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.03]}><cylinderGeometry args={[0.05, 0.05, 0.08, 16]} /></mesh>
          <group ref={antenna}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} material={M.gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.08 - i * 0.022]}><cylinderGeometry args={[0.062, 0.062, 0.012, 6]} /></mesh>
            ))}
            <mesh material={M.white} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.2]}><cylinderGeometry args={[0.058, 0.058, 0.1, 20]} /></mesh>
            <mesh material={M.white} position={[0, 0, -0.26]}><sphereGeometry args={[0.07, 20, 14]} /></mesh>
            <group position={[0, 0, -0.26]} rotation={[-0.5, 0, 0]}>
              <mesh material={M.white} position={[0, 0.12, 0]}><cylinderGeometry args={[0.05, 0.055, 0.2, 20]} /></mesh>
              <RoundedBox args={[0.17, 1.2, 0.07]} radius={0.034} smoothness={4} position={[0, 0.78, 0]} material={M.white} castShadow />
            </group>
          </group>
        </group>
      </ClickablePart>

      {/* ---------- saia com aletas + fundo cinza ---------- */}
      <ClickablePart id="aletas">
        <mesh material={M.grey} position={[0, -0.17, 0]}><cylinderGeometry args={[0.86, 0.78, 0.34, 64, 1, true]} /></mesh>
        <instancedMesh ref={fins} args={[undefined, undefined, 52]} material={M.grey} castShadow>
          <boxGeometry args={[0.035, 0.3, 0.2]} />
        </instancedMesh>
      </ClickablePart>
      <ClickablePart follow="aletas">
        <mesh material={M.grey} position={[0, -0.365, 0]}><cylinderGeometry args={[0.8, 0.78, 0.05, 64]} /></mesh>
        {[[0.55, 0.55], [-0.55, 0.55], [0.55, -0.4], [-0.55, -0.4]].map(([x, z], i) => (
          <mesh key={i} material={M.greyDark} position={[x, -0.395, z]}><cylinderGeometry args={[0.06, 0.06, 0.02, 16]} /></mesh>
        ))}
      </ClickablePart>

      <ClickablePart id="alto-falante">
        <mesh material={grille} position={[0, -0.3915, 0.3]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.27, 40]} /></mesh>
        <mesh material={M.greyDark} position={[0, -0.39, 0.3]} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[0.27, 0.3, 40]} /></mesh>
        <mesh material={M.hole} position={[0.4, -0.3915, 0.3]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.022, 12]} /></mesh>
      </ClickablePart>
      <ClickablePart id="ethernet">
        <mesh material={M.greyDark} position={[-0.3, -0.385, -0.5]}><boxGeometry args={[0.3, 0.03, 0.3]} /></mesh>
        <mesh material={M.hole} position={[-0.3, -0.398, -0.5]}><boxGeometry args={[0.2, 0.012, 0.18]} /></mesh>
        <mesh material={M.gold} position={[-0.3, -0.4, -0.44]}><boxGeometry args={[0.14, 0.012, 0.03]} /></mesh>
      </ClickablePart>
      <ClickablePart id="fonte">
        <mesh material={M.greyDark} position={[0.3, -0.39, -0.55]}><cylinderGeometry args={[0.085, 0.085, 0.03, 24]} /></mesh>
        <mesh material={M.hole} position={[0.3, -0.401, -0.55]}><cylinderGeometry args={[0.05, 0.05, 0.012, 20]} /></mesh>
        <mesh material={M.gold} position={[0.3, -0.405, -0.55]}><cylinderGeometry args={[0.014, 0.014, 0.012, 10]} /></mesh>
      </ClickablePart>

      {/* ---------- interior ---------- */}
      <ClickablePart id="placa-principal">
        <mesh material={M.pcb} position={[0, -0.08, 0]}><cylinderGeometry args={[0.76, 0.76, 0.025, 48]} /></mesh>
        <mesh material={M.metal} position={[0.05, -0.05, 0.28]}><boxGeometry args={[0.3, 0.035, 0.24]} /></mesh>
        <mesh material={M.chip} position={[-0.3, -0.055, -0.25]}><boxGeometry args={[0.2, 0.025, 0.2]} /></mesh>
        <mesh material={M.chip} position={[0.42, -0.055, 0.1]}><boxGeometry args={[0.12, 0.025, 0.16]} /></mesh>
        <mesh material={M.metal} position={[-0.1, -0.05, -0.55]}><boxGeometry args={[0.16, 0.05, 0.12]} /></mesh>
        {[[-0.55, 0.05], [-0.5, -0.05], [0.2, -0.1], [0.6, -0.2], [-0.1, 0.55]].map(([x, z], i) => (
          <mesh key={i} material={i % 2 ? M.chip : M.gold} position={[x, -0.058, z]}><boxGeometry args={[0.05, 0.02, 0.08]} /></mesh>
        ))}
      </ClickablePart>
      <ClickablePart id="ventoinha">
        <group position={[0.32, -0.02, -0.32]}>
          <mesh material={M.chip}><cylinderGeometry args={[0.2, 0.2, 0.07, 28, 1, true]} /></mesh>
          <mesh material={M.chip} position={[0, -0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.16, 0.2, 28]} /></mesh>
          <group ref={fan}>
            <mesh material={M.black}><cylinderGeometry args={[0.065, 0.065, 0.06, 16]} /></mesh>
            {Array.from({ length: 7 }, (_, i) => (
              <group key={i} rotation={[0, (i / 7) * Math.PI * 2, 0]}>
                <mesh material={M.black} position={[0.115, 0, 0]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.12, 0.008, 0.07]} /></mesh>
              </group>
            ))}
          </group>
        </group>
      </ClickablePart>
      <ClickablePart id="chip-4g">
        <group position={[-0.38, -0.05, 0.3]}>
          <mesh material={M.metal}><boxGeometry args={[0.22, 0.03, 0.26]} /></mesh>
          <mesh material={M.white} position={[0, 0.012, 0.07]}><boxGeometry args={[0.17, 0.012, 0.22]} /></mesh>
          <mesh material={M.gold} position={[0, 0.02, 0.1]}><boxGeometry args={[0.09, 0.004, 0.09]} /></mesh>
        </group>
      </ClickablePart>
      <ClickablePart id="bateria">
        <RoundedBox args={[0.74, 0.14, 0.42]} radius={0.03} smoothness={3} position={[0, -0.22, 0.05]} material={M.blue} />
        <mesh material={M.yellow} position={[0, -0.148, 0.05]}><boxGeometry args={[0.4, 0.004, 0.2]} /></mesh>
        <mesh material={M.red} position={[0.4, -0.18, 0.1]} rotation={[0, 0, 0.9]}><cylinderGeometry args={[0.012, 0.012, 0.2, 6]} /></mesh>
        <mesh material={M.black} position={[0.4, -0.18, 0.02]} rotation={[0, 0, 0.9]}><cylinderGeometry args={[0.012, 0.012, 0.2, 6]} /></mesh>
      </ClickablePart>

      {/* ---------- efeitos das micro-animações ---------- */}
      {interactive && (
        <>
          <CommLinks from={VIAS_FROM} to={VIAS_TO} state={(i) => {
            const t = actionTime('antena')
            if (t < 4.2 + i * 0.7) return 0
            if (i === 0 && t > 7.5 && t < 10.5) return 2
            if (i === 1 && t > 8.3 && t < 10.5) return 3
            return 1
          }} />
          {viasPhase >= 1 && (
            <Html position={[0, 2.9, -0.7]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-full bg-black/70 px-4 py-1.5 text-sm font-semibold text-white">
                {viasPhase === 1 ? 'Caiu o 4G? Outra via assume.' : 'Três vias: sempre conectado.'}
              </div>
            </Html>
          )}
          <VoiceWaves on={() => actionTime('audio') >= 0.4} position={[0, -0.42, 0.3]} rotation={[0.5, 0, Math.PI]} />
          {audioPhase >= 0 && (
            <Html position={[0.9, -0.9, 0.9]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-2xl rounded-bl-none bg-white px-4 py-2 text-sm font-semibold text-[#1E398D] shadow-lg">
                Central Orsegups: Olá, está tudo bem?
              </div>
            </Html>
          )}
          <group ref={plug} position={[0.3, -0.4, -0.55]} visible={false}>
            <mesh geometry={cable} material={cableMat} userData={{ fx: true }} raycast={() => null} />
            <mesh material={M.black} rotation={[0, 0, Math.PI / 2]} userData={{ fx: true }} raycast={() => null}><cylinderGeometry args={[0.05, 0.05, 0.16, 12]} /></mesh>
          </group>
          {batPhase >= 0 && (
            <Html position={[0, 1.15, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag flex items-center gap-3 rounded-2xl bg-black/75 px-4 py-2 text-white">
                <svg width="44" height="22" viewBox="0 0 44 22"><rect x="1" y="1" width="37" height="20" rx="4" fill="none" stroke="#fff" strokeWidth="2" /><rect x="40" y="7" width="3" height="8" rx="1" fill="#fff" /><rect x="4" y="4" width="26" height="14" rx="2" fill="hsl(128 53% 50%)" /></svg>
                <div className="text-left leading-tight"><div className="text-lg font-bold">~3 h</div><div className="text-xs font-normal opacity-80">sem energia, tudo segue ligado</div></div>
              </div>
            </Html>
          )}
        </>
      )}
    </DeviceCtx.Provider>
  )
}
