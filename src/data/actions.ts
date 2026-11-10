import type { ActionId, Vec3 } from './devices'

// Duração (s) das micro-animações com tempo fixo. As sem duração são interativas e
// ficam abertas até o usuário fechar ou trocar de parte.
export const ACTIONS: Record<ActionId, {
  label: string
  duration?: number
  /** mantém as outras partes esmaecidas durante a ação (para ver o interior) */
  keepDim?: boolean
  /** câmera própria da ação, quando o efeito não cabe no enquadramento da parte */
  camera?: { position: Vec3; target: Vec3 }
}> = {
  antena: { label: 'Rosquear a antena e ver as 3 vias', duration: 13, camera: { position: [4.4, 3.4, -5.6], target: [0, 1.3, -0.4] } },
  sos190: { label: 'Acionar o 190' },
  led: { label: 'Ver os estados do LED' },
  audio: { label: 'Ouvir a Central', duration: 8 },
  'bateria-modulo': { label: 'Tirar da tomada', duration: 9, camera: { position: [2.6, 1.3, 3.0], target: [0.4, 0, 0] } },
  pir: { label: 'Ver o campo de detecção', duration: 14, camera: { position: [5.6, 4.4, 7.4], target: [0.6, -0.5, 1.8] } },
  camera: { label: 'Tirar uma foto', duration: 7, camera: { position: [1.7, 0.8, 4.2], target: [0.45, 0.3, 0.3] } },
  suporte: { label: 'Inclinar o sensor', duration: 8, camera: { position: [3.2, 1.2, -1.2], target: [0, 0, -0.3] } },
  'tampa-foto': { label: 'Abrir a tampa', duration: 6, keepDim: true, camera: { position: [-2.0, 0.3, -2.6], target: [0, -0.2, -0.6] } },
  ima: { label: 'Abrir a porta', duration: 7, camera: { position: [0.2, 0.9, 6.6], target: [0.5, 0.1, 0] } },
  choque: { label: 'Testar uma batida', camera: { position: [0.2, 0.9, 6.6], target: [0.5, 0.1, 0] } },
  som: { label: 'Tocar a sirene', camera: { position: [1.1, 0.4, 3.6], target: [0, 0, 0.2] } },
  encaixe: { label: 'Encaixar e girar', duration: 6, camera: { position: [2.6, 0.8, -2.2], target: [0, 0, 0] } },
  'bateria-sirene': { label: 'Retirar a bateria', duration: 7, keepDim: true, camera: { position: [0.9, 1.2, 2.6], target: [0, 0.4, 0.3] } },
  'btn-desarmar': { label: 'Apertar: desarmar', duration: 3.2, camera: { position: [1.1, 0.7, 7.2], target: [1.0, 0.2, 0] } },
  'btn-armar': { label: 'Apertar: armar', duration: 3.2, camera: { position: [1.1, 0.7, 7.2], target: [1.0, 0.2, 0] } },
  'btn-parcial': { label: 'Apertar: armar parcial', duration: 3.2, camera: { position: [1.1, 0.7, 7.2], target: [1.0, 0.2, 0] } },
  panico: { label: 'Acionar o pânico', camera: { position: [1.1, 0.7, 7.2], target: [1.0, 0.2, 0] } },
  alcance: { label: 'Ver o alcance', duration: 6, camera: { position: [0, 4.6, 6.4], target: [0, -0.4, 0] } },
  'tampa-controle': { label: 'Abrir a tampa', duration: 6, keepDim: true, camera: { position: [1.3, 0.7, -2.9], target: [0, 0.1, -0.5] } },
  flip: { label: 'Virar a placa', duration: 5, camera: { position: [0.9, 0.3, 4.0], target: [0, 0, 0] } },
  brilho: { label: 'Ver o brilho', duration: 3, camera: { position: [0.7, 0.2, 3.6], target: [0, 0, 0] } },
  'alarme-geral': { label: 'Mudar o estado do alarme' },
  'solicitar-imagem': { label: 'Solicitar imagem atualizada' },
}
