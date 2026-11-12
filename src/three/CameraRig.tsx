import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import type CameraControlsImpl from 'camera-controls'
import { ACTIONS } from '../data/actions'
import { DEVICE_BY_ID, getPart, type Vec3 } from '../data/devices'
import { useShowroom, type Scene } from '../store/showroomStore'
import { reducedMotion } from './common/util'
import { deviceBox, partBox, pedestalRadius } from './common/registry'

type SceneCam = { from?: Vec3; position: Vec3; target: Vec3; portrait?: { from?: Vec3; position: Vec3; target: Vec3 } }
const SCENE_CAM: Record<Exclude<Scene, 'showroom'>, SceneCam> = {
  // em retrato o kit fica em duas fileiras (ver KIT_LAYOUT_PORTRAIT) e a câmera olha um pouco de cima
  intro: { from: [0, 2.6, 15], position: [0, 1.5, 9.2], target: [0, 0.85, 0], portrait: { from: [0, 7, 25], position: [0, 4.6, 19.6], target: [0, 0.7, 0] } },
  outro: { from: [0, 4.5, 13], position: [0, 1.4, 9.2], target: [0, 0.9, 0], portrait: { from: [0, 8, 24], position: [0, 4.6, 19.6], target: [0, 0.7, 0] } },
  network: { position: [0, 3.8, 14.5], target: [0, 1.2, 0] },
  inaction: { position: [0.6, 3.4, 9.6], target: [0, 1.25, -0.6] },
}

// em retrato (celular) as cenas largas recuam o bastante para tudo caber
const PORTRAIT_Z = 3.0
const sceneCam = (scene: Exclude<Scene, 'showroom'>, portrait: boolean) => {
  const sc = SCENE_CAM[scene]
  if (!portrait) return sc
  return sc.portrait ?? { ...sc, position: [sc.position[0], sc.position[1] * 1.3, sc.position[2] * PORTRAIT_Z] as Vec3 }
}
const PART_FILL = 0.62 // a parte ocupa no máximo ~45% da área livre (0,62² ≈ 0,4)
const HOME_FILL = 0.86
const BOX = new THREE.Box3(), DBOX = new THREE.Box3(), SPH = new THREE.Sphere()
const RIGHT = new THREE.Vector3(), UP2 = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3()
const DIR = new THREE.Vector3(), POS = new THREE.Vector3(), TGT = new THREE.Vector3(), SIZE = new THREE.Vector3()

/** Área livre da tela (px): entre a barra de cima, o dock, a lista de partes e o card. */
function freeRect(w: number, h: number, withCard: boolean, listOpen: boolean) {
  const desktop = w >= 768
  const top = desktop ? 150 : 190
  // embaixo ficam o dock e, acima dele, a dica de uso: a área livre termina antes dos dois
  const bottom = desktop ? h - 152 : withCard ? h * 0.46 : h - 146
  const left = desktop && listOpen && w >= 1024 ? 285 : 12
  const right = desktop && withCard ? w - 400 : w - 12
  return { cx: (left + right) / 2, cy: (top + bottom) / 2, w: Math.max(120, right - left), h: Math.max(120, bottom - top) }
}

/**
 * Câmera do demo: órbita livre (arrastar / roda / pinça), voo até a parte selecionada e reset com
 * duplo clique. Não há giro automático: a câmera só gira quando alguém arrasta. O enquadramento é
 * calculado pelo bounding box real da parte (com margem) e centralizado na área livre da tela; na
 * vista inteira o pedestal também entra na conta, para o anel não invadir o dock nem a dica de uso.
 * A câmera nunca fica dentro da caixa do aparelho.
 */
