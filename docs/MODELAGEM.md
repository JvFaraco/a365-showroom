# Partes modeladas por aparelho

Todos os modelos são procedurais (three.js). As proporções vêm das fotos de referência e das medidas externas dos aparelhos (contorno, alturas e raios de fora); por dentro, as peças grandes estão no lugar, sem medida exata. Cada linha é uma malha (ou grupo) separada, com o `part.id` usado em `src/data/devices.ts`. Partes marcadas com (i) são internas: só ficam clicáveis no modo Explodir ou no Raio-X.

Materiais: plástico branco acetinado #F1F2F4 com verniz leve e micro-textura (`white`), cinza-azulado fosco #8A93A3 (`grey`), preto soft-touch #1A1C20 (`black`), cromado (`chrome`), placa verde com textura de trilhas (`pcb`), linhas de partição (`partition`), logo em sulcos (`logoGroove`) e LEDs emissivos com bloom. Nenhuma marca de fornecedor, número de série ou QR legível: etiquetas são retângulos lisos.

## Módulo de Comando (planta de 144 × 145 mm, 38 mm de altura; 1 un = 80 mm; frente em +Z)


A tampa é uma superfície só: topo plano e nivelado, de 58,5 mm de raio, e lateral que desce abrindo em curva (rápido perto do topo, quase reta embaixo) até 75 mm de raio no fundo. Ela não sobra para fora: encaixa rente na carcaça cinza. A tampa desce até o fundo em três apoios iguais, a 120° um do outro (na frente, atrás à esquerda e atrás à direita), cada um plano em ~±12°. Entre os apoios a borda faz um arco só, simétrico e arredondado, que sobe 18 mm: nos dois lados, onde aparece a base cinza, e atrás, por onde saem a antena e os cabos. No alto dos arcos a faixa branca tem 20 mm. Na frente da tampa, sob o botão, vai o adesivo "Dúvidas?" (~19 × 24 mm) com um QR ilustrativo (um desenho que não codifica nada). A base cinza é redonda, de ~67 mm de raio no alto, e afina um pouco até o fundo (~62 mm) sob os arcos; sob os três apoios ela faz o contrário e abre até ~72 mm no fundo, acompanhando a tampa. Tem nervuras fundas só nos dois lados, sob os arcos laterais; cada nervura dobra para baixo e continua como um rasgo no fundo. Na frente e atrás a base é lisa. No fundo: três pés de borracha de ~3 mm com o furo do parafuso no centro (um atrás do apoio da frente, dois perto dos apoios de trás), o rebaixo largo da etiqueta (vazio), logo à frente do bolsão, e o bolsão fundo no meio da borda de trás. O bolsão é um rasgo aberto: atravessa a parede de trás até a borda, e é por ali que os cabos saem. Dentro dele: grade de som em hexágono (37 furos) numa moldura de cantos redondos na face funda, RJ45 deitado, na parede da frente do bolsão, com a boca virada para dentro dele (o cabo entra deitado), e o jack da fonte na parede esquerda, a meia altura. A antena não sai do centro: fica num ressalto ao lado do bolsão (à direita de quem olha o fundo); o furo pequeno fica do outro lado.
| part.id | Como é modelada |
|---|---|
| `tampa` | Uma malha paramétrica só (`lidGeometry`), desenhada em dois trechos que dividem os vértices: o disco do topo, fosco, e a lateral, com brilho. O raio da lateral em cada altura vem de `wallR` (o perfil externo) e a altura da borda de baixo em volta do contorno vem de `lidRim` (os três apoios e os arcos entre eles). Sob cada apoio, uma aba branca com fenda marca o fecho (aparece por baixo). Logo em sulcos finos. Por dentro: bloco do guia de luz com furo de parafuso, ganchos e ressalto. |
| `botao-sos` | Tecla branca de cantos redondos, rente à tampa, na borda da frente, mais larga que alta (~29 × 12 mm), com uma fresta fina em volta (sem aro prateado). Embaixo dela, um pino de cristal (guia de luz) desce até a placa. A tecla afunda enquanto o 190 é segurado. |
| `led` | Ponto emissivo pequeno e forte no centro da tecla (escuro quando apagado); o brilho em volta vem do bloom. A luz vem do LED da placa: com o módulo explodido, a tecla apaga e acende o LED de `led-botao-placa`. |
| `antena` | Conector dourado rosqueado, junta com pino (articulação) e pá extrudada com chanfro. Sai da base, atrás, fora do centro: num ressalto de face plana ao lado do bolsão. |
| `base` | Base cinza: tambor redondo rente à tampa (`baseR` dá o raio em cada altura: afina até o fundo sob os arcos e abre sob os três apoios), com nervuras fundas só nos dois lados, e fundo com o rebaixo da etiqueta e o rasgo do bolsão, que atravessa a parede de trás (na largura dele a parede só existe acima da face funda, e os frisos somem), numa malha só; onde a tampa cobre a base, a parede recua para dentro dela; rasgos do fundo em `InstancedMesh` (um por nervura, só nas duas faixas laterais). Acompanham: pés, furo pequeno, ressalto da antena e as duas travas da placa. |
| `alto-falante` | Grade de 37 furos redondos em hexágono (`InstancedMesh`), na moldura da face funda do bolsão: de baixo, é o que mais aparece. |
| `ethernet`, `fonte` | Porta de rede na parede da frente do bolsão (só a boca aparece; o corpo do conector fica embaixo da placa); conector de energia na parede esquerda. Na ação dos cabos, os dois chegam por trás, deitados, pela abertura do bolsão. |
| `placa-principal` (i) | Placa verde limpa, com o recorte retangular no meio da borda de trás (onde passam o bolsão e o alto-falante): RJ45 no fundo do recorte, jack da fonte num dos braços, área de energia, pinos de teste, parafusos e etiqueta lisa. |
| `led-botao-placa` (i) | LED SMD e botão tátil azul na borda da placa, embaixo da cápsula. |
| `chip-4g` (i) | Cartão verde do modem espetado num slot preto, suporte metálico com o SIM e cabo coaxial; na outra ponta, a presilha metálica (base e duas travas nos cantos) que segura o cartão. Sai junto com a placa na vista explodida. |
| `wifi` (i) | Blindagem prateada com etiqueta lisa, conector dourado, coaxial e LEDs verdes. |
| `radio` (i) | Blindagem quadrada com furinhos (instanciados), chip ao lado e a antena de fio amarelo, soldada atrás do rádio e correndo pela borda de trás, por cima da caixinha do alto-falante (pela foto da placa aberta). |
| `speaker` (i) | Caixinha cinza no recorte da placa, cone preto e ímã cromado em `LatheGeometry`, dois fios. |
| `microfone` (i) | Cápsula pequena e dois fios, ao lado do alto-falante. |
| `bateria` (i) | Bloco por baixo da placa, com o cabo vermelho e preto que sai da ponta dela, sobe por fora da borda e passa por cima da placa até o conector branco de 2 pinos. Sai junto com a placa na vista explodida. |

