# Partes modeladas por aparelho

Todos os modelos são procedurais (three.js). As proporções vêm das fotos de referência; a Orsegups não publica dimensões. Cada linha é uma malha (ou grupo) separada, com o `part.id` usado em `src/data/devices.ts`. Partes marcadas com (i) são internas: só ficam clicáveis no modo Explodir ou no Raio-X.

Materiais: plástico branco acetinado #F1F2F4 com verniz leve e micro-textura (`white`), cinza-azulado fosco #8A93A3 (`grey`), preto soft-touch #1A1C20 (`black`), cromado (`chrome`), placa verde com textura de trilhas (`pcb`), linhas de partição (`partition`), logo em sulcos (`logoGroove`) e LEDs emissivos com bloom. Nenhuma marca de fornecedor, número de série ou QR legível: etiquetas são retângulos lisos.

## Módulo de Comando (planta de 144 × 145 mm, 38 mm de altura; 1 un = 80 mm; frente em +Z)


A tampa é uma superfície só: topo plano, nivelado e largo, ombro arredondado e lateral que desce abrindo um pouco (a borda de baixo fica ~5 mm mais larga que o topo). Ela não sobra para fora: encaixa rente na carcaça cinza, presa por três presilhas (na frente, atrás à esquerda e atrás à direita), que é onde a tampa desce até o fundo. Entre as presilhas a borda sobe em arco longo: nos dois lados, onde aparece a base cinza, e atrás, por onde saem a antena e os cabos. Nos arcos a faixa branca tem ~20 mm, mais da metade da altura do aparelho. Na frente a tampa desce numa ponta de base reta e cantos arredondados, que quase chega ao fundo; a borda sobe dos dois lados dela em curva côncava, rápido no começo e depois devagar até os lados. Na frente da tampa, sob o botão, vai o adesivo "Dúvidas?" (~19 × 24 mm) com um QR ilustrativo (um desenho que não codifica nada). A base cinza acompanha a tampa: fica sempre logo por dentro da borda dela (1 mm de degrau), então aparece dos dois lados da ponta da frente. A parede é reta e faz um canto arredondado de ~7 mm até o fundo. Tem nervuras fundas só nos dois lados (de ~25° a ~125° da frente), com uma faixa lisa logo abaixo da tampa; cada nervura dobra para baixo e continua como um rasgo no fundo. Na frente e atrás a base é lisa. No fundo: três pés baixos com o furo do parafuso no centro (um atrás da ponta da frente, dois perto dos cantos de trás), o rebaixo largo da etiqueta (vazio), logo à frente do bolsão, e o bolsão fundo no meio da borda de trás. O bolsão é um rasgo aberto: atravessa a parede de trás até a borda, e é por ali que os cabos saem. Dentro dele: grade de som em hexágono (37 furos) numa moldura de cantos redondos na face funda, RJ45 deitado, na parede da frente do bolsão, com a boca virada para dentro dele (o cabo entra deitado), e o jack da fonte na parede esquerda, a meia altura. A antena não sai do centro: fica num ressalto ao lado do bolsão (à direita de quem olha o fundo); o furo pequeno fica do outro lado.
| part.id | Como é modelada |
|---|---|
| `tampa` | Uma malha paramétrica só (`lidGeometry`), desenhada em dois trechos que dividem os vértices: o disco do topo, fosco, e a lateral, com brilho. O raio e a altura da borda de baixo em volta do contorno vêm de `lidRim` (os três apoios e os arcos entre eles). Sob cada apoio, uma aba branca com fenda marca o fecho (aparece por baixo). Logo em sulcos finos. Por dentro: bloco do guia de luz com furo de parafuso, ganchos e ressalto. |
| `botao-sos` | Tecla branca de cantos redondos, rente à tampa, na borda da frente, mais larga que alta (~26 × 12 mm, medida na foto de frente), com uma fresta fina em volta (sem aro prateado). Embaixo dela, um pino de cristal (guia de luz) desce até a placa. A tecla afunda enquanto o 190 é segurado. |
| `led` | Ponto emissivo pequeno e forte no centro da tecla (escuro quando apagado); o brilho em volta vem do bloom. |
| `antena` | Conector dourado rosqueado, junta com pino (articulação) e pá extrudada com chanfro. Sai da base, atrás, fora do centro: num ressalto de face plana ao lado do bolsão. |
| `base` | Base cinza: tambor redondo rente à tampa, com nervuras fundas só nos dois lados, e fundo com o rebaixo da etiqueta e o rasgo do bolsão, que atravessa a parede de trás (na largura dele a parede só existe acima da face funda, e os frisos somem), numa malha só; onde a tampa cobre a base, a parede recua para dentro dela; rasgos do fundo em `InstancedMesh` (um por nervura, só nas duas faixas laterais). Acompanham: pés, furo pequeno, ressalto da antena e as duas travas da placa. |
| `alto-falante` | Grade de 37 furos redondos em hexágono (`InstancedMesh`), na moldura da face funda do bolsão: de baixo, é o que mais aparece. |
| `ethernet`, `fonte` | Porta de rede na parede da frente do bolsão (só a boca aparece; o corpo do conector fica embaixo da placa); conector de energia na parede esquerda. Na ação dos cabos, os dois chegam por trás, deitados, pela abertura do bolsão. |
| `placa-principal` (i) | Placa verde limpa, com o recorte retangular no meio da borda de trás (onde passam o bolsão e o alto-falante): RJ45 no fundo do recorte, jack da fonte num dos braços, área de energia, pinos de teste, parafusos e etiqueta lisa. |
| `led-botao-placa` (i) | LED SMD e botão tátil azul na borda da placa, embaixo da cápsula. |
| `chip-4g` (i) | Cartão verde espetado num slot preto, suporte metálico com o SIM e cabo coaxial. |
| `wifi` (i) | Blindagem prateada com etiqueta lisa, conector dourado, coaxial e LEDs verdes. |
| `radio` (i) | Blindagem quadrada com furinhos (instanciados), chip ao lado e a antena de fio amarelo. |
| `speaker` (i) | Caixinha cinza no recorte da placa, cone preto e ímã cromado em `LatheGeometry`, dois fios. |
| `microfone` (i) | Cápsula pequena e dois fios, ao lado do alto-falante. |
| `bateria` (i) | Bloco por baixo da placa, com o conector branco de 2 pinos e os fios vermelho e preto. |

