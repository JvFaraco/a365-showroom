/** Ponte com a tela de carregamento inline do index.html (window.__boot). Não usa React. */
type Boot = { set: (p: number, label?: string) => void; done: () => void }
const w = (typeof window !== 'undefined' ? window : {}) as { __boot?: Boot }
export const boot: Boot = {
  set: (p, label) => {
    // cada etapa vira uma marca de desempenho (aparece no painel Performance e no tools/perf.mjs)
    if (label && typeof performance !== 'undefined') performance.mark(`boot: ${label}`)
    w.__boot?.set(Math.min(1, Math.max(0, p)), label)
  },
  done: () => w.__boot?.done(),
}
