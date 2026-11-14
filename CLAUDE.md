# Guia do projeto para o Claude

Leia este arquivo inteiro antes de mexer em qualquer coisa. Ele junta o que uma sessão nova precisa saber: o que é o
projeto, as regras, como o código está organizado, como cada aparelho foi modelado, as decisões tomadas (e por quê),
os erros que já aconteceram e o que está pendente. O `README.md` explica o uso e o `docs/MODELAGEM.md` lista as
partes de cada aparelho; este arquivo é o complemento para quem vai trabalhar no código.

## 1. O projeto

- Showroom 3D interativo dos 7 itens do kit Alarme 365 da Orsegups: Módulo de Comando, Fotossensor, Sensor
  Magnético, Sirene, Controle Remoto, Placa de aviso e Aplicativo. O público gira o aparelho, clica numa parte, a
  câmera voa até ela e abre um card curto. Há também a abertura (kit inteiro), a cena "Em ação" (uma sala com um
  disparo do alarme, passo a passo) e o encerramento.
- Uso interno, só para apresentação. Publicado no GitHub Pages a cada push na `main`
  (https://jvfaraco.github.io/a365-showroom/), pelo workflow `.github/workflows/pages.yml`.
- Stack: Vite, React 18, TypeScript, three 0.169 com @react-three/fiber, drei e postprocessing, zustand,
  framer-motion, Tailwind. Fontes Poppins e Encode Sans empacotadas (funciona sem internet).

### Como o usuário trabalha

- Fala português do Brasil; responda sempre em pt-BR, direto e sem enrolação.
- Manda fotos e feedback curto ("a lateral não é pontiaguda, é só um arco"). Quando ele aponta um erro de forma,
  confira na referência e corrija exatamente aquilo; não invente detalhe que ele não pediu.
- Quando pede "manda uma foto", quer prints do modelo (de vários ângulos, se ele disser) enviados no chat.
- Pede para mesclar quando está satisfeito. Até lá, tudo fica num PR.

## 2. Regras que não mudam

**O repositório e o site são PÚBLICOS.**

- `ref/` nunca entra no git (está no `.gitignore`). As fotos ali mostram pessoas e a casa de um cliente.
  Rode `git status` antes de cada commit e confira que nada de `ref/` foi adicionado.
- Prints que misturam modelo e foto (os `-mix.png` do `tools/render.mjs`) ou que mostram foto do usuário vão só para
  o usuário, nunca para o repositório nem para o PR. No repo e no PR, só prints do próprio site ou só do modelo.
- Arquivos técnicos de fábrica (desenhos 3D, modelo técnico de placa) ficam fora do projeto. Pode usar os **números
  das medidas externas**; nenhuma malha, arquivo ou contorno copiado entra. Por dentro, só as peças grandes, em
  posição aproximada, sem medida exata. O modelo técnico da placa do controle não é usado.
- Nada de código de peça, número de revisão, espessura de parede, formato de presilha ou detalhe do mecanismo do
  tamper (além do que o card já diz) no código, comentários, docs ou commits. Escreva "medidas externas do aparelho".
- Só o aparelho físico: nada de dados de software, eventos, telemetria, etiquetas ou números de série em cards e
  texturas. Só a marca Orsegups aparece; nenhuma marca de fornecedor. QR sempre ilustrativo (`fakeQr`, não codifica
  nada). Sem preço, sem FAQ. Não invente dado técnico: onde faltar, texto neutro.
- Ícones de sistema de terceiros não entram no repo nem viram textura.
- A modelagem é procedural (feita à mão no código), em `src/three/devices/*.tsx`. Sem `.glb`.

## 3. Fluxo de trabalho

- Nunca dê push direto na `main`. Trabalhe num branch (o usual é `acabamento-4`), abra PR e **só mescle quando o
  usuário pedir**. Se o PR do branch já foi mesclado, recomece o branch a partir da `main` atual.
- Antes de commitar: `npx tsc --noEmit` e `npm run build`.
- Todo commit que mexe em material, geometria ou carga leva no corpo **programas de shader e triângulos, antes e
  depois** (`node tools/count.mjs <url do preview>`). Commits de docs/prints dizem que não mudam nada disso.
- **Desempenho:** o ambiente da nuvem não tem GPU; fps e tempo de carga reais não dá para medir aqui. Nenhuma mudança
  feita *para ganhar desempenho* entra sem número medido pelo usuário, na máquina dele:
  `node tools/perf.mjs https://jvfaraco.github.io/a365-showroom/ --channel msedge --cpu 1,4`.
- Proibido: mudar a ordem de carga dos aparelhos, juntar tudo num "material único com todas as flags" e ligar flag
  nova de material em peça que não tinha.
- Se a forma visível mudou: regenere a imagem da abertura (`PERF_SOFTWARE_GL=1 node tools/poster.mjs <url>`, depois
  outro build), refaça os prints de `docs/prints/` e atualize `docs/MODELAGEM.md` e as pendências do `README.md`.
- PR em português, com o que muda, a tabela de números e os prints (só do modelo/site).

### Ferramentas (sem GPU, render por software)

- `npm run dev -- --port 5312 --strictPort` e, depois do build, `npm run preview -- --port 4174 --strictPort`.
- `node tools/render.mjs 5312 <ref-id> <saída> [cam] [js]`: print do modelo no ângulo de uma foto de referência.
  Exemplos de câmera usados até aqui (formato `px,py,pz,tx,ty,tz,fov,roll`): frente `0,0,6,0,-0.1,0,22,0`;
  lado `6,0.1,0.1,0,-0.1,0,22,0`; três-quartos `2.2,0.7,5.0,0,-0.1,0,25,0`; trás `-1.4,0.8,-5.4,0,-0.1,0,24,0`;
  Raio-X com `"window.__showroom.getState().setView('xray')"`.
- Cada print leva ~80 s; no máximo 4 em paralelo. Um comando do terminal tem limite de 120 s: rode lotes em segundo
  plano e espere o arquivo de saída. Não edite `src/` enquanto prints rodam no servidor de dev (o recarregamento
  automático estraga o print).
- `node tools/count.mjs <url>`: programas de shader e triângulos. Se um aparelho der número estranho, rode de novo.
- `node tools/perf.mjs <url>` com `PERF_SOFTWARE_GL=1`: só serve para comparar duas versões na mesma máquina. Oscila
  muito (a mesma versão variou de 25 a 38 s de carga): alterne as rodadas (A, B, A, B) e fale em "equivalente dentro
  do ruído", nunca em número fino.
- Console do navegador: `window.__showroom.getState()` dá acesso ao estado (`setDevice('sirene')`,
  `selectPart('led')`, `setView('xray'|'exploded'|'manual')`, `startAction('tamper')`, `setScene('inaction')`).
  `?debug=1` mostra programas e triângulos; `?hq` trava a qualidade máxima.

### Desempenho: o que já se sabe

- **Meta do usuário:** acima de 60 fps, sem nenhuma travada, no PC e no celular (o site precisa funcionar bem no
  celular). Ele não aceita lentidão.
- **Como medir no aparelho de verdade:** `?perf=1` mostra fps e quadros lentos ao vivo e tem o botão "Testar
  fluidez" (~45 s, resultado copiável). A raiz do site é a `main`; o branch `acabamento-4` sai em `/preview/`. Para
  provar uma melhora, o usuário roda o teste nos dois endereços, no mesmo aparelho, e manda os dois resultados.
  `&q=0..3`, `&dpr=` e `&fpsmin=` testam ajustes sem mudar o código.
- **Fluxo de uma mudança de desempenho:** commit no `acabamento-4` → prévia em `/preview/` → usuário mede → os números
  dele entram no PR → só então mescla.
- **Chamadas de desenho por quadro** (nível de qualidade 0): abertura ~1.540, cena "Em ação" ~1.870, um aparelho no
  showroom de ~300 a ~740 (o módulo tem ~127 malhas visíveis e dá ~650 a ~740). O reflexo do piso
  (`MeshReflectorMaterial`, em `Stage.tsx`) redesenha a cena inteira: sem ele (nível 3) as chamadas caem pela metade.
  O contorno só redesenha a cena quando há algo sob o mouse.
- **Qualidade adaptativa:** o `PerformanceMonitor` do drei, no padrão, só reduz quando a média cai abaixo de 40 fps
  numa tela de 60 Hz. Para a meta de 60, o limite candidato é ~55 (`&fpsmin=55`), a confirmar com a medição.
- **React fora do caminho do quadro:** o hover não pode passar por estado ou contexto que envolva a cena toda. O
  contorno era um `<Selection>`/`<Select>` em volta de tudo e re-renderizava centenas de partes a cada passada do
  mouse (picos de 20 a 40 ms). A correção (contorno controlado direto no efeito, `common/outline.ts`) está no branch
  `otimizacao`, **ainda fora da `main`**: espera a medição do usuário (precisa de rebase na `main` antes).
- A contagem de programas de shader varia ±2 entre rodadas, conforme o momento em que é feita. Compare sempre na
  mesma etapa (por exemplo, logo depois de entrar no showroom) e nas duas versões.

## 4. Como o código está organizado

- **`src/data/devices.ts`** é a fonte única de conteúdo: aparelhos, partes, textos dos cards e câmeras. Cada parte
  tem `id`, `name`, `what`, `facts`, `tip`, `camera` (só a direção; a distância é calculada), `internal` (só aparece
  explodido ou no Raio-X), `action` (micro-animação do "Ver em ação"), `explode` e `pin` (Modo Manual). O aparelho
  tem `fem` para os textos com gênero ("da placa").
- **`src/data/actions.ts`**: cada micro-animação tem `label`, `duration` (fixa) ou `hold` + `undo` (abre e fica
  aberta até "Fechar"/"Recolocar"), `keepDim` e `camera` própria.
- **`src/store/showroomStore.ts`** (zustand): cena, aparelho, parte, vista, ação, estado do alarme, qualidade, carga.
  Tempo de ação: `actionTime(id)` (segundos desde o início) e `actionTau(id)` (com o "desfazer" voltando pelo mesmo
  caminho). Nos componentes, `useActionPhase(id, marcos)` só re-renderiza quando a fase muda.
- **O que muda a cada quadro não passa pelo React**: refs, `useFrame` e escrita direta no DOM (anel de 5 s, barra de
  tempo, etiqueta do hover). Mantenha assim.
- **`src/three/parts/ClickablePart.tsx`** envolve cada parte: `<ClickablePart id="...">` (clicável) ou
  `follow="..."` (carcaça que acompanha uma parte). Ele **clona** os materiais de cada malha, deixa todos
  `transparent` com opacidade 1 (esmaecer e Raio-X nunca trocam de programa de shader), aplica o patch de fresnel do
  Raio-X e registra a caixa da parte para o enquadramento. Malhas com `userData.fx` ficam de fora (efeitos);
  `userData.led` marca LED; material com `userData.brand` ganha a correção de cor da marca.
- **Carga (`Boot` em `src/three/scenes/Showroom.tsx`)**: monta um aparelho por quadro, compila os shaders de cada um
  com `compileAsync` (no showroom e no kit da abertura, objetos `kit:<id>`), deixa tudo visível por dois quadros
  (`warm`) e só então marca `ready`. Os 7 aparelhos ficam montados o tempo todo; trocar de aparelho só muda
  visibilidade e posição. A abertura (`Kit.tsx`) usa os mesmos componentes com `interactive={false}`.
- **Câmera (`src/three/CameraRig.tsx`)**: calcula a área livre da tela (sem barra, dock, lista e card), encaixa a
  caixa real da parte nela (`fitBox`, `PART_FILL`) e centraliza com `setFocalOffset`. Ações com `camera` própria
  usam essa direção. Sem giro automático.
- **Pós-processamento (`src/three/PostFX.tsx`)**: AO em meia resolução, bloom só acima de luminância 1,2 (emissivos),
  contorno do hover, vinheta, tone mapping ACES e SMAA. A qualidade cai em degraus quando o fps cai (DPR, depois AO,
  depois reflexo/vinheta/SMAA). Chega num pacote separado, como as cenas "Em ação" e "Encerramento".
- **Texturas** são desenhadas em canvas uma vez (`src/three/common/textures.ts`, com `memo`): placa, adesivo do
  módulo, ícones, PCB, Fresnel, foto da IA. `fitText` encolhe texto até caber; `wideText` estica na horizontal (as
  letras largas da placa). O logo Orsegups sai de `src/three/common/logoShape.ts` e é o mesmo na placa (canvas) e na
  interface (SVG em `icons.tsx`).
- **Aplicativo**: a tela do celular é React de verdade dentro do 3D (`<Html transform occlude>`, `src/ui/AppScreen.tsx`).
  Cada `Region` é uma parte clicável (`sos`, `alarme-geral`, `ultimas-imagens`, `ultimos-eventos`, `menu`).
- **Interface 2D** em `src/ui/` (barra, lista de partes, card, dock, botões de vista, modo apresentação). Tokens de
  movimento em `src/index.css` e `tailwind.config.js` (`duration-fast/base/slow`, `ease-out`). Só `transform` e
  `opacity` nas animações; tudo respeita `prefers-reduced-motion`.
- **Modo de referência** (`src/dev/RefMode.tsx`, só em `npm run dev`): `?ref=1&r=<id>` põe a foto de `ref/` por cima
  do canvas e trava a câmera no ângulo dela; `&cam=` ajusta o ângulo e `&op=` a opacidade. Cada entrada aponta um
  arquivo, um aparelho e uma câmera.

## 5. Como cada aparelho foi modelado

Frente sempre em +Z. As medidas citadas são externas, em mm. Detalhe de cada parte em `docs/MODELAGEM.md`.

- **Módulo de Comando** (`ModuloComando.tsx`, 1 un = 80 mm). O corpo é modelado mais alto e achatado no fim
  (`SQUASH = 0.6` a partir de `BOTTOM = -0.4`; antes do achatamento, `y = mm / 48`). Tampa branca: uma malha só
  (`lidGeometry`), topo plano de raio 58,5 mm (`R_TOP`) e lateral pelo perfil `WALL_PROFILE` até ~75 mm no fundo. A
  borda de baixo desce em **três apoios a 120°** (frente e os dois de trás, onde ficam as presilhas) e, entre eles, faz
  **um arco só, arredondado**, que sobe 18 mm (`lidFeet`, `lidRim`). Base cinza pelas tabelas `BASE_ARCH` (sob os arcos)
  e `BASE_FOOT` (sob os apoios), com nervuras só nos lados. Botão SOS/190 de ~29 × 12 mm na borda da frente, com o LED.
  Adesivo "Dúvidas?" com QR ilustrativo na frente. Fundo com bolsão aberto para trás (RJ45, fonte, grade de som).
- **Fotossensor** (`Fotossensor.tsx`, 1 un = 79 mm). Cilindro de 68 mm de diâmetro, 137 de altura mais 7 da base
  cinza; topo plano de borda curta (~4 mm) e sulco fino perto do topo. A frente é esculpida por funções: `hoodOffset`
  (capuz da câmera: ressalto em pera que sai até ~10 mm acima da lente e vira o bolso inclinado do LED) e
  `lensRecess` (moldura da lente PIR, ~50 × 43 mm, ~9 mm para dentro, com o queixo em rampa onde fica o logo). Atrás,
  tampa das 3 pilhas AA até o sulco e o suporte de parede (trilhos em Λ), que afasta o corpo ~16 mm da parede.
- **Sensor magnético** (`SensorMagnetico.tsx`, 1 un = 49,5 mm). Corpo 92,6 × 24 × 27,6 mm, ímã 92,3 × 11 × 15 mm,
  vão de 7 mm. Modelados de pé e deitados por `DEITA`. LED de ~8 × 4 mm a 18 mm do meio; logo no centro.
- **Sirene** (`Sirene.tsx`, 1 un = 64 mm). O corpo é **só a cúpula** de 36,4 mm (`domeGeometry`, revolução da tabela
  `DOME`: mm abaixo da face → raio). O resto da altura (até 59,9 mm da parede) é o **suporte de parede**: prato de
  3 mm (`supportPlate`, com o furo redondo do elemento sonoro e a abertura da bateria) e três pés de 21 mm a 120°
  (`supportFeet`), parafusados na parede. O LED fica na face, a 40 mm do centro, embaixo. A traseira e o miolo são
  desenhados num grupo girado 90° (`CORE_ROT`; `rot()` converte para a posição instalada): bateria em pé ao lado do
  elemento sonoro, tamper numa plaquinha ao lado do conector da bateria.
- **Controle remoto** (`ControleRemoto.tsx`, 1 un = 25,9 mm). Contorno em gota (`teardrop`): círculo de 22 mm de raio
  que se funde com o olhal da argola (furo oval). Espessura ~13 mm pela escala em Z (`THICK`). Teclado de 4 botões em
  cunha no centro, disco central fixo (não é botão), filete azul em volta. Atrás, a tampa da bateria: disco com um
  lado reto, girado 45° (`COVER_ROT`), com a presilha no lado oposto; fora dela a casca é fechada.
- **Placa de aviso** (`Placa.tsx`). Chapa de 1,5 × 2,0 em faixas de textura nas proporções da arte oficial: logo no
  alto (56% da largura), "ORSEGUPS" e telefone, faixa amarela "AVISO À POLÍCIA" e rodapé com "ALARME 365" e QR
  branco. Verso com "ALARME 365" e QR (suposição: a arte só mostra a frente).
- **Aplicativo** (`Smartphone.tsx` + `AppScreen.tsx`). Celular com aro, botões e ilha de câmera; a tela segue a tela
  inicial do app oficial (fundo branco, seções com o nome por fora, cartões cinza-claros, menu de 5 abas).

## 6. Referências

- `ref/` (só local, fora do git) guarda as fotos de cada aparelho, as artes oficiais (placa, app, kit), manuais e
  guias de LED, numa pasta por aparelho. Uma sessão nova na nuvem **não tem** essa pasta: se precisar, peça ao
  usuário para enviar os arquivos de novo e salve-os em `ref/`.
- Fotos coladas direto no chat não ficam salvas para depois. Se for revisar uma foto mais tarde, salve-a em `ref/`.
- O usuário também tem um pacote com vídeos de fábrica e arquivos técnicos. Use só para tirar medidas externas,
  fora do repositório (pasta temporária da sessão), e nunca copie nada dele para o projeto.

## 7. Decisões tomadas (e por quê)

- **Materiais sempre `transparent`** nas partes: esmaecer e Raio-X só mudam a opacidade, sem compilar shader novo
  no meio da apresentação.
- **Programas de shader contam.** Cada combinação diferente de flags é um programa a mais, compilado na carga. Por
  isso não se liga flag nova em peça que não tinha. Exemplo: a chapa lisa da placa usa uma textura azul de 1 px em
  vez de `map: null`, para usar o mesmo programa das faces impressas.
- **Cor da marca exata:** o tone mapping ACES lava o amarelo (ia a 228, 216, 85). O material da placa tem
  `userData.brand`, e o `ClickablePart` aplica `brandPatch` (`materials.ts`), que devolve a cor pela inversa da
  curva antes do tone mapping e a mantém abaixo do limiar do bloom. Resultado: amarelo 240, 216, 34 (arte: 252, 227,
  0). Marca: azul `#1E398D`, amarelo `#F9E000`.
- **Patch de shader:** como o `ClickablePart` clona o material e troca o `onBeforeCompile`, um patch posto direto no
  material original some. Patch novo = marca em `userData` + aplicação dentro do `ClickablePart`, com uma
  `customProgramCacheKey` própria.
- **Carga:** nada é desenhado antes de os shaders ficarem prontos; a imagem estática da abertura (`public/poster*.webp`)
  aparece por trás da tela de carregamento. A ordem de carga não muda.
- **Interior aproximado:** por dentro, só as peças grandes (placas, bateria, sensor, alto-falante), em posição
  aproximada. É a regra do usuário, e evita expor detalhe de fábrica.

## 8. Erros que já aconteceram (não repetir)

**Modelagem**

- Inventar forma que não está na referência: a sirene ganhou um "rabo" que não existe. Só modele o que aparece nas
  fotos ou nas medidas.
- Confundir peças: toda a altura da sirene foi posta no corpo, mas o corpo é só a cúpula; o resto é o suporte de
  parede. Antes de modelar, descubra quais peças são separadas (a "aba" que aparecia nas fotos eram os pés do suporte).
- Orientação errada: a traseira da sirene ficou girada 90° em relação ao LED. Confira cada peça interna em relação a
  um ponto visível (o LED fica embaixo).
- A lateral do módulo ficou pontuda e depois em rampa: entre os três apoios a 120° a borda faz **um arco só**,
  arredondado; as presilhas ficam nos apoios, não mais para trás.
- A tampa de trás do controle deixava a placa verde aparecer: ela fecha a cavidade inteira.
- Antes de dizer que algo "está pronto", renderize e olhe o print de vários ângulos, inclusive de trás e de lado.

- O LED aparece na janela da carcaça, mas fica na placa. `<Led on="shell">` é a janela (apaga com o aparelho
  explodido) e `<Led on="board">` é o LED na placa (só acende explodido). Peças presas na placa (câmera, mola, cartão
  do modem, bateria pelo cabo) têm o mesmo `explode` da placa: nunca saem soltas na vista explodida.
- Cascas não são blocos maciços: por dentro elas têm paredes, guias, pinos e aberturas (magnético, controle).
- No celular, durante uma ação, o card fica compacto e a câmera mede a área livre pelo topo real do card. Sem isso,
  a câmera recuava para dentro da névoa e a cena da ação sumia.

**Render e interface**

- A tela do app (HTML em CSS 3D, `<Html transform>`) sai deslocada no Safari do iPhone, mas não no Chrome; os testes
  daqui (Chromium) não mostram. Não tirar o `useScreenAlign` do `Smartphone.tsx`.

- O sinal do deslocamento vertical da câmera estava invertido (no `camera-controls`, Y positivo desce a câmera): no
  celular, o aparelho ficava escondido atrás do card. Confira prints em 390 × 844 com o card aberto.
- Texto com gênero errado ("parte do placa"): use `fem` do aparelho.
- Barra de progresso animando `width`: use `transform: scaleX`.
- Medição de desempenho por software interpretada como número real. Ela só compara versões, e com ruído grande.

## 9. Situação atual e pendências

- A rodada de acabamento está mesclada na `main`: os 5 aparelhos com as medidas externas, a placa e o app pelas
  artes oficiais, e os acertos de interface. O usuário considera os modelos 3D ok; o que vem agora é ajuste fino.
- Números (do `?debug=1`, 14/11): 57 programas de shader; triângulos na abertura ~260 mil; módulo ~63,6 mil,
  fotossensor ~65,5 mil, magnético ~18,3 mil, sirene ~31,4 mil, controle ~80,5 mil.
- **Pendente do usuário:** medir a fluidez com `?perf=1` no PC e no celular e mandar os resultados (depois disso, a
  correção do hover do branch `otimizacao` e um perfil leve para celular).
- **Pendente do usuário:** a prévia `/preview/` não publica: o ambiente `github-pages` só aceita a `main` (liberar o
  branch `acabamento-4` em Settings → Environments → github-pages).
- App saindo da tela do celular (só no Safari do iPhone, ~45 px para baixo): corrigido em `Smartphone.tsx`
  (`useScreenAlign` compara a tela HTML com os cantos projetados do vidro e desloca a camada); falta o usuário confirmar
  no iPhone.
- **Pendente do usuário:** foto do outro lado da placa
  do magnético (posição do LED), gravações dos sons do módulo e da sirene (para imitar por síntese) e o que ele quis
  dizer com "o LED da sirene" (mensagem cortada).
- Decisões do usuário nesta rodada: o fotossensor NÃO tem tamper (abrir a tampa não dispara); a bateria da sirene não
  é trocada pelo usuário; o suporte do fotossensor é fixo e o sensor gira em pé sobre ele; a sirene toca assim que o
  magnético detecta a porta abrindo; o LED do magnético pisca em azul; não há modo Manual.
- O azul da placa ainda sai um pouco mais claro que o da arte.
- As pendências de conteúdo a confirmar com a Orsegups estão no fim do `README.md` (destino do QR, cor do filete do
  controle, logo no disco central, lado do borne do magnético, posição exata de peças internas).
