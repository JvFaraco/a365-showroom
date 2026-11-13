# Instruções para o Claude neste projeto

Showroom 3D dos equipamentos do Alarme 365 (Vite + React + three/r3f + zustand). O site é publicado no GitHub Pages a
cada push na `main`. Responda sempre em português do Brasil.

## Regras que não mudam

**O repositório e o site são PÚBLICOS.**

- `ref/` nunca entra no git (já está no `.gitignore`). As fotos ali mostram pessoas, crachá e a casa de um cliente.
  Rode `git status` antes de cada commit e confira que nada de `ref/` foi adicionado.
- Prints que misturam modelo e foto (os `-mix.png` do `tools/render.mjs`) ou que mostram foto do usuário vão só para
  o usuário, nunca para o repositório nem para o PR. No repo e no PR, só prints do próprio site ou só do modelo.
- Arquivos técnicos de fábrica (desenhos 3D, modelo técnico de placa) ficam fora do projeto. Pode usar os **números
  das medidas externas**; nenhuma malha, arquivo ou contorno copiado entra. Por dentro, só as peças grandes, em
  posição aproximada, sem medida exata. O modelo técnico da placa do controle não é usado.
- Nada de código de peça, número de revisão, espessura de parede, formato de presilha ou detalhe do mecanismo do
  tamper (além do que o card já diz) no código, comentários, docs ou commits. Use "medidas externas do aparelho".
- Só o aparelho físico: nada de dados de software, eventos, telemetria, etiquetas ou números de série em cards e
  texturas. Só a marca Orsegups aparece; nenhuma marca de fornecedor. QR sempre ilustrativo (`fakeQr`, não
  codifica nada). Sem preço, sem FAQ. Não invente dado técnico.
- Ícones de sistema de terceiros não entram no repo nem viram textura.
- A modelagem é procedural (feita à mão no código), em `src/three/devices/*.tsx`.

## Fluxo de trabalho

- Nunca dê push direto na `main`. Trabalhe num branch, abra PR e **só mescle quando o usuário pedir**.
- Se o PR do branch já foi mesclado, recomece o branch a partir da `main` atual antes de continuar.
- Antes de commitar: `npx tsc --noEmit` e `npm run build`.
- **Desempenho:** o ambiente da nuvem não tem GPU, então fps e tempo de carga reais não dá para medir aqui. Nenhuma
  mudança feita *para ganhar desempenho* entra sem número medido pelo usuário (`node tools/perf.mjs <url>
  --channel msedge --cpu 1,4`, na máquina dele).
- Todo commit que mexe em material, geometria ou carga leva no corpo **programas de shader e triângulos, antes e
  depois** (`node tools/count.mjs <url do preview>`).
- Proibido: mudar a ordem de carga dos aparelhos, juntar tudo num "material único com todas as flags" e ligar flag
  nova de material em peça que não tinha.
- Se a forma visível mudou, regenere a imagem da abertura (`PERF_SOFTWARE_GL=1 node tools/poster.mjs <url>`) e os
  prints de `docs/prints/`. Atualize `docs/MODELAGEM.md` e as pendências do `README.md`.

## Ferramentas (sem GPU)

- `npm run dev -- --port 5312 --strictPort` e `npm run preview -- --port 4174 --strictPort` (depois do build).
- `node tools/render.mjs 5312 <ref-id> <saída> [cam] [js]`: print do modelo no ângulo de uma foto de referência
  (entradas em `src/dev/RefMode.tsx`). Cada print leva ~80 s; no máximo 4 em paralelo.
- Um comando do terminal tem limite de 120 s: rode lotes de prints em segundo plano e espere o arquivo de saída.
- Não edite `src/` enquanto prints rodam no servidor de dev: o recarregamento automático estraga o print.
- Medidas de desempenho por software oscilam muito (a mesma versão variou de 25 a 38 s de carga). Para comparar duas
  versões, alterne as rodadas (A, B, A, B...) e fale em "equivalente dentro do ruído", nunca em número fino.

## Erros que já aconteceram (não repetir)

**Modelagem**

- Inventar forma que não está na referência: a sirene ganhou um "rabo" que não existe, e o usuário reclamou. Só
  modele o que aparece nas fotos ou nas medidas.
- Confundir peças: a altura da sirene foi toda posta no corpo, mas o corpo é só a cúpula de 36 mm; o resto é o
  suporte de parede (prato e três pés parafusados). Antes de modelar, descubra quais peças são separadas.
- Orientação errada: a traseira da sirene ficou girada 90° em relação ao LED. Confira a posição de cada peça interna
  em relação a um ponto de referência visível (o LED fica embaixo).
- A lateral do módulo ficou pontuda: entre os três apoios a 120° a borda faz um arco só, arredondado.
- A tampa de trás do controle deixava a placa verde aparecer: ela fecha a cavidade inteira, e a presilha fica na
  borda.
- Fotos coladas no chat não ficam salvas para a sessão. Peça ao usuário para pôr em `ref/` o que precisar rever.

**Render e materiais**

- O tone mapping (ACES) lava o amarelo da marca. A placa usa `userData.brand` no material, e o `ClickablePart`
  aplica a correção (`brandPatch` em `materials.ts`). Cor da marca: azul `#1E398D`, amarelo `#F9E000`.
- O `ClickablePart` **clona** os materiais e troca o `onBeforeCompile`: um patch de shader posto direto no material
  original some. Para um patch novo, marque o material com `userData` e aplique dentro do `ClickablePart`.
- Cada combinação diferente de flags de material é um programa de shader a mais. Material sem `map` ao lado de um
  com `map` já criou um programa extra; a chapa lisa da placa usa uma textura de 1 px para usar o mesmo programa.
- No `camera-controls`, o deslocamento focal positivo em Y desce a câmera. O sinal estava invertido no celular, e o
  aparelho ficava escondido atrás do card. Confira prints em 390 × 844 com o card aberto.

**Interface**

- Textos com gênero: use `fem` do aparelho em `devices.ts` ("parte da placa", "parte do módulo").
- Animações: só `transform` e `opacity`, com os tokens de duração e easing de `index.css` e `tailwind.config.js`;
  tudo respeita `prefers-reduced-motion`.

## Unidades dos modelos

Módulo: 1 unidade = 80 mm. Fotossensor: 79 mm. Magnético: 49,5 mm. Sirene: 64 mm. Controle: 25,9 mm. Frente em +Z.
