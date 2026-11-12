#!/usr/bin/env node
/**
 * Mede o carregamento e a fluidez do showroom, sempre do mesmo jeito, para comparar antes e depois.
 *
 *   node tools/perf.mjs [url] [--channel msedge|chromium] [--cpu 1,4] [--headed] [--json]
 *
 * - url: padrão http://localhost:4173/ (rode `npm run build && npm run preview` antes).
 * - Precisa do Playwright instalado (`npm i -D playwright`, ou global). Com `--channel msedge` usa o Edge
 *   da máquina; sem isso, o Chromium do Playwright.
 * - Para cada fator de CPU (1× = normal, 4× = quatro vezes mais lenta) mede:
 *     primeira pintura (logo + título), tempo até a tela de carregamento sumir, tarefas longas na carga e
 *     depois dela, e, passando pelos 7 aparelhos, fps médio, p95 do quadro e quadros acima de 50 ms.
 * - Em máquina sem GPU (CI, contêiner) use PERF_SOFTWARE_GL=1: os tempos absolutos deixam de valer, mas a
 *   comparação antes/depois na mesma máquina continua válida.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const args = process.argv.slice(2)
const flag = (name, def) => { const i = args.indexOf(`--${name}`); return i < 0 ? def : args[i + 1] }
const url = args.find((a) => /^https?:/.test(a)) ?? 'http://localhost:4173/'
const channel = flag('channel', undefined)
const cpus = String(flag('cpu', '1,4')).split(',').map(Number)
const headed = args.includes('--headed')
const DEVICES = ['modulo', 'fotossensor', 'magnetico', 'sirene', 'controle', 'placa', 'app']
const TIMEOUT = Number(process.env.PERF_TIMEOUT ?? 300000)

const launchArgs = process.env.PERF_SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : []

async function measure(cpu) {
  const browser = await chromium.launch({ channel, headless: !headed, args: launchArgs })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  // tarefas longas (> 50 ms), desde o início da navegação
  await page.addInitScript(() => {
    window.__lt = []
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask', buffered: true }) } catch { /* sem suporte */ }
  })
  await page.goto(url, { waitUntil: 'commit' })
  // a tela de carregamento "sumiu": a cena está pronta e não há mais elemento de carregamento visível
  const loaded = await page.waitForFunction(() => {
    const st = window.__showroom?.getState?.()
    if (!st?.ready) return false
    const el = document.querySelector('#boot, [aria-label="Carregando"]')
    if (el && getComputedStyle(el).opacity !== '0' && getComputedStyle(el).display !== 'none') return false
    return performance.now()
  }, null, { timeout: TIMEOUT, polling: 'raf' }).then((h) => h.jsonValue())
  const paint = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)])))
  const ltLoad = await page.evaluate((t) => window.__lt.filter(([s]) => s < t), loaded)
  // entra no showroom e passa pelos 7 aparelhos, medindo os quadros
  await page.evaluate(() => window.__showroom.getState().setScene('showroom'))
  await page.waitForTimeout(1500)
  const mark = await page.evaluate(() => performance.now())
  const frames = []
  for (const d of DEVICES) {
    const f = await page.evaluate((id) => new Promise((resolve) => {
      const out = []; let last = performance.now(); const t0 = last
      window.__showroom.getState().setDevice(id)
      const tick = (t) => { out.push(t - last); last = t; if (t - t0 < 1500) requestAnimationFrame(tick); else resolve(out) }
      requestAnimationFrame(tick)
    }), d)
    frames.push(...f.slice(1))
  }
  const ltAfter = await page.evaluate((t) => window.__lt.filter(([s]) => s >= t), mark)
  await browser.close()
  const sorted = [...frames].sort((a, b) => a - b)
  const sum = frames.reduce((a, b) => a + b, 0)
  return {
    cpu,
    primeiraPinturaMs: paint['first-contentful-paint'] ?? paint['first-paint'] ?? null,
    carregamentoSomeMs: Math.round(loaded),
    tarefasLongasNaCarga: ltLoad.length,
    maiorTarefaNaCargaMs: Math.max(0, ...ltLoad.map(([, d]) => d)),
    tarefasAcimaDe200msDepois: ltAfter.filter(([, d]) => d > 200).length,
    maiorTarefaDepoisMs: Math.max(0, ...ltAfter.map(([, d]) => d)),
    fpsMedio: +(1000 / (sum / frames.length)).toFixed(1),
    p95QuadroMs: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
    quadrosAcimaDe50ms: frames.filter((f) => f > 50).length,
    quadros: frames.length,
  }
}

const rows = []
for (const cpu of cpus) rows.push(await measure(cpu))
if (args.includes('--json')) console.log(JSON.stringify(rows, null, 2))
else {
  const cols = [['CPU', (r) => `${r.cpu}×`], ['1ª pintura', (r) => `${r.primeiraPinturaMs} ms`], ['carregamento some', (r) => `${(r.carregamentoSomeMs / 1000).toFixed(2)} s`],
    ['maior tarefa na carga', (r) => `${r.maiorTarefaNaCargaMs} ms`], ['tarefas > 200 ms depois', (r) => r.tarefasAcimaDe200msDepois], ['maior tarefa depois', (r) => `${r.maiorTarefaDepoisMs} ms`],
    ['fps médio', (r) => r.fpsMedio], ['p95 do quadro', (r) => `${r.p95QuadroMs} ms`], ['quadros > 50 ms', (r) => `${r.quadrosAcimaDe50ms} de ${r.quadros}`]]
  console.log(`| ${cols.map(([h]) => h).join(' | ')} |`)
  console.log(`|${cols.map(() => '---').join('|')}|`)
  for (const r of rows) console.log(`| ${cols.map(([, f]) => f(r)).join(' | ')} |`)
}
