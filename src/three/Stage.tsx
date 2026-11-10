import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { easing } from 'maath'
import { actionTime, useShowroom } from '../store/showroomStore'

/**
 * Palco: fundo azul-marinho quase preto, chão espelhado com reflexo suave, luz de estúdio
 * (key + rim azul + HDRI procedural) e, no showroom, pedestal com sombra de contato.
 * `floorY` é a altura do chão; `pedestal` desenha o pedestal logo acima dele.
 */
export function Stage({ floorY, pedestal = false }: { floorY: number; pedestal?: boolean }) {
  const lowPerf = useShowroom((s) => s.lowPerf)
  const ground = useRef<THREE.Group>(null!)
  const key = useRef<THREE.DirectionalLight>(null!)
  const amb = useRef<THREE.AmbientLight>(null!)
  const dim = useRef({ v: 1 })
  const ringMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1E398D', emissive: '#2f66ff', emissiveIntensity: 1.6, toneMapped: false }), [])
  const pedMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d1226', roughness: 0.35, metalness: 0.6 }), [])

  useFrame(({ camera }, dt) => {
    // vista por baixo (fundo do módulo): o chão e o pedestal somem para não tapar
    ground.current.visible = camera.position.y > floorY + 0.25
    // "sem energia": o palco escurece
    const t = actionTime('bateria-modulo')
    easing.damp(dim.current, 'v', t > 1.6 && t < 8.2 ? 0.12 : 1, 0.25, dt)
    key.current.intensity = 1.5 * dim.current.v
    amb.current.intensity = 0.18 * dim.current.v
  })

  return (
    <>
      <color attach="background" args={['#05070f']} />
      <fog attach="fog" args={['#05070f', 14, 34]} />
      <ambientLight ref={amb} intensity={0.25} />
      <directionalLight ref={key} position={[4, 7, 6]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-6, 3, -6]} intensity={2.6} color="#3d66ff" />
      <directionalLight position={[6, 2, -5]} intensity={0.9} color="#7aa0ff" />
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={['#03040a']} />
        <Lightformer form="rect" intensity={1.3} position={[0, 6, 2]} scale={[10, 5, 1]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} position={[6, 2, 4]} scale={[4, 6, 1]} rotation={[0, -Math.PI / 3, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#4f7dff" position={[-7, 2, -2]} scale={[4, 6, 1]} rotation={[0, Math.PI / 2.5, 0]} />
        <Lightformer form="ring" intensity={1.2} color="#9db8ff" position={[0, 3, -8]} scale={4} />
      </Environment>

      <group ref={ground}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} raycast={() => null}>
          <planeGeometry args={[80, 80]} />
          {lowPerf ? (
            <meshStandardMaterial color="#05070d" roughness={1} metalness={0} envMapIntensity={0.2} />
          ) : (
            <MeshReflectorMaterial mirror={0.55} blur={[320, 90]} resolution={512} mixBlur={1} mixStrength={7} roughness={0.9}
              depthScale={1} minDepthThreshold={0.4} maxDepthThreshold={1.3} color="#060913" metalness={0.5} />
          )}
        </mesh>
        {pedestal && (
          <group position={[0, floorY, 0]}>
            <mesh material={pedMat} position={[0, 0.06, 0]} raycast={() => null}><cylinderGeometry args={[1.75, 1.85, 0.12, 72]} /></mesh>
            <mesh material={ringMat} position={[0, 0.121, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><ringGeometry args={[1.66, 1.7, 96]} /></mesh>
            {!lowPerf && <ContactShadows position={[0, 0.124, 0]} scale={4.2} far={2.6} blur={2.4} opacity={0.65} resolution={256} frames={Infinity} />}
          </group>
        )}
      </group>
    </>
  )
}
