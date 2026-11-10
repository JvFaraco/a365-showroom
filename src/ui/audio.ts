import { useShowroom } from '../store/showroomStore'

// Áudio opcional (mudo por padrão): bip de clique, clique dos botões e sirene curta e baixa.
let ctx: AudioContext | null = null
let siren: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null

function ac() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function beep(kind: 'ui' | 'click' = 'ui') {
  if (!useShowroom.getState().sound) return
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain()
    o.type = kind === 'ui' ? 'sine' : 'square'
    o.frequency.value = kind === 'ui' ? 880 : 220
    g.gain.setValueAtTime(kind === 'ui' ? 0.05 : 0.04, a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + (kind === 'ui' ? 0.09 : 0.05))
    o.connect(g).connect(a.destination)
    o.start(); o.stop(a.currentTime + 0.1)
  } catch { /* sem áudio disponível */ }
}

export function setSiren(on: boolean, level = 2) {
  const enabled = on && useShowroom.getState().sound
  try {
    if (!enabled) {
      if (siren) { siren.osc.stop(); siren.lfo.stop(); siren = null }
      return
    }
    const a = ac()
    if (!siren) {
      const osc = a.createOscillator(), gain = a.createGain(), lfo = a.createOscillator(), lg = a.createGain()
      osc.type = 'sawtooth'; osc.frequency.value = 900
      lfo.frequency.value = 3; lg.gain.value = 250
      lfo.connect(lg).connect(osc.frequency)
      osc.connect(gain).connect(a.destination)
      osc.start(); lfo.start()
      siren = { osc, gain, lfo }
    }
    siren.gain.gain.value = 0.012 * level
  } catch { /* sem áudio disponível */ }
}
