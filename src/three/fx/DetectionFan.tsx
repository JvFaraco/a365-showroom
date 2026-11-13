import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { fxBasic, mat as makeMat } from '../common/materials'

const BLUE = new THREE.Color('#3d7bff'), RED = new THREE.Color('#ff3030'), WHITE = new THREE.Color('#ffffff')

/**
 * Leque de detecção do PIR: 90° de abertura e 10 m de alcance (com marca de 8 m).
 * Fica deitado no plano XZ, abrindo para +Z a partir da origem. `length` = 10 m em unidades de cena.
 * `alert()` 0..1 tinge o leque de vermelho; `show()` 0..1 abre/fecha.
 */
export function DetectionFan({ length = 4, alert, show, labels = true, ...props }: { length?: number; alert: () => number; show: () => number; labels?: boolean } & JSX.IntrinsicElements['group']) {
  const g = useRef<THREE.Group>(null!)
  const fill = useMemo(() => fxBasic('#3d7bff', 0.16), [])
  const edge = useMemo(() => fxBasic('#3d7bff', 0.7), [])
  const scan = useMemo(() => [0, 1, 2].map(() => fxBasic('#8fb4ff', 0)), [])
  const start = Math.PI / 4 // 90° centrado em +Y do plano (que vira +Z ao deitar)
  const scans = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    const a = alert(), s = show()
    g.current.scale.setScalar(Math.max(0.001, s))
    g.current.visible = s > 0.001
    fill.color.copy(BLUE).lerp(RED, a); edge.color.copy(fill.color)
    fill.opacity = 0.14 + a * 0.16
    scan.forEach((m, i) => {
      const p = (clock.elapsedTime * 0.35 + i / 3) % 1
      scans.current.children[i].scale.setScalar(0.05 + p * 0.95)
      m.opacity = (1 - p) * 0.55
      m.color.copy(fill.color).lerp(WHITE, 0.4)
    })
  })
  return (
    <group {...props}>
      <group ref={g} rotation={[Math.PI / 2, 0, 0]}>
        <mesh material={fill} userData={{ fx: true }} raycast={() => null}><circleGeometry args={[length, 48, start, Math.PI / 2]} /></mesh>
        <mesh material={edge} userData={{ fx: true }} raycast={() => null} position={[0, 0, -0.004]}><ringGeometry args={[length * 0.992, length, 48, 1, start, Math.PI / 2]} /></mesh>
        <mesh material={edge} userData={{ fx: true }} raycast={() => null} position={[0, 0, -0.004]}><ringGeometry args={[length * 0.795, length * 0.8, 48, 1, start, Math.PI / 2]} /></mesh>
        <group ref={scans} position={[0, 0, -0.008]}>
          {scan.map((m, i) => <mesh key={i} material={m} userData={{ fx: true }} raycast={() => null}><ringGeometry args={[length * 0.97, length, 48, 1, start, Math.PI / 2]} /></mesh>)}
        </group>
        {labels && (
          <>
        <Html position={[length * 0.8 * Math.cos(start), length * 0.8 * Math.sin(start), 0]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded bg-black/60 px-1.5 text-xs font-semibold text-white">8 m</div>
            </Html>
            <Html position={[length * Math.cos(start), length * Math.sin(start), 0]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded bg-black/60 px-1.5 text-xs font-semibold text-white">10 m</div>
            </Html>
            <Html position={[0, length * 0.42, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">90°</div>
            </Html>
          </>
        )}
      </group>
    </group>
  )
}

/** Silhueta humana low-poly (altura ~1 antes da escala), pés na origem. */
export function LowPolyPerson({ color = '#c8d2e6', ...props }: { color?: string } & JSX.IntrinsicElements['group']) {
  const mat = useMemo(() => makeMat({ color, roughness: 0.8, flatShading: true }), [color])
  return (
    <group {...props}>
      <mesh material={mat} position={[0, 0.9, 0]} userData={{ fx: true }}><icosahedronGeometry args={[0.09, 0]} /></mesh>
      <mesh material={mat} position={[0, 0.62, 0]} userData={{ fx: true }}><cylinderGeometry args={[0.13, 0.1, 0.36, 6]} /></mesh>
      <mesh material={mat} position={[-0.06, 0.22, 0]} userData={{ fx: true }}><cylinderGeometry args={[0.05, 0.04, 0.44, 5]} /></mesh>
      <mesh material={mat} position={[0.06, 0.22, 0]} userData={{ fx: true }}><cylinderGeometry args={[0.05, 0.04, 0.44, 5]} /></mesh>
      <mesh material={mat} position={[-0.17, 0.6, 0]} rotation={[0, 0, -0.2]} userData={{ fx: true }}><cylinderGeometry args={[0.035, 0.03, 0.36, 5]} /></mesh>
      <mesh material={mat} position={[0.17, 0.6, 0]} rotation={[0, 0, 0.2]} userData={{ fx: true }}><cylinderGeometry args={[0.035, 0.03, 0.36, 5]} /></mesh>
    </group>
  )
}

/** Cachorrinho low-poly, patas na origem, olhando para +X. */
export function LowPolyDog({ color = '#d9a066', ...props }: { color?: string } & JSX.IntrinsicElements['group']) {
  const mat = useMemo(() => makeMat({ color, roughness: 0.8, flatShading: true }), [color])
  return (
    <group {...props}>
      <mesh material={mat} position={[0, 0.2, 0]} userData={{ fx: true }}><boxGeometry args={[0.36, 0.14, 0.14]} /></mesh>
      <mesh material={mat} position={[0.22, 0.3, 0]} userData={{ fx: true }}><boxGeometry args={[0.14, 0.13, 0.13]} /></mesh>
      <mesh material={mat} position={[0.31, 0.27, 0]} userData={{ fx: true }}><boxGeometry args={[0.08, 0.06, 0.07]} /></mesh>
      <mesh material={mat} position={[0.2, 0.39, 0.045]} userData={{ fx: true }}><coneGeometry args={[0.03, 0.07, 4]} /></mesh>
      <mesh material={mat} position={[0.2, 0.39, -0.045]} userData={{ fx: true }}><coneGeometry args={[0.03, 0.07, 4]} /></mesh>
      <mesh material={mat} position={[-0.2, 0.3, 0]} rotation={[0, 0, 0.7]} userData={{ fx: true }}><boxGeometry args={[0.03, 0.14, 0.03]} /></mesh>
      {[[-0.13, 0.05], [-0.13, -0.05], [0.13, 0.05], [0.13, -0.05]].map(([x, z], i) => (
        <mesh key={i} material={mat} position={[x, 0.07, z]} userData={{ fx: true }}><boxGeometry args={[0.04, 0.14, 0.04]} /></mesh>
      ))}
    </group>
  )
}
