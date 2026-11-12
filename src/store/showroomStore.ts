import { create } from 'zustand'
import { DEVICES, DEVICE_BY_ID, getPart, hasInternal, type ActionId, type DeviceId } from '../data/devices'
import { ARM_TO_LED, type LedStateId } from '../data/ledStates'
import { ACTIONS } from '../data/actions'

export type Scene = 'intro' | 'showroom' | 'inaction' | 'outro'
export type View = 'normal' | 'exploded' | 'xray' | 'manual'
export type ArmState = 'disarmed' | 'armed' | 'partial'

export const now = () => performance.now() / 1000

// Valores que mudam a cada frame ficam fora do React/zustand (lidos em useFrame e por rAF no DOM).
/** Progresso 0..1 do botão segurado por 5 s (190 no módulo, ✱ no controle). */
export const holdRef = { v: 0 }
/** Tempo (s) da cena "Em ação". */
export const ia = { t: 0 }

type State = {
  scene: Scene
  device: DeviceId
  part: string | null
  hovered: string | null
  view: View
  tour: boolean
  armState: ArmState
  ledState: LedStateId
  action: { id: ActionId; t0: number; undoAt?: number } | null
  holding: boolean
  holdMsg: '' | 'solte' | 'ok'
  sirenLevel: 1 | 2 | 3
  sirenOn: boolean
  shockLevel: 1 | 2 | 3 // 1 baixa, 2 média, 3 alta
  knock: { t0: number; fired: boolean } | null
  appPhoto: 'idle' | 'loading' | 'done'
  iaPlaying: boolean
  iaStep: number // passo atual da cena "Em ação" (o tempo corre em `ia.t`, fora do React)
  presenter: boolean
  sound: boolean
  /** 0 completo · 1 DPR mínimo · 2 sem AO · 3 sem reflexo nem SMAA/vinheta */
  quality: 0 | 1 | 2 | 3
  ready: boolean // aparelhos montados e shaders pré-compilados
  warm: boolean // aquecimento: tudo visível e selecionado por alguns frames, atrás do carregamento
  listOpen: boolean
  resetTick: number

  setScene: (s: Scene) => void
  setDevice: (d: DeviceId, part?: string | null) => void
  selectPart: (p: string | null) => void
  setHovered: (p: string | null) => void
  setView: (v: View) => void
  toggleView: (v: View) => void
  stepPart: (dir: 1 | -1, crossDevices?: boolean) => void
  setTour: (t: boolean) => void
  setArm: (a: ArmState) => void
  setLed: (l: LedStateId) => void
  startAction: (id: ActionId) => void
  stopAction: () => void
  undoAction: () => void
  reset: () => void
  set: (p: Partial<State>) => void
}

const clean = { action: null, holding: false, holdMsg: '' as const, sirenOn: false, knock: null, appPhoto: 'idle' as const }

export const useShowroom = create<State>((set, get) => ({
  scene: 'intro',
  device: 'modulo',
  part: null,
  hovered: null,
  view: 'normal',
  tour: false,
  armState: 'disarmed',
  ledState: 'desarmado',
  ...clean,
  sirenLevel: 2,
  iaPlaying: false,
  iaStep: 0,
  shockLevel: 2,
  presenter: false,
  sound: false,
  quality: 0,
  ready: false,
  warm: true,
  listOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,
  resetTick: 0,

  set: (p) => { if ('action' in p || 'part' in p) holdRef.v = 0; set(p) },
  setScene: (scene) => { ia.t = 0; holdRef.v = 0; set({ scene, part: null, hovered: null, tour: false, view: 'normal', iaPlaying: false, iaStep: 0, ...clean }) },
  setDevice: (device, part = null) => {
    set({ scene: 'showroom', device, part: null, hovered: null, view: 'normal', ...clean })
    if (part) get().selectPart(part)
  },
  selectPart: (part) => {
    const s = get()
    const p = getPart(s.device, part)
    // parte interna pedida com a carcaça fechada: liga o Raio-X para ela aparecer
    const view = p?.internal && s.view === 'normal' ? 'xray' : s.view
    holdRef.v = 0
    set({ part: p ? p.id : null, view, hovered: null, ...clean })
  },
  setHovered: (hovered) => set({ hovered }),
  setView: (view) => set({ view }),
  toggleView: (v) => {
    const s = get()
    const d = DEVICE_BY_ID[s.device]
    if (v === 'xray' && !hasInternal(d)) return
    const view = s.view === v ? 'normal' : v
    // sair do explodido/raio-X com uma parte interna aberta volta à vista inteira
    const cur = getPart(s.device, s.part)
    set({ view, ...(cur?.internal && view === 'normal' ? { part: null, ...clean } : {}) })
  },
  stepPart: (dir, crossDevices = false) => {
    const s = get()
    const parts = DEVICE_BY_ID[s.device].parts
    const i = parts.findIndex((p) => p.id === s.part)
    let n = i + dir
    if (i === -1) n = dir === 1 ? 0 : parts.length - 1
    if (n >= 0 && n < parts.length) return s.selectPart(parts[n].id)
    if (crossDevices) {
      const di = DEVICES.findIndex((d) => d.id === s.device)
      const nd = DEVICES[(di + dir + DEVICES.length) % DEVICES.length]
      s.setDevice(nd.id)
      if (s.tour) set({ tour: true })
    } else {
      s.selectPart(parts[(n + parts.length) % parts.length].id)
    }
  },
  setTour: (tour) => {
    set({ tour })
    if (tour && !get().part) get().stepPart(1)
  },
  setArm: (armState) => set({ armState, ledState: ARM_TO_LED[armState] }),
  setLed: (ledState) => set({ ledState }),
  startAction: (id) => { holdRef.v = 0; set({ ...clean, sirenOn: id === 'som', action: { id, t0: now() } }) },
  stopAction: () => { holdRef.v = 0; set({ ...clean }) },
  undoAction: () => { const a = get().action; if (a && !a.undoAt) set({ action: { ...a, undoAt: now() } }) },
  reset: () =>
    set((s) => ({
      scene: 'showroom', part: null, hovered: null, view: 'normal', tour: false,
      armState: 'disarmed', ledState: 'desarmado', ...clean, resetTick: s.resetTick + 1,
    })),
}))

/** Tempo (s) decorrido da ação `id`, ou -1 se ela não estiver ativa. */
export function actionTime(id: ActionId): number {
  const a = useShowroom.getState().action
  return a && a.id === id ? now() - a.t0 : -1
}

export const UNDO_SPEED = 1.4

/**
 * Progresso (s) de uma ação com estado: avança até `hold` e fica aberta; depois do
 * "desfazer", volta pelo mesmo caminho até 0. -1 se a ação não estiver ativa.
 */
export function actionTau(id: ActionId): number {
  const a = useShowroom.getState().action
  if (!a || a.id !== id) return -1
  const hold = ACTIONS[id].hold ?? Infinity
  const fwd = Math.min((a.undoAt ?? now()) - a.t0, hold)
  return a.undoAt ? Math.max(0, fwd - (now() - a.undoAt) * UNDO_SPEED) : fwd
}

// acesso pelo console / testes automatizados
if (typeof window !== 'undefined') (window as unknown as { __showroom: typeof useShowroom }).__showroom = useShowroom
