import { useEffect } from 'react'
import { ACTIONS } from '../data/actions'
import { DEVICES } from '../data/devices'
import { UNDO_SPEED, useShowroom } from '../store/showroomStore'
import { setSiren } from './audio'

const TOUR_SECONDS = 5

/**
 * Modo apresentação e atalhos de teclado:
 * P tela cheia · → / espaço / clicker próxima parte · ← volta · 1–7 aparelho ·
 * E explode · X raio-X · M manual · T tour · ESC vista inteira · R reseta.
 * Também cuida do relógio do Tour e do fim das micro-animações com duração fixa.
 */
export function PresenterMode() {
  const tour = useShowroom((s) => s.tour)
  const part = useShowroom((s) => s.part)
  const device = useShowroom((s) => s.device)
  const action = useShowroom((s) => s.action)
  const sirenOn = useShowroom((s) => s.sirenOn)
  const sirenLevel = useShowroom((s) => s.sirenLevel)
  const sound = useShowroom((s) => s.sound)
  const iaSiren = useShowroom((s) => s.scene === 'inaction' && s.iaPlaying && s.iaT >= 10)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const s = useShowroom.getState()
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
      const onButton = el.tagName === 'BUTTON'
      const k = e.key.toLowerCase()
      if (k === 'p' && !typing) {
        const presenter = !s.presenter
        s.set({ presenter })
        if (presenter) void document.documentElement.requestFullscreen?.().catch(() => {})
        else if (document.fullscreenElement) void document.exitFullscreen?.()
        return
      }
      if (s.scene !== 'showroom') {
        if ((k === 'enter' || k === ' ' || k === 'arrowright' || k === 'pagedown') && !onButton && s.scene === 'intro') { e.preventDefault(); s.setScene('showroom') }
        if (k === 'escape' || k === 'r') s.setScene('showroom')
        if (/^[1-7]$/.test(k)) s.setDevice(DEVICES[Number(k) - 1].id)
        return
      }
      if (typing) return
      const next = k === 'arrowright' || k === 'pagedown' || (k === ' ' && !onButton)
      const prev = k === 'arrowleft' || k === 'pageup'
      if (next || prev) { e.preventDefault(); s.stepPart(next ? 1 : -1, s.presenter); return }
      if (/^[1-7]$/.test(k)) return s.setDevice(DEVICES[Number(k) - 1].id)
      if (k === 'e') return s.toggleView('exploded')
      if (k === 'x') return s.toggleView('xray')
      if (k === 'm') { s.selectPart(null); return s.toggleView('manual') }
      if (k === 't') return s.setTour(!s.tour)
      if (k === 'r') return s.reset()
      if (k === 'escape') {
        if (s.action) s.stopAction()
        else if (s.part) s.selectPart(null)
        else if (s.tour) s.setTour(false)
        else s.setView('normal')
      }
    }
    const onFs = () => { if (!document.fullscreenElement && useShowroom.getState().presenter) useShowroom.getState().set({ presenter: false }) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs) }
  }, [])

  // Tour: ~5 s em cada parte, com o card aberto; no fim das partes segue para o próximo aparelho
  useEffect(() => {
    if (!tour || action) return
    const t = setTimeout(() => useShowroom.getState().stepPart(1, true), TOUR_SECONDS * 1000)
    return () => clearTimeout(t)
  }, [tour, part, device, action])

  // micro-animações com duração fixa terminam sozinhas; as com estado, quando o "desfazer" termina
  useEffect(() => {
    if (!action) return
    const cfg = ACTIONS[action.id]
    const d = action.undoAt ? Math.min(action.undoAt - action.t0, cfg.hold ?? 0) / UNDO_SPEED + 0.15 : cfg.undo ? undefined : cfg.duration
    if (!d) return
    const t = setTimeout(() => { if (useShowroom.getState().action === action) useShowroom.getState().stopAction() }, d * 1000)
    return () => clearTimeout(t)
  }, [action])

  useEffect(() => { setSiren((!!action && action.id === 'som' && sirenOn) || iaSiren, iaSiren ? 2 : sirenLevel) }, [action, sirenOn, sirenLevel, sound, iaSiren])
  return null
}
