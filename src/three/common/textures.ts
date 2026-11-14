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
export function drawAiPhoto(ctx: CanvasRenderingContext2D, w: number, h: number, box = true, empty = false) {
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
  if (empty) return // a sala sem ninguém
  person(ctx, px, py, ph)
  if (box) {
    ctx.fillStyle = 'hsla(128,53%,50%,0.42)'; ctx.strokeStyle = 'hsl(128,53%,50%)'; ctx.lineWidth = Math.max(2, w * 0.008)
    ctx.fillRect(px - ph * 0.33, py - ph * 1.03, ph * 0.66, ph * 1.06)
    ctx.strokeRect(px - ph * 0.33, py - ph * 1.03, ph * 0.66, ph * 1.06)
  }
}

let photoUrl: Record<string, string> = {}
export function aiPhotoDataUrl(box = true, empty = false) {
  const k = `${box}-${empty}`
  if (!photoUrl[k]) { const [c, ctx] = canvas(480, 360); drawAiPhoto(ctx, 480, 360, box, empty); photoUrl[k] = c.toDataURL('image/jpeg', 0.85) }
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
/** Texto esticado na horizontal até ocupar exatamente `w` (as letras largas da arte da placa), com reforço opcional do traço. */
function wideText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, font: string, align: 'left' | 'center' = 'center', stroke = 0) {
  ctx.save()
  ctx.font = font; ctx.textAlign = align
  const k = w / ctx.measureText(text).width
  ctx.translate(x, y); ctx.scale(k, 1)
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = stroke / k; ctx.strokeStyle = ctx.fillStyle as string; ctx.strokeText(text, 0, 0) }
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

// As quatro faixas da frente seguem a arte oficial da placa (450 × 600): logo (anel de 56% da largura, no alto) com
// "ORSEGUPS", telefone, faixa amarela (de 66% a 83% da altura) e rodapé com "ALARME 365" e o QR.
export const placaLogoTexture = () =>
  memo('placa-logo', () => {
    const [c, ctx] = canvas(768, 667, HI)
    ctx.fillStyle = AZUL; ctx.fillRect(0, 0, 768, 667)
    logoPath2D(ctx, 386, 286, 250, AMARELO)
    ctx.fillStyle = AMARELO
    wideText(ctx, 'ORSEGUPS', 384, 623, 398, '600 64px Poppins, sans-serif')
    return tex(c)
  })

export const placaFoneTexture = () =>
  memo('placa-fone', () => {
    const [c, ctx] = canvas(768, 88, HI)
    ctx.fillStyle = AZUL; ctx.fillRect(0, 0, 768, 88)
    ctx.fillStyle = '#fff'
    wideText(ctx, '4020.4411', 384, 45, 258, '700 52px Poppins, sans-serif')
    return tex(c)
  })

export const placaFaixaTexture = () =>
  memo('placa-faixa', () => {
    const [c, ctx] = canvas(768, 177, HI)
    ctx.fillStyle = AMARELO; ctx.fillRect(0, 0, 768, 177)
    // câmera de segurança, pelo desenho da arte: haste reta, colar, capuz em viseira, corpo em cunha e, na ponta, a
    // lente oblíqua (anel com o miolo amarelo e a meia-lua). Cada peça da frente leva um filete amarelo em volta.
    ctx.fillStyle = AZUL
    ctx.fillRect(37.5, -8, 12, 48) // haste
    ctx.fillRect(36, 43, 17, 23) // colar
    ctx.beginPath(); ctx.ellipse(125.5, 119, 22.5, 34, 0.2, 0, Math.PI * 2); ctx.fill() // anel da lente
    ctx.fillStyle = AMARELO; ctx.beginPath(); ctx.ellipse(119, 108, 10.5, 26, 0.2, 0, Math.PI * 2); ctx.fill()
    ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = AMARELO
    const peca = (path: () => void) => { ctx.beginPath(); path(); ctx.closePath(); ctx.stroke(); ctx.fillStyle = AZUL; ctx.fill() }
    peca(() => { ctx.moveTo(150, 94); ctx.bezierCurveTo(181, 90, 184, 114, 157, 128); ctx.lineTo(152, 124) }) // meia-lua
    peca(() => { // capuz
      ctx.moveTo(28, 108); ctx.lineTo(28, 92); ctx.bezierCurveTo(29, 77, 38, 62, 56, 61); ctx.lineTo(158, 84)
      ctx.lineTo(90, 122); ctx.lineTo(42, 122); ctx.quadraticCurveTo(28, 122, 28, 108)
    })
    peca(() => { ctx.moveTo(34, 127); ctx.lineTo(97, 130); ctx.lineTo(101, 152); ctx.lineTo(86, 151); ctx.lineTo(36, 131) }) // corpo
    ctx.fillStyle = AZUL
    wideText(ctx, 'AVISO À POLÍCIA', 190, 84, 555, '700 64px Poppins, sans-serif', 'left', 1.5)
    wideText(ctx, 'COM REGISTRO DE IMAGEM', 196, 141, 543, '400 40px "Encode Sans", sans-serif', 'left')
    return tex(c)
  })

