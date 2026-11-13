import * as THREE from 'three'
import { logoPath2D } from './Logo'

function canvas(w: number, h: number, scale = 1) {
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale); c.height = Math.round(h * scale)
  const ctx = c.getContext('2d')!
  ctx.scale(scale, scale)
  return [c, ctx] as const
}
const HI = 2048 / 768 // texturas da placa de aviso com 2048 px de largura
function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
const cache = new Map<string, THREE.Texture>()
const memo = (k: string, f: () => THREE.Texture) => cache.get(k) ?? (cache.set(k, f()), cache.get(k)!)

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r)
}

// ---------- ícones (compartilhados com a UI 2D) ----------
export type IconId = 'panico' | 'desarmar' | 'armar' | 'parcial'

/** Desenha um ícone do controle/app centrado em (0,0), tamanho ~s. */
export function drawIcon(ctx: CanvasRenderingContext2D, id: IconId, s: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color; ctx.fillStyle = color
  ctx.lineWidth = s * 0.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (id === 'panico') {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.46, 0, Math.PI * 2); ctx.stroke()
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.26, Math.sin(a) * s * 0.26); ctx.lineTo(-Math.cos(a) * s * 0.26, -Math.sin(a) * s * 0.26); ctx.stroke()
    }
  } else if (id === 'desarmar' || id === 'armar') {
    rr(ctx, -s * 0.34, -s * 0.06, s * 0.68, s * 0.52, s * 0.07); ctx.stroke()
    ctx.beginPath()
    if (id === 'armar') { ctx.moveTo(-s * 0.2, -s * 0.06); ctx.lineTo(-s * 0.2, -s * 0.22); ctx.arc(0, -s * 0.22, s * 0.2, Math.PI, 0); ctx.lineTo(s * 0.2, -s * 0.06) }
    else { ctx.moveTo(-s * 0.2, -s * 0.06); ctx.lineTo(-s * 0.2, -s * 0.26); ctx.arc(0, -s * 0.26, s * 0.2, Math.PI, -0.25) }
    ctx.stroke()
    ctx.beginPath(); ctx.arc(0, s * 0.17, s * 0.06, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(0, s * 0.18); ctx.lineTo(0, s * 0.3); ctx.stroke()
  } else {
    ctx.beginPath(); ctx.moveTo(-s * 0.46, -s * 0.02); ctx.lineTo(0, -s * 0.44); ctx.lineTo(s * 0.46, -s * 0.02); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-s * 0.32, -s * 0.1); ctx.lineTo(-s * 0.32, s * 0.44); ctx.lineTo(s * 0.32, s * 0.44); ctx.lineTo(s * 0.32, -s * 0.1); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, s * 0.04, s * 0.085, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-s * 0.13, s * 0.36); ctx.lineTo(-s * 0.13, s * 0.27); ctx.arc(0, s * 0.27, s * 0.13, Math.PI, 0); ctx.lineTo(s * 0.13, s * 0.36); ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}

export const iconTexture = (id: IconId, color = '#e9edf5') =>
  memo(`icon:${id}:${color}`, () => {
    const [c, ctx] = canvas(128, 128)
    ctx.translate(64, 64)
    drawIcon(ctx, id, 96, color)
    return tex(c)
  })

// ---------- foto analisada pela IA ----------
function person(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#16181d'
  ctx.beginPath(); ctx.arc(0, -h * 0.9, h * 0.085, 0, Math.PI * 2); ctx.fill() // cabeça
  rr(ctx, -h * 0.13, -h * 0.8, h * 0.26, h * 0.42, h * 0.07); ctx.fill() // tronco
  ctx.lineWidth = h * 0.085; ctx.strokeStyle = '#16181d'; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-h * 0.06, -h * 0.42); ctx.lineTo(-h * 0.14, -h * 0.02); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(h * 0.06, -h * 0.42); ctx.lineTo(h * 0.16, -h * 0.03); ctx.stroke()
  ctx.lineWidth = h * 0.065
  ctx.beginPath(); ctx.moveTo(-h * 0.12, -h * 0.74); ctx.lineTo(-h * 0.24, -h * 0.46); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(h * 0.12, -h * 0.74); ctx.lineTo(h * 0.27, -h * 0.52); ctx.stroke()
  ctx.restore()
}

