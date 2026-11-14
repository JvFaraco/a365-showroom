import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { easing } from 'maath'
import { DEVICE_BY_ID } from '../data/devices'
import { actionTime, roomFx, useShowroom } from '../store/showroomStore'
import { REF_ON } from '../dev/RefMode'
import { pedestalRadius } from './common/registry'

const DARK = new Set(['controle', 'app'])
// constante fora do componente: o material refletor recria seus render targets quando `blur` muda de identidade
const REFLECT_BLUR: [number, number] = [300, 90]

const ROOM_DAY = new THREE.Color('#cfd8ff'), ROOM_NIGHT = new THREE.Color('#8fa4dc'), ROOM_RED = new THREE.Color('#ff2a2a'), ROOM_FLASH = new THREE.Color('#ffffff')
const NO_FX = { flash: 0, red: 0, night: 0 }
const KEY_DAY = new THREE.Color('#ffffff'), KEY_NIGHT = new THREE.Color('#b4c2ea')
// a luz do cômodo sai de onde a luz vem: do teto, puxada para a janela à noite, para a sirene quando ela pisca em
// vermelho e para o fotossensor no flash (só muda a posição de uma luz que já existe)
const ROOM_POS = new THREE.Vector3(0, 3.1, 1), ROOM_MOON = new THREE.Vector3(-2.2, 2.6, 1.1)
const ROOM_SIREN = new THREE.Vector3(-1.2, 2.4, -2.3), ROOM_PHOTO = new THREE.Vector3(-3.0, 2.1, -2.0)

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(235,238,245,1)'); g.addColorStop(0.55, 'rgba(200,206,220,0.3)'); g.addColorStop(1, 'rgba(180,188,205,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/**
 * Estúdio de produto, montado uma vez e mantido em todas as cenas: softbox grande acima e à esquerda
 * (key), fill frontal fraco e dois rim lights atrás; reflexo do piso discreto; no showroom, um pedestal
 * neutro e fosco com sombra de contato assada uma vez por aparelho. O ambiente (HDRI de estúdio) é
 * gerado no carregamento com Lightformers: vai dentro do build e funciona sem internet.
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
  const ped = useRef<THREE.Group>(null!)
  const warm = useShowroom((s) => s.warm)
  const dim = useRef({ v: 1, rim: 1, glow: 0.12, room: 0, ped: 1 })
  // pedestal: disco neutro, fosco e discreto (sem aro luminoso); só um chanfro um pouco mais claro na borda
  const ringMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2d35', roughness: 0.8 }), [])
  const pedMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#17191f', roughness: 0.85, metalness: 0 }), [])
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

  useFrame(({ camera, scene: sc }, dt) => {
    // névoa: começa um pouco antes do centro da cena, nunca antes de 16 (no celular a câmera recua mais)
    const fog = sc.fog as THREE.Fog | null
    if (fog) { fog.near = Math.max(16, camera.position.length() * 0.95); fog.far = fog.near + 22 }
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
    const fx = scene === 'inaction' ? roomFx : NO_FX
    key.current.intensity = 1.25 * d.v * (1 - 0.35 * fx.night)
    key.current.color.copy(KEY_DAY).lerp(KEY_NIGHT, fx.night * 0.6)
    rimW.current.intensity = 1.1 * d.rim * d.v
    rimB.current.intensity = 1.2 * d.rim * d.v
    glowMat.opacity = d.glow * d.v
    // luz do cômodo da cena "Em ação": existe sempre (intensidade 0 fora dela), para o número de luzes nunca mudar
    easing.damp(d, 'room', scene === 'inaction' ? 40 : 0, 0.3, dt)
    // na cena: noite (mais baixa e azulada), o flash da câmera clareia a sala e a sirene a pisca em vermelho. Só muda
    // cor e intensidade de uma luz que já existe: nada recompila
    room.current.position.copy(ROOM_POS).lerp(ROOM_MOON, fx.night * 0.5).lerp(ROOM_SIREN, fx.red * 0.55).lerp(ROOM_PHOTO, fx.flash * 0.8)
    room.current.intensity = d.room * (1 - 0.45 * fx.night) * (1 + 2.2 * fx.flash) * (1 + 0.6 * fx.red)
    room.current.color.copy(ROOM_DAY).lerp(ROOM_NIGHT, fx.night).lerp(ROOM_RED, fx.red * 0.85).lerp(ROOM_FLASH, fx.flash)
    amb.current.intensity = 0.16 * d.v * (1 - 0.4 * fx.night + 1.2 * fx.flash)
    // o pedestal acompanha a pegada do aparelho (modelado com raio 1,75)
    easing.damp(d, 'ped', pedestalRadius(device) / 1.75, 0.18, dt)
    ped.current.scale.set(d.ped, 1, d.ped)
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
      <directionalLight ref={rimB} position={[-6, 2.6, -5.5]} intensity={1.2} color="#b9c6ee" />
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={['#04050b']} />
        {/* key: softbox retangular grande, acima e à esquerda */}
        <Lightformer form="rect" intensity={2.1} position={[-4, 6, 3]} scale={[9, 6, 1]} rotation={[Math.PI / 2.6, 0.5, 0]} />
        {/* fill frontal fraco */}
        <Lightformer form="rect" intensity={0.35} position={[2, 1, 8]} scale={[8, 5, 1]} rotation={[0, Math.PI, 0]} />
        {/* dois rim lights atrás, com um levíssimo tom azul da marca */}
        <Lightformer form="rect" intensity={1.5} color="#dfe7ff" position={[7, 2.5, -4]} scale={[3, 7, 1]} rotation={[0, -Math.PI / 2.6, 0]} />
        <Lightformer form="rect" intensity={1.4} color="#cfd8f2" position={[-7, 2.5, -4]} scale={[3, 7, 1]} rotation={[0, Math.PI / 2.6, 0]} />
        <Lightformer form="rect" intensity={0.25} position={[0, -4, 0]} scale={[10, 10, 1]} rotation={[-Math.PI / 2, 0, 0]} />
      </Environment>

      <group ref={ground}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} raycast={() => null}>
          <planeGeometry args={[80, 80]} />
          {quality >= 3 ? (
            <meshStandardMaterial color="#05070d" roughness={1} metalness={0} envMapIntensity={0.2} />
          ) : (
            <MeshReflectorMaterial mirror={0.3} blur={REFLECT_BLUR} resolution={512} mixBlur={1} mixStrength={1.5} roughness={0.95}
              depthScale={1} minDepthThreshold={0.4} maxDepthThreshold={1.3} color="#060913" metalness={0.4} />
          )}
        </mesh>
        <group position={[0, floorY, 0]} visible={showroom || warm}>
          <group ref={ped}>
            <mesh material={pedMat} position={[0, 0.06, 0]} raycast={() => null}><cylinderGeometry args={[1.75, 1.8, 0.12, 128]} /></mesh>
            <mesh material={ringMat} position={[0, 0.121, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><ringGeometry args={[1.71, 1.75, 128]} /></mesh>
            <mesh material={glowMat} position={[0, 0.123, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><circleGeometry args={[1.6, 48]} /></mesh>
          </group>
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
