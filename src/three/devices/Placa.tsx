import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ClickablePart } from '../parts/ClickablePart'
import { fxBasic } from '../common/materials'
import { placaFaixaTexture, placaFoneTexture, placaLogoTexture, placaRodapeTexture, placaVersoTexture } from '../common/textures'
import { roundedRectGeometry } from '../common/shapes'
import { DeviceCtx, bump, seg, type DeviceProps } from '../common/util'
import { actionTime } from '../../store/showroomStore'

// chapa pintada: cor viva (um pouco de emissivo) com um leve brilho de verniz
const face = (map: THREE.Texture | null) => new THREE.MeshPhysicalMaterial({ color: map ? '#ffffff' : '#1E398D', map, emissive: map ? '#ffffff' : '#1E398D', emissiveMap: map, emissiveIntensity: 0.55, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.3 })

/** Placa de aviso: retângulo azul de cantos redondos; frente com logo, telefone e faixa amarela; verso com QR Code. */
export function Placa({ interactive = false }: DeviceProps) {
  const root = useRef<THREE.Group>(null!)
  const shine = useRef<THREE.Mesh>(null!)
  const plate = useMemo(() => roundedRectGeometry(1.5, 2, 0.105, 0.04, 0.008), [])
  const mats = useMemo(() => ({
    logo: face(placaLogoTexture()), fone: face(placaFoneTexture()), faixa: face(placaFaixaTexture()),
    rodape: face(placaRodapeTexture()), verso: face(placaVersoTexture()), chapa: face(null),
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
    shine.current.position.z = tb >= 0 ? 0.036 : -0.036
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'placa', interactive }}>
      <group ref={root}>
        <ClickablePart follow="corpo">
          <mesh geometry={plate} material={mats.chapa} castShadow />
          <mesh material={mats.rodape} position={[0, -0.84, 0.0292]}><planeGeometry args={[1.3, 0.3]} /></mesh>
        </ClickablePart>
        <ClickablePart id="logo">
          <mesh material={mats.logo} position={[0, 0.5, 0.0292]}><planeGeometry args={[1.3, 0.96]} /></mesh>
        </ClickablePart>
        <ClickablePart id="telefone">
          <mesh material={mats.fone} position={[0, -0.13, 0.0292]}><planeGeometry args={[1.3, 0.34]} /></mesh>
        </ClickablePart>
        <ClickablePart id="faixa">
          <mesh material={mats.faixa} position={[0, -0.5, 0.0298]}><planeGeometry args={[1.5, 0.346]} /></mesh>
        </ClickablePart>
        <ClickablePart id="verso">
          <mesh material={mats.verso} position={[0, 0, -0.0292]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.38, 1.84]} /></mesh>
        </ClickablePart>
        <mesh ref={shine} material={shineMat} userData={{ fx: true }} raycast={() => null}><planeGeometry args={[0.22, 1.94]} /></mesh>
      </group>
    </DeviceCtx.Provider>
  )
}