Vista explodida, de cima para baixo: cúpula; placa (com o cartão do chip um pouco acima); caixinha do alto-falante; bateria; base cinza, que fica parada com a antena.

## Fotossensor (68 × 144 × 95 mm com base e suporte de parede; 1 un = 79 mm; frente em +Z)

O corpo é um cilindro de 68 mm de diâmetro e 137 de altura (medidas externas do aparelho), de topo plano com a borda arredondada curta (~4 mm) e um sulco fino em volta, perto do topo. É uma casca gerada como superfície paramétrica (volta do contorno × altura). A frente é esculpida por duas funções: `hoodOffset`, o capuz da câmera, e `lensRecess`, a moldura da lente PIR. O capuz é um ressalto em forma de pera que nasce rente ao corpo no alto, sai até ~10 mm para fora logo acima da câmera (a sobrancelha) e, daí para baixo, vira a borda de um bolso escavado de fundo inclinado: quase rente ao corpo na altura da lente e ~15 mm para dentro embaixo, onde fica a janela oval do LED. A lente PIR é um painel fosco grande (~50 × 43 mm), curvo como o corpo e ~9 mm para dentro dele, com a prateleira em cima, os chanfros dos lados e o queixo em rampa embaixo, onde fica o logo. O funil que leva até o sensor PIR fica por dentro, atrás da lente.

