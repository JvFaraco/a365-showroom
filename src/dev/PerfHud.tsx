import { useEffect, useRef, useState } from 'react'
import { useShowroom } from '../store/showroomStore'
import { DEVICES } from '../data/devices'
import { FORCE_DPR, FORCE_Q, FPS_MIN, gpuName, perfBridge } from './perf'

type Phase = { name: string; frames: number[]; ms: number }
type Report = { phases: Phase[]; quality: string; info: string }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (a: number[], p: number) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }

/** Resumo de uma fase: fps médio, p95 do quadro e quantos quadros passaram de 20 ms (perdeu um quadro a 60 Hz) e de 50 ms (travada). */
function summary(ph: Phase) {
  const n = ph.frames.length
  const fps = n ? (n * 1000) / ph.ms : 0
  const big = ph.frames.filter((f) => f > 250)
  return { fps, p95: pct(ph.frames, 0.95), slow: ph.frames.filter((f) => f > 20).length, jank: ph.frames.filter((f) => f > 50).length, n,
    freeze: big.length, worst: Math.max(0, ...ph.frames) }
}

function deviceInfo() {
  const s = useShowroom.getState()
  const ua = navigator.userAgent.replace(/\s+\(KHTML.*$/, '')
  return [
    `GPU: ${gpuName(perfBridge.gl)}`,
    `Tela: ${innerWidth}×${innerHeight} · DPR do aparelho ${devicePixelRatio} · DPR usado ${perfBridge.gl?.getPixelRatio().toFixed(2) ?? '?'}`,
    `Qualidade no fim: ${s.quality}${FORCE_Q !== null ? ' (fixada na URL)' : ''}${FORCE_DPR !== null ? ` · DPR fixado ${FORCE_DPR}` : ''}${FPS_MIN !== null ? ` · fpsmin ${FPS_MIN}` : ''}`,
    `Navegador: ${ua}`,
  ].join('\n')
}

function reportText(r: Report) {
  const rows = r.phases.map((ph) => {
    const s = summary(ph)
    return `${ph.name.padEnd(18)} ${s.fps.toFixed(0).padStart(4)} fps · p95 ${s.p95.toFixed(1).padStart(5)} ms · >20 ms: ${String(s.slow).padStart(3)} de ${s.n} · >50 ms: ${s.jank} · travadas >250 ms: ${s.freeze} (pior ${s.worst.toFixed(0)} ms)`
  })
  return `Teste de fluidez (Alarme 365)\n${r.info}\nQualidade durante o teste: ${r.quality}\n\n${rows.join('\n')}`
}

/** Dispara eventos de ponteiro no contêiner do canvas, como o mouse de verdade (o hover usa os mesmos eventos). */
function pointer(type: string, x: number, y: number, buttons = 0) {
  perfBridge.container?.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, buttons, bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
}

/**
 * Medidor de fluidez (`?perf=1`): fps e quadros lentos ao vivo e um teste automático de ~45 s que gira, aproxima,
 * passa o mouse por cima, troca de aparelho, abre parte, Raio-X e explodido, e roda a cena "Em ação". O resultado
 * pode ser copiado e mandado de volta.
 */
export function PerfHud() {
  const live = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [copied, setCopied] = useState(false)
  const phase = useRef<Phase | null>(null)

  // laço de medição: intervalo entre quadros exibidos (inclui tudo: JS, render, composição)
  useEffect(() => {
    let raf = 0, last = performance.now()
    const recent: number[] = []
    let tick = 0
    const loop = (t: number) => {
      const dt = t - last; last = t
      // quadro longo também conta (antes, mais de 1 s era descartado e a travada sumia do resultado). Ficam de fora a
      // aba escondida e as pausas do navegador com a janela fora de vista (coberta ou minimizada: ele para de desenhar
      // e o primeiro quadro na volta traz a pausa inteira, como os 98 s de um teste)
      if (!document.hidden && dt < 5000) { recent.push(dt); if (recent.length > 240) recent.shift(); phase.current?.frames.push(dt) }
      if (++tick % 20 === 0 && live.current) {
        const tail = recent.slice(-120), sum = tail.reduce((a, b) => a + b, 0)
        const s = useShowroom.getState()
        live.current.textContent = `${(tail.length * 1000 / Math.max(1, sum)).toFixed(0)} fps · p95 ${pct(tail, 0.95).toFixed(1)} ms · >20 ms ${tail.filter((f) => f > 20).length}/${tail.length} · DPR ${perfBridge.gl?.getPixelRatio().toFixed(2) ?? '?'} · q${s.quality}`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const onVis = () => { last = performance.now() } // na volta da aba, recomeça a contar daqui
    document.addEventListener('visibilitychange', onVis)
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  const run = async () => {
    setRunning(true); setReport(null); setCopied(false)
    const st = useShowroom.getState
    const phases: Phase[] = []
    const qs = new Set<number>()
    const measure = async (name: string, ms: number, step?: (k: number) => void) => {
      const ph: Phase = { name, frames: [], ms }
      phase.current = ph
      const t0 = performance.now()
      while (performance.now() - t0 < ms) {
        step?.((performance.now() - t0) / ms)
        qs.add(st().quality)
        await new Promise((r) => requestAnimationFrame(r))
      }
      phase.current = null
      phases.push(ph)
    }
    st().setScene('showroom'); st().setDevice('modulo')
    await wait(2500)
    const c = perfBridge.controls
    const box = perfBridge.container?.getBoundingClientRect()
    const cx = (box?.left ?? 0) + (box?.width ?? innerWidth) / 2, cy = (box?.top ?? 0) + (box?.height ?? innerHeight) / 2
    await measure('Parado', 2500)
    await measure('Girar', 4000, () => { c?.rotate(0.025, 0, false) })
    await measure('Aproximar', 3000, (k) => { c?.dolly(Math.sin(k * Math.PI * 4) * 0.06, false) })
    await measure('Passar o mouse', 4000, (k) => pointer('pointermove', cx + Math.sin(k * Math.PI * 6) * 160, cy + Math.cos(k * Math.PI * 4) * 90))
    pointer('pointermove', 5, 5)
    await measure('Trocar aparelho', DEVICES.length * 1300, (k) => {
      const id = DEVICES[Math.min(DEVICES.length - 1, Math.floor(k * DEVICES.length))].id
      if (st().device !== id) st().setDevice(id)
    })
    st().setDevice('modulo'); await wait(800)
    await measure('Abrir parte', 2500, (k) => { if (k > 0.05 && !st().part) st().selectPart('botao-sos') })
    st().selectPart(null)
    await measure('Raio-X', 2500, (k) => { if (k > 0.05 && st().view !== 'xray') st().setView('xray') })
    await measure('Explodir', 2500, (k) => { if (k > 0.05 && st().view !== 'exploded') st().setView('exploded') })
    st().setView('normal')
    st().setScene('inaction'); await wait(1500)
    st().set({ iaPlaying: true })
    await measure('Cena Em ação', 8000)
    st().set({ iaPlaying: false }); st().setScene('showroom')
    setReport({ phases, quality: [...qs].sort().join(' → '), info: deviceInfo() })
    setRunning(false)
  }

  const copy = async () => {
    if (!report) return
    try { await navigator.clipboard.writeText(reportText(report)); setCopied(true) } catch { setCopied(false) }
  }

  return (
    <div className="fixed right-2 top-[6.5rem] z-[60] max-w-[calc(100vw-1rem)] rounded-xl border border-accent/60 bg-black/85 p-2.5 font-mono text-[12px] leading-snug text-white shadow-lg sm:max-w-sm">
      <div ref={live}>medindo…</div>
      <div className="mt-1 flex gap-2">
        <button className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-ink disabled:opacity-50" disabled={running} onClick={() => void run()}>{running ? 'Testando… (~45 s, não mexa)' : 'Testar fluidez'}</button>
        {report && <button className="rounded bg-white/15 px-2 py-1" onClick={() => void copy()}>{copied ? 'Copiado' : 'Copiar resultado'}</button>}
        {report && <button className="rounded bg-white/15 px-2 py-1" onClick={() => setReport(null)}>Fechar</button>}
      </div>
      {report && <pre className="mt-1 max-h-[45vh] overflow-auto whitespace-pre-wrap select-text">{reportText(report)}</pre>}
    </div>
  )
}
