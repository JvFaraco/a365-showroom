import { Html } from '@react-three/drei'
import type { Vec3 } from '../../data/devices'
import { Stage } from '../Stage'
import { Placed, type Placement } from './Kit'
import { RadioPulse } from '../fx/RadioPulse'
import { CommLinks } from '../fx/CommLinks'

const LAYOUT: Placement[] = [
  { id: 'modulo', position: [0, 0, 0], rotation: [0, 0.4, 0] },
  { id: 'placa', position: [-5.3, 0, -0.6], rotation: [0, 0.3, 0] },
  { id: 'fotossensor', position: [-3.7, 0, -0.9], rotation: [0, 0.25, 0] },
  { id: 'magnetico', position: [-2.5, 0, 0.9], rotation: [0, 0.2, 0] },
  { id: 'sirene', position: [-3.9, 0, 1.7], rotation: [-0.12, 0.3, 0] },
  { id: 'controle', position: [-1.5, 0, 2.3], rotation: [-0.15, 0.2, 0] },
  { id: 'app', position: [5.0, 0, 0.8], rotation: [-0.1, -0.35, 0] },
]
const MOD: Vec3 = [0, 0.55, 0]
const RADIO: Vec3[] = [[-3.7, 2.0, -0.9], [-2.5, 1.0, 0.9], [-3.9, 1.3, 1.7], [-1.5, 0.6, 2.3]]
const VIAS: Vec3[] = [[1.9, 1.5, 0.6], [2.1, 2.3, 0], [1.9, 3.1, -0.6]]
const CLOUD: Vec3 = [3.4, 2.3, 0]
const CENTRAL: Vec3 = [5.4, 3.3, -0.8]

const Tag = ({ position, children, tone = 'dark' }: { position: Vec3; children: React.ReactNode; tone?: 'dark' | 'brand' }) => (
  <Html position={position} center style={{ pointerEvents: 'none' }}>
    <div className={`fx-tag rounded-full px-3 py-1 text-sm font-semibold text-white ${tone === 'brand' ? 'bg-brand ring-2 ring-accent' : 'bg-black/60'}`}>{children}</div>
  </Html>
)

/** Sistema conectado: rádio dos aparelhos até o Módulo; 3 vias do Módulo até a nuvem, o app e a Central. */
export function Network() {
  return (
    <>
      <Stage floorY={0} />
      {LAYOUT.map((p) => <Placed key={p.id} p={p} />)}
      {RADIO.map((from, i) => <RadioPulse key={i} from={from} to={MOD} speed={0.5 + i * 0.07} />)}
      <CommLinks from={MOD} to={VIAS} state={() => 1} />
      {VIAS.map((v, i) => <RadioPulse key={i} from={v} to={CLOUD} color="#9db8ff" size={0.12} count={2} speed={0.6} />)}
      <RadioPulse from={CLOUD} to={[5.0, 1.6, 0.8]} color="#35d46a" size={0.16} count={3} />
      <RadioPulse from={CLOUD} to={CENTRAL} color="#F9E000" size={0.16} count={3} />
      <Html position={CLOUD} center style={{ pointerEvents: 'none' }}>
        <div className="fx-tag flex flex-col items-center text-white">
          <svg width="74" height="48" viewBox="0 0 74 48"><path d="M20 44a16 16 0 0 1-2-31.8A21 21 0 0 1 58 16a14 14 0 0 1-2 28z" fill="#1E398D" stroke="#9db8ff" strokeWidth="2.5" /></svg>
          <span className="-mt-1 text-xs font-semibold">Nuvem Orsegups</span>
        </div>
      </Html>
      <Tag position={CENTRAL} tone="brand">Central Orsegups</Tag>
      <Tag position={[0, -0.25, 1.6]}>Módulo de Comando</Tag>
      <Tag position={[-3.2, 3.0, 0]}>Radiofrequência</Tag>
      <Tag position={[5.0, -0.25, 1.9]}>Aplicativo</Tag>
    </>
  )
}
