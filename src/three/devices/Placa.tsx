import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { placaFaixaTexture, placaFoneTexture, placaLogoTexture, placaRodapeTexture, placaVersoTexture } from '../common/textures'
import { roundedRectGeometry } from '../common/shapes'
import { DeviceCtx, bump, seg, type DeviceProps } from '../common/util'
import { actionTime } from '../../store/showroomStore'

const face = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.1 })

/** Placa de aviso: retângulo azul de cantos redondos; frente com logo, telefone e faixa amarela; verso com QR Code. */
export function Placa({ interactive = false }: DeviceProps) {
  const root = useRef<THREE.Group>(null!)
  const shine = useRef<THREE.Mesh>(null!)
  const plate = useMemo(() => roundedRectGeometry(1.5, 2, 0.1, 0.04, 0.006), [])
  const mats = useMemo(() => ({
    logo: face(placaLogoTexture()), fone: face(placaFoneTexture()), faixa: face(placaFaixaTexture()),
    rodape: face(placaRodapeTexture()), verso: face(placaVersoTexture()),
  }), [])
  const shineMat = useMemo(() => { const m = fxBasic('#ffffff', 0); m.blending = THREE.AdditiveBlending; return m }, [])

  useFrame(() => {
    if (!interactive) return
    const tf = actionTime('flip')
    root.current.rotation.y = tf < 0 ? 0 : bump(tf, 0.3, 1.7, 3.2, 4.6) * Math.PI
    // brilho especular varrendo a superfície (também no fim do flip)
    const tb = actionTime('brilho')
    const k = tb >= 0 ? seg(tb, 0.2, 2.2) : tf >= 0 ? seg(tf, 1.7, 3.0) : -1
    shine.current.position.x = -0.62 + Math.max(0, k) * 1.24
    shineMat.opacity = k <= 0 || k >= 1 ? 0 : Math.sin(k * Math.PI) * 0.35
    shine.current.position.z = tb >= 0 ? 0.034 : -0.034
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'placa', interactive }}>
      <group ref={root}>
        <ClickablePart follow="corpo">
          <mesh geometry={plate} material={M.blue} castShadow />
          <mesh material={mats.rodape} position={[0, -0.87, 0.0275]}><planeGeometry args={[1.2, 0.234]} /></mesh>
        </ClickablePart>
        <ClickablePart id="logo">
          <mesh material={mats.logo} position={[0, 0.48, 0.0275]}><planeGeometry args={[1.2, 1.0]} /></mesh>
        </ClickablePart>
        <ClickablePart id="telefone">
          <mesh material={mats.fone} position={[0, -0.2, 0.0275]}><planeGeometry args={[1.2, 0.344]} /></mesh>
        </ClickablePart>
        <ClickablePart id="faixa">
          <mesh material={mats.faixa} position={[0, -0.565, 0.0285]}><planeGeometry args={[1.5, 0.371]} /></mesh>
        </ClickablePart>
        <ClickablePart id="verso">
          <mesh material={mats.verso} position={[0, 0, -0.0275]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.38, 1.84]} /></mesh>
        </ClickablePart>
        <mesh ref={shine} material={shineMat} userData={{ fx: true }} raycast={() => null}><planeGeometry args={[0.22, 1.94]} /></mesh>
      </group>
    </DeviceCtx.Provider>
  )
}
