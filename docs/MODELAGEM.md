# Partes modeladas por aparelho

Todos os modelos são procedurais (three.js). As proporções vêm das fotos de referência; a Orsegups não publica dimensões. Cada linha é uma malha (ou grupo) separada, com o `part.id` usado em `src/data/devices.ts`. Partes marcadas com (i) são internas: só ficam clicáveis no modo Explodir ou no Raio-X.

Materiais: plástico branco acetinado (`white`), branco em relevo (`whiteRelief`), cinza (`grey`), cinza-escuro (`greyDark`), preto fosco (`black`), preto brilhante (`blackGloss`), placa verde (`pcb`), metal, dourado e LEDs emissivos com bloom.

## Módulo de Comando (raio 1, eixo vertical, frente em +Z)

| part.id | Como é modelada |
|---|---|
| `tampa` | `LatheGeometry` em cúpula, com os vértices escalados para a face cair para a frente; logo em relevo. Branco. |
| `led` | Cristal de cantos redondos na face, perto da borda da frente, com moldura em relevo. Emissivo: é ele que acende com a cor do estado. |
| `botao-sos` | Ponto oval escuro no centro do cristal. |
| `antena` | Conector dourado com anéis de rosca, cotovelo esférico e pá em `RoundedBox`. Sai da base cinza, não da cúpula. |
| `aletas` | Saia cônica cinza e 52 aletas em `InstancedMesh`. O fundo cinza, as duas pecinhas e a etiqueta lisa acompanham esta parte. |
| `alto-falante` | Disco com textura de grade de furos e furo do microfone, no fundo. |
| `ethernet` | Rebaixo escuro com a porta e os contatos dourados, no fundo. |
| `fonte` | Conector redondo com pino central, no fundo. |
| `placa-principal` (i) | Disco verde com chips e blindagens. |
| `ventoinha` (i) | Moldura quadrada e rotor de 7 pás, que gira. Fica perto da saída da antena. |
| `chip-4g` (i) | Slot metálico com o chip encaixado. |
| `bateria` (i) | Bloco em `RoundedBox` com etiqueta e cabo vermelho e preto, sobre a placa. |

Vista explodida em três camadas: a cúpula branca sobe mais; a placa verde (com ventoinha, slot do chip e bateria) sobe menos; a base cinza fica parada, com a antena, o alto-falante, a Ethernet e a fonte.

## Fotossensor (0,8 × 1,95 × 0,5, frente em +Z)

| part.id | Como é modelada |
|---|---|
| `camera` | Lente em cilindros concêntricos, no módulo oval em relevo (extrusão em forma de estádio). |
| `flash` | Janela escura com o emissor branco. |
| `led` | Ponto emissivo abaixo do flash. |
| `pir` | Moldura e lente Fresnel: segmento de cilindro fosco e translúcido com textura de anéis. |
| `base` | `RoundedBox` cinza-escuro. |
| `suporte` | Esfera do pivô, braço curto e placa de parede com parafusos. |
| `tampa-traseira` | Painel traseiro com trava, articulado embaixo. |
| `pilhas` (i) | Dois cilindros com rótulo e polo metálico. |
| `fixacao` (i) | Placa cinza com 4 furos e 2 parafusos de trava. |

## Sensor Magnético (frente em +Z)

| part.id | Como é modelada |
|---|---|
| `corpo` | Barra alta em `RoundedBox` branca, com logo embaixo. |
| `ima` | Barra mais fina e curta, paralela e colada ao corpo. |
| `led` | Fenda escura com LED emissivo. |
| `choque` (i) | Placa verde com disco piezo dourado e chip. |
| `bateria` (i) | Cilindro preto com rótulo laranja. |

## Sirene (raio 1, face em +Z)

A traseira é uma placa branca plana, sem tampa extra: é o suporte que cobre essa face. Por isso bateria, placa, elemento sonoro e tamper ficam na traseira e são partes internas.

| part.id | Como é modelada |
|---|---|
| `corpo` | Cúpula baixa em `LatheGeometry` com face plana e logo em relevo. |
| `led` | Fenda na borda de baixo da face, virada para o chão. |
| `suporte` | Prato de parede: aro em `LatheGeometry`, fundo extrudado com furo grande e recortes, canal vertical, abas da baioneta e parafusos. |
| `tamper` (i) | Alavanca de gatilho numa guia em U, na traseira. O suporte a mantém pressionada; ela salta quando a sirene sai do suporte. |
| `elemento-sonoro` (i) | Círculo em relevo com anéis concêntricos na traseira, e a câmara cilíndrica por dentro. |
| `bateria` (i) | Cilindro preto deitado, com etiqueta laranja, num nicho no alto da traseira, preso por uma trava. |
| `placa` (i) | Plaquinha verde ao lado da bateria, com conector branco de 2 fios (vermelho e preto). |

A traseira também tem os furos quadrados e os ganchos em "L" do encaixe, e a etiqueta como um retângulo liso.

## Controle Remoto (raio 0,9, frente em +Z)

| part.id | Como é modelada |
|---|---|
| `btn-panico`, `btn-desarmar`, `btn-armar`, `btn-parcial` | Setores de anel extrudados, em cruz, com o ícone em textura. |
| `btn-central` | Cilindro com o logo em relevo. |
| `led` | Fenda no topo. |
| `corpo` | Disco de borda arredondada em `LatheGeometry`, preto fosco, com o filete azul em toro e a cauda em gota. |
| `argola` | Toro preto com filete azul. |
| `tampa` | Disco traseiro liso, com o entalhe no topo e um símbolo em relevo. Levanta pela borda de cima. |
| `bateria` (i) | Bateria-moeda no suporte metálico dourado, sobre a placa verde (com a etiqueta como retângulo liso). |

## Placa de aviso (1,5 × 2,0)

| part.id | Como é modelada |
|---|---|
| `logo` | Plano com o logo amarelo desenhado em canvas, sobre a chapa azul de cantos redondos. |
| `telefone` | Plano com "ORSEGUPS" e "4020.4411". |
| `faixa` | Faixa amarela com o ícone de câmera e o aviso. |
| `verso` | Plano traseiro com "ALARME 365" e o QR Code ilustrativo. |

## Aplicativo (0,95 × 1,95)

O corpo do celular é uma extrusão de cantos redondos. A tela é React de verdade dentro do 3D (`<Html transform occlude>`, em `src/ui/AppScreen.tsx`), e cada região é uma parte: `sos`, `alarme-geral`, `ultimas-imagens`, `ultimos-eventos` e `menu`.
