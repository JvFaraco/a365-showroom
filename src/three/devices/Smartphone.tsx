import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M } from '../common/materials'
import { roundedRectGeometry } from '../common/shapes'
import { DeviceCtx, useActionPhase, type DeviceProps } from '../common/util'
import { AppScreen } from '../../ui/AppScreen'
import { MiniModulo } from '../fx/MiniModulo'

const SCREEN_W = 0.87
const PX = 320 // largura da tela em px de CSS
const HTML_SCALE = SCREEN_W / (PX / 40) // drei: 40 px de CSS = 1 unidade de cena

/**
 * Smartphone com o aplicativo Alarme Orsegups. A tela é React de verdade dentro do 3D
 * (<Html transform occlude>); cada região da tela é uma parte clicável (ver AppScreen).
 */
export function Smartphone({ interactive = false }: DeviceProps) {
  const body = useRef<THREE.Mesh>(null!)
  const frame = useMemo(() => roundedRectGeometry(0.95, 1.95, 0.13, 0.07, 0.012), [])
  const glass = useMemo(() => roundedRectGeometry(0.89, 1.89, 0.11, 0.004, 0), [])
  const armOn = useActionPhase('alarme-geral') >= 0

  return (
    <DeviceCtx.Provider value={{ deviceId: 'app', interactive }}>
      <ClickablePart follow="corpo">
        <mesh ref={body} geometry={frame} material={M.blackGloss} castShadow />
        <mesh geometry={glass} material={M.lens} position={[0, 0, 0.046]} />
        <mesh material={M.metal} position={[0.482, 0.4, 0]}><boxGeometry args={[0.012, 0.22, 0.03]} /></mesh>
        <mesh material={M.lens} position={[-0.25, 0.7, -0.05]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.02, 24]} /></mesh>
      </ClickablePart>
      <Html transform occlude={[body]} position={[0, 0, 0.052]} scale={HTML_SCALE} zIndexRange={[10, 0]}
        style={{ transition: 'opacity .2s' }} pointerEvents={interactive ? 'auto' : 'none'}>
        <AppScreen interactive={interactive} />
      </Html>
      {interactive && armOn && <MiniModulo position={[-1.05, 0.55, 0.1]} scale={0.8} />}
    </DeviceCtx.Provider>
  )
}