/** Foto de um cômodo com uma pessoa e, opcionalmente, a caixa verde da IA. */
export function drawAiPhoto(ctx: CanvasRenderingContext2D, w: number, h: number, box = true) {
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.62)
  g.addColorStop(0, '#dfe3ea'); g.addColorStop(1, '#c4cad5')
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.62)
  ctx.fillStyle = '#9c8468'; ctx.fillRect(0, h * 0.62, w, h * 0.38)
  ctx.fillStyle = '#8a745b'
  for (let i = 0; i < 7; i++) ctx.fillRect(0, h * (0.66 + i * 0.055), w, 2)
  // janela, móvel e sofá
  ctx.fillStyle = '#f5f8ff'; ctx.fillRect(w * 0.08, h * 0.1, w * 0.22, h * 0.34)
  ctx.strokeStyle = '#aab2c0'; ctx.lineWidth = 3; ctx.strokeRect(w * 0.08, h * 0.1, w * 0.22, h * 0.34)
  ctx.beginPath(); ctx.moveTo(w * 0.19, h * 0.1); ctx.lineTo(w * 0.19, h * 0.44); ctx.stroke()
  ctx.fillStyle = '#f2f3f5'; ctx.fillRect(w * 0.66, h * 0.4, w * 0.3, h * 0.28)
  ctx.fillStyle = '#d5d9e0'; ctx.fillRect(w * 0.66, h * 0.53, w * 0.3, 3)
  ctx.fillStyle = '#6f7785'; rr(ctx, w * 0.02, h * 0.56, w * 0.3, h * 0.2, 10); ctx.fill()
  ctx.fillStyle = '#7d8696'; rr(ctx, w * 0.02, h * 0.5, w * 0.3, h * 0.12, 10); ctx.fill()
  const ph = h * 0.62, px = w * 0.52, py = h * 0.9
  person(ctx, px, py, ph)
  if (box) {
    ctx.fillStyle = 'hsla(128,53%,50%,0.42)'; ctx.strokeStyle = 'hsl(128,53%,50%)'; ctx.lineWidth = Math.max(2, w * 0.008)
    ctx.fillRect(px - ph * 0.33, py - ph * 1.03, ph * 0.66, ph * 1.06)
    ctx.strokeRect(px - ph * 0.33, py - ph * 1.03, ph * 0.66, ph * 1.06)
  }
}

let photoUrl: Record<string, string> = {}
export function aiPhotoDataUrl(box = true) {
  const k = String(box)
  if (!photoUrl[k]) { const [c, ctx] = canvas(480, 360); drawAiPhoto(ctx, 480, 360, box); photoUrl[k] = c.toDataURL('image/jpeg', 0.85) }
  return photoUrl[k]
}

/** Polaroid: foto com a caixa da IA e a legenda da previsão. */
export const polaroidTexture = () =>
  memo('polaroid', () => {
    const [c, ctx] = canvas(512, 512)
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, 512, 512)
    ctx.save(); ctx.translate(28, 28); ctx.beginPath(); ctx.rect(0, 0, 456, 360); ctx.clip(); drawAiPhoto(ctx, 456, 360, true); ctx.restore()
    ctx.fillStyle = '#1b2233'; ctx.font = '600 30px Poppins, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Pessoa (100% de previsão)', 256, 448)
    return tex(c)
  })

// ---------- placa de aviso ----------
const AZUL = '#1E398D', AMARELO = '#F9E000'

