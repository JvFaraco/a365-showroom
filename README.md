# Alarme 365 · Showroom 3D

> **Licença:** esta pasta não está sob a licença MIT da raiz do repositório. Todos os direitos reservados. "Orsegups", "Alarme 365", o logo e o telefone são marcas e informações da Orsegups, usados só para apresentação. Veja [`LICENSE.md`](LICENSE.md).

Apresentação interativa em 3D dos 7 equipamentos do Alarme 365 (Orsegups). O público gira cada aparelho, clica numa parte, a câmera voa até ela e abre um card curto explicando o que é e para que serve.

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build estático em dist/
npm run preview  # serve o build
```

Stack: Vite, React 18, TypeScript, three.js com @react-three/fiber, drei e postprocessing, zustand, framer-motion, maath e Tailwind. As fontes Poppins e Encode Sans vão empacotadas (via `@fontsource`), então o demo roda sem internet.

## Como usar

| Ação | Mouse / toque | Teclado |
|---|---|---|
| Girar, aproximar | arrastar, roda ou pinça | |
| Resetar a vista | duplo clique | `R` reseta tudo |
| Ver uma parte | clicar nela, num pino do Modo Manual ou na lista "Partes" | `→` / `espaço` próxima, `←` anterior |
| Voltar à vista inteira | botão Voltar | `ESC` |
| Trocar de aparelho | faixa inferior | `1` a `7` |
| Explodir, Raio-X, Manual, Tour | botões no topo | `E`, `X`, `M`, `T` |
| Modo apresentação (tela cheia, textos maiores) | botão no canto | `P` |

No modo apresentação, `→` (ou o clicker, que envia PageDown) segue para o próximo aparelho quando as partes acabam. Sem ele, as setas dão a volta nas partes do mesmo aparelho.

As micro-animações que abrem ou tiram algo (tampa do fotossensor, tampa do controle, bateria da sirene, sirene fora do suporte) ficam abertas até o botão de desfazer do card ("Fechar", "Recolocar", "Encaixar"), que volta pelo mesmo caminho.

## Fluidez

- Os 7 aparelhos do showroom ficam montados o tempo todo. Trocar de aparelho só muda `visible` e anima a posição.
- Atrás da tela de carregamento há um aquecimento: tudo fica visível por alguns frames, o contorno do hover e a sombra de contato são exercitados e `gl.compile` fecha os shaders. Depois disso, nenhum clique, zoom, Raio-X ou micro-animação compila shader novo.
- O que muda a cada frame (anel de 5 s, linha do tempo, etiqueta do hover) corre em refs e direto no DOM, fora do estado do React.
- Qualidade adaptativa: quando o FPS cai, primeiro o DPR vai a 1; depois sai o AO; por último saem o reflexo do piso, a vinheta e o SMAA.
- Sombra de contato assada uma vez por aparelho; AO em meia resolução; bloom só nos emissivos; sem DOF.

Parâmetros de URL:

| Parâmetro | Efeito |
|---|---|
| `?hq` | mantém reflexo e pós-processamento completos mesmo que o FPS caia |
| `?debug=1` | só em `npm run dev`: FPS, draw calls e triângulos (`r3f-perf`) |
| `?ref=1` | só em `npm run dev`: modo de comparação com a foto (veja abaixo) |

## Comparar com a foto (`?ref=1`)

Coloque as fotos de referência em `ref/<id>.jpg` na raiz desta pasta (`modulo`, `sirene`, `fotossensor`, `controle`, `placa`, `app`). A pasta `ref/` fica fora do git e fora do build. Com `npm run dev`, abra `/?ref=1`: a foto aparece por cima do canvas com um slider de opacidade, e a câmera trava no ângulo da foto. `&d=sirene` escolhe o aparelho e `&cam=px,py,pz,tx,ty,tz,fov,roll` afina o ângulo sem recompilar. Os ângulos ficam em `src/dev/RefMode.tsx`.

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
    scenes/   Intro, Showroom, Network, InAction, Outro
    common/   materiais, texturas em canvas, logo, LED, formas
  ui/       PartCard, PartList, Breadcrumb, DeviceDock, ViewToggles, PresenterMode, AppScreen
```

Todo o conteúdo dos cards vem de `src/data/devices.ts`. Para mudar um texto ou o enquadramento de uma parte, edite só esse arquivo.

## Trocar os modelos procedurais por `.glb`

Cada aparelho é um componente em `src/three/devices/`, e cada parte clicável é um `<ClickablePart id="...">` com o mesmo `id` que está em `devices.ts`. Para usar um `.glb`, carregue o arquivo no componente do aparelho e envolva cada nó nomeado com o `<ClickablePart>` de mesmo `id`. Hover, zoom, card, Raio-X e vista explodida continuam funcionando sem outras mudanças.

## Partes modeladas

A lista de partes de cada aparelho, com primitivas, proporções e materiais, está em [`docs/MODELAGEM.md`](docs/MODELAGEM.md).

## Pendências a confirmar com a Orsegups

- Destino do QR Code do verso da placa. O que aparece no demo é ilustrativo e não codifica nada.
- Cor do filete lateral do controle: azul na arte oficial, amarelo na foto real. O demo usa o azul.
- "Aletas de ventilação": o card continua dizendo que elas refrigeram a eletrônica, mas as fotos mostram que não há ventoinha.
