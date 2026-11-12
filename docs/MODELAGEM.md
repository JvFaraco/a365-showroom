# Partes modeladas por aparelho

Todos os modelos são procedurais (three.js). As proporções vêm das fotos de referência; a Orsegups não publica dimensões. Cada linha é uma malha (ou grupo) separada, com o `part.id` usado em `src/data/devices.ts`. Partes marcadas com (i) são internas: só ficam clicáveis no modo Explodir ou no Raio-X.

Materiais: plástico branco acetinado #F1F2F4 com verniz leve e micro-textura (`white`), cinza-azulado fosco #8A93A3 (`grey`), preto soft-touch #1A1C20 (`black`), cromado (`chrome`), placa verde com textura de trilhas (`pcb`), linhas de partição (`partition`), logo em sulcos (`logoGroove`) e LEDs emissivos com bloom. Nenhuma marca de fornecedor, número de série ou QR legível: etiquetas são retângulos lisos.

## Módulo de Comando (planta de 144 × 145 mm, 38 mm de altura; 1 un = 80 mm; frente em +Z)

| part.id | Como é modelada |
|---|---|
| `tampa` | Face: disco plano em `LatheGeometry`, inclinado para a frente, com linha de partição e o logo em sulcos finos. Saia: malha paramétrica que nasce redonda na borda da face e se abre em concha, com uma ponta na frente e duas asas atrás. Por dentro: bloco do guia de luz com furo de parafuso, ganchos e ressalto. |
| `botao-sos` | A cápsula perto da borda da frente (eixo maior tangente à borda): aro cromado fino e guia de luz em `MeshTransmissionMaterial`. A peça inteira afunda enquanto o 190 é segurado. |
| `led` | Ponto emissivo forte no centro da cápsula e halo fraco pelo contorno. |
| `antena` | Conector dourado rosqueado, junta com pino (articulação) e pá extrudada com chanfro. Sai da base, atrás. |
| `base` | Base cinza: copo em `LatheGeometry` e 60 dentes arredondados em `InstancedMesh` (borda serrilhada, só forma). Acompanham: bolsão dos cabos, rebaixo da etiqueta, furo de parafuso, pé redondo e as duas travas da placa. |
| `alto-falante` | Grade de furos redondos em `InstancedMesh`, no fundo do bolsão. |
| `ethernet`, `fonte` | Porta de rede e conector de energia, lado a lado dentro do bolsão. |
| `placa-principal` (i) | Placa verde recortada (extrusão), textura de trilhas, 90 componentes SMD em `InstancedMesh`, área de energia, pinos de teste, parafusos e etiqueta lisa. |
| `led-botao-placa` (i) | LED SMD e botão tátil azul na borda da placa, embaixo da cápsula. |
| `chip-4g` (i) | Cartão verde espetado num slot preto, suporte metálico com o SIM e cabo coaxial. |
| `wifi` (i) | Blindagem prateada com etiqueta lisa, conector dourado, coaxial e LEDs verdes. |
| `radio` (i) | Blindagem quadrada com furinhos (instanciados), chip ao lado e a antena de fio amarelo. |
| `speaker` (i) | Caixinha cinza no recorte da placa, cone preto e ímã cromado em `LatheGeometry`, dois fios. |
| `microfone` (i) | Cápsula pequena e dois fios, ao lado do alto-falante. |
| `bateria` (i) | Bloco por baixo da placa, com o conector branco de 2 pinos e os fios vermelho e preto. |

Vista explodida, de cima para baixo: cúpula; placa (com o cartão do chip um pouco acima); caixinha do alto-falante; bateria; base cinza, que fica parada com a antena.

## Fotossensor (68 × 144 × 94 mm com base e placa de fixação; 1 un = 79 mm; frente em +Z)

O corpo (68 × 137 × 78 mm, mais fundo que largo) é uma casca gerada como superfície paramétrica (volta do contorno × altura): frente e laterais arredondadas, traseira mais plana, topo de borda arredondada. O capuz e o rebaixo do PIR (de ~20 a 64 mm de altura, ~61 mm de boca, fundo ~16 mm atrás da frente) são escavados na própria casca, com fundo e paredes; só a cápsula da câmera é saliente. O compartimento das pilhas também é aberto na casca. A casca sai em duas metades (frente e corpo traseiro), que se separam na vista explodida.

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
| `pilhas` (i) | 3 pilhas AA na vertical, nas proporções reais (50,5 × 14,5 mm), com polaridades alternadas, num berço preto com mola e contato; pino do anti-sabotagem no alto. Sem marca. Não saem do compartimento. |
| `fixacao` | Placa cinza entre os trilhos, num nível mais fundo, com o entalhe retangular no alto e um parafuso perto de baixo. |

## Sensor Magnético (corpo 93 × 25 × 28 mm, ímã 92 × 12 × 15 mm, vão de 7 mm; 1 un = 49,5 mm; frente em +Z)

| part.id | Como é modelada |
|---|---|
| `corpo` | Barra alta em `RoundedBox` de chanfro macio, na proporção ~94 × 31 × 23, com linha de partição da tampa, marca de alinhamento e logo em sulco fino. |
| `ima` | Barra fina e longa (quase o comprimento do corpo, metade da altura e da profundidade), paralela e alinhada, com vão de poucos milímetros. Na cena da porta fica no batente; o corpo vai na folha. |
| `led` | Fenda escura com LED emissivo. |
| `choque` (i) | Placa verde comprida e estreita: chip do sensor, chave de anti-sabotagem, borne de 2 parafusos, etiqueta lisa e antena em mola de cobre na ponta. |
| `bateria` (i) | Bateria cilíndrica presa por duas presilhas metálicas. |

## Sirene (128 mm de diâmetro, 60 mm de projeção; 1 un = 64 mm; face em +Z)

A traseira é uma placa branca plana, sem tampa extra: é o suporte que cobre essa face. Por isso bateria, placa, elemento sonoro e tamper ficam na traseira e são partes internas.

| part.id | Como é modelada |
|---|---|
| `corpo` | `LatheGeometry` de perfil suave: face plana, chanfro largo e lateral levemente cônica; linha de partição e logo em sulcos finos. |
| `led` | Fenda na borda de baixo da face, virada para o chão. |
| `suporte` | Prato de parede: aro aberto em cima (é por onde a sirene desce), fundo extrudado com furo grande e recortes, canal vertical, travas e parafusos. A sirene não gira: desce na vertical e trava com um clique. |
| `tamper` (i) | Botão circular em degraus no centro da traseira. O suporte o mantém pressionado; ele salta quando a sirene sai do suporte. |
| `elemento-sonoro` (i) | Por dentro, pastilha branca redonda com furo no centro (`LatheGeometry`), ligada à placa por dois fios brancos; na traseira, o círculo em relevo com anéis concêntricos. |
| `bateria` (i) | Cilindro preto deitado, com etiqueta laranja, num nicho no alto da traseira, preso por uma trava. |
| `placa` (i) | Placa verde em cunha por dentro, com chips, pontos de teste e antena de fio preto; o trecho com o conector branco de 2 fios aparece na traseira, ao lado da bateria. |

A traseira também tem os furos quadrados e os ganchos em "L" do encaixe, e a etiqueta como um retângulo liso.

## Controle Remoto (45 × 51 × 13 mm; 1 un = 25,9 mm; frente em +Z)

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
