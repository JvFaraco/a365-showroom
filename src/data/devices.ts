// Fonte única de conteúdo do showroom: aparelhos, partes clicáveis, textos e câmeras.
// Só entram aqui fatos da especificação. Onde faltar dado: texto neutro + TODO.

export type Vec3 = [number, number, number]

export type ActionId =
  // Módulo de Comando
  | 'antena' | 'sos190' | 'led' | 'audio' | 'bateria-modulo' | 'abrir-modulo' | 'cabos' | 'desplugar-bateria'
  // Fotossensor
  | 'pir' | 'camera' | 'suporte' | 'tampa-foto' | 'sabotagem' | 'sensibilidade'
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
  more?: ActionId[] // outras ações da mesma parte (botões a mais no card)
  explode?: Vec3 // deslocamento da parte na vista explodida (0..1)
  pin?: Vec3 // Modo Manual: desloca o pino a partir do centro da parte (para não cair em cima de outro)
}

export type DeviceId = 'modulo' | 'fotossensor' | 'magnetico' | 'sirene' | 'controle' | 'placa' | 'app'

export type Device = {
  id: DeviceId
  name: string
  short: string
  fem?: boolean // nome feminino: "da sirene", "da placa"
  tagline: string
  parts: Part[]
  inKit365S: boolean
  home: { position: Vec3; target: Vec3 } // vista inteira
  explodeView?: { position: Vec3; target: Vec3 } // vista explodida: ângulo próprio, quando a fila de peças pede
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
    kitScale: 1.0, // 80 mm/un: tamanho real em relação ao fotossensor
    parts: [
      {
        id: 'antena',
        name: 'Antena',
        what: 'Antena removível, que se rosqueia até travar.',
        facts: ['Garante o sinal do chip 4G', 'Chip multi-operadora'],
        tip: 'Deixe o módulo perto de janelas ou de paredes externas para ter melhor sinal.',
        camera: { position: [1.4, 1.1, -2.7], target: [-0.35, 0.35, -1.15] },
        action: 'antena',
      },
      {
        id: 'botao-sos',
        name: 'Botão SOS / 190',
        what: 'Pedido de socorro direto. O botão fica em cima do módulo, perto da borda da frente, com o LED no centro.',
        facts: ['Segure por 5 segundos para acionar a polícia (190)'],
        tip: 'Use só em emergência real.',
        camera: { position: [0.5, 1.3, 2.0], target: [0, 0.07, 0.62] },
        action: 'sos190',
        explode: [0, 1.4, 0],
      },
      {
        id: 'led',
        name: 'LED de status',
        what: 'Ponto de luz no centro do botão, em cima do módulo. Mostra o estado do sistema por cores.',
        facts: ['Azul = desarmado', 'Vermelho = armado', 'Laranja = armado parcial', 'E outros estados (veja em ação)'],
        camera: { position: [-0.55, 1.15, 1.95], target: [0, 0.07, 0.62] },
        action: 'led',
        explode: [0, 1.4, 0],
      },
      {
        id: 'tampa',
        name: 'Tampa / face com logo',
        what: 'Carcaça do módulo.',
        facts: ['Sistema anti-sabotagem (tamper)'],
        camera: { position: [0, 2.3, 2.1], target: [0, 0.05, 0] },
        action: 'abrir-modulo',
        explode: [0, 1.4, 0],
      },
      {
        id: 'base',
        name: 'Base cinza',
        what: 'Fundo do módulo. Reúne a grade do alto-falante, o bolsão dos cabos, aberto na borda de trás, por onde entram o cabo de rede e a fonte, a etiqueta de identificação e os pés de apoio.',
        facts: [],
        camera: { position: [2.0, -1.4, 1.9], target: [0, -0.3, 0] },
      },
      {
        id: 'alto-falante',
        name: 'Grade de som',
        what: 'Furos no fundo do módulo, dentro do bolsão dos cabos: é por onde passa o som.',
        facts: ['Áudio bidirecional: a Central Orsegups pode falar e ouvir o ambiente em tempo real'],
        camera: { position: [0.5, -2.6, -1.5], target: [0, -0.35, -0.56] },
        action: 'audio',
      },
      {
        id: 'ethernet',
        name: 'Porta Ethernet',
        what: 'Entrada para cabo de rede, na parede do bolsão do fundo: o cabo vem por trás e entra deitado.',
        facts: ['Terceira via de comunicação: cabo de rede'],
        camera: { position: [0.35, -1.7, -2.3], target: [0, -0.36, -0.3] },
        action: 'cabos',
      },
      {
        id: 'fonte',
        name: 'Entrada da fonte',
        what: 'Alimentação na tomada. Fica no bolsão do fundo: o cabo vem por trás e o conector entra pela lateral.',
        facts: [],
        camera: { position: [-0.8, -1.9, -1.6], target: [0.18, -0.36, -0.47] },
        action: 'bateria-modulo',
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
        explode: [0, 0.75, 0], // preso na placa pela presilha: sai junto com ela
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
        camera: { position: [-1.4, 1.3, -1.2], target: [-0.5, -0.04, -0.3] },
        internal: true,
        explode: [0, 0.75, 0],
      },
      {
        id: 'speaker',
        name: 'Alto-falante',
        what: 'É por ele que a Central Orsegups fala com você no áudio bidirecional.',
        facts: [],
        camera: { position: [0.9, 1.4, -1.6], target: [0, -0.08, -0.5] },
        internal: true,
        explode: [0, 0.75, 0], // ligado na placa pelos fios: sai junto com ela
      },
      {
        id: 'tamper',
        name: 'Anti-sabotagem (tamper)',
        what: 'Botão na placa, à esquerda, logo atrás do Wi-Fi. A tampa o mantém apertado: se o módulo for aberto, ele solta e o sistema avisa.',
        facts: [],
        camera: { position: [-1.7, 1.3, 1.5], target: [-0.45, -0.05, 0.05] },
        internal: true,
        explode: [0, 0.75, 0],
      },
      {
        id: 'reset',
        name: 'Botão de reset',
        what: 'Fica embaixo da placa, sobre o furo do fundo, ao lado da antena.',
        facts: [],
        camera: { position: [-1.4, -1.8, -1.6], target: [-0.42, -0.3, -0.5] },
        internal: true,
        explode: [0, 0.75, 0],
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
        action: 'desplugar-bateria',
        explode: [0, 0.75, 0], // presa embaixo da placa pelo cabo: sai junto com ela
      },
    ],
  },
  {
    id: 'fotossensor',
    name: 'Fotossensor',
    short: 'Fotossensor',
    tagline: 'Detecta, fotografa e confirma.',
    inKit365S: true,
    home: { position: [0.45, 0.4, 4.2], target: [0, 0, -0.1] }, // quase de frente: a cápsula e a lente aparecem no eixo do aparelho
    // explodido: quase de lado, para a fila de peças no eixo frente–trás aparecer inteira
    explodeView: { position: [4.4, 1.0, 1.6], target: [0, 0.1, -0.1] },
    bottom: -1.03,
    kitScale: 1.0, // 79 mm/un (referência)
    parts: [
      {
        id: 'camera',
        name: 'Câmera',
        what: 'Câmera colorida de alta resolução.',
        facts: ['Fotografa no momento do disparo', 'Ou quando você pede pelo app', 'A IA analisa a foto e identifica pessoas'],
        camera: { position: [0.7, 0.7, 2.0], target: [0, 0.41, 0.5] },
        action: 'camera',
        explode: [0, 0.22, 1.05],
        pin: [0, 0.06, 0],
      },
      {
        id: 'flash',
        name: 'Flash LED',
        what: 'Ilumina a cena para a foto.',
        facts: ['Foto nítida mesmo no escuro'],
        camera: { position: [-0.6, 0.35, 1.9], target: [0, 0.18, 0.5] },
        action: 'camera',
        explode: [0, 0.22, 1.05],
        pin: [-0.1, 0.03, 0],
      },
      {
        id: 'led',
        name: 'LED de status',
        what: 'Indica detecção e funcionamento.',
        facts: [],
        camera: { position: [0.5, 0.1, 1.7], target: [0, 0.1, 0.5] },
        explode: [0, 0.22, 1.05],
        pin: [0.1, -0.03, 0],
      },
      {
        id: 'pir',
        name: 'Lente PIR',
        what: 'Sensor infravermelho de movimento.',
        facts: ['Campo de 90°', 'Alcance de 8 a 10 m', 'Pet Immune: ignora animais pequenos', 'Sensibilidade ajustável'],
        camera: { position: [0.7, -0.3, 2.2], target: [0, -0.48, 0.3] },
        action: 'pir',
        more: ['sensibilidade'],
        explode: [0, 0.22, 1.05],
      },
      {
        id: 'base',
        name: 'Base',
        what: 'Acabamento inferior do corpo.',
        facts: [],
        camera: { position: [1.0, -0.8, 2.2], target: [0, -0.98, 0.1] },
        // a base não desce na vista explodida: abaixo dela já é o pedestal
        pin: [0.2, 0, 0.45],
      },
      {
        id: 'suporte',
        name: 'Suporte de parede',
        what: 'Faz parte da base: sobe pela traseira e tem o encaixe em "Λ" onde entra a peça de fixação da parede. O sensor é fixo nele, e os dois giram juntos para a esquerda e para a direita, sempre em pé, para apontar para a área.',
        facts: ['Altura de instalação: 2,10 m a 2,40 m do chão'],
        tip: 'Instale no canto, entre 2,10 m e 2,40 m do chão, apontando para o centro da área.',
        camera: { position: [1.5, -0.2, -2.2], target: [0, -0.6, -0.6] },
        action: 'suporte',
        // a luva faz parte da base: não se separa dela na vista explodida
        pin: [0.12, -0.2, 0],
      },
      {
        id: 'tampa-traseira',
        name: 'Tampa traseira',
        what: 'Abre por alavanca no encaixe de cima, como a do controle. Dá acesso às pilhas.',
        facts: [],
        camera: { position: [-1.6, 0.6, -2.3], target: [0, 0.25, -0.5] },
        explode: [0, 0.22, -0.8],
        pin: [0, 0.25, 0],
      },
      {
        id: 'pilhas',
        name: 'Pilhas',
        what: '3 pilhas AA.',
        facts: ['Duram até 2 anos, conforme o uso'],
        camera: { position: [-1.3, 0.6, -2.2], target: [0, 0.23, -0.37] },
        action: 'tampa-foto',
        internal: true,
        explode: [0, 0.22, -0.42],
        pin: [0, -0.2, 0],
      },
      {
        id: 'fixacao',
        name: 'Peça de fixação',
        what: 'Peça solta que vai parafusada na parede. A guia dela entra no encaixe do suporte, e o sensor desce até travar.',
        facts: ['Os parafusos de trava impedem que o sensor seja retirado'],
        camera: { position: [-1.3, -0.3, -2.2], target: [0, -0.6, -0.55] },
        explode: [0, 0.22, -1.15],
        pin: [-0.05, 0.15, 0],
      },
      {
        id: 'placas',
        name: 'Placa principal',
        what: 'Placa eletrônica principal, na vertical, quase da altura do corpo. Nela ficam o sensor PIR, o suporte da câmera e a antena.',
        facts: [],
        camera: { position: [1.0, -0.2, 2.4], target: [0, -0.4, 0.1] },
        internal: true,
        explode: [0, 0.22, 0.3],
      },
      {
        id: 'modulo-camera',
        name: 'Câmera (módulo interno)',
        what: 'Preso na parte de cima da placa principal: um suporte branco segura o tubo da lente, apontado para a lente do capuz, e a plaquinha dos LEDs.',
        facts: [],
        camera: { position: [0.9, 0.7, 2.2], target: [0, 0.4, 0.2] },
        internal: true,
        explode: [0, 0.22, 0.3],
      },
      {
        id: 'sensor-pir',
        name: 'Sensor PIR',
        what: 'Cilindro metálico na placa principal, atrás da lente PIR. Se alguém mexe no fotossensor depois de instalado, ele avisa sabotagem no aplicativo. Abrir a tampa das pilhas não dispara nada.',
        facts: ['Sistema anti-sabotagem'],
        camera: { position: [0.8, -0.3, 2.0], target: [0, -0.55, 0.15] },
        action: 'sabotagem',
        internal: true,
        explode: [0, 0.22, 0.3],
      },
      {
        id: 'antena',
        name: 'Antena',
        what: 'Mola de cobre soldada na borda de baixo da placa principal, logo acima da base.',
        facts: [],
        camera: { position: [0.8, -0.7, 2.0], target: [0, -0.85, 0.2] },
        internal: true,
        explode: [0, 0.22, 0.3],
      },
    ],
  },
  {
    id: 'magnetico',
    name: 'Sensor Magnético',
    short: 'Magnético',
    tagline: 'Percebe antes de alguém entrar.',
    inKit365S: false,
    home: { position: [1.0, 0.9, 4.0], target: [0, 0, 0] },
    // explodido: de lado e de cima, para as camadas (tampa, placa verde, base) aparecerem
    explodeView: { position: [3.4, 2.0, 2.6], target: [0, 0, 0.3] },
    bottom: -0.52,
    kitScale: 0.72, // real 0,63 × 1,15 de leitura
    parts: [
      {
        id: 'corpo',
        name: 'Corpo principal',
        // TODO(usuário): a foto de instalação mostra o corpo na folha da porta e o ímã no batente (o texto antigo dizia o contrário); confirmar no manual.
        what: 'Detecta a abertura de portas e janelas. Na instalação de referência, fica na folha da porta.',
        facts: ['Transmite por radiofrequência', 'Tem anti-sabotagem'],
        tip: 'Não instale em portas de ferro nem em estruturas metálicas.',
        camera: { position: [0.6, 0.2, 2.8], target: [0, -0.19, 0.3] },
        explode: [0, 0, 0.75],
      },
      {
        id: 'ima',
        name: 'Ímã',
        what: 'Fica paralelo ao corpo, alinhado no comprimento. Na instalação de referência, vai no batente.',
        facts: ['Distância máxima entre as duas peças: 1 cm'],
        camera: { position: [0.5, 1.0, 2.6], target: [0, 0.32, 0] },
        action: 'ima',
        explode: [0, 0.8, 0.12],
      },
      {
        id: 'led',
        name: 'LED',
        what: 'Pisca ao detectar.',
        facts: [],
        camera: { position: [-0.6, 0.1, 1.6], target: [-0.31, -0.19, 0.32] },
        explode: [0, 0, 0.75],
      },
      {
        id: 'placa',
        name: 'Placa eletrônica',
        what: 'Lê o ímã e avisa a central pelo rádio.',
        facts: [],
        camera: { position: [0.6, 0.4, 2.4], target: [0, -0.19, 0] },
        internal: true,
        explode: [0, 0, 0.32],
      },
      {
        id: 'tamper',
        name: 'Anti-sabotagem (tamper)',
        what: 'Botão na placa, apertado por um pino da base. Se a tampa for separada da base, ele solta e o sistema avisa.',
        facts: [],
        camera: { position: [0.9, -0.5, 2.2], target: [-0.6, -0.19, -0.1] },
        internal: true,
        explode: [0, 0, 0.32],
      },
      {
        id: 'choque',
        name: 'Sensor de choque',
        what: 'Detector de vibração com níveis de sensibilidade.',
        facts: ['Identifica a tentativa de arrombamento antes de a porta abrir'],
        camera: { position: [-0.5, 0.5, 2.2], target: [-0.28, -0.23, 0] },
        internal: true,
        action: 'choque',
        explode: [0, 0, 0.32],
      },
      {
        id: 'bateria',
        name: 'Bateria de lítio',
        what: 'Alimenta o sensor, sem fios.',
        facts: ['Dura até 2 anos, conforme o uso'],
        camera: { position: [0.5, 0.5, 2.2], target: [0.02, -0.23, 0] },
        internal: true,
        explode: [0, 0, 0.32],
      },
    ],
  },
  {
    id: 'sirene',
    name: 'Sirene',
    short: 'Sirene',
    fem: true,
    tagline: 'Até 110 dB de alerta.',
    inKit365S: true,
    home: { position: [1.5, 0.5, 3.7], target: [0, 0, 0] },
    bottom: -1.03,
    kitScale: 0.81, // 64 mm/un: tamanho real
    parts: [
      {
        id: 'corpo',
        name: 'Corpo / face',
        what: 'Sirene sem fio.',
        facts: ['Funciona independente do painel', 'Por isso é difícil de neutralizar'],
        camera: { position: [0.9, 0.4, 2.7], target: [0, 0, 0.3] },
        explode: [0, 0, 0.6],
      },
      {
        id: 'led',
        name: 'LED',
        what: 'Indica o status.',
        facts: [],
        tip: 'Instale com o LED voltado para o chão.',
        camera: { position: [0.25, -1.3, 2.0], target: [0, -0.55, 0.3] },
        explode: [0, 0, 0.6],
      },
      {
        id: 'suporte',
        name: 'Suporte de parede',
        what: 'É parafusado na parede. A sirene desce de cima para baixo no suporte e trava com um clique.',
        facts: [],
        tip: 'Instale em local visível e de difícil acesso, longe de sol direto e umidade.',
        camera: { position: [1.9, 0.7, -3.0], target: [0, 0, -0.45] },
        action: 'encaixe',
        explode: [0, 0, -1.1],
      },
      {
        id: 'encaixe-suporte',
        name: 'Encaixe do suporte',
        what: 'Centraliza a sirene no suporte de parede.',
        facts: [],
        camera: { position: [1.1, 0.5, -2.7], target: [0.42, 0.2, -0.3] },
        internal: true,
        explode: [0, 0, -0.5],
      },
      {
        id: 'tamper',
        name: 'Anti-sabotagem (tamper)',
        what: 'Micro-chave que o suporte mantém apertada; se a sirene sai do suporte, o sistema é avisado.',
        facts: ['Fica numa plaquinha na traseira, ao lado do conector da bateria'],
        tip: 'Com a sirene aberta, não é possível armar.',
        camera: { position: [-0.6, -0.2, -2.4], target: [-0.08, -0.5, -0.3] },
        internal: true,
        action: 'tamper',
        explode: [0, 0, -0.5],
      },
      {
        id: 'elemento-sonoro',
        name: 'Elemento sonoro',
        what: 'É de onde sai o som da sirene.',
        facts: ['Até 110 dB', 'Volume programável em 3 níveis'],
        camera: { position: [1.1, 0.5, -2.7], target: [0.42, 0.2, -0.2] },
        internal: true,
        action: 'som',
        explode: [0, 0, -0.1],
      },
      {
        id: 'bateria',
        name: 'Bateria de lítio',
        what: 'Alimenta a sirene, sem fios. Fica por dentro, num berço na traseira, e não é trocada pelo usuário.',
        facts: ['Dura até 2 anos, conforme o uso'],
        camera: { position: [-1.0, 0.6, -2.7], target: [-0.38, 0.02, -0.3] },
        internal: true,
        explode: [0, 0, -0.9],
      },
      {
        id: 'placa',
        name: 'Placa eletrônica',
        what: 'Recebe o comando do módulo por radiofrequência.',
        facts: [],
        camera: { position: [-0.7, -0.1, -2.4], target: [0, -0.43, -0.25] },
        internal: true,
        explode: [0, 0, -0.05],
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
    bottom: -1.08,
    kitScale: 0.49, // real 0,33 × 1,5 de leitura
    parts: [
      {
        id: 'btn-panico',
        name: '✱ Pânico',
        what: 'Botão de pânico, no topo.',
        facts: ['Segure por 5 segundos em caso de emergência'],
        camera: { position: [0.3, 1.0, 2.0], target: [0, 0.58, 0.2] },
        action: 'panico',
        explode: [0, 0, 0.9],
      },
      {
        id: 'btn-desarmar',
        name: 'Cadeado aberto',
        what: 'Desarmar.',
        facts: [],
        camera: { position: [-0.9, 0.3, 2.0], target: [-0.48, 0.1, 0.2] },
        action: 'btn-desarmar',
        explode: [0, 0, 0.9],
      },
      {
        id: 'btn-armar',
        name: 'Cadeado fechado',
        what: 'Armar.',
        facts: ['Todos os sensores ficam ativos'],
        camera: { position: [0.9, 0.3, 2.0], target: [0.48, 0.1, 0.2] },
        action: 'btn-armar',
        explode: [0, 0, 0.9],
      },
      {
        id: 'btn-parcial',
        name: 'Casa com pessoa',
        what: 'Armar parcial.',
        facts: ['Só o perímetro fica ativo', 'Você circula dentro de casa'],
        tip: 'Funciona se o arme parcial estiver configurado.',
        camera: { position: [0.3, -0.7, 2.0], target: [0, -0.38, 0.2] },
        action: 'btn-parcial',
        explode: [0, 0, 0.9],
      },
      // O centro do controle NÃO é botão: é um disco fixo, modelado junto com o corpo.
      // TODO(usuário): confirmar se o disco leva o logo (arte de marketing) ou é liso (ícone do sistema).
      {
        id: 'led',
        name: 'LED',
        what: 'Pisca a cada comando enviado.',
        facts: [],
        camera: { position: [0.2, 1.45, 1.5], target: [0, 0.86, 0.13] },
        explode: [0, 0, 0.5],
      },
      {
        id: 'corpo',
        name: 'Corpo e filete azul',
        what: 'Comunicação por radiofrequência com o módulo.',
        facts: ['Alcance de até 30 m', 'Sem barreiras'],
        camera: { position: [2.4, 0.5, 1.5], target: [0.85, 0.1, 0] },
        action: 'alcance',
        explode: [0, 0, 0.5],
      },
      {
        id: 'argola',
        name: 'Argola',
        what: 'Para levar no chaveiro.',
        facts: [],
        camera: { position: [0.6, -0.8, 2.0], target: [0, -0.8, 0] },
        explode: [0, 0, -0.6],
      },
      {
        id: 'tampa',
        name: 'Tampa traseira',
        what: 'Tampa redonda com um lado reto, quase rente à face de trás. Abre por alavanca, pelo entalhe da borda.',
        facts: [],
        camera: { position: [0.9, 0.5, -2.5], target: [0, 0.1, -0.18] },
        explode: [0, 0, -1.0],
      },
      {
        id: 'bateria',
        name: 'Bateria-moeda',
        what: 'Bateria de lítio do controle.',
        facts: ['Modelo CR2032', 'Dura até 2 anos, conforme o uso'],
        camera: { position: [0.7, 0.4, -2.3], target: [0, 0.05, -0.1] },
        action: 'tampa-controle',
        internal: true,
        explode: [0, 0, -0.3],
      },
    ],
  },
  {
    id: 'placa',
    name: 'Placa de aviso',
    short: 'Placa',
    fem: true,
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
