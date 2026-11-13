# Arquivado

Código tirado do demo, guardado para consulta. Esta pasta fica fora de `src/` e fora do build.

## `network/`: cena "Sistema conectado"

A cena mostrava o kit inteiro com os enlaces de rádio até o Módulo e as três vias até a nuvem. Saiu da
navegação (abas, seletor do celular, Tour, atalhos e modo apresentação). A sequência do demo ficou
**Showroom → Em ação → Encerramento**.

- `Network.tsx`: a cena 3D (ficava em `src/three/scenes/Network.tsx`).
- `NetworkUI.tsx`: o texto da camada 2D (ficava em `src/ui/Overlays.tsx`).

Os efeitos que ela usava (`RadioPulse`, `CommLinks`) continuam em `src/three/fx/`, porque outras partes do
demo também usam.

### Para restaurar

O último commit com a cena funcionando é `e6b8099`:

```bash
git show e6b8099:src/three/scenes/Network.tsx > src/three/scenes/Network.tsx
```

Depois, recoloque: o item `network` em `SCENES` e o `<NetworkUI />` em `src/ui/Overlays.tsx`; o `case 'network'`
em `src/App.tsx`; a câmera `network` em `SCENE_CAM` (`src/three/CameraRig.tsx`); e `'network'` no tipo `Scene`
(`src/store/showroomStore.ts`). O diff desse commit para o seguinte mostra cada trecho.
