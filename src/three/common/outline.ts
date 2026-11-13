import type * as THREE from 'three'
import type { OutlineEffect } from 'postprocessing'
import { useShowroom } from '../../store/showroomStore'

// Contorno do hover, controlado direto no efeito (sem estado do React). Antes, cada parte era um <Select> de
// @react-three/postprocessing: mudar o hover atualizava um contexto, e o React re-renderizava as centenas de
// partes dos 7 aparelhos a cada passada do mouse, o que dava picos de 20 a 40 ms. Aqui o hover só troca a lista
// de malhas do efeito.

let effect: OutlineEffect | null = null
let hovered: THREE.Object3D[] = []
/** Malhas de todas as partes clicáveis: no aquecimento da carga ficam todas contornadas por dois quadros. */
const warmSet = new Set<THREE.Object3D>()

function apply() {
  if (!effect) return
  const list = useShowroom.getState().warm ? [...warmSet] : hovered
  effect.selection.set(list)
}

/** Liga o efeito de contorno (ref do <Outline>). Reaplica depois que o próprio <Outline> zera a seleção ao montar. */
export function bindOutline(e: OutlineEffect | null) {
  effect = e
  if (e) requestAnimationFrame(apply)
}

/** Malhas de um grupo (para contornar a parte inteira). */
export function meshesOf(root: THREE.Object3D) {
  const out: THREE.Object3D[] = []
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.fx) out.push(o) })
  return out
}

/** Contorna estas malhas (hover). Lista vazia apaga o contorno. */
export function setOutline(objs: THREE.Object3D[]) {
  hovered = objs
  apply()
}
/** Apaga o contorno, se ele for destas malhas (a saída de uma parte não apaga o contorno da que acabou de entrar). */
export function clearOutline(objs: THREE.Object3D[]) {
  if (hovered === objs || (hovered.length && hovered[0] === objs[0])) setOutline([])
}

/** Registra as malhas de uma parte clicável para o aquecimento; devolve a função que tira o registro. */
export function registerWarm(objs: THREE.Object3D[]) {
  objs.forEach((o) => warmSet.add(o))
  return () => objs.forEach((o) => warmSet.delete(o))
}

// quando o aquecimento termina, volta ao contorno do hover (vazio)
useShowroom.subscribe((s, prev) => { if (s.warm !== prev.warm) apply() })