Vista explodida, de cima para baixo: cúpula; placa (com o cartão do chip um pouco acima); caixinha do alto-falante; bateria; base cinza, que fica parada com a antena.

## Fotossensor (68 × 144 × 94 mm com base e placa de fixação; 1 un = 79 mm; frente em +Z)

O corpo tem 68 mm de largura, 137 de altura e a planta fecha um círculo: é tão fundo quanto largo, com a frente em meio-cilindro e a traseira bem arredondada. É uma casca gerada como superfície paramétrica (volta do contorno × altura), com a borda do topo arredondada e o sulco fino da tampa de cima. A frente tem três rebaixos, todos para DENTRO do corpo: o capuz raso em arco; dentro dele, o bolso da câmera e do LED, em forma de pera alongada, com o fundo inclinado (raso em cima, mais fundo embaixo), onde ficam a lente e a janela oval do LED (não há peça saliente); e a moldura da lente PIR, um painel fosco grande (~53 × 42 mm), curvo como o corpo e ~3 mm para dentro dele, com a prateleira em cima, os chanfros dos lados e o queixo embaixo, onde fica o logo. O funil que leva até o sensor PIR fica por dentro, atrás da lente.

| part.id | Como é modelada |
|---|---|
| `camera` | Lente em cilindros concêntricos, na cápsula em pílula (um pouco mais larga em cima), dentro do corte do capuz. |
| `flash` | Janela escura com o emissor branco. |
| `led` | Ponto emissivo abaixo do flash. |
| `pir` | Janela leitosa levemente curva, com faixas de Fresnel discretas, no fundo do rebaixo de baixo (atrás da linha do corpo). A faixa em trapézio é a rampa de cima desse rebaixo. |
| `base` | Faixa cinza fosca, recuada, com o fundo arredondado. |
| `suporte` | Trilhos cinza em Λ (mais próximos no alto) da placa de fixação na parede (~31 × 67 mm, ~11 mm de espessura), com os pés na altura da base. O sensor inclina no eixo horizontal do pé. |
| `placas` (i) | Armação interna com a placa da câmera em cima, a placa do PIR no meio e a antena em mola embaixo (pelas fotos e vídeos; sem etiquetas). |
| `tampa-traseira` | Cobre a metade de cima da traseira (o compartimento das pilhas): trava no topo, duas abas embaixo, nervuras e etiqueta lisa por dentro. |
| `pilhas` (i) | 3 pilhas AA na vertical, nas proporções reais (50,5 × 14,5 mm), com polaridades alternadas, num berço preto com mola e contato; pino do anti-sabotagem no alto. Corpo preto com faixa dourada no lado do +, sem marca nem texto. Não saem do compartimento. |
| `fixacao` | Placa cinza entre os trilhos, num nível mais fundo, com o entalhe retangular no alto e um parafuso perto de baixo. |

