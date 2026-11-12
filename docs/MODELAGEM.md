# Partes modeladas por aparelho

Todos os modelos são procedurais (three.js). As proporções vêm das fotos de referência; a Orsegups não publica dimensões. Cada linha é uma malha (ou grupo) separada, com o `part.id` usado em `src/data/devices.ts`. Partes marcadas com (i) são internas: só ficam clicáveis no modo Explodir ou no Raio-X.

Materiais: plástico branco acetinado #F1F2F4 com verniz leve e micro-textura (`white`), cinza-azulado fosco #8A93A3 (`grey`), preto soft-touch #1A1C20 (`black`), cromado (`chrome`), placa verde com textura de trilhas (`pcb`), linhas de partição (`partition`), logo em sulcos (`logoGroove`) e LEDs emissivos com bloom. Nenhuma marca de fornecedor, número de série ou QR legível: etiquetas são retângulos lisos.

## Módulo de Comando (face de raio 0,9, eixo vertical, frente em +Z)

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

## Fotossensor (0,8 × 1,95 × 0,5, frente em +Z)

| part.id | Como é modelada |
|---|---|
| `camera` | Lente em cilindros concêntricos, no módulo oval em relevo (extrusão em forma de estádio). |
| `flash` | Janela escura com o emissor branco. |
| `led` | Ponto emissivo abaixo do flash. |
| `pir` | Janela fosca levemente curva, com anéis de Fresnel sutis, no capuz trapezoidal que desce até a base. |
| `base` | `RoundedBox` cinza-claro, como no aparelho real. |
| `suporte` | Esfera do pivô, braço curto e placa de parede com parafusos. |
| `tampa-traseira` | Cobre a metade de cima da traseira (o compartimento das pilhas): trava no topo, duas abas embaixo, nervuras e etiqueta lisa por dentro. |
| `pilhas` (i) | 3 pilhas AA na vertical, com polaridades alternadas, num berço preto com mola e contato; pino do anti-sabotagem ao lado. Sem marca. |
| `fixacao` (i) | Peça cinza-clara na metade de baixo da traseira: trapézio com canal em cunha e parafuso de trava. O suporte articulado prende nela. |

## Sensor Magnético (frente em +Z)

| part.id | Como é modelada |
|---|---|
| `corpo` | Barra alta em `RoundedBox` de chanfro macio, na proporção ~94 × 31 × 23, com linha de partição da tampa, marca de alinhamento e logo em sulco fino. |
| `ima` | Barra mais fina e curta, paralela e colada ao corpo. |
| `led` | Fenda escura com LED emissivo. |
| `choque` (i) | Placa verde comprida e estreita: chip do sensor, chave de anti-sabotagem, borne de 2 parafusos, etiqueta lisa e antena em mola de cobre na ponta. |
| `bateria` (i) | Bateria cilíndrica presa por duas presilhas metálicas. |

## Sirene (raio 1, face em +Z)

A traseira é uma placa branca plana, sem tampa extra: é o suporte que cobre essa face. Por isso bateria, placa, elemento sonoro e tamper ficam na traseira e são partes internas.

| part.id | Como é modelada |
|---|---|
| `corpo` | `LatheGeometry` de perfil suave: face plana, chanfro largo e lateral levemente cônica; linha de partição e logo em sulcos finos. |
| `led` | Fenda na borda de baixo da face, virada para o chão. |
| `suporte` | Prato de parede: aro em `LatheGeometry`, fundo extrudado com furo grande e recortes, canal vertical, abas da baioneta e parafusos. |
| `tamper` (i) | Alavanca de gatilho numa guia em U, na traseira. O suporte a mantém pressionada; ela salta quando a sirene sai do suporte. |
| `elemento-sonoro` (i) | Por dentro, pastilha branca redonda com furo no centro (`LatheGeometry`), ligada à placa por dois fios brancos; na traseira, o círculo em relevo com anéis concêntricos. |
| `bateria` (i) | Cilindro preto deitado, com etiqueta laranja, num nicho no alto da traseira, preso por uma trava. |
| `placa` (i) | Placa verde em cunha por dentro, com chips, pontos de teste e antena de fio preto; o trecho com o conector branco de 2 fios aparece na traseira, ao lado da bateria. |

A traseira também tem os furos quadrados e os ganchos em "L" do encaixe, e a etiqueta como um retângulo liso.

## Controle Remoto (raio 0,9, frente em +Z)

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
