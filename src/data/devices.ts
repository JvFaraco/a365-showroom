// Fonte única de conteúdo do showroom: aparelhos, partes clicáveis, textos e câmeras.
// Só entram aqui fatos da especificação. Onde faltar dado: texto neutro + TODO.

export type Vec3 = [number, number, number]

export type ActionId =
  // Módulo de Comando
  | 'antena' | 'sos190' | 'led' | 'audio' | 'bateria-modulo' | 'abrir-modulo' | 'cabos'
  // Fotossensor
  | 'pir' | 'camera' | 'suporte' | 'tampa-foto'
  // Sensor magnético
  | 'ima' | 'choque'
  // Sirene
  | 'som' | 'encaixe' | 'bateria-sirene' | 'tamper'
  // Controle remoto
  | 'btn-desarmar' | 'btn-armar' | 'btn-parcial' | 'panico' | 'alcance' | 'tampa-controle'
  // Placa
  | 'flip' | 'brilho'
  // Aplicativo
  | 'alarme-geral' | 'solicitar-imagem'

export type Part = {
  id: string
  name: string
  what: string
  facts: string[]
  tip?: string
  camera: { position: Vec3; target: Vec3 }
  internal?: boolean // só clicável explodido / raio-X
  action?: ActionId // micro-animação do "Ver em ação"
  explode?: Vec3 // deslocamento da parte na vista explodida (0..1)
}

export type DeviceId = 'modulo' | 'fotossensor' | 'magnetico' | 'sirene' | 'controle' | 'placa' | 'app'

export type Device = {
  id: DeviceId
  name: string
  short: string
  tagline: string
  parts: Part[]
  inKit365S: boolean
  home: { position: Vec3; target: Vec3 } // vista inteira
  bottom: number // ponto mais baixo do modelo (altura do pedestal)
  kitScale: number // escala relativa nas cenas com o kit completo
}

