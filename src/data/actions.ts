import type { ActionId, Vec3 } from './devices'

/** Tempo (s) que o Tour fica em cada parte. */
export const TOUR_SECONDS = 5

// Duração (s) das micro-animações com tempo fixo. As sem duração são interativas e
// ficam abertas até o usuário fechar ou trocar de parte.
export const ACTIONS: Record<ActionId, {
  label: string
  duration?: number
  /** ação com estado: abre em `hold` segundos e fica aberta até o botão `undo` desfazer */
  hold?: number
  undo?: string
  /** mantém as outras partes esmaecidas durante a ação (para ver o interior) */
  keepDim?: boolean
  /** câmera própria da ação, quando o efeito não cabe no enquadramento da parte */
  camera?: { position: Vec3; target: Vec3 }
}> = {
  antena: { label: 'Rosquear a antena e ver as 3 vias', duration: 13, camera: { position: [4.4, 3.4, -5.6], target: [0, 1.3, -0.4] } },
  sos190: { label: 'Acionar o 190' },
  led: { label: 'Ver os estados do LED' },
  'abrir-modulo': { label: 'Abrir o módulo', hold: 3.3, undo: 'Fechar', camera: { position: [2.4, 2.8, 4.4], target: [0, 0.55, 0] } },
  cabos: { label: 'Encaixar os cabos', duration: 5.5, camera: { position: [1.5, -2.6, -3.4], target: [0, -0.45, -0.9] } },
  audio: { label: 'Ouvir a Central', duration: 8, camera: { position: [1.4, -2.4, -3.0], target: [0, -0.5, -0.7] } },
  'bateria-modulo': { label: 'Tirar da tomada', duration: 9, camera: { position: [2.6, 1.3, 3.0], target: [0.4, 0, 0] } },
  pir: { label: 'Ver o campo de detecção', duration: 14, camera: { position: [5.6, 4.4, 7.4], target: [0.6, -0.5, 1.8] } },
  camera: { label: 'Tirar uma foto', duration: 7, camera: { position: [1.7, 0.8, 4.2], target: [0.45, 0.3, 0.3] } },
  suporte: { label: 'Inclinar o sensor', duration: 8, camera: { position: [4.6, 0.4, -0.6], target: [0, -0.2, -0.1] } },
  'tampa-foto': { label: 'Abrir a tampa', hold: 3.8, undo: 'Fechar', camera: { position: [1.5, 0.5, 5.6], target: [0, -0.1, 0.4] } },
  ima: { label: 'Abrir a porta', duration: 7, camera: { position: [-0.6, 0.6, 7.2], target: [0.4, -0.7, 0] } },
  choque: { label: 'Testar uma batida', camera: { position: [-0.6, 0.6, 7.2], target: [0.4, -0.7, 0] } },
  som: { label: 'Tocar a sirene', camera: { position: [1.1, 0.4, 3.6], target: [0, 0, 0.2] } },
  encaixe: { label: 'Encaixar no suporte', duration: 4.6, camera: { position: [3.6, 1.5, 6.4], target: [0, 0.9, 0] } },
  'bateria-sirene': { label: 'Retirar a bateria', hold: 4.0, undo: 'Recolocar', camera: { position: [1.8, 1.6, 7.0], target: [0, 0.9, 0] } },
  tamper: { label: 'Retirar da parede', hold: 1.4, undo: 'Recolocar', camera: { position: [-3.8, 1.3, 6.2], target: [0, 0.9, 0] } },
  'btn-desarmar': { label: 'Apertar: desarmar', duration: 3.2, camera: { position: [1.1, 0.7, 7.2], target: [1.0, 0.2, 0] } },
  'btn-armar': { label: 'Apertar: armar', duration: 3.2, camera: { position: [1.1, 0.7, 7.2], target: [1.0, 0.2, 0] } },
  'btn-parcial': { label: 'Apertar: armar parcial', duration: 3.2, camera: { position: [1.1, 0.7, 7.2], target: [1.0, 0.2, 0] } },
  panico: { label: 'Acionar o pânico', camera: { position: [1.1, 0.7, 7.2], target: [1.0, 0.2, 0] } },
  alcance: { label: 'Ver o alcance', duration: 6, camera: { position: [0, 4.6, 6.4], target: [0, -0.4, 0] } },
  'tampa-controle': { label: 'Abrir a tampa', hold: 3.7, undo: 'Fechar', camera: { position: [1.1, 0.6, 5.6], target: [-0.2, -0.15, 0.3] } },
  flip: { label: 'Virar a placa', duration: 5, camera: { position: [0.9, 0.3, 4.0], target: [0, 0, 0] } },
  brilho: { label: 'Ver o brilho', duration: 3, camera: { position: [0.7, 0.2, 3.6], target: [0, 0, 0] } },
  'alarme-geral': { label: 'Mudar o estado do alarme' },
  'solicitar-imagem': { label: 'Solicitar imagem atualizada' },
}