/** Texto em caixa alta que encolhe até caber na largura dada. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, font: string) {
  let sz = size
  do { ctx.font = font.replace('SIZE', String(sz)); sz -= 1 } while (ctx.measureText(text).width > maxW && sz > 8)
  ctx.fillText(text, x, y)
}

// logo: anel grande (≈ 60% da largura da placa) com o swoosh recortado
export const placaLogoTexture = () =>
  memo('placa-logo', () => {
    const [c, ctx] = canvas(768, 567, HI)
    ctx.fillStyle = AZUL; ctx.fillRect(0, 0, 768, 567)
    logoPath2D(ctx, 384, 290, 262, AMARELO)
    return tex(c)
  })

export const placaFoneTexture = () =>
  memo('placa-fone', () => {
    const [c, ctx] = canvas(768, 201, HI)
    ctx.fillStyle = AZUL; ctx.fillRect(0, 0, 768, 201)
    ctx.textAlign = 'center'
    ctx.fillStyle = AMARELO
    ;(ctx as unknown as { letterSpacing: string }).letterSpacing = '3px'
    ctx.font = '700 62px Poppins, sans-serif'; ctx.fillText('ORSEGUPS', 384, 74)
    ;(ctx as unknown as { letterSpacing: string }).letterSpacing = '0px'
    ctx.fillStyle = '#fff'; ctx.font = '700 44px Poppins, sans-serif'; ctx.fillText('4020.4411', 384, 152)
    return tex(c)
  })

export const placaFaixaTexture = () =>
  memo('placa-faixa', () => {
    const [c, ctx] = canvas(768, 177, HI)
    ctx.fillStyle = AMARELO; ctx.fillRect(0, 0, 768, 177)
    // câmera de segurança, pendurada no canto
    ctx.fillStyle = AZUL; ctx.strokeStyle = AZUL; ctx.lineWidth = 11
    ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(40, 62); ctx.lineTo(66, 62); ctx.stroke()
    ctx.save(); ctx.translate(98, 92); ctx.rotate(0.3)
    rr(ctx, -62, -28, 124, 56, 12); ctx.fill()
    ctx.fillStyle = AMARELO; ctx.beginPath(); ctx.arc(36, 0, 17, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = AZUL; ctx.beginPath(); ctx.arc(36, 0, 8, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.fillStyle = AZUL; ctx.textAlign = 'left'
    fitText(ctx, 'AVISO À POLÍCIA', 186, 86, 560, 72, '800 SIZEpx Poppins, sans-serif')
    fitText(ctx, 'COM REGISTRO DE IMAGEM', 190, 140, 556, 40, '500 SIZEpx "Encode Sans", sans-serif')
    return tex(c)
  })

function fakeQr(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fg: string, bg: string) {
  // QR ilustrativo (não codifica nada). TODO: confirmar com a Orsegups o destino do QR Code real.
  const n = 25, m = size / n
  ctx.fillStyle = bg; ctx.fillRect(x - m, y - m, size + 2 * m, size + 2 * m)
  ctx.fillStyle = fg
  let seed = 365
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  const finder = (i: number, j: number) => (i < 7 && j < 7) || (i >= n - 7 && j < 7) || (i < 7 && j >= n - 7)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!finder(i, j) && rnd() > 0.52) ctx.fillRect(x + i * m, y + j * m, m + 0.5, m + 0.5)
  for (const [i, j] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    ctx.fillStyle = fg; ctx.fillRect(x + i * m, y + j * m, 7 * m, 7 * m)
    ctx.fillStyle = bg; ctx.fillRect(x + (i + 1) * m, y + (j + 1) * m, 5 * m, 5 * m)
    ctx.fillStyle = fg; ctx.fillRect(x + (i + 2) * m, y + (j + 2) * m, 3 * m, 3 * m)
  }
}

export const placaRodapeTexture = () =>
  memo('placa-rodape', () => {
    const [c, ctx] = canvas(768, 177, HI)
    ctx.fillStyle = AZUL; ctx.fillRect(0, 0, 768, 177)
    ctx.fillStyle = '#fff'; ctx.font = '800 62px Poppins, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('ALARME 365', 318, 104)
    fakeQr(ctx, 590, 36, 104, '#1E398D', '#fff')
    return tex(c)
  })

export const placaVersoTexture = () =>
  memo('placa-verso', () => {
    const [c, ctx] = canvas(768, 1024, HI)
    ctx.fillStyle = AZUL; ctx.fillRect(0, 0, 768, 1024)
    ctx.fillStyle = '#fff'; ctx.font = '700 96px Poppins, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('ALARME 365', 384, 290)
    fakeQr(ctx, 384 - 150, 430, 300, AZUL, '#fff')
    return tex(c)
  })

// ---------- detalhes de superfície ----------
/** Lente Fresnel do PIR: faixas horizontais suaves com facetas verticais bem discretas, como na arte oficial. */
export const fresnelTexture = () =>
  memo('fresnel', () => {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = '#dfe2e8'; ctx.fillRect(0, 0, 256, 256)
    // 4 faixas: cada uma clareia de cima para baixo e termina num vinco
    const rows = [0, 58, 122, 190, 256]
    for (let i = 0; i < 4; i++) {
      const g = ctx.createLinearGradient(0, rows[i], 0, rows[i + 1])
      g.addColorStop(0, 'rgba(120,128,142,.34)'); g.addColorStop(0.18, 'rgba(160,168,180,.12)'); g.addColorStop(1, 'rgba(255,255,255,.22)')
      ctx.fillStyle = g; ctx.fillRect(0, rows[i], 256, rows[i + 1] - rows[i])
    }
    // facetas verticais, quase invisíveis
    ctx.strokeStyle = 'rgba(120,128,142,.10)'; ctx.lineWidth = 1
    for (let x = 16; x < 256; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke() }
    return tex(c)
  })

