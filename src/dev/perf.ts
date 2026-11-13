// Medição de fluidez no aparelho de verdade (PC ou celular) e opções de teste pela URL.
// Nada aqui muda o comportamento padrão: sem parâmetros na URL, o site funciona como sempre.
//
//   ?perf=1        mostra o medidor (fps, quadros lentos) e o botão "Testar fluidez"
//   ?q=0..3        fixa o nível de qualidade (0 completo · 1 DPR 1 · 2 sem AO · 3 sem reflexo/SMAA/vinheta)
//                  e desliga a qualidade adaptativa
//   ?dpr=1|1.5|2   fixa a resolução (densidade de pixels)
//   ?fpsmin=55     a qualidade adaptativa reduz quando a média cai abaixo deste fps (padrão do drei: 40 em 60 Hz)
import type CameraControlsImpl from 'camera-controls'
import type * as THREE from 'three'

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
const num = (k: string) => { const v = Q.get(k); return v === null || v === '' || isNaN(+v) ? null : +v }

export const PERF_HUD = Q.has('perf')
const q = num('q')
export const FORCE_Q = q === null ? null : (Math.max(0, Math.min(3, Math.round(q))) as 0 | 1 | 2 | 3)
const d = num('dpr')
export const FORCE_DPR = d === null ? null : Math.max(0.5, Math.min(3, d))
export const FPS_MIN = num('fpsmin')

/** Ponte entre o canvas e o medidor (DOM): controles da câmera, renderer e o contêiner que recebe os eventos. */
export const perfBridge: { controls: CameraControlsImpl | null; gl: THREE.WebGLRenderer | null; container: HTMLElement | null } = {
  controls: null, gl: null, container: null,
}

/** Nome da placa de vídeo, quando o navegador informa. */
export function gpuName(gl: THREE.WebGLRenderer | null) {
  if (!gl) return '?'
  const ctx = gl.getContext()
  const ext = ctx.getExtension('WEBGL_debug_renderer_info')
  return String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER))
}