## Sensor Magnético (corpo 93 × 25 × 28 mm, ímã 92 × 12 × 15 mm, vão de 7 mm; 1 un = 49,5 mm; frente em +Z)

| part.id | Como é modelada |
|---|---|
| `corpo` | Barra de cantos pouco arredondados (quase uma caixa), em duas peças: a base atrás e a tampa na frente, com a emenda entre elas. Na face: o logo em relevo, pequeno, um pouco antes do meio; a janela do LED; e, perto de uma ponta, a emenda da tampinha, que dá a volta na frente e nos lados. |
| `ima` | Barra fina e longa (quase o comprimento do corpo, metade da altura e da profundidade), paralela e alinhada, com vão de poucos milímetros. Na cena da porta fica no batente; o corpo vai na folha. |
| `led` | Janela escura pequena (~6 × 3 mm), atravessada na face, entre o logo e a tampinha da ponta, com LED emissivo. |
| `placa`, `choque` (i) | Placa verde comprida e estreita (~74 × 19 mm, pela foto da placa): borne preto de 2 parafusos num canto, do lado da tampinha; na outra ponta, a antena em mola de cobre, que sai para fora da placa e ocupa o resto do corpo; fila de cinco pontos de teste numa borda; sensor do ímã no canto da antena; chip do sensor de choque. Sem etiqueta. |
| `bateria` (i) | Pilha cilíndrica deitada sobre a placa, presa por duas presilhas metálicas; corpo preto e faixa dourada no +, sem marca. |

## Sirene (128 mm de diâmetro, 60 mm de projeção; 1 un = 64 mm; face em +Z)

A traseira é uma placa branca plana, sem tampa extra: é o suporte que cobre essa face. Por isso bateria, placa, elemento sonoro e tamper ficam na traseira e são partes internas.

| part.id | Como é modelada |
|---|---|
| `corpo` | Um copo numa peça só (`LatheGeometry` com o perfil exato de `shellProfile`): face plana na frente, quina curta e marcada, barriga que abre rápido até a largura total e lateral reta até a parede. Não é cúpula e não tem emenda no meio. A borda de trás dobra para dentro e forma um recuo: a placa traseira fica dentro dele e o suporte de parede some ali (de lado e de cima, não aparece). Logo em sulcos finos no centro da face. |
| `led` | Janela pequena (~9 × 3,5 mm) na face, perto da borda, centralizada embaixo (6 horas): moldura escura, luz forte e lente de cristal fina por cima. |
| `suporte` | Prato de parede: aro aberto em cima (é por onde a sirene desce), fundo extrudado com furo grande e recortes, canal vertical, travas e parafusos. A sirene não gira: desce na vertical e trava com um clique. |
| `tamper` (i) | Micro-chave preta (~6 × 6 mm, com o botão no meio) numa plaquinha verde (~15 × 20 mm), à direita da traseira, logo abaixo do conector branco da bateria. O ressalto do suporte mantém o botão apertado; fora do suporte, ele sobe ~1 mm. |
| `encaixe-suporte` (i) | Disco levemente elevado, anel e arcos no centro-baixo da traseira: plástico fixo, que centraliza a sirene no suporte. Não é o tamper. |
| `elemento-sonoro` (i) | Por dentro, pastilha branca redonda com furo no centro (`LatheGeometry`), ligada à placa por dois fios brancos; na traseira, o círculo em relevo com anéis concêntricos. |
| `bateria` (i) | Cilindro preto deitado, com etiqueta laranja, num nicho no alto da traseira, preso por uma trava. |
| `placa` (i) | Placa verde em cunha por dentro, com chips, pontos de teste e antena de fio preto; o trecho com o conector branco de 2 fios aparece na traseira, ao lado da bateria. |

