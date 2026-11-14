import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M } from '../common/materials'
import { roundedRectGeometry } from '../common/shapes'
import { DeviceCtx, useActionPhase, type DeviceProps } from '../common/util'
import { useShowroom } from '../../store/showroomStore'
import { AppScreen } from '../../ui/AppScreen'
import { MiniModulo } from '../fx/MiniModulo'

const SCREEN_W = 0.87
const PX = 320 // largura da tela em px de CSS
const HTML_SCALE = SCREEN_W / (PX / 40) // drei: 40 px de CSS = 1 unidade de cena
const SCREEN_H = SCREEN_W * (688 / PX) // altura da tela do app (688 px de CSS) em unidades de cena
const HTML_Z = 0.052
const _v = new THREE.Vector3()

/**
 * O Safari do iPhone posiciona a tela HTML em 3D (CSS 3D) um pouco diferente do Chrome: a tela do app aparecia
 * deslocada para baixo, saindo do aparelho. Aqui, de tempos em tempos, compara-se onde a tela HTML está de fato na
 * página com onde o vidro do celular aparece (os 4 cantos projetados pela câmera) e desloca-se a camada da tela pela
 * diferença. No Chrome a diferença é zero e nada muda.
 */
function useScreenAlign(body: React.MutableRefObject<THREE.Mesh>, content: React.MutableRefObject<HTMLDivElement | null>) {
  const st = useRef({ n: 0, x: 0, y: 0 })
  useFrame(({ camera, gl, size }) => {
    const s = st.current
    if (++s.n % 12) return
    const c = content.current, layer = c?.parentElement?.parentElement?.parentElement
    if (!c || !layer || !body.current) return
    const r = c.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      body.current.localToWorld(_v.set((sx * SCREEN_W) / 2, (sy * SCREEN_H) / 2, HTML_Z)).project(camera)
      if (_v.z > 1) return // atrás da câmera
      const px = ((_v.x + 1) / 2) * size.width, py = ((1 - _v.y) / 2) * size.height
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
    }
    const cr = gl.domElement.getBoundingClientRect()
    const dx = (x0 + x1) / 2 - (r.left + r.width / 2 - cr.left), dy = (y0 + y1) / 2 - (r.top + r.height / 2 - cr.top)
    if (Math.abs(dx) < 0.75 && Math.abs(dy) < 0.75) return
    s.x = THREE.MathUtils.clamp(s.x + dx, -240, 240); s.y = THREE.MathUtils.clamp(s.y + dy, -240, 240)
    layer.style.translate = `${s.x.toFixed(1)}px ${s.y.toFixed(1)}px`
  })
}

/**
 * Smartphone com o aplicativo Alarme Orsegups. A tela é React de verdade dentro do 3D
 * (<Html transform occlude>); cada região da tela é uma parte clicável (ver AppScreen).
 */
export function Smartphone({ interactive = false }: DeviceProps) {
  const body = useRef<THREE.Mesh>(null!)
  const content = useRef<HTMLDivElement | null>(null)
  useScreenAlign(body, content)
  const frame = useMemo(() => roundedRectGeometry(0.95, 1.95, 0.13, 0.07, 0.012), [])
  // aro metálico claro (aço) em volta do corpo, como na arte do app
  const band = useMemo(() => roundedRectGeometry(0.962, 1.962, 0.136, 0.05, 0.008), [])
  const bandMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a9ea6', roughness: 0.32, metalness: 0.95 }), [])
  const island = useMemo(() => roundedRectGeometry(0.36, 0.36, 0.09, 0.02, 0.006), [])
  const glass = useMemo(() => roundedRectGeometry(0.89, 1.89, 0.11, 0.004, 0), [])
  const armOn = useActionPhase('alarme-geral') >= 0
  // no showroom os 7 aparelhos ficam montados: a tela (DOM) só aparece quando o celular é o aparelho ativo
  const shown = useShowroom((s) => !interactive || (s.scene === 'showroom' && s.device === 'app'))

  return (
    <DeviceCtx.Provider value={{ deviceId: 'app', interactive }}>
      <ClickablePart follow="corpo">
        <mesh ref={body} geometry={frame} material={M.blackGloss} castShadow />
        <mesh geometry={band} material={bandMat} />
        <mesh geometry={glass} material={M.lens} position={[0, 0, 0.046]} />
        {/* botão de liga à direita e os dois de volume à esquerda */}
        {/* botões saindo ~0,7 mm do aro (antes ficavam escondidos dentro dele): liga à direita; volume e chave de mudo à esquerda */}
        <mesh material={bandMat} position={[0.493, 0.49, 0]}><boxGeometry args={[0.012, 0.16, 0.03]} /></mesh>
        {[[0.55, 0.12], [0.39, 0.12], [0.68, 0.045]].map(([y, h]) => <mesh key={y} material={bandMat} position={[-0.493, y, 0]}><boxGeometry args={[0.012, h, 0.03]} /></mesh>)}
        {/* atrás: ilha da câmera (quadrado de cantos redondos) com duas lentes em diagonal */}
        <mesh geometry={island} material={M.blackGloss} position={[-0.2, 0.7, -0.053]} rotation={[0, Math.PI, 0]} />
        {[[-0.275, 0.775], [-0.125, 0.625]].map(([x, y]) => (
          <group key={x} position={[x, y, -0.079]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh material={bandMat}><cylinderGeometry args={[0.075, 0.075, 0.012, 24]} /></mesh>
            <mesh material={M.lens} position={[0, -0.004, 0]}><cylinderGeometry args={[0.056, 0.056, 0.012, 24]} /></mesh>
          </group>
        ))}
      </ClickablePart>
      <Html ref={content} transform occlude={[body]} position={[0, 0, HTML_Z]} scale={HTML_SCALE} zIndexRange={[10, 0]}
        style={{ transition: 'opacity var(--duration-fast) var(--ease-out)', display: shown ? 'block' : 'none' }} pointerEvents={interactive ? 'auto' : 'none'}>
        <AppScreen interactive={interactive} />
      </Html>
      {interactive && armOn && <MiniModulo position={[-1.05, 0.55, 0.1]} scale={0.8} />}
    </DeviceCtx.Provider>
  )
}
