#!/usr/bin/env node
/**
 * Programas de shader e triângulos visíveis (do `?debug=1`), na abertura e em cada aparelho. É o número que vai
 * no corpo de todo commit que mexe em material, geometria ou carga ("antes" e "depois").
 *
 *   npm run build && npm run preview -- --port 4174 --strictPort     (em outro terminal)
 *   node tools/count.mjs http://localhost:4174/
 *
 * Se um aparelho der um número estranho (já aconteceu de o magnético aparecer com o valor de outro), rode de novo:
 * é a troca de aparelho que não terminou a tempo.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const url = process.argv[2] ?? 'http://localhost:4173/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 800, height: 450 } })
await page.goto(url + (url.includes('?') ? '&' : '?') + 'debug=1')
await page.waitForFunction(() => window.__showroom?.getState().ready, null, { timeout: 600000, polling: 500 })
await page.waitForTimeout(1500)
const out = { abertura: await page.evaluate(() => window.__debug) }
for (const d of ['modulo', 'fotossensor', 'magnetico', 'sirene', 'controle']) {
  await page.evaluate((d) => window.__showroom.getState().setDevice(d), d)
  await page.waitForTimeout(3500)
  out[d] = (await page.evaluate(() => window.__debug)).triangles
}
console.log(JSON.stringify(out))
await browser.close()
