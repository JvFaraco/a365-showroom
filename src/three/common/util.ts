import { createContext, useContext, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ActionId, DeviceId } from '../../data/devices'
import { actionTime } from '../../store/showroomStore'

export type DeviceProps = {
  /** false nas cenas de kit/rede/ação: sem hover, sem clique por parte, sem micro-animações */
  interactive?: boolean
}

export const DeviceCtx = createContext<{ deviceId: DeviceId; interactive: boolean }>({ deviceId: 'modulo', interactive: false })
export const useDeviceCtx = () => useContext(DeviceCtx)

/** Quanto o aparelho ativo está explodido (0..1). Amortecido em Showroom.tsx. */
export const explodeAmt = { v: 0 }

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
/** Progresso suave (ease in-out) de t entre a e b. */
export const seg = (t: number, a: number, b: number) => {
  const x = clamp01((t - a) / (b - a))
  return x * x * (3 - 2 * x)
}
/** Sobe em [a,b], fica em 1, desce em [c,d]. */
export const bump = (t: number, a: number, b: number, c: number, d: number) => seg(t, a, b) * (1 - seg(t, c, d))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Fase atual de uma micro-animação: -1 se inativa, senão o índice do último marco (s) já passado.
 * Só re-renderiza quando a fase muda.
 */
export function useActionPhase(id: ActionId | ActionId[], marks: number[] = [0]): number {
  const [phase, setPhase] = useState(-1)
  const cur = useRef(-1)
  useFrame(() => {
    let t = -1
    if (Array.isArray(id)) { for (const i of id) { t = actionTime(i); if (t >= 0) break } } else t = actionTime(id)
    let p = -1
    if (t >= 0) for (let i = 0; i < marks.length; i++) if (t >= marks[i]) p = i
    if (p !== cur.current) { cur.current = p; setPhase(p) }
  })
  return phase
}
