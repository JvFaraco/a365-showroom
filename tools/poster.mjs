#!/usr/bin/env node
/**
 * Gera a imagem estática da abertura (os 7 aparelhos), que aparece por trás da tela de carregamento antes
 * de o 3D ficar pronto. É um print do próprio app, só do canvas (sem título, botão ou barra).
 *
 *   npm run build && npm run preview          (em outro terminal)
 *   node tools/poster.mjs [url] [--channel msedge]
 *
 * Saída: public/poster.webp (1600 × 900) e public/poster-m.webp (retrato, 780 × 1688). Rode de novo, e faça
 * outro build, sempre que os modelos, a luz ou a disposição da abertura mudarem.
 * Precisa do Playwright (`npm i -D playwright`). Em máquina sem GPU, use PERF_SOFTWARE_GL=1.
 */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const args = process.argv.slice(2)
const url = args.find((a) => /^https?:/.test(a)) ?? 'http://localhost:4173/'
const channel = args.includes('--channel') ? args[args.indexOf('--channel') + 1] : undefined
const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(out, { recursive: true })
const launchArgs = process.env.PERF_SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : []

const browser = await chromium.launch({ channel, args: launchArgs })
for (const [name, width, height, mobile] of [['poster.webp', 1600, 900, false], ['poster-m.webp', 780, 1688, true]]) {
  const ctx = await browser.newContext({ viewport: { width: mobile ? width / 2 : width, height: mobile ? height / 2 : height }, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce', ...(mobile ? { hasTouch: true, isMobile: true } : {}) })
  const page = await ctx.newPage()
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}hq`)
  await page.waitForFunction(() => window.__showroom?.getState?.().ready, null, { timeout: 600000 })
  // só a cena: somem a interface (título, botão, barras) e a própria tela de carregamento
  // (a tela do celular do kit é HTML dentro do contêiner do canvas, o primeiro filho de <main>, e fica)
  await page.addStyleTag({ content: '#boot, main > :not(:first-child) { visibility: hidden !important; }' })
  await page.waitForTimeout(2500)
  const png = await page.screenshot({ type: 'png', timeout: 240000 })
  // PNG → WebP dentro da página (o Playwright não grava WebP)
  const webp = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    c.getContext('2d').drawImage(img, 0, 0)
    return c.toDataURL('image/webp', 0.8).split(',')[1]
  }, png.toString('base64'))
  writeFileSync(resolve(out, name), Buffer.from(webp, 'base64'))
  console.log(name, `${width} × ${height}`, `${Math.round(Buffer.from(webp, 'base64').length / 1024)} kB`)
  await ctx.close()
}
await browser.close()
