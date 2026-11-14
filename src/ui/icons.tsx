import type { SVGProps } from 'react'
import { LOGO_RING, logoCut } from '../three/common/logoShape'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 20, p: P) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p })

export const LockOpen = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /><circle cx="12" cy="16" r="1" fill="currentColor" /></svg>)
export const LockClosed = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1" fill="currentColor" /></svg>)
export const HomePerson = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M3 11l9-8 9 8" /><path d="M5 10v11h14V10" /><circle cx="12" cy="13" r="1.6" fill="currentColor" /><path d="M9.5 19v-1a2.5 2.5 0 0 1 5 0v1" /></svg>)
export const Speaker = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></svg>)
export const Shield = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M12 8v5" /><circle cx="12" cy="16" r=".6" fill="currentColor" /></svg>)
export const Bell = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17z" /><path d="M10 21h4" /></svg>)
export const User = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>)
export const Home = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M3 11l9-8 9 8" /><path d="M5 10v11h14V10" /><path d="M10 21v-6h4v6" /></svg>)
export const Grid = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>)
export const Devices = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="3" /><path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></svg>)
// agenda com as duas argolas no alto e o busto apoiado na base
export const Contacts = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 2v2M15 2v2" /><circle cx="12" cy="11" r="3" /><path d="M6.5 21a5.5 5.5 0 0 1 11 0" /></svg>)
export const Clock = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>)
// quatro aparelhos ligados em cadeia aberta (três ligações, sem fechar o quadrilátero)
export const Nodes = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="11" cy="4.5" r="2.3" /><circle cx="18" cy="11" r="2.3" /><circle cx="12" cy="18.5" r="2.3" /><circle cx="5" cy="12" r="2.3" /><path d="M13 6.4l3 2.7M16.2 13.2l-2.5 3.1M10 16.6l-2.9-2.7" /></svg>)
export const AlertCircle = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><circle cx="12" cy="16.5" r=".8" fill="currentColor" /></svg>)
export const CircleX = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>)
export const Camera = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7l1.5-3h5L16 7" /><circle cx="12" cy="13.5" r="3.5" /></svg>)
export const Explode = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="6" y="3" width="12" height="4" rx="1" /><rect x="6" y="10" width="12" height="4" rx="1" /><rect x="6" y="17" width="12" height="4" rx="1" /></svg>)
export const Xray = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 3" /><circle cx="12" cy="12" r="3" /></svg>)
export const Manual = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="7" cy="7" r="3" /><path d="M10 7h10M4 14h16M4 19h10" /></svg>)
export const Play = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M7 4l13 8-13 8V4z" fill="currentColor" /></svg>)
export const Pause = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M7 4v16M17 4v16" strokeWidth="3" /></svg>)
export const Sound = ({ size, on, ...p }: P & { on: boolean }) => (<svg {...base(size, p)}><path d="M4 9v6h4l5 4V5L8 9H4z" />{on ? <path d="M16.5 8.5a5 5 0 0 1 0 7" /> : <path d="M17 9l5 6M22 9l-5 6" />}</svg>)
export const Fullscreen = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>)
export const ListIcon = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>)
export const Close = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M6 6l12 12M18 6L6 18" /></svg>)
// engrenagem simples: oito dentes em volta de um furo
export const Gear = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /><circle cx="12" cy="12" r="6.5" /></svg>)
// sensor de abertura: o corpo e o ímã lado a lado
export const DoorSensor = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="7" y="7" width="3.5" height="10" rx="1" /><rect x="12.5" y="4" width="4.5" height="16" rx="1.2" /></svg>)
// controle remoto: a gota com a argola no alto e o botão no meio
export const Remote = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M12 3c1.6 0 2.4 1.4 2.6 2.6A7 7 0 1 1 9.4 5.6C9.6 4.4 10.4 3 12 3z" /><circle cx="12" cy="13" r="2.4" /></svg>)
// módulo de comando visto de lado: a tampa arredondada sobre a base, com o LED na frente
export const Hub = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M4 17c0-5 3.6-9 8-9s8 4 8 9" /><path d="M3 17h18v2.5H3z" /><circle cx="12" cy="14" r=".9" fill="currentColor" /></svg>)
export const Chevron =({ size, dir = 'right', ...p }: P & { dir?: 'left' | 'right' }) => (<svg {...base(size, p)}><path d={dir === 'right' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} /></svg>)

// logo Orsegups na forma oficial (a mesma da placa): anel + corte, num viewBox de 120 com raio de fora 54
const LR = 54
const circle = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}Z`
const LOGO_D = circle(LR * LOGO_RING.outer[0], LR * LOGO_RING.outer[1], LR) + circle(LR * LOGO_RING.hole[0], LR * LOGO_RING.hole[1], LR * LOGO_RING.holeR)
const LOGO_CUT_D = logoCut(0, 0, LR).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('') + 'Z'

/** Logo Orsegups: o anel de dentro e o braço de fora, separados pelo corte curvo. */
export function OrsegupsLogo({ size = 64, color = '#F9E000' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="-60 -62 120 120" role="img" aria-label="Orsegups">
      <mask id="ors-cut" maskUnits="userSpaceOnUse" x="-60" y="-62" width="120" height="120">
        <rect x="-60" y="-62" width="120" height="120" fill="#fff" />
        <path d={LOGO_CUT_D} fill="#000" />
      </mask>
      <path d={LOGO_D} fill={color} fillRule="evenodd" mask="url(#ors-cut)" />
    </svg>
  )
}
