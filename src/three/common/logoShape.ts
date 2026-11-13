// Forma do logo Orsegups (pela arte oficial da placa), em coordenadas polares em volta do centro:
// [ângulo em graus, raio ÷ raio de fora]. É usada pela textura da placa (canvas) e pelo logo da interface (SVG).
// ARM é a borda de dentro do braço de fora (da ponta à esquerda, por cima, até a ponta à direita); RING_R e RING_L
// são a borda de cima do anel de dentro, à direita e à esquerda do miolo. Entre o braço e o anel fica o corte.
const ARM: [number, number][] = [[138, 1.027], [135, 1.0], [128, 0.929], [120, 0.857], [112, 0.81], [105, 0.77], [97, 0.73], [90, 0.698], [82, 0.679], [75, 0.667], [67, 0.664], [60, 0.667], [52, 0.675], [45, 0.69], [37, 0.714], [30, 0.738], [22, 0.774], [15, 0.81], [7, 0.869], [0, 0.937], [-8, 0.996]]
const RING_R: [number, number][] = [[-11, 1.0], [0, 0.889], [7, 0.817], [15, 0.754], [22, 0.702], [30, 0.659], [36.7, 0.633]]
const RING_L: [number, number][] = [[111, 0.647], [120, 0.698], [128, 0.754], [135, 0.817], [142, 0.897], [150, 0.984], [154, 1.03]]

/** Anel do logo, em frações do raio de fora: deslocamento do círculo de fora e do miolo, e o raio do miolo. */
export const LOGO_RING = { outer: [-0.012, -0.032], hole: [-0.016, -0.04], holeR: 0.611 } as const

/** Curva suave (Catmull-Rom) pelos pontos polares, já em coordenadas de tela (y para baixo). */
function polarCurve(tb: [number, number][], cx: number, cy: number, r: number, n = 6) {
  const P = tb.map(([d, k]) => [cx + Math.cos((d * Math.PI) / 180) * k * r, cy - Math.sin((d * Math.PI) / 180) * k * r])
  const out: number[][] = []
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)]
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3)))
    }
  }
  out.push(P[P.length - 1])
  return out
}

/**
 * Contorno do corte (o "swoosh" na cor do fundo) para um logo de raio de fora `r` centrado em (cx, cy): largo à
 * esquerda, passa rente por cima do miolo e afina até a ponta da direita.
 */
export function logoCut(cx: number, cy: number, r: number): number[][] {
  const pol = (d: number, k: number) => [cx + Math.cos((d * Math.PI) / 180) * k * r, cy - Math.sin((d * Math.PI) / 180) * k * r]
  return [
    pol(156, 1.08), pol(139, 1.08), // por fora do anel, à esquerda: ali o corte abre até a borda
    ...polarCurve(ARM, cx, cy, r),
    pol(-10, 1.08), pol(-12, 1.08),
    ...polarCurve(RING_R, cx, cy, r),
    pol(50, 0.5), pol(100, 0.5), // por dentro do miolo
    ...polarCurve(RING_L, cx, cy, r),
  ]
}
