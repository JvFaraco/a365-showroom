import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { easing } from 'maath'
import { DEVICE_BY_ID } from '../data/devices'
import { actionTime, useShowroom } from '../store/showroomStore'
import { REF_ON } from '../dev/RefMode'

const DARK = new Set(['controle', 'app'])
// constante fora do componente: o material refletor recria seus render targets quando `blur` muda de identidade
const REFLECT_BLUR: [number, number] = [300, 90]

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(190,210,255,1)'); g.addColorStop(0.55, 'rgba(120,150,255,0.35)'); g.addColorStop(1, 'rgba(80,110,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/**
 * Estúdio de produto, montado uma vez e mantido em todas as cenas: softbox grande acima e à esquerda
 * (key), fill frontal fraco e dois rim lights atrás com um leve azul da marca; chão espelhado sutil;
 * no showroom, pedestal com sombra de contato assada uma vez por aparelho.
 */
export function Stage() {
  const quality = useShowroom((s) => s.quality)
  const scene = useShowroom((s) => s.scene)
  const device = useShowroom((s) => s.device)
  const showroom = scene === 'showroom'
  const floorY = showroom ? DEVICE_BY_ID[device].bottom - 0.2 : scene === 'inaction' ? -0.02 : 0
  const ground = useRef<THREE.Group>(null!)
  const key = useRef<THREE.DirectionalLight>(null!)
  const rimW = useRef<THREE.DirectionalLight>(null!)
  const rimB = useRef<THREE.DirectionalLight>(null!)
  const amb = useRef<THREE.AmbientLight>(null!)
  const room = useRef<THREE.PointLight>(null!)
  const warm = useShowroom((s) => s.warm)
  const dim = useRef({ v: 1, rim: 1, glow: 0.12, room: 0 })
  const ringMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1E398D', emissive: '#2f66ff', emissiveIntensity: 1.3, toneMapped: false }), [])
  const pedMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d1226', roughness: 0.35, metalness: 0.6 }), [])
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), [])

  // sombra de contato: assada uma vez, depois que o aparelho pousa (nunca a cada frame)
  const [bake, setBake] = useState(1)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    if (!showroom) return
    const t = setTimeout(() => { setSettled(true); setBake((b) => b + 1) }, 1150)
    return () => clearTimeout(t)
  }, [device, showroom])

  useFrame(({ camera }, dt) => {
    // vista por baixo (fundo do módulo): o chão e o pedestal somem para não tapar
    ground.current.visible = !REF_ON && camera.position.y > floorY + 0.25
    // "sem energia": o palco escurece
    const t = actionTime('bateria-modulo')
    const dark = showroom && DARK.has(device)
    const d = dim.current
    easing.damp(d, 'v', t > 1.6 && t < 8.2 ? 0.12 : 1, 0.25, dt)
    // peça escura em fundo escuro: reforça os rim lights e clareia o piso sob o aparelho
    easing.damp(d, 'rim', dark ? 1.9 : 1, 0.4, dt)
    easing.damp(d, 'glow', dark ? 0.14 : 0.04, 0.4, dt)
    key.current.intensity = 1.25 * d.v
    amb.current.intensity = 0.16 * d.v
    rimW.current.intensity = 1.1 * d.rim * d.v
    rimB.current.intensity = 1.5 * d.rim * d.v
    glowMat.opacity = d.glow * d.v
    // luz do cômodo da cena "Em ação": existe sempre (intensidade 0 fora dela), para o número de luzes nunca mudar
    easing.damp(d, 'room', scene === 'inaction' ? 40 : 0, 0.3, dt)
    room.current.intensity = d.room
  })

  return (
    <>
      <color attach="background" args={['#05070f']} />
      <fog attach="fog" args={['#05070f', 16, 38]} />
      <ambientLight ref={amb} intensity={0.16} />
      <directionalLight ref={key} position={[-4.5, 7, 5.5]} intensity={1.25} color="#ffffff" />
      <directionalLight position={[2, 1.5, 7]} intensity={0.25} color="#ffffff" />
      <directionalLight ref={rimW} position={[5.5, 3.2, -6]} intensity={1.1} color="#e9efff" />
      <pointLight ref={room} position={[0, 3.1, 1]} intensity={0} distance={12} color="#cfd8ff" />
      <directionalLight ref={rimB} position={[-6, 2.6, -5.5]} intensity={1.5} color="#6e8dff" />
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={['#04050b']} />
        {/* key: softbox retangular grande, acima e à esquerda */}
        <Lightformer form="rect" intensity={2.1} position={[-4, 6, 3]} scale={[9, 6, 1]} rotation={[Math.PI / 2.6, 0.5, 0]} />
        {/* fill frontal fraco */}
        <Lightformer form="rect" intensity={0.35} position={[2, 1, 8]} scale={[8, 5, 1]} rotation={[0, Math.PI, 0]} />
        {/* dois rim lights atrás, com um levíssimo tom azul da marca */}
        <Lightformer form="rect" intensity={1.5} color="#dfe7ff" position={[7, 2.5, -4]} scale={[3, 7, 1]} rotation={[0, -Math.PI / 2.6, 0]} />
        <Lightformer form="rect" intensity={1.5} color="#8ea6ff" position={[-7, 2.5, -4]} scale={[3, 7, 1]} rotation={[0, Math.PI / 2.6, 0]} />
        <Lightformer form="rect" intensity={0.25} position={[0, -4, 0]} scale={[10, 10, 1]} rotation={[-Math.PI / 2, 0, 0]} />
      </Environment>

      <group ref={ground}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} raycast={() => null}>
          <planeGeometry args={[80, 80]} />
          {quality >= 3 ? (
            <meshStandardMaterial color="#05070d" roughness={1} metalness={0} envMapIntensity={0.2} />
          ) : (
            <MeshReflectorMaterial mirror={0.4} blur={REFLECT_BLUR} resolution={512} mixBlur={1} mixStrength={3.2} roughness={0.95}
              depthScale={1} minDepthThreshold={0.4} maxDepthThreshold={1.3} color="#060913" metalness={0.4} />
          )}
        </mesh>
        <group position={[0, floorY, 0]} visible={showroom || warm}>
          <mesh material={pedMat} position={[0, 0.06, 0]} raycast={() => null}><cylinderGeometry args={[1.75, 1.85, 0.12, 96]} /></mesh>
          <mesh material={ringMat} position={[0, 0.121, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><ringGeometry args={[1.67, 1.7, 128]} /></mesh>
          <mesh material={glowMat} position={[0, 0.123, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><circleGeometry args={[1.6, 48]} /></mesh>
          {/* um único ContactShadows, sempre montado: `frames` sobe de 1 em 1, e cada passo assa a sombra
              exatamente mais uma vez (no aquecimento e depois que cada aparelho pousa) */}
          {quality < 3 && (
            <ContactShadows visible={(showroom && settled) || warm} position={[0, 0.126, 0]} scale={4.2} far={2.6} blur={2.6} opacity={0.7} resolution={256} frames={bake} />
          )}
        </group>
      </group>
    </>
  )
}
