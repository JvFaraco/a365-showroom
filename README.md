# Alarme 365 · Showroom 3D

> **Licença:** todos os direitos reservados. "Orsegups", "Alarme 365", o logo e o telefone são marcas e informações da Orsegups, usados só para apresentação. Veja [`LICENSE.md`](LICENSE.md).

Apresentação interativa em 3D dos 7 equipamentos do Alarme 365 (Orsegups). O público gira cada aparelho, clica numa parte, a câmera voa até ela e abre um card curto explicando o que é e para que serve.

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build estático em dist/
npm run preview  # serve o build
```

Stack: Vite, React 18, TypeScript, three.js com @react-three/fiber, drei e postprocessing, zustand, framer-motion, maath e Tailwind. As fontes Poppins e Encode Sans vão empacotadas (via `@fontsource`), então o demo roda sem internet.

## Como usar

O demo tem três cenas, nesta ordem: **Showroom → Em ação → Encerramento** (mais a abertura). A cena "Sistema conectado" foi arquivada em [`arquivado/`](arquivado/README.md), fora do build.

| Ação | Mouse / toque | Teclado |
|---|---|---|
| Girar, aproximar | arrastar, roda ou pinça | |
| Resetar a vista | duplo clique | `R` reseta tudo |
| Ver uma parte | clicar nela, num pino do Modo Manual ou na lista "Partes" | `→` / `espaço` próxima, `←` anterior |
| Voltar à vista inteira | botão Voltar | `ESC` |
| Trocar de aparelho | faixa inferior | `1` a `7` |
| Explodir, Raio-X, Manual, Tour | botões no topo | `E`, `X`, `M`, `T` |
| Modo apresentação (tela cheia, textos maiores) | botão no canto | `P` |

A câmera só gira quando alguém arrasta: não há giro automático.

No modo apresentação, `→` (ou o clicker, que envia PageDown) segue para o próximo aparelho quando as partes acabam. Sem ele, as setas dão a volta nas partes do mesmo aparelho.

As micro-animações que abrem ou tiram algo (tampa do fotossensor, tampa do controle, bateria da sirene, sirene fora do suporte) ficam abertas até o botão de desfazer do card ("Fechar", "Recolocar"), que volta pelo mesmo caminho. A sirene não gira para encaixar: desce de cima para baixo no suporte e trava com um clique.

## Fluidez

- Os 7 aparelhos do showroom ficam montados o tempo todo. Trocar de aparelho só muda `visible` e anima a posição.
- Atrás da tela de carregamento há um aquecimento fatiado: cada aparelho entra num quadro e tem os shaders compilados com `compileAsync`, começando pelo da tela inicial; no fim, tudo fica visível por alguns quadros para subir as texturas e exercitar o contorno do hover. Depois disso, nenhum clique, zoom, Raio-X ou micro-animação compila shader novo.
- O que muda a cada frame (anel de 5 s, linha do tempo, etiqueta do hover) corre em refs e direto no DOM, fora do estado do React.
- Qualidade adaptativa: quando o FPS cai, primeiro o DPR vai a 1; depois sai o AO; por último saem o reflexo do piso, a vinheta e o SMAA.
- Sombra de contato assada uma vez por aparelho; AO em meia resolução; bloom só nos emissivos; sem DOF.

## Carregamento

- Primeira imagem antes do 3D: uma foto estática da abertura (`public/poster.webp` e `poster-m.webp`, geradas do próprio app por `node tools/poster.mjs`) aparece por trás da tela de carregamento, com o título e o botão já no lugar. Se a pessoa clicar no botão antes de o 3D chegar, o showroom abre assim que puder. Rode o `poster.mjs` de novo (e faça outro build) quando os modelos ou a disposição da abertura mudarem.
- O canvas não desenha nada antes de os shaders ficarem prontos (`frameloop="never"` durante a carga): usar um programa ainda em compilação obriga a esperar por ele.
- A tela de carregamento é HTML/CSS inline no `index.html`: aparece no primeiro quadro, antes de qualquer JS. O logo anima só com `transform`/`opacity` (não trava quando a thread principal está ocupada) e a barra mostra a etapa real: código, aparelhos, materiais, preparando. Ela sai em crossfade para a abertura já renderizada. Respeita `prefers-reduced-motion`.
- O JS sai em pacotes: `three`, react-three (fiber/drei), pós-processamento, interface e o app. As cenas "Em ação" e "Encerramento" e o pós-processamento chegam por `import()` dinâmico; as duas cenas são buscadas em tempo ocioso logo depois da carga. O único pacote acima de 600 kB é o núcleo do `three` (675 kB, 171 kB em gzip), que na versão 0.169 é um arquivo só.
- Fontes só nos subconjuntos `latin` e `latin-ext`.

Para medir (carregamento, tarefas longas e quadros ao passar pelos 7 aparelhos, com CPU 1× e 4×):

```bash
npm run build && npm run preview
```

```bash
node tools/perf.mjs http://localhost:4173/ --channel msedge
```

O script precisa do Playwright (`npm i -D playwright`). Sem `--channel`, usa o Chromium do Playwright.

Parâmetros de URL:

| Parâmetro | Efeito |
|---|---|
| `?hq` | mantém reflexo e pós-processamento completos mesmo que o FPS caia |
| `?debug=1` | número de programas de shader e aviso (com trace) de chamadas ao WebGL que esperam a compilação; em `npm run dev`, também FPS, draw calls e triângulos (`r3f-perf`) |
| `?ref=1` | só em `npm run dev`: modo de comparação com a foto (veja abaixo) |

## Comparar com a foto (`?ref=1`)

Coloque as fotos de referência em `ref/` na raiz do projeto: `modulo.jpg`, `sirene.jpg`, `fotossensor.jpg`, `controle.jpg`, `placa.jpg`, `app.jpg` (as oficiais) e `modulo-topo-led-azul.jpg` (o módulo visto de cima). A pasta `ref/` fica fora do git e fora do build. Com `npm run dev`, abra `/?ref=1`: a foto aparece por cima do canvas com um slider de opacidade, e a câmera trava no ângulo da foto. `&r=modulo-topo` escolhe a foto e `&cam=px,py,pz,tx,ty,tz,fov,roll` afina o ângulo sem recompilar. Os ângulos ficam em `src/dev/RefMode.tsx`, uma entrada por foto (fotos reais na mão, fotos de instalação, ícones do sistema); a entrada também pode pôr o modelo no estado da foto (vista explodida, tampa aberta).

**Nada de `ref/` vai para o repositório**, que é público: as fotos mostram pessoas e a casa de um cliente, e os ícones são de um sistema de terceiros (também não viram textura). Confira com `git status` antes de cada commit.

## Onde fica cada coisa

```
src/
  data/     devices.ts (aparelhos, partes, textos, câmeras), ledStates.ts (14 estados),
            actions.ts (micro-animações), inAction.ts (linha do tempo)
  store/    showroomStore.ts
  three/
    devices/  um componente por aparelho
    parts/    ClickablePart.tsx (hover, contorno, clique, esmaecer, explodir), PartCallout.tsx
    fx/       DetectionFan, SoundWaves, RadioPulse, CameraFlash, CommLinks, MagneticField, VoiceWaves, HoldRing
    scenes/   Intro, Showroom, InAction, Outro
    common/   materiais, texturas em canvas, logo, LED, formas
  ui/       PartCard, PartList, Breadcrumb, DeviceDock, ViewToggles, PresenterMode, AppScreen