export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const scene = useShowroom((s) => s.scene)
  const device = useShowroom((s) => s.device)
  const part = useShowroom((s) => s.part)
  const view = useShowroom((s) => s.view)
  const actionId = useShowroom((s) => s.action?.id)
  const resetTick = useShowroom((s) => s.resetTick)
  const listOpen = useShowroom((s) => s.listOpen)
  const ready = useShowroom((s) => s.ready)

  const fly = (animate = true) => {
    const c = ref.current
    if (!c) return
    const cam = c.camera as THREE.PerspectiveCamera
    const W = size.width, H = size.height
    const portrait = W / H < 0.8
    const s = useShowroom.getState()
    const anim = animate && !reducedMotion()
    c.smoothTime = 0.32
    if (s.scene !== 'showroom') {
      const sc = sceneCam(s.scene, portrait)
      void c.setFocalOffset(0, 0, 0, anim)
      void c.setLookAt(sc.position[0], sc.position[1], sc.position[2], sc.target[0], sc.target[1], sc.target[2], anim)
      return
    }
    const d = DEVICE_BY_ID[s.device]
    const k = s.view === 'exploded' || s.view === 'manual' ? 1 : 0
    const p = getPart(s.device, s.part)
    const ac = s.action ? ACTIONS[s.action.id].camera : undefined
    const free = freeRect(W, H, !!(p || ac), s.listOpen)
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360)
    const fit = (radius: number, fill: number) => {
      const tv = tanHalf * (free.h / H) * fill, th = tanHalf * (W / H) * (free.w / W) * fill
      return radius / Math.sin(Math.atan(Math.min(tv, th)))
    }
    // distância para a caixa inteira caber na área livre, vista da direção `dir` (projeta os 8 cantos)
    const fitBox = (box: THREE.Box3, center: THREE.Vector3, dir: THREE.Vector3, fill: number) => {
      const tv = tanHalf * (free.h / H) * fill, th = tanHalf * (W / H) * (free.w / W) * fill
      RIGHT.crossVectors(UPV, dir)
      if (RIGHT.lengthSq() < 1e-6) RIGHT.set(1, 0, 0)
      RIGHT.normalize(); UP2.crossVectors(dir, RIGHT)
      let d = 0
      for (let i = 0; i < 8; i++) {
        V.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center)
        d = Math.max(d, V.dot(dir) + Math.max(Math.abs(V.dot(RIGHT)) / th, Math.abs(V.dot(UP2)) / tv))
      }
      return d
    }
    let dist: number
    if (ac) {
      // câmera própria da ação: mantém a direção e garante que a cena da ação caiba na área livre
      TGT.fromArray(ac.target); DIR.fromArray(ac.position).sub(TGT)
      const authored = DIR.length()
      DIR.normalize()
      dist = Math.max(authored, fit(authored * 0.3, 0.9)) * (portrait ? 1.25 : 1)
    } else {
      const box = p ? partBox(s.device, p.id, k, BOX) : null
      deviceBox(s.device, k, DBOX)
      if (p && box) {
        box.getBoundingSphere(SPH)
        TGT.copy(SPH.center)
        DIR.fromArray(p.camera.position).sub(new THREE.Vector3().fromArray(p.camera.target)).normalize()
        dist = Math.max(fitBox(box, TGT, DIR, PART_FILL), SPH.radius * 2.2, 0.85)
      } else if (!DBOX.isEmpty()) {
        DBOX.getCenter(TGT)
        DIR.fromArray(d.home.position).sub(new THREE.Vector3().fromArray(d.home.target)).normalize()
        dist = fitBox(DBOX, TGT, DIR, HOME_FILL)
        // o pedestal (disco sob o aparelho) também precisa caber na área livre
        const r = pedestalRadius(s.device), py = d.bottom - 0.2
        const tv = tanHalf * (free.h / H) * 0.98, th = tanHalf * (W / H) * (free.w / W) * 0.98
        RIGHT.crossVectors(UPV, DIR)
        if (RIGHT.lengthSq() < 1e-6) RIGHT.set(1, 0, 0)
        RIGHT.normalize(); UP2.crossVectors(DIR, RIGHT)
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2
          V.set(Math.cos(a) * r, py, Math.sin(a) * r).sub(TGT)
          dist = Math.max(dist, V.dot(DIR) + Math.max(Math.abs(V.dot(RIGHT)) / th, Math.abs(V.dot(UP2)) / tv))
        }
      } else {
        TGT.fromArray(d.home.target); DIR.fromArray(d.home.position).sub(TGT)
        dist = DIR.length() * 1.45; DIR.normalize()
      }
      // a câmera nunca fica dentro da geometria: se cair dentro da caixa do aparelho, recua até sair
      if (!DBOX.isEmpty()) {
        DBOX.getSize(SIZE)
        DBOX.expandByScalar(0.12)
        for (let i = 0; i < 40 && DBOX.containsPoint(POS.copy(TGT).addScaledVector(DIR, dist)); i++) dist += 0.12
      }
    }
    POS.copy(TGT).addScaledVector(DIR, dist)
    // centraliza o alvo na área livre: desloca a câmera lateralmente (em unidades de mundo na distância do alvo)
    const pxToWorld = (dist * tanHalf) / (H / 2)
    const fx = -(free.cx - W / 2) * pxToWorld, fy = (free.cy - H / 2) * pxToWorld
    void c.setFocalOffset(fx, fy, 0, anim)
    void c.setLookAt(POS.x, POS.y, POS.z, TGT.x, TGT.y, TGT.z, anim)
  }

  // troca de cena: posiciona longe e faz o dolly-in
  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (scene !== 'showroom') {
      const sc = sceneCam(scene, size.width / size.height < 0.8)
      if (sc.from && !reducedMotion()) {
        void c.setFocalOffset(0, 0, 0, false)
        void c.setLookAt(sc.from[0], sc.from[1], sc.from[2], sc.target[0], sc.target[1], sc.target[2], false)
        c.smoothTime = 1.1
        void c.setLookAt(sc.position[0], sc.position[1], sc.position[2], sc.target[0], sc.target[1], sc.target[2], true)
        return
      }
    }
    fly()
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fly() }, [device, part, view, actionId, resetTick, listOpen, ready, size.width, size.height]) // eslint-disable-line react-hooks/exhaustive-deps

  // duplo clique: reset da vista
  useEffect(() => {
    const el = gl.domElement.parentElement?.parentElement ?? gl.domElement
    const dbl = () => fly()
    el.addEventListener('dblclick', dbl)
    return () => el.removeEventListener('dblclick', dbl)
  }, [gl]) // eslint-disable-line react-hooks/exhaustive-deps

  return <CameraControls ref={ref} makeDefault minDistance={0.8} maxDistance={scene === 'showroom' ? 14 : 30} dollySpeed={0.6} smoothTime={0.32} draggingSmoothTime={0.12} />
}
