// Os 14 estados do LED do Módulo de Comando (guia de LEDs).
export type LedPattern = 'solid' | 'blink' | 'slow' | 'triple' | 'alt' | 'off'

export type LedStateId =
  | 'desarmado' | 'armado' | 'parcial' | 'disparo' | 'audio' | 'sos'
  | 'iniciando' | 'sem-sinal' | 'manutencao' | 'pareando'
  | 'buscando-atualizacao' | 'instalando-atualizacao' | 'erro-atualizacao' | 'apagado'

export type LedState = {
  id: LedStateId
  label: string // cor / padrão
  meaning: string
  colors: string[]
  pattern: LedPattern
}

// cores na faixa em que o tone mapping (ACES) não as desbota: azul com um toque de verde (o azul puro vira roxo)
const AZUL = '#0f5bff', VERMELHO = '#ff1f1f', LARANJA = '#ff7a10', AMARELO = '#ffd000', BRANCO = '#ffffff', VERDE = '#18d24a'

export const LED_STATES: LedState[] = [
  { id: 'desarmado', label: 'Azul', meaning: 'Desarmado', colors: [AZUL], pattern: 'solid' },
  { id: 'armado', label: 'Vermelho contínuo', meaning: 'Armado (modo sair)', colors: [VERMELHO], pattern: 'solid' },
  { id: 'parcial', label: 'Laranja', meaning: 'Armado modo ficar / parcial', colors: [LARANJA], pattern: 'solid' },
  { id: 'disparo', label: 'Vermelho piscando', meaning: 'Disparo', colors: [VERMELHO], pattern: 'blink' },
  { id: 'audio', label: 'Vermelho piscando lento', meaning: 'Ligação de áudio com a Central', colors: [VERMELHO], pattern: 'slow' },
  { id: 'sos', label: 'Vermelho 3x', meaning: 'SOS / pânico acionado', colors: [VERMELHO], pattern: 'triple' },
  { id: 'iniciando', label: 'Amarelo estático', meaning: 'Iniciando', colors: [AMARELO], pattern: 'solid' },
  { id: 'sem-sinal', label: 'Amarelo piscando', meaning: 'Procurando sinal / sem internet', colors: [AMARELO], pattern: 'blink' },
  { id: 'manutencao', label: 'Branco estático', meaning: 'Modo manutenção', colors: [BRANCO], pattern: 'solid' },
  { id: 'pareando', label: 'Branco piscando', meaning: 'Pareando dispositivo', colors: [BRANCO], pattern: 'blink' },
  { id: 'buscando-atualizacao', label: 'Verde estático', meaning: 'Buscando atualização', colors: [VERDE], pattern: 'solid' },
  { id: 'instalando-atualizacao', label: 'Verde piscando', meaning: 'Instalando atualização', colors: [VERDE], pattern: 'blink' },
  { id: 'erro-atualizacao', label: 'Verde + vermelho', meaning: 'Erro na atualização', colors: [VERDE, VERMELHO], pattern: 'alt' },
  { id: 'apagado', label: 'Apagado', meaning: 'Sem energia', colors: ['#20242c'], pattern: 'off' },
]

export const LED_BY_ID = Object.fromEntries(LED_STATES.map((s) => [s.id, s])) as Record<LedStateId, LedState>

/** Cor e intensidade (0..1) do LED num instante t (segundos). Sem alocação. */
export function ledSample(s: LedState, t: number, out: { color: string; on: number }) {
  out.color = s.colors[0]
  switch (s.pattern) {
    case 'solid': out.on = 1; break
    case 'off': out.on = 0; break
    case 'blink': out.on = t % 0.5 < 0.25 ? 1 : 0.04; break
    case 'slow': out.on = t % 1.8 < 0.9 ? 1 : 0.04; break
    case 'triple': { const c = t % 2.4; out.on = c < 1.2 && c % 0.4 < 0.2 ? 1 : 0.04; break }
    case 'alt': out.color = s.colors[t % 1 < 0.5 ? 0 : 1]; out.on = 1; break
  }
  return out
}

export const ARM_TO_LED = { disarmed: 'desarmado', armed: 'armado', partial: 'parcial' } as const