function fakeQr(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fg: string, bg: string, n = 25) {
  // QR ilustrativo (não codifica nada), com n × n módulos. TODO: confirmar com a Orsegups o destino do QR Code real.
  const m = size / n
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

/** Tinta do adesivo "Dúvidas?": anil escuro, puxando para o violeta (não é o azul da marca). */
const TINTA_DUVIDAS = '#25236B'
/** Adesivo "Dúvidas?" da frente do módulo: texto anil e um QR ilustrativo (não codifica nada) sobre fundo branco. */
export const duvidasStickerTexture = () =>
  memo('duvidas-sticker', () => {
    const [c, ctx] = canvas(320, 420, 2)
    ctx.fillStyle = '#fbfbfa'; ctx.fillRect(0, 0, 320, 420)
    ctx.fillStyle = TINTA_DUVIDAS; ctx.textAlign = 'center'
    fitText(ctx, 'Dúvidas?', 160, 60, 230, 46, '700 SIZEpx Poppins, sans-serif')
    fakeQr(ctx, 50, 86, 220, TINTA_DUVIDAS, '#fbfbfa')
    ctx.fillStyle = TINTA_DUVIDAS; ctx.textAlign = 'center'
    fitText(ctx, 'Aponte a câmera para o', 160, 352, 270, 23, '600 SIZEpx "Encode Sans", sans-serif')
    fitText(ctx, 'QRCode e fale conosco', 160, 384, 270, 23, '600 SIZEpx "Encode Sans", sans-serif')
    return tex(c)
  })

/** Azul liso da chapa (borda e miolo): 1 px. Com textura, a chapa usa o mesmo programa de shader das faces impressas. */
export const placaAzulTexture = () =>
  memo('placa-azul', () => {
    const [c, ctx] = canvas(2, 2)
    ctx.fillStyle = AZUL; ctx.fillRect(0, 0, 2, 2)
    return tex(c)
  })

export const placaRodapeTexture = () =>
  memo('placa-rodape', () => {
    const [c, ctx] = canvas(768, 177, HI)
    ctx.fillStyle = AZUL; ctx.fillRect(0, 0, 768, 177)
    ctx.fillStyle = '#fff'
    wideText(ctx, 'ALARME 365', 69, 117, 457, '700 70px Poppins, sans-serif', 'left')
    fakeQr(ctx, 590, 32, 110, '#fff', AZUL, 29) // na arte o QR é branco sobre o azul, de módulos miúdos
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
    ctx.fillStyle = '#157a3c'; ctx.fillRect(0, 0, 256, 256)
    let seed = 365
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 1.4
    // trilhas como numa placa de verdade: feixes de 2 a 4 linhas paralelas (um tom acima do verde), com um trecho
    // reto, uma quebra a 45° e outro trecho reto; no fim de cada linha, uma via (pontinho claro de miolo escuro)
    for (let i = 0; i < 15; i++) {
      const x0 = rnd() * 256, y0 = rnd() * 256, h = rnd() > 0.5, l1 = 24 + rnd() * 70, l2 = 18 + rnd() * 60, n = 2 + Math.floor(rnd() * 3)
      for (let k = 0; k < n; k++) {
        let x = x0 + (h ? 0 : k * 5), y = y0 + (h ? k * 5 : 0)
        ctx.strokeStyle = 'rgba(92,186,118,0.3)'
        ctx.beginPath(); ctx.moveTo(x, y)
        if (h) x += l1 - k * 5; else y += l1 - k * 5
        ctx.lineTo(x, y); x += 9; y += 9; ctx.lineTo(x, y)
        if (h) y += l2; else x += l2
        ctx.lineTo(x, y); ctx.stroke()
        if (k === 0) {
          ctx.fillStyle = 'rgba(150,215,165,0.5)'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = 'rgba(8,40,20,0.75)'; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill()
        }
      }
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

/** Halo dos LEDs: brilho radial branco (a cor vem do material), forte no centro e sumindo na borda. */
export const ledGlowTexture = () =>
  memo('led-glow', () => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.08, 'rgba(255,255,255,0.85)'); g.addColorStop(0.22, 'rgba(255,255,255,0.32)'); g.addColorStop(0.5, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  })
