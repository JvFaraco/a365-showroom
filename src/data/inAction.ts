// Linha do tempo da cena "Em ação".
export const IA_STEPS = [
  { t: 0, label: 'Armado pelo controle', text: 'O alarme é armado pelo controle remoto.' },
  { t: 3, label: 'Porta aberta', text: 'O sensor magnético detecta a abertura da porta.' },
  { t: 7.4, label: 'Foto + IA', text: 'O fotossensor dispara o flash e a IA marca "Pessoa".' },
  { t: 10, label: 'Sirene', text: 'A sirene toca e o invasor foge.' },
  { t: 13, label: 'Foto no celular', text: 'O celular recebe a foto.' },
] as const
export const IA_DURATION = 17