```

Todo o conteúdo dos cards vem de `src/data/devices.ts`. Para mudar um texto ou o enquadramento de uma parte, edite só esse arquivo.

## Aparência

Render de produto, não desenho: plástico branco levemente quente com variação sutil de rugosidade, cinza fosco, metais, vidro escuro na lente. As texturas (micro-relevo, ruído de rugosidade, lente PIR, placas) são geradas em canvas uma vez, no carregamento. O ambiente de estúdio também é gerado no carregamento (softboxes em `Lightformer`), vai dentro do build e funciona sem internet. Pós: AO leve, bloom só nos LEDs acesos, contorno fino só no hover, ACES. O pedestal é um disco neutro e fosco, com o raio proporcional ao aparelho.

## Trocar os modelos procedurais por `.glb`

Cada aparelho é um componente em `src/three/devices/`, e cada parte clicável é um `<ClickablePart id="...">` com o mesmo `id` que está em `devices.ts`. Para usar um `.glb`, carregue o arquivo no componente do aparelho e envolva cada nó nomeado com o `<ClickablePart>` de mesmo `id`. Hover, zoom, card, Raio-X e vista explodida continuam funcionando sem outras mudanças.

## Partes modeladas

A lista de partes de cada aparelho, com primitivas, proporções e materiais, está em [`docs/MODELAGEM.md`](docs/MODELAGEM.md).

## Pendências a confirmar com a Orsegups

- Destino do QR Code do verso da placa. O que aparece no demo é ilustrativo e não codifica nada.
- Cor do filete lateral do controle: azul na arte oficial, amarelo na foto real. O demo usa o azul.
- Disco central do controle: não é botão. A arte de marketing mostra o logo nele e o ícone do sistema mostra liso; o demo usa o logo em baixo-relevo discreto.
- Sensor magnético: a foto de instalação mostra o corpo na folha da porta e o ímã no batente (o texto antigo dizia o contrário); confirmar no manual. A mesma foto tem um terceiro bloco branco, abaixo do corpo, que não foi modelado.
- Módulo: a ficha de medidas põe a antena a ~85% da largura e ~40% da profundidade (lateral direita); o modelo mantém a cauda e a antena atrás, como na foto oficial. A altura total segue a ficha (38 mm), mas a divisão entre base cinza (27 mm) e tampa é aproximada.
- Sirene: o suporte de parede não tem medida na ficha; foi mantido o da rodada anterior.
