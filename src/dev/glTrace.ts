/**
 * Diagnóstico de carga do `?debug=1`: quem USA um programa de shader antes de ele terminar de compilar?
 *
 * Com KHR_parallel_shader_compile o navegador compila em paralelo; mas ler o estado de um programa
 * (getProgramParameter: LINK_STATUS, ACTIVE_UNIFORMS, ACTIVE_ATTRIBUTES) obriga a ESPERAR a compilação.
 * Aqui embrulhamos essa chamada: cada espera acima de 20 ms vira um `console.trace` (o caminho mostra quem
 * chamou) e entra num resumo por tipo de material e por etapa da carga, impresso com `console.table`
 * quando a tela de carregamento sai. Também fica em `window.__glTrace`.
 *
 * Só é ligado com `?debug=1`. Não muda a ordem de carga nem nenhum material.
 */
type Row = { ms: number; material: string; consulta: string; etapa: string }
const NAMES: Record<number, string> = { 0x8b82: 'LINK_STATUS', 0x8b86: 'ACTIVE_UNIFORMS', 0x8b89: 'ACTIVE_ATTRIBUTES', 0x91b1: 'COMPLETION_STATUS' }

export function installGlTrace() {
  if (typeof WebGL2RenderingContext === 'undefined') return
  const rows: Row[] = []
  const w = window as unknown as { __glTrace?: Row[]; __gl?: { info: { programs: { program: WebGLProgram; name?: string; type?: string }[] | null } } }
  w.__glTrace = rows
  const proto = WebGL2RenderingContext.prototype
  const orig = proto.getProgramParameter
  proto.getProgramParameter = function (this: WebGL2RenderingContext, program: WebGLProgram, pname: number) {
    const t0 = performance.now()
    const out = orig.call(this, program, pname)
    const ms = performance.now() - t0
    if (ms > 20) {
      // de que material é este programa, e em que etapa da carga estávamos
      const p = w.__gl?.info.programs?.find((x) => x.program === program)
      const etapa = performance.getEntriesByType('mark').filter((m) => m.name.startsWith('boot:')).pop()?.name.slice(6) ?? 'antes da carga'
      const row = { ms: Math.round(ms), material: p?.name || p?.type || 'ainda não registrado', consulta: NAMES[pname] ?? `0x${pname.toString(16)}`, etapa }
      rows.push(row)
      console.trace(`[debug] getProgramParameter esperou ${row.ms} ms · ${row.material} · ${row.consulta} · etapa: ${row.etapa}`)
    }
    return out
  }
}

/** Resumo das esperas (por material e etapa), para colar no PR. */
export function reportGlTrace() {
  const rows = (window as unknown as { __glTrace?: Row[] }).__glTrace ?? []
  const by = new Map<string, { material: string; etapa: string; chamadas: number; totalMs: number; maiorMs: number }>()
  for (const r of rows) {
    const k = `${r.material}|${r.etapa}`
    const e = by.get(k) ?? { material: r.material, etapa: r.etapa, chamadas: 0, totalMs: 0, maiorMs: 0 }
    e.chamadas++; e.totalMs += r.ms; e.maiorMs = Math.max(e.maiorMs, r.ms)
    by.set(k, e)
  }
  const table = [...by.values()].sort((a, b) => b.totalMs - a.totalMs)
  console.log(`[debug] esperas por shader acima de 20 ms durante a carga: ${rows.length} chamadas, ${rows.reduce((a, r) => a + r.ms, 0)} ms no total`)
  if (table.length) console.table(table)
  return table
}
