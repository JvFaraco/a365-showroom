// Linha do tempo da cena "Em ação".
export const IA_STEPS = [
  { t: 0, label: 'Armado pelo controle', text: 'O controle remoto arma o alarme e o LED do módulo fica vermelho.' },
  { t: 3, label: 'Porta aberta', text: 'O sensor magnético detecta a porta abrindo. A sirene toca na hora e o celular recebe "Disparo do sensor".' },
  { t: 7.4, label: 'Foto com flash', text: 'O fotossensor detecta o movimento e tira a foto com flash.' },
  { t: 10, label: 'Fuga', text: 'Com a sirene tocando e a foto tirada, o invasor foge.' },
  { t: 13, label: 'Imagem + IA', text: 'Chega a "Imagem do disparo" e a IA confirma: Pessoa (100% de previsão).' },
] as const
export const IA_DURATION = 17

/**
 * Marcos finos da cena (s), além dos passos: o celular e as etiquetas mudam só nesses instantes. O índice da fase
 * (quantos marcos já passaram) vai para o estado `iaPhase`, uma vez por marco.
 * 1 armado · 2 aviso "Disparo do sensor" · 3 a IA marca a pessoa · 4 a marcação some · 5 "Imagem do disparo".
 */
export const IA_PHASES = [1.6, 4.2, 8.3, 10, 13] as const
export const PH = { armed: 1, alarm: 2, box: 3, boxOff: 4, image: 5 } as const