A traseira também tem os furos quadrados e os ganchos em "L" do encaixe, e a etiqueta como um retângulo liso.

## Controle Remoto (45 × 51 × 13 mm; 1 un = 25,9 mm; frente em +Z)

O corpo é gordinho (um seixo, não uma moeda): duas placas finas no contorno inteiro, com a aba fina da argola, e dois ombros arredondados feitos como sólidos de revolução, um na frente e um atrás. Espessura no meio de ~14 mm.

| part.id | Como é modelada |
|---|---|
| `btn-panico`, `btn-desarmar`, `btn-armar`, `btn-parcial` | Setores de anel extrudados, em cruz, com o ícone em textura. |
| centro (sem `id`) | Disco fixo, modelado com o corpo; não é botão. Logo em baixo-relevo discreto (a confirmar). |
| `led` | Fenda no topo. |
| `corpo` | Um só bloco em gota (extrusão com chanfro), preto soft-touch, com o filete azul em volta. Atrás, o aro grosso com a cavidade da bateria. |
| `argola` | O furo na ponta do bloco, com a borda chanfrada. |
| `tampa` | Circular de topo reto, duas abas em cima e uma embaixo, entalhe, nervura em U e etiqueta lisa por dentro. |
| `bateria` (i) | CR2032 prateada com o "+" gravado, no suporte preto com a lâmina de contato dourada, sobre a placa verde. Do outro lado da placa, sob os botões: 4 chaves em domo dourado, o chip no centro, o LED e a antena de fio amarelo. |

## Placa de aviso (1,5 × 2,0)

| part.id | Como é modelada |
|---|---|
| `logo` | Anel amarelo grande com o swoosh recortado, em canvas de 2048 px, sobre a chapa azul de cantos redondos. |
| `telefone` | Plano com "ORSEGUPS" e "4020.4411". |
| `faixa` | Faixa amarela com o ícone de câmera e o aviso. |
| `verso` | Plano traseiro com "ALARME 365" e o QR Code ilustrativo. |

## Aplicativo (0,95 × 1,95)

O corpo do celular é uma extrusão de cantos redondos. A tela é React de verdade dentro do 3D (`<Html transform occlude>`, em `src/ui/AppScreen.tsx`), e cada região é uma parte: `sos`, `alarme-geral`, `ultimas-imagens`, `ultimos-eventos` e `menu`.

## Placas internas

Cada placa leva os componentes que aparecem nas fotos reais, em grupos ordenados perto dos CIs: capacitores (bege), resistores e CIs pequenos (pretos), cristal (metal) e pontos de teste (dourados). Os bloquinhos de cada cor são fundidos numa malha só por placa (`boxesGeometry`), sem instâncias. A textura tem trilhas em feixes paralelos com vias. Nada vem do desenho técnico de fábrica e não há texto, etiqueta, QR ou marca.

## Cena "Em ação"

Sala em corte (paredes claras, piso de madeira, rodapé, janela, porta com batente, aparador, sofá e tapete), invasor que anda, leque de detecção do fotossensor no chão e ondas de rádio saindo de quem transmite em cada etapa. O celular acompanha: alarme armado, aviso do disparo e a tela "Imagem" do aplicativo.
