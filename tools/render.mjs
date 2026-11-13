#!/usr/bin/env node
/**
 * Print de um aparelho no modo de referência, para conferir modelagem sem abrir o navegador.
 *
 *   npm run dev -- --port 5312 --strictPort        (em outro terminal)
 *   node tools/render.mjs <porta> <ref-id> <saída> ["px,py,pz,tx,ty,tz,fov,roll"] ["código JS"]
 *
 * - ref-id: uma entrada de `src/dev/RefMode.tsx` (modulo, fotossensor, sirene, controle, placa, app, placa-a...).
 * - A câmera opcional sobrepõe a da entrada. O código JS roda depois da carga, por exemplo
 *   "window.__showroom.getState().setView('xray')" ou "...startAction('tamper')".
 * - Gera <saída>-model.png (só o modelo) e <saída>-mix.png (modelo + foto, se a foto existir em ref/).
 *   Os -mix.png mostram fotos de referência: NUNCA vão para o repositório nem para o PR.
 * - Sem GPU, leva ~80 s; rode no máximo 4 ao mesmo tempo. WAIT=<ms> muda a espera depois da carga.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const [port, ref, out, cam, ev] = process.argv.slice(2)
if (!port || !ref || !out) { console.error('uso: node tools/render.mjs <porta> <ref-id> <saída> [cam] [js]'); process.exit(1) }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 900, height: 720 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
await page.goto(`http://localhost:${port}/?ref=1&hq&r=${ref}&op=0${cam ? '&cam=' + cam : ''}`)
await page.waitForFunction(() => window.__showroom && window.__showroom.getState().ready, null, { timeout: 240000 })
await page.waitForTimeout(+(process.env.WAIT || 6000))
if (ev) { await page.evaluate(ev); await page.waitForTimeout(3000) }
await page.addStyleTag({ content: '.glass{display:none!important}' })
const setOp = (v) => page.evaluate((v) => { const i = document.querySelector('img[src^="/ref/"]'); if (i) i.style.opacity = v }, v)
await setOp(0); await page.waitForTimeout(600); await page.screenshot({ path: out + '-model.png', timeout: 180000 })
await setOp(0.5); await page.waitForTimeout(300); await page.screenshot({ path: out + '-mix.png', timeout: 180000 })
if (errs.length) console.log('erros no console:', JSON.stringify(errs.slice(0, 5)))
await browser.close()
