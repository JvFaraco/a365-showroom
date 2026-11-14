import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { explodeAmt, useDeviceCtx } from './util'
import { useShowroom } from '../../store/showroomStore'
import { ledGlowTexture } from './textures'

export type LedOut = { color: string; on: number }

const WHITE = new THREE.Color('#ffffff')
const _c = new THREE.Color(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3()

/**
 * LED emissivo (com bloom). `sample` é chamado a cada frame e preenche cor + intensidade (0..1).
 * `on`: onde o LED aparece. 'shell' é a janela na carcaça: o LED de verdade fica na placa, então, com o aparelho
 * explodido, a janela apaga. 'board' é o LED na placa: só acende quando o aparelho está explodido (de outro modo,
 * a luz já aparece na janela da carcaça).
 *
 * Como um LED de verdade: a luz sobe e desce numa rampa curta (nada de piscar seco), o miolo fica quase branco
 * quando está forte e há um halo suave em volta, virado para a câmera. O halo só é desenhado quando o LED está bem
 * aceso (não soma chamadas de desenho com o LED apagado ou fraco) e usa o mesmo programa de shader do brilho do palco.
 */
export function Led({ sample, children, boost = 3.2, baseColor = '#111318', halo = 1, on: where, ...props }: { sample: (t: number, out: LedOut) => void; children?: ReactNode; boost?: number; baseColor?: string; halo?: number; on?: 'shell' | 'board' } & JSX.IntrinsicElements['mesh']) {
  const { deviceId, interactive } = useDeviceCtx()
  const mesh = useRef<THREE.Mesh>(null!)
  const glow = useRef<THREE.Mesh>(null!)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: baseColor, emissive: '#000000', roughness: 0.3, toneMapped: false }), [baseColor])
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: ledGlowTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), [])
  const out = useRef<LedOut>({ color: '#000000', on: 0 })
  const cur = useRef({ on: 0, color: new THREE.Color('#000000'), size: 0 })
  useFrame(({ clock, camera }, dt) => {
    const o = out.current
    sample(clock.elapsedTime, o)
    if (where && interactive) {
      const s = useShowroom.getState()
      const k = s.scene === 'showroom' && s.device === deviceId ? explodeAmt.v : 0
      o.on *= where === 'shell' ? 1 - k : k
    }
    const c = cur.current
    // rampa: acende rápido (~25 ms) e apaga um pouco mais devagar (~70 ms); a cor também passa suave
    const rate = o.on > c.on ? 40 : 14
    c.on += (o.on - c.on) * (1 - Math.exp(-rate * Math.min(dt, 0.1)))
    c.color.lerp(_c.set(o.color), 1 - Math.exp(-20 * Math.min(dt, 0.1)))
    const m = mesh.current.material as THREE.MeshStandardMaterial
    // miolo quente: perto do máximo, a cor clareia na direção do branco (é o que faz o ponto parecer luz, não tinta)
    const k = Math.min(1, c.on)
    m.emissive.copy(c.color).lerp(WHITE, k * k * 0.62)
    m.emissiveIntensity = c.on * boost
    // halo: plano virado para a câmera, um pouco à frente do LED, do tamanho de ~5 vezes o LED (com teto, para não vazar
    // para fora do aparelho). Só aparece com o LED bem aceso: fraco, ele vira uma mancha colorida em volta do ponto
    const g = glow.current, a = THREE.MathUtils.smoothstep(k, 0.3, 0.9) * halo
    g.visible = a > 0.02
    if (!g.visible) return
    if (!c.size) { const geo = mesh.current.geometry; geo.computeBoundingSphere(); c.size = geo.boundingSphere?.radius ?? 0.02 }
    mesh.current.getWorldPosition(_p); mesh.current.getWorldScale(_s)
    const r = c.size * Math.max(_s.x, _s.y, _s.z)
    glowMat.color.copy(c.color).lerp(WHITE, 0.18)
    glowMat.opacity = a
    // posição e giro no mundo convertidos para o espaço do LED (o halo é filho dele)
    _v.copy(camera.position).sub(_p).normalize().multiplyScalar(r * 1.2).add(_p)
    mesh.current.worldToLocal(g.position.copy(_v))
    mesh.current.getWorldQuaternion(_q).invert().multiply(camera.quaternion)
    g.quaternion.copy(_q)
    const w = Math.min(r * 11, 0.42)
    g.scale.set(w / _s.x, w / _s.y, w / _s.z)
  })
  return (
    <mesh ref={mesh} material={mat} userData={{ led: true }} {...props}>
      {children}
      <mesh ref={glow} material={glowMat} visible={false} userData={{ fx: true }} raycast={() => null} renderOrder={2}><planeGeometry args={[1, 1]} /></mesh>
    </mesh>
  )
}
