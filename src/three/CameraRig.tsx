import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import type CameraControlsImpl from 'camera-controls'
import { ACTIONS } from '../data/actions'
import { DEVICE_BY_ID, getPart, type Vec3 } from '../data/devices'
import { now, useShowroom, type Scene } from '../store/showroomStore'
import { reducedMotion } from './common/util'

const SCENE_CAM: Record<Exclude<Scene, 'showroom'>, { from?: Vec3; position: Vec3; target: Vec3 }> = {
  intro: { from: [0, 2.6, 15], position: [0, 1.5, 9.2], target: [0, 0.85, 0] },
  outro: { from: [0, 4.5, 13], position: [0, 1.4, 9.2], target: [0, 0.9, 0] },
  network: { position: [0, 3.8, 14.5], target: [0, 1.2, 0] },
  inaction: { position: [0.6, 3.4, 9.6], target: [0, 1.25, -0.6] },
}

/**
 * Câmera do demo: órbita livre (arrastar / roda / pinça), voo até a parte selecionada
 * (CameraControls.setLookAt), reset com duplo clique e auto-rotate depois de 4 s ocioso.
 */
export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const lastInput = useRef(now())
  const scene = useShowroom((s) => s.scene)
  const device = useShowroom((s) => s.device)
  const part = useShowroom((s) => s.part)
  const view = useShowroom((s) => s.view)
  const actionId = useShowroom((s) => s.action?.id)
  const resetTick = useShowroom((s) => s.resetTick)

  const fly = (animate = true) => {
    const c = ref.current
    if (!c) return
    const portrait = size.width / size.height < 0.8
    const s = useShowroom.getState()
    let pos: Vec3, tgt: Vec3
    let fx = 0, fy = 0
    if (s.scene !== 'showroom') {
      const sc = SCENE_CAM[s.scene]
      pos = sc.position; tgt = sc.target
      if (portrait) pos = [pos[0], pos[1] * 1.3, pos[2] * 2.1]
    } else {
      const d = DEVICE_BY_ID[s.device]
      const k = s.view === 'exploded' || s.view === 'manual' ? 1 : 0
      const p = getPart(s.device, s.part)
      const ac = s.action ? ACTIONS[s.action.id].camera : undefined
      let pull = 1
      if (ac) { pos = ac.position; tgt = ac.target; pull = portrait ? 1.5 : 1 }
      else if (p) {
        const e = p.explode ?? [0, 0, 0]
        pos = [p.camera.position[0] + e[0] * k, p.camera.position[1] + e[1] * k, p.camera.position[2] + e[2] * k]
        tgt = [p.camera.target[0] + e[0] * k, p.camera.target[1] + e[1] * k, p.camera.target[2] + e[2] * k]
        pull = portrait ? 2.1 : 1
      } else { pos = d.home.position; tgt = d.home.target; pull = 1.45 * (k ? 1.6 : 1) * (portrait ? 1.7 : 1) }
      pos = [tgt[0] + (pos[0] - tgt[0]) * pull, tgt[1] + (pos[1] - tgt[1]) * pull, tgt[2] + (pos[2] - tgt[2]) * pull]
      // abre espaço para o card: à direita no desktop, embaixo no celular
      if (p || ac) {
        const dist = Math.hypot(pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2])
        if (size.width >= 768) fx = dist * 0.09
        else fy = -dist * 0.12
      }
    }
    const anim = animate && !reducedMotion()
    c.smoothTime = 0.32
    void c.setFocalOffset(fx, fy, 0, anim)
    void c.setLookAt(pos[0], pos[1], pos[2], tgt[0], tgt[1], tgt[2], anim)
  }

  // troca de cena: posiciona longe e faz o dolly-in
  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (scene !== 'showroom') {
      const sc = SCENE_CAM[scene]
      if (sc.from && !reducedMotion()) {
        void c.setLookAt(sc.from[0], sc.from[1], sc.from[2], sc.target[0], sc.target[1], sc.target[2], false)
        c.smoothTime = 1.1
        const portrait = size.width / size.height < 0.8
        const p = portrait ? [sc.position[0], sc.position[1] * 1.3, sc.position[2] * 2.1] : sc.position
        void c.setLookAt(p[0], p[1], p[2], sc.target[0], sc.target[1], sc.target[2], true)
        return
      }
    }
    fly()
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fly() }, [device, part, view, actionId, resetTick, size.width, size.height]) // eslint-disable-line react-hooks/exhaustive-deps

  // duplo clique: reset da vista; qualquer entrada zera o relógio do auto-rotate
  useEffect(() => {
    const el = gl.domElement.parentElement?.parentElement ?? gl.domElement
    const touch = () => { lastInput.current = now() }
    const dbl = () => { touch(); fly() }
    el.addEventListener('dblclick', dbl)
    el.addEventListener('pointerdown', touch)
    el.addEventListener('pointermove', touch)
    el.addEventListener('wheel', touch, { passive: true })
    window.addEventListener('keydown', touch)
    return () => {
      el.removeEventListener('dblclick', dbl); el.removeEventListener('pointerdown', touch)
      el.removeEventListener('pointermove', touch); el.removeEventListener('wheel', touch); window.removeEventListener('keydown', touch)
    }
  }, [gl]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const c = ref.current
    if (!c) return
    const s = useShowroom.getState()
    const idle = now() - lastInput.current > 4
    const spin = s.scene === 'showroom' ? !s.part && !s.action && idle : (s.scene === 'intro' || s.scene === 'outro') && false
    if (spin && !reducedMotion()) void c.rotate(dt * 0.22, 0, false)
  })

  return <CameraControls ref={ref} makeDefault minDistance={0.9} maxDistance={scene === 'showroom' ? 11 : 26} dollySpeed={0.6} smoothTime={0.32} draggingSmoothTime={0.12} />
}