| part.id | Como é modelada |
|---|---|
| `camera` | Lente em cilindros concêntricos, quase na vertical, no alto do bolso do capuz, sob a sobrancelha. |
| `flash` | Janela oval vertical (~8 × 15 mm) deitada na rampa do bolso, com o emissor branco. |
| `led` | Ponto emissivo abaixo do flash. |
| `pir` | Janela leitosa curva como o corpo, no fundo da moldura (~9 mm atrás da linha do corpo). A faixa em trapézio embaixo é o queixo em rampa. |
| `base` | Base cinza fosca em `LatheGeometry`: quase rente ao corpo em cima e ~4 mm mais estreita embaixo, com o canto arredondado. Fechada em cima, como no CAD: borda e um fundo rebaixado em prato onde o corpo assenta. A linha da emenda com o corpo fica presa nela (na vista explodida não sobe com o corpo). |
| `suporte` | Luva cinza que faz parte da base: sobe pela traseira até h = 68 mm, com 31 mm de largura, e encosta no corpo. Por trás, dois lábios formam o encaixe em Λ (26 mm de vão embaixo, 11 mm no alto), onde entra a guia da peça de fixação; no fundo do encaixe, o parafuso de trava. Inclina junto com o corpo e não se separa da base na vista explodida. |
| `placas` (i) | Placa principal em pé, ~5 mm atrás do eixo do aparelho e quase da altura do corpo (de h = 24 a 128 mm), com o sensor PIR no fundo do funil. Presos nela, e explodindo junto: o suporte branco da câmera na parte de cima (abas que encostam na placa, paredes dos lados e a frente com janela), a câmera pequena (plaquinha de ~14 mm com a lente de ~7 mm, apoiada em dois pinos logo atrás do furo do capuz), a plaquinha verde dos LEDs na janela de baixo e a antena em mola, soldada na borda de baixo. Posições aproximadas, sem etiquetas. |
| `tampa-traseira` | Acompanha a curva de trás (~54 mm de largura), da metade da altura até o sulco perto do topo: trava no topo, duas abas embaixo, nervuras e etiqueta lisa por dentro. Em volta da metade de trás, perto da base, a faixa de frisos verticais finos. |
| `pilhas` (i) | 3 pilhas AA na vertical, nas proporções reais (50,5 × 14,5 mm), com polaridades alternadas, num berço preto com mola e contato; pino do anti-sabotagem no alto. Corpo preto com faixa dourada no lado do +, sem marca nem texto. Não saem do compartimento. |
| `fixacao` | Peça solta da parede (31 × 67 mm): chapa fina encostada na parede e a guia trapezoidal que entra no encaixe da luva, com os dois furos dos parafusos da parede. Fica parada quando o sensor inclina; na vista explodida, sai para trás. |

## Sensor Magnético (corpo 92,6 × 24 × 27,6 mm, ímã 92,3 × 11 × 15 mm, vão de 7 mm; 1 un = 49,5 mm; frente em +Z)

| part.id | Como é modelada |
|---|---|
| `corpo` | Duas cascas finas (paredes de ~2 mm), como as peças reais: a base atrás, com o fundo e, por dentro, o ressalto em cruz, as guias da placa, a divisória da ponta, o rasgo e o furo dos parafusos que prendem na porta; e a tampa na frente, de frente arredondada, com o anel da luz do LED e o apoio da placa por dentro. Na face: o logo em relevo, no meio do comprimento; a janela do LED; e, perto de uma ponta, a emenda da tampinha. |
| `ima` | Barra fina e longa (quase o comprimento do corpo, metade da altura e da profundidade), paralela e alinhada, com vão de poucos milímetros. Na cena da porta fica no batente; o corpo vai na folha. Duas peças: a base, de 5 mm, presa no batente, com nervuras atravessadas por dentro, e a tampa oca por cima. Na vista explodida a tampa sai e mostra a base e o ímã (barra cinza sobre as nervuras, posição aproximada). A linha da emenda é só um aro na borda, para não tampar o miolo. |
| `led` | Janela escura pequena (~8 × 4 mm), atravessada na face, a 18 mm do meio, entre o logo e a tampinha da ponta, com LED emissivo. |
| `placa`, `choque` (i) | Placa verde comprida e estreita (~74 × 19 mm, pela foto da placa): borne preto de 2 parafusos num canto, do lado da tampinha; na outra ponta, a antena em mola de cobre, que sai para fora da placa e ocupa o resto do corpo; fila de cinco pontos de teste numa borda; sensor do ímã no canto da antena; chip do sensor de choque. Sem etiqueta. |
| `bateria` (i) | Pilha cilíndrica deitada sobre a placa, presa por duas presilhas metálicas; corpo preto e faixa dourada no +, sem marca. |

## Sirene (128 mm de diâmetro, 60 mm de projeção; 1 un = 64 mm; face em +Z)

