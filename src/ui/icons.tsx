import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 20, p: P) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p })

export const LockOpen = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /><circle cx="12" cy="16" r="1" fill="currentColor" /></svg>)
export const LockClosed = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1" fill="currentColor" /></svg>)
export const HomePerson = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M3 11l9-8 9 8" /><path d="M5 10v11h14V10" /><circle cx="12" cy="13" r="1.6" fill="currentColor" /><path d="M9.5 19v-1a2.5 2.5 0 0 1 5 0v1" /></svg>)
export const Speaker = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></svg>)
export const Shield = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M12 8v5" /><circle cx="12" cy="16" r=".6" fill="currentColor" /></svg>)
export const Bell = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17z" /><path d="M10 21h4" /></svg>)
export const User = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>)
export const Home = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M3 11l9-8 9 8" /><path d="M5 10v11h14V10" /></svg>)
export const Grid = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>)
export const Devices = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="3" /><path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></svg>)
export const Contacts = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M8 17a4 4 0 0 1 8 0" /></svg>)
export const Clock = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>)
export const Explode = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="6" y="3" width="12" height="4" rx="1" /><rect x="6" y="10" width="12" height="4" rx="1" /><rect x="6" y="17" width="12" height="4" rx="1" /></svg>)
export const Xray = ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 3" /><circle cx="12" cy="12" r="3" /></svg>)
export const Manual = ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="7" cy="7" r="3" /><path d="M10 7h10M4 14h16M4 19h10" /></svg>)
export const Play = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M7 4l13 8-13 8V4z" fill="currentColor" /></svg>)
export const Pause = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M7 4v16M17 4v16" strokeWidth="3" /></svg>)
export const Sound = ({ size, on, ...p }: P & { on: boolean }) => (<svg {...base(size, p)}><path d="M4 9v6h4l5 4V5L8 9H4z" />{on ? <path d="M16.5 8.5a5 5 0 0 1 0 7" /> : <path d="M17 9l5 6M22 9l-5 6" />}</svg>)
export const Fullscreen = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>)
export const ListIcon = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>)
export const Close = ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M6 6l12 12M18 6L6 18" /></svg>)
export const Chevron = ({ size, dir = 'right', ...p }: P & { dir?: 'left' | 'right' }) => (<svg {...base(size, p)}><path d={dir === 'right' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} /></svg>)

/** Logo Orsegups: anel com um "swoosh" curvo recortado. `draw` anima o traço (tela de carregamento). */
export function OrsegupsLogo({ size = 64, color = '#F9E000', draw = false }: { size?: number; color?: string; draw?: boolean }) {
  const id = draw ? 'ors-cut-d' : 'ors-cut'
  return (
    <svg width={size} height={size} viewBox="-60 -60 120 120" role="img" aria-label="Orsegups">
      <mask id={id}>
        <rect x="-60" y="-60" width="120" height="120" fill="#fff" />
        <path d="M -44 4 A 50 50 0 0 1 56 6 A 54 54 0 0 0 -44 4 Z" fill="#000" transform="rotate(-8)" />
      </mask>
      <circle r="40" fill="none" stroke={color} strokeWidth="20" mask={`url(#${id})`}
        {...(draw ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1, style: { animation: 'logo-draw 1.4s ease-in-out forwards' } } : {})} />
    </svg>
  )
}