export const DEVICES: Device[] = [
  {
    id: 'modulo',
    name: 'Módulo de Comando',
    short: 'Módulo',
    tagline: 'O cérebro do sistema.',
    inKit365S: true,
    home: { position: [1.6, 1.7, 3.6], target: [0, 0.1, 0] },
    bottom: -0.4,
    kitScale: 0.75,
    parts: [
      {
        id: 'antena',
        name: 'Antena',
        what: 'Antena removível, que se rosqueia até travar.',
        facts: ['Garante o sinal do chip 4G', 'Chip multi-operadora'],
        tip: 'Deixe o módulo perto de janelas ou de paredes externas para ter melhor sinal.',
        camera: { position: [1.8, 1.1, -2.7], target: [0, 0.35, -1.15] },
        action: 'antena',
      },
      {
        id: 'botao-sos',
        name: 'Botão SOS / 190',
        what: 'Pedido de socorro direto. A cápsula do LED, perto da borda da frente, é o próprio botão.',
        facts: ['Segure por 5 segundos para acionar a polícia (190)'],
        tip: 'Use só em emergência real.',
        camera: { position: [0.5, 1.3, 2.0], target: [0, 0.24, 0.68] },
        action: 'sos190',
        explode: [0, 1.4, 0],
      },
      {
        id: 'led',
        name: 'LED de status',
        what: 'Acende dentro da cápsula em cima do módulo, que funciona como guia de luz. Mostra o estado do sistema por cores.',
        facts: ['Azul = desarmado', 'Vermelho = armado', 'Laranja = armado parcial', 'E outros estados (veja em ação)'],
        camera: { position: [-0.55, 1.15, 1.95], target: [0, 0.24, 0.68] },
        action: 'led',
        explode: [0, 1.4, 0],
      },
      {
        id: 'tampa',
        name: 'Tampa / face com logo',
        what: 'Carcaça do módulo.',
        facts: ['Sistema anti-sabotagem (tamper)'],
        camera: { position: [0, 2.3, 2.1], target: [0, 0.3, 0] },
        action: 'abrir-modulo',
        explode: [0, 1.4, 0],
      },
      {
        id: 'base',
        name: 'Base cinza',
        what: 'Fundo do módulo. Reúne a grade do alto-falante, o bolsão por onde entram o cabo de rede e a fonte, a etiqueta de identificação e os pés de apoio.',
        facts: [],
        camera: { position: [2.0, -1.4, 1.9], target: [0, -0.3, 0] },
      },
      {
        id: 'alto-falante',
        name: 'Grade de som',
        what: 'Furos no fundo do módulo, dentro do bolsão dos cabos: é por onde passa o som.',
        facts: ['Áudio bidirecional: a Central Orsegups pode falar e ouvir o ambiente em tempo real'],
        camera: { position: [0.6, -2.3, -1.9], target: [0, -0.4, -0.6] },
        action: 'audio',
      },
      {
        id: 'ethernet',
        name: 'Porta Ethernet',
        what: 'Entrada para cabo de rede, no bolsão do fundo.',
        facts: ['Terceira via de comunicação: cabo de rede'],
        camera: { position: [0.9, -1.9, -1.9], target: [0.2, -0.4, -0.5] },
        action: 'cabos',
      },
      {
        id: 'fonte',
        name: 'Entrada da fonte',
        what: 'Alimentação na tomada, no bolsão do fundo.',
        facts: [],
        camera: { position: [-0.9, -1.9, -1.9], target: [-0.22, -0.4, -0.5] },
        action: 'cabos',
      },
      {
        id: 'placa-principal',
        name: 'Placa principal',
        what: 'O módulo é um computador.',
        facts: ['Roda software próprio da Orsegups', 'Conversa com a nuvem'],
        camera: { position: [0.5, 1.9, 1.8], target: [0.1, -0.06, 0.25] },
        internal: true,
        explode: [0, 0.75, 0],
      },
      {
        id: 'led-botao-placa',
        name: 'LED e botão na placa',
        what: 'Ficam na borda da placa, exatamente embaixo da cápsula da face.',
        facts: ['A cápsula é o guia de luz deste LED', 'E é ela que aperta este botão (190)'],
        camera: { position: [0.6, 1.2, 1.9], target: [0, -0.05, 0.67] },
        internal: true,
        explode: [0, 0.75, 0],
      },
      {
        id: 'chip-4g',
        name: 'Cartão do chip 4G',
        what: 'Chip 4G multi-operadora: a primeira via de comunicação, já ativa de fábrica.',
        facts: [],
        camera: { position: [1.2, 1.3, 1.4], target: [0.2, -0.03, 0.35] },
        internal: true,
        explode: [0, 0.98, 0],
      },
      {
        id: 'wifi',
        name: 'Módulo Wi-Fi / rede',
        what: 'Wi-Fi e Ethernet: a segunda e a terceira vias de comunicação.',
        facts: [],
        camera: { position: [-1.2, 1.3, 1.3], target: [-0.31, -0.04, 0.32] },
        internal: true,
        explode: [0, 0.75, 0],
      },
      {
        id: 'radio',
        name: 'Rádio dos sensores',
        what: 'É por onde sensores, sirene e controle conversam com o módulo.',
        facts: [],
        camera: { position: [-1.2, 1.3, -1.2], target: [-0.3, -0.04, -0.3] },
        internal: true,
        explode: [0, 0.75, 0],
      },
      {
        id: 'speaker',
        name: 'Alto-falante',
        what: 'É por ele que a Central Orsegups fala com você no áudio bidirecional.',
        facts: [],
        camera: { position: [0.9, 1.4, -1.6], target: [0.06, -0.1, -0.45] },
        internal: true,
        explode: [0, 0.5, 0],
      },
      {
        id: 'microfone',
        name: 'Microfone',
        what: 'A Central ouve o ambiente em tempo real.',
        facts: [],
        camera: { position: [1.4, 1.2, -0.9], target: [0.36, -0.1, -0.2] },
        internal: true,
        explode: [0, 0.5, 0],
      },
      {
        id: 'bateria',
        name: 'Bateria de lítio',
        what: 'Mantém tudo funcionando sem energia. Fica por baixo da placa.',
        facts: ['Cerca de 3 horas de autonomia', 'Depende do número de aparelhos e do uso'],
        camera: { position: [1.7, 0.7, 1.7], target: [0.1, -0.24, 0.1] },
        internal: true,
        action: 'bateria-modulo',
        explode: [0, 0.25, 0],
      },
    ],
  },
  {
    id: 'fotossensor',
    name: 'Fotossensor',
    short: 'Fotossensor',
    tagline: 'Detecta, fotografa e confirma.',
    inKit365S: true,
    home: { position: [1.5, 0.5, 4.0], target: [0, 0, -0.1] },
    bottom: -0.97,
    kitScale: 1.0,
    parts: [
      {
        id: 'camera',
        name: 'Câmera',
        what: 'Câmera colorida de alta resolução.',
        facts: ['Fotografa no momento do disparo', 'Ou quando você pede pelo app', 'A IA analisa a foto e identifica pessoas'],
        camera: { position: [0.6, 0.85, 1.8], target: [0, 0.62, 0.36] },
        action: 'camera',
        explode: [0, 0, 0.55],
      },
      {
        id: 'flash',
        name: 'Flash LED',
        what: 'Ilumina a cena para a foto.',
        facts: ['Foto nítida mesmo no escuro'],
        camera: { position: [-0.6, 0.55, 1.7], target: [0, 0.42, 0.36] },
        action: 'camera',
        explode: [0, 0, 0.55],
      },
      {
        id: 'led',
        name: 'LED de status',
        what: 'Indica detecção e funcionamento.',
        facts: [],
        camera: { position: [0.45, 0.2, 1.5], target: [0, 0.3, 0.36] },
        explode: [0, 0, 0.55],
      },
      {
        id: 'pir',
        name: 'Lente PIR',
        what: 'Sensor infravermelho de movimento.',
        facts: ['Campo de 90°', 'Alcance de 8 a 10 m', 'Pet Immune: ignora animais pequenos'],
        camera: { position: [0.8, 0.05, 2.0], target: [0, -0.14, 0.28] },
        action: 'pir',
        explode: [0, 0, 0.45],
      },
      {
        id: 'base',
        name: 'Base',
        what: 'Acabamento inferior do corpo.',
        facts: [],
        camera: { position: [1.0, -0.7, 2.0], target: [0, -0.87, 0.1] },
        explode: [0, -0.4, 0],
      },
      {
        id: 'suporte',
        name: 'Suporte articulado',
        what: 'Fixa na parede e permite inclinar o sensor.',
        facts: ['Altura de instalação: 2,10 m a 2,40 m do chão'],
        tip: 'Instale no canto, entre 2,10 m e 2,40 m do chão, apontando para o centro da área.',
        camera: { position: [2.0, 0.9, -1.7], target: [0, 0.3, -0.55] },
        action: 'suporte',
        explode: [0, 0, -1.7],
      },
      {
        id: 'tampa-traseira',
        name: 'Tampa traseira',
        what: 'Abre por alavanca no encaixe de cima, como a do controle. Dá acesso às pilhas e tem anti-sabotagem.',
        facts: [],
        camera: { position: [-1.6, -0.1, -2.1], target: [0, -0.3, -0.27] },
        action: 'tampa-foto',
        explode: [0, 0, -0.85],
      },
      {
        id: 'pilhas',
        name: 'Pilhas',
        what: '3 pilhas AAA.',
        facts: ['Duram até 2 anos, conforme o uso'],
        camera: { position: [-1.3, 0.1, -2.0], target: [0, -0.3, -0.08] },
        internal: true,
        explode: [0, 0, -0.42],
      },
      {
        id: 'fixacao',
        name: 'Peça de fixação',
        what: 'Gabarito para furar a parede e guia para encaixar o sensor.',
        facts: ['Os parafusos de trava impedem que o sensor seja retirado'],
        camera: { position: [1.5, 0.8, -1.9], target: [0, 0.3, -0.3] },
        internal: true,
        explode: [0, 0, -1.25],
      },
    ],
  },
  {
    id: 'magnetico',
    name: 'Sensor Magnético',
    short: 'Magnético',
    tagline: 'Percebe antes de alguém entrar.',
    inKit365S: false,
    home: { position: [1.3, 0.4, 4.0], target: [0, 0, 0] },
    bottom: -0.97,
    kitScale: 0.5,
    parts: [
      {
        id: 'corpo',
        name: 'Corpo principal',
        what: 'Vai no batente. Detecta a abertura de portas e janelas.',
        facts: ['Transmite por radiofrequência', 'Tem anti-sabotagem'],
        tip: 'Não instale em portas de ferro nem em estruturas metálicas.',
        camera: { position: [-1.1, 0.3, 2.6], target: [-0.2, 0, 0.21] },
        explode: [0, 0, 0.75],
      },
      {
        id: 'ima',
        name: 'Ímã',
        what: 'Vai na folha da porta ou da janela.',
        facts: ['Distância máxima entre as duas peças: 1 cm'],
        camera: { position: [1.3, 0.25, 2.4], target: [0.29, 0, 0.17] },
        action: 'ima',
        explode: [0.55, 0, 0],
      },
      {
        id: 'led',
        name: 'LED',
        what: 'Pisca ao detectar.',
        facts: [],
        camera: { position: [-0.55, 0.85, 1.6], target: [-0.2, 0.62, 0.21] },
        explode: [0, 0, 0.75],
      },
      {
        id: 'choque',
        name: 'Sensor de choque',
        what: 'Detector de vibração com níveis de sensibilidade.',
        facts: ['Identifica a tentativa de arrombamento antes de a porta abrir'],
        camera: { position: [-1.2, 0.55, 1.9], target: [-0.2, 0.28, 0] },
        internal: true,
        action: 'choque',
      },
      {
        id: 'bateria',
        name: 'Bateria de lítio',
        what: 'Alimenta o sensor, sem fios.',
        facts: ['Dura até 2 anos, conforme o uso'],
        camera: { position: [-1.2, -0.3, 1.9], target: [-0.2, -0.38, 0] },
        internal: true,
      },
    ],
  },
  {
    id: 'sirene',
    name: 'Sirene',
    short: 'Sirene',
    tagline: 'Até 110 dB de alerta.',
    inKit365S: true,
    home: { position: [1.5, 0.5, 3.7], target: [0, 0, 0] },
    bottom: -1.02,
    kitScale: 0.72,
    parts: [
      {
        id: 'corpo',
        name: 'Corpo / face',
        what: 'Sirene sem fio.',
        facts: ['Funciona independente do painel', 'Por isso é difícil de neutralizar'],
        camera: { position: [0.9, 0.4, 2.7], target: [0, 0, 0.3] },
        explode: [0, 0, 0.35],
      },
      {
        id: 'led',
        name: 'LED',
        what: 'Indica o status.',
        facts: [],
        tip: 'Instale com o LED voltado para o chão.',
        camera: { position: [0.35, -0.75, 1.7], target: [0, -0.55, 0.31] },
        explode: [0, 0, 0.35],
      },
      {
        id: 'suporte',
        name: 'Suporte de parede',
        what: 'É parafusado na parede. A sirene encaixa e gira para travar.',
        facts: [],
        tip: 'Instale em local visível e de difícil acesso, longe de sol direto e umidade.',
        camera: { position: [1.9, 0.7, -2.7], target: [0, 0, -0.5] },
        action: 'encaixe',
        explode: [0, 0, -1.0],
      },
      {
        id: 'tamper',
        name: 'Anti-sabotagem (tamper)',
        what: 'Botão de gatilho (alavanca) na traseira da sirene, que o suporte mantém pressionado.',
        facts: ['Ao se desprender do suporte, o tamper é acionado', 'O sistema é informado de que a sirene está aberta'],
        tip: 'Com a sirene aberta, não é possível armar.',
        camera: { position: [-1.3, -1.0, -2.4], target: [-0.34, -0.64, -0.3] },
        internal: true,
        action: 'tamper',
      },
      {
        id: 'elemento-sonoro',
        name: 'Elemento sonoro',
        what: 'É de onde sai o som da sirene.',
        facts: ['Até 110 dB', 'Volume programável em 3 níveis'],
        camera: { position: [0.9, -0.1, -2.6], target: [0.2, -0.42, -0.32] },
        internal: true,
        action: 'som',
        explode: [0, 0, -0.3],
      },
      {
        id: 'bateria',
        name: 'Bateria de lítio',
        what: 'Alimenta a sirene, sem fios. Fica num berço na traseira.',
        facts: ['Dura até 2 anos, conforme o uso'],
        camera: { position: [-0.5, 1.1, -2.5], target: [-0.03, 0.45, -0.35] },
        internal: true,
        action: 'bateria-sirene',
        explode: [0, 0, -0.5],
      },
      {
        id: 'placa',
        name: 'Placa eletrônica',
        what: 'Recebe o comando do módulo por radiofrequência.',
        facts: [],
        camera: { position: [-1.2, 0.3, -2.2], target: [-0.43, 0.08, -0.29] },
        internal: true,
        explode: [0, 0, -0.25],
      },
    ],
  },
  {
    id: 'controle',
    name: 'Controle Remoto',
    short: 'Controle',
    tagline: 'O alarme no seu chaveiro.',
    inKit365S: true,
    home: { position: [1.2, 0.5, 4.0], target: [0, -0.05, 0] },
    bottom: -1.3,
    kitScale: 0.28,
    parts: [
      {
        id: 'btn-panico',
        name: '✱ Pânico',
        what: 'Botão de pânico, no topo.',
        facts: ['Segure por 5 segundos em caso de emergência'],
        camera: { position: [0.3, 1.0, 2.0], target: [0, 0.58, 0.2] },
        action: 'panico',
        explode: [0, 0, 0.6],
      },
      {
        id: 'btn-desarmar',
        name: 'Cadeado aberto',
        what: 'Desarmar.',
        facts: [],
        camera: { position: [-0.9, 0.3, 2.0], target: [-0.48, 0.1, 0.2] },
        action: 'btn-desarmar',
        explode: [0, 0, 0.6],
      },
      {
        id: 'btn-armar',
        name: 'Cadeado fechado',
        what: 'Armar.',
        facts: ['Todos os sensores ficam ativos'],
        camera: { position: [0.9, 0.3, 2.0], target: [0.48, 0.1, 0.2] },
        action: 'btn-armar',
        explode: [0, 0, 0.6],
      },
      {
        id: 'btn-parcial',
        name: 'Casa com pessoa',
        what: 'Armar parcial.',
        facts: ['Só o perímetro fica ativo', 'Você circula dentro de casa'],
        tip: 'Funciona se o arme parcial estiver configurado.',
        camera: { position: [0.3, -0.7, 2.0], target: [0, -0.38, 0.2] },
        action: 'btn-parcial',
        explode: [0, 0, 0.6],
      },
      {
        id: 'btn-central',
        name: 'Botão central',
        what: 'Logo Orsegups.',
        facts: [],
        camera: { position: [0.4, 0.35, 1.7], target: [0, 0.1, 0.22] },
        explode: [0, 0, 0.75],
      },
      {
        id: 'led',
        name: 'LED',
        what: 'Pisca a cada comando enviado.',
        facts: [],
        camera: { position: [0.2, 1.45, 1.5], target: [0, 0.86, 0.13] },
      },
      {
        id: 'corpo',
        name: 'Corpo e filete azul',
        what: 'Comunicação por radiofrequência com o módulo.',
        facts: ['Alcance de até 30 m', 'Sem barreiras'],
        camera: { position: [2.4, 0.5, 1.5], target: [0.85, 0.1, 0] },
        action: 'alcance',
      },
      {
        id: 'argola',
        name: 'Argola',
        what: 'Para levar no chaveiro.',
        facts: [],
        camera: { position: [0.6, -1.0, 2.0], target: [0, -1.0, 0] },
      },
      {
        id: 'tampa',
        name: 'Tampa traseira',
        what: 'Tampa redonda de topo reto. Abre por alavanca, pelo entalhe no topo.',
        facts: [],
        camera: { position: [0.9, 0.5, -2.5], target: [0, 0.1, -0.18] },
        action: 'tampa-controle',
        explode: [0, 0, -1.1],
      },
      {
        id: 'bateria',
        name: 'Bateria-moeda',
        what: 'Bateria de lítio do controle.',
        facts: ['Modelo CR2032', 'Dura até 2 anos, conforme o uso'],
        camera: { position: [0.7, 0.4, -2.3], target: [0, 0.05, -0.1] },
        internal: true,
        explode: [0, 0, -0.7],
      },
    ],
  },
  {
    id: 'placa',
    name: 'Placa de aviso',
    short: 'Placa',
    tagline: 'A primeira barreira.',
    inKit365S: true,
    home: { position: [1.0, 0.3, 4.0], target: [0, 0, 0] },
    bottom: -1.02,
    kitScale: 1.0,
    parts: [
      {
        id: 'logo',
        name: 'Logo',
        what: 'Identifica a proteção Orsegups.',
        facts: [],
        camera: { position: [0.3, 0.6, 2.4], target: [0, 0.5, 0.04] },
        action: 'flip',
        explode: [0, 0, 0.3],
      },
      {
        id: 'faixa',
        name: 'Faixa "Aviso à polícia"',
        what: 'Avisa que o local tem registro de imagem.',
        facts: ['Desestimula a invasão'],
        camera: { position: [0.4, -0.4, 1.9], target: [0, -0.49, 0.04] },
        action: 'brilho',
        explode: [0, 0, 0.5],
      },
      {
        id: 'telefone',
        name: 'Telefone',
        what: 'Contato Orsegups.',
        facts: ['4020.4411'],
        camera: { position: [-0.35, -0.1, 1.6], target: [0, -0.2, 0.04] },
        explode: [0, 0, 0.3],
      },
      {
        id: 'verso',
        name: 'Verso',
        what: 'Tem um QR Code.',
        facts: [],
        tip: 'Instale a placa visível, ao lado da entrada principal.',
        camera: { position: [0.7, 0.1, -2.9], target: [0, 0, -0.04] },
        action: 'flip',
        explode: [0, 0, -0.35],
      },
    ],
  },
  {
    id: 'app',
    name: 'Aplicativo Alarme Orsegups',
    short: 'Aplicativo',
    tagline: 'Tudo na palma da mão.',
    inKit365S: true,
    home: { position: [0.9, 0.2, 3.7], target: [0, 0, 0] },
    bottom: -1.0,
    kitScale: 0.72,
    parts: [
      {
        id: 'sos',
        name: 'Botão SOS',
        what: 'Pede socorro à Central imediatamente.',
        facts: [],
        camera: { position: [0.45, 0.95, 2.35], target: [0.26, 0.8, 0.05] },
      },
      {
        id: 'alarme-geral',
        name: 'Alarme geral',
        what: 'Mostra e muda o estado do alarme.',
        facts: ['Cadeado aberto: desarmado', 'Cadeado fechado: armado', 'Casa com pessoa: armado parcial'],
        camera: { position: [0.20, 0.60, 2.50], target: [0, 0.5, 0.05] },
        action: 'alarme-geral',
      },
      {
        id: 'ultimas-imagens',
        name: 'Últimas imagens',
        what: 'Fotos dos disparos e as pedidas pelo app.',
        facts: [],
        tip: 'Pedir uma imagem atualizada leva de 30 a 45 s.',
        camera: { position: [0.20, 0.10, 2.60], target: [0, 0.04, 0.05] },
        action: 'solicitar-imagem',
      },
      {
        id: 'ultimos-eventos',
        name: 'Últimos eventos',
        what: 'Histórico com ícones.',
        facts: ['Cadeado vermelho: arme', 'Cadeado azul: desarme', 'Alto-falante vermelho: disparo', 'Escudo com "!": alerta'],
        camera: { position: [0.20, -0.45, 2.50], target: [0, -0.48, 0.05] },
      },
      {
        id: 'menu',
        name: 'Menu inferior',
        what: 'Navegação do aplicativo.',
        facts: ['5 abas: Início, Comandos, Equipamentos, Contatos e Eventos'],
        camera: { position: [0.20, -0.85, 2.40], target: [0, -0.84, 0.05] },
      },
    ],
  },
]

export const DEVICE_BY_ID = Object.fromEntries(DEVICES.map((d) => [d.id, d])) as Record<DeviceId, Device>

export const SLOGAN = 'Atentos a tudo, o tempo todo.'

export function getPart(deviceId: DeviceId, partId: string | null | undefined): Part | undefined {
  if (!partId) return undefined
  return DEVICE_BY_ID[deviceId].parts.find((p) => p.id === partId)
}

export const hasInternal = (d: Device) => d.parts.some((p) => p.internal)