São duas peças. A sirene em si é só a cúpula, de 36 mm de altura: face plana de 50 mm de raio e lateral que abre em curva suave até os 64 mm da borda. O resto da projeção é o suporte de parede: um prato de 3 mm, do mesmo diâmetro, sobre três pés de 21 mm. Entre os pés fica um vão entre o prato e a parede. A traseira da sirene é plana e assenta no prato; bateria, placa, elemento sonoro e tamper são partes internas. Com o LED para baixo, a bateria fica em pé de um lado e o elemento sonoro do outro.

| part.id | Como é modelada |
|---|---|
| `corpo` | Cúpula numa superfície só (`domeGeometry`, revolução do perfil externo): face plana, quina curta e lateral em curva até a borda, que dobra para dentro. Atrás, um disco branco fecha a traseira, com o berço da bateria e os quatro rasgos quadrados do encaixe. Logo em sulcos finos no centro da face. |
| `led` | Janela pequena (~9 × 3,5 mm) na face, a 40 mm do centro, embaixo (6 horas): moldura escura, luz forte e lente de cristal fina por cima. |
| `suporte` | Prato extrudado (`supportPlate`), fechado: só tem o furo redondo do elemento sonoro, a calha da bateria (meia-cana fechada, para o lado da parede) e, em cada pé, uma cunha aberta por onde entra o parafuso. Por trás, nada de dentro da sirene aparece. Os três pés (`supportFeet`, uma malha) ficam a 120° um do outro, às 12, 4 e 8 horas: parede de fora curva, mais larga junto ao prato, e fundo com o parafuso. Quatro travas pequenas no prato entram nos rasgos da traseira da sirene. |
| `tamper` (i) | Micro-chave preta (~6 × 6 mm, com o botão no meio) numa plaquinha verde (~15 × 20 mm), na traseira, ao lado do conector branco da bateria: aparece quando a sirene sai do suporte. O prato do suporte mantém o botão apertado; fora do suporte, ele sobe ~1 mm. |
| `encaixe-suporte` (i) | Disco levemente elevado, anel e arcos na traseira, atrás do elemento sonoro: plástico fixo, que entra no furo redondo do prato e centraliza a sirene no suporte. Não é o tamper. |
| `elemento-sonoro` (i) | Por dentro, pastilha branca redonda com furo no centro (`LatheGeometry`), ligada à placa por dois fios brancos; na traseira, o círculo em relevo com anéis concêntricos. |
| `bateria` (i) | Cilindro preto com etiqueta laranja, em pé num berço da traseira (de um lado, com o LED para baixo); metade dele entra na calha do suporte. |
| `placa` (i) | Placa verde em cunha por dentro, com chips, pontos de teste e antena de fio preto; o trecho com o conector branco de 2 fios aparece na traseira, ao lado da bateria. |

A traseira também tem os furos quadrados e os ganchos em "L" do encaixe, e a etiqueta como um retângulo liso.

## Controle Remoto (44 × 51 × 13 mm; 1 un = 25,9 mm; frente em +Z)

O corpo é um seixo, não uma moeda: duas placas finas no contorno inteiro, em gota (círculo de 22 mm de raio que se funde, por concordâncias largas, com o olhal da argola, um círculo de ~6 mm de raio com o centro quase na borda do corpo), e dois ombros arredondados feitos como sólidos de revolução, um na frente e um atrás. Espessura no meio de ~13 mm; o teclado fica no centro do corpo.