/** Grade de furos do alto-falante (alpha recortado). */
export const grilleTexture = () =>
  memo('grille', () => {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = '#8a8f98'; ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = '#0a0b0e'
    for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) {
      const x = 23 + i * 21, y = 23 + j * 21
      if (Math.hypot(x - 128, y - 128) < 112) { ctx.beginPath(); ctx.arc(x, y, 6.2, 0, Math.PI * 2); ctx.fill() }
    }
    return tex(c)
  })

// ---------- acabamento ----------
/** Micro-textura do plástico injetado: normal map sutil, gerado uma vez. */
export const microNormalTexture = () =>
  memo('micro-normal', () => {
    const N = 128
    const h = new Float32Array(N * N)
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < h.length; i++) h[i] = rnd()
    // suaviza um pouco para virar "casca de laranja" fina, e não ruído puro
    const b = new Float32Array(N * N)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let a = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a += h[((y + dy + N) % N) * N + ((x + dx + N) % N)]
      b[y * N + x] = a / 9
    }
    const [c, ctx] = canvas(N, N)
    const img = ctx.createImageData(N, N)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = b[y * N + ((x + 1) % N)] - b[y * N + ((x - 1 + N) % N)]
      const dy = b[((y + 1) % N) * N + x] - b[((y - 1 + N) % N) * N + x]
      const i = (y * N + x) * 4
      img.data[i] = 128 + dx * 420; img.data[i + 1] = 128 + dy * 420; img.data[i + 2] = 255; img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(6, 6)
    return t
  })

/** Placa de circuito: verde liso, de um tom só, com trilhas finas e MUITO discretas. Sem componentes pintados,
 *  sem serigrafia, sem etiquetas: os componentes de verdade são poucos e ficam na geometria. */
export const pcbTexture = () =>
  memo('pcb', () => {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = '#17803f'; ctx.fillRect(0, 0, 256, 256)
    let seed = 365
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    ctx.lineCap = 'round'; ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(70,165,100,0.22)'
    for (let i = 0; i < 26; i++) {
      // trilha em "L": um trecho reto, uma quebra a 45° e outro trecho reto
      let x = rnd() * 256, y = rnd() * 256
      const h = rnd() > 0.5, l1 = 20 + rnd() * 60, l2 = 15 + rnd() * 50
      ctx.beginPath(); ctx.moveTo(x, y)
      if (h) x += l1; else y += l1
      ctx.lineTo(x, y); x += 8; y += 8; ctx.lineTo(x, y)
      if (h) y += l2; else x += l2
      ctx.lineTo(x, y); ctx.stroke()
    }
    return tex(c)
  })

/** Variação sutil de rugosidade do plástico injetado (canal verde multiplica a `roughness`). Gerada uma vez. */
export const roughnessNoiseTexture = () =>
  memo('rough-noise', () => {
    const N = 128
    const [c, ctx] = canvas(N, N)
    const img = ctx.createImageData(N, N)
    let seed = 31
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // ruído em duas escalas: manchas largas (brilho irregular do molde) + grão fino
    const coarse = Array.from({ length: 17 * 17 }, rnd)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * 16, fy = (y / N) * 16, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy
      const g = (i: number, j: number) => coarse[(j % 16) * 17 + (i % 16)]
      const low = (g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx) * (1 - ty) + (g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx) * ty
      const v = Math.round(255 * (0.84 + 0.11 * low + 0.05 * rnd()))
      img.data.set([v, v, v, 255], (y * N + x) * 4)
    }
    ctx.putImageData(img, 0, 0)
    const t = tex(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(3, 3)
    t.colorSpace = THREE.NoColorSpace
    return t
  })
