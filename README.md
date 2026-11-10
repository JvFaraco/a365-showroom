# Alarme 365 · Showroom 3D

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

`?hq` na URL mantém o reflexo e o pós-processamento completos mesmo que o FPS caia.

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

- Modelo da bateria do controle remoto.
- Destino do QR Code do verso da placa. O que aparece no demo é ilustrativo e não codifica nada.
- Botão 190 do Módulo: o demo mostra o LED como o cristal na face, perto da borda da frente, e o botão como o ponto no centro desse cristal. Falta confirmar se o botão é só o ponto central ou o cristal inteiro.