| part.id | Como é modelada |
|---|---|
| `btn-panico`, `btn-desarmar`, `btn-armar`, `btn-parcial` | Setores de anel extrudados, em cruz, com o ícone em textura. |
| centro (sem `id`) | Disco fixo, modelado com o corpo; não é botão. Logo em baixo-relevo discreto (a confirmar). |
| `led` | Fenda de ~7 × 2 mm na parte plana da frente, entre o teclado e a borda de cima. |
| `corpo` | Gota (extrusão com chanfro), preto soft-touch, com o filete azul em volta. A casca da frente é oca, como a peça real: a face é aberta em anel onde entra o teclado de borracha, o miolo fica preso por quatro raios em X (nas frestas entre as teclas) e, por dentro, há os pinos das cascas (por fora da borda da placa) e o anel do miolo, que encosta na frente da placa em volta do CI. O teclado (lâmina e um pino embaixo de cada tecla, que aperta o domo dourado da placa) sai junto com as teclas na vista explodida. Atrás, o aro grosso com a cavidade da bateria. |
| `argola` | Furo oval deitado (~6,5 × 4 mm) perto da ponta do olhal, com a borda chanfrada. |
| `tampa` | Disco com um lado reto, girado 45° em relação ao olhal: no lado reto, duas abas que engancham; no lado oposto, a presilha, uma aba curta com a fenda por onde a tampa abre e fecha. Fora do lado reto a casca de trás é fechada (a placa não aparece por fora). Por dentro: nervura em U e etiqueta lisa. |
| `bateria` (i) | CR2032 prateada com o "+" gravado, encostada atrás da placa, no suporte marrom aberto de um lado (por onde ela sai) com a lâmina dourada por cima. |
| placa (i, sem `id`) | Disco de ~38 mm, 1 mm à frente da emenda das cascas, com um entalhe pequeno na borda do lado da argola. Na frente, virados para o teclado: as 4 teclas (base quadrada preta e domo dourado) a 14 mm do centro, embaixo dos pinos do teclado; o CI quadrado no centro; o cristal metálico; capacitores, resistores e pads dourados como na foto da placa (girada 135°); o LED na borda, embaixo da fenda; e a antena de fio amarelo correndo por dentro da borda. Atrás: o suporte da bateria e uma etiqueta lisa. |

## Placa de aviso (1,5 × 2,0)

A frente segue a arte oficial da placa (proporção 3:4): logo com 56% da largura no alto, "ORSEGUPS" e o telefone, faixa amarela de 66% a 83% da altura e rodapé com "ALARME 365" e o QR. O logo sai de `logoShape.ts`: o anel de dentro e o braço de fora, separados pelo corte curvo (largo à esquerda, rente ao miolo por cima, fino até a ponta da direita); a mesma forma desenha o logo da interface. As letras largas da arte são texto esticado na horizontal (`wideText`).

As cores da marca saem exatas: o material da chapa leva `userData.brand`, e o `ClickablePart` acrescenta ao shader a inversa da curva de tone mapping (`brandPatch`), para o amarelo não lavar no fim do quadro. A chapa lisa usa uma textura azul de 1 px, de modo que a placa inteira usa um só programa de shader.

| part.id | Como é modelada |
|---|---|
| `logo` | Anel amarelo com o corte, em canvas de 2048 px, sobre a chapa azul de cantos redondos. |
| `telefone` | Plano com "ORSEGUPS" (amarelo, letras largas) e "4020.4411" (branco). |
| `faixa` | Faixa amarela de ponta a ponta: câmera de segurança (haste, braço, corpo inclinado e lente) e o aviso em azul. |
| `verso` | Plano traseiro com "ALARME 365" e o QR Code ilustrativo. No rodapé da frente o QR é branco sobre o azul, como na arte. |

## Aplicativo (0,95 × 1,95)

O corpo do celular é uma extrusão de cantos redondos com aro metálico, botão de liga à direita, dois de volume à esquerda e, atrás, a ilha da câmera com duas lentes. A tela é React de verdade dentro do 3D (`<Html transform occlude>`, em `src/ui/AppScreen.tsx`), e cada região é uma parte: `sos`, `alarme-geral`, `ultimas-imagens`, `ultimos-eventos` e `menu`. O desenho segue a tela inicial do aplicativo: fundo branco, o nome de cada seção por fora e os cartões em cinza claro, o seletor de três estados, a foto com a etiqueta do aparelho no canto e os pontinhos de página, e o menu inferior de ponta a ponta. A barra de status (hora, sinal, 5G e bateria) é a mesma na tela clara e na tela "Imagem".

## Placas internas

Cada placa leva os componentes que aparecem nas fotos reais, em grupos ordenados perto dos CIs: capacitores (bege), resistores e CIs pequenos (pretos), cristal (metal) e pontos de teste (dourados). Os bloquinhos de cada cor são fundidos numa malha só por placa (`boxesGeometry`), sem instâncias. A textura tem trilhas em feixes paralelos com vias. Nada vem do desenho técnico de fábrica e não há texto, etiqueta, QR ou marca.

## Cena "Em ação"

Sala em corte (paredes claras, piso de madeira, rodapé, janela, porta com batente, aparador, sofá e tapete), invasor que anda, leque de detecção do fotossensor no chão e ondas de rádio saindo de quem transmite em cada etapa. O celular acompanha: alarme armado, aviso do disparo e a tela "Imagem" do aplicativo.
