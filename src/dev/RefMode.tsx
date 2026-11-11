import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { DEVICES, type DeviceId, type Vec3 } from '../data/devices'
import { useShowroom } from '../store/showroomStore'

/**
 * Modo de comparação, só em desenvolvimento: `npm run dev` e abrir com `?ref=1`.
 * Põe a foto de referência do aparelho por cima do canvas (com slider de opacidade) e trava a
 * câmera no ângulo da foto. As fotos ficam em `ref/<id>.jpg`, na raiz do projeto, fora do git e
 * fora do build. Parâmetros opcionais: `&op=0.5` (opacidade), `&d=sirene` (aparelho) e
 * `&cam=px,py,pz,tx,ty,tz,fov,roll` (para afinar o ângulo sem recompilar).
 */
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
export const REF_ON = import.meta.env.DEV && Q.has('ref')

type Ref = { position: Vec3; target: Vec3; fov: number; roll: number }
export const REFS: Partial<Record<DeviceId, Ref>> = {
  modulo: { position: [-5.14, 3.28, 1.03], target: [-0.14, -0.2, -0.27], fov: 28, roll: -0.7 },
  sirene: { position: [-1.1, 2.9, 3.9], target: [0, -0.05, 0], fov: 33, roll: 0 },
  fotossensor: { position: [0, 0.35, 7.2], target: [0, 0, 0], fov: 25, roll: 0 },
  controle: { position: [-0.9, 0.25, 5.6], target: [0, -0.22, 0], fov: 37, roll: 0.1 },
  placa: { position: [0, 0, 6.6], target: [0, 0, 0], fov: 18, roll: 0 },
  app: { position: [0, 0, 6.4], target: [0, 0, 0], fov: 25, roll: 0 },
}

function refFor(device: DeviceId): Ref | undefined {
  const o = Q.get('cam')?.split(',').map(Number)
  if (o && o.length >= 7 && o.every((n) => !Number.isNaN(n))) return { position: [o[0], o[1], o[2]], target: [o[3], o[4], o[5]], fov: o[6], roll: o[7] ?? 0 }
  return REFS[device]
}

const F = new THREE.Vector3(), R = new THREE.Vector3(), U = new THREE.Vector3(), T = new THREE.Vector3()

/** Dentro do Canvas: trava a câmera no ângulo da foto (posição, alvo, fov e rolagem). */
export function RefCamera() {
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  useEffect(() => {
    const s = useShowroom.getState()
    const d = Q.get('d') as DeviceId | null
    if (d && DEVICES.some((x) => x.id === d)) s.setDevice(d)
    else if (s.scene !== 'showroom') s.setScene('showroom')
    s.set({ listOpen: false })
  }, [])
  useFrame(({ camera }) => {
    const r = refFor(useShowroom.getState().device)
    if (!r) return
    if (controls) controls.enabled = false
    const cam = camera as THREE.PerspectiveCamera
    cam.position.fromArray(r.position)
    T.fromArray(r.target)
    F.subVectors(T, cam.position).normalize()
    R.crossVectors(F, U.set(0, 1, 0)).normalize()
    U.crossVectors(R, F)
    cam.up.copy(U).multiplyScalar(Math.cos(r.roll)).addScaledVector(R, Math.sin(r.roll))
    cam.lookAt(T)
    if (cam.fov !== r.fov) { cam.fov = r.fov; cam.updateProjectionMatrix() }
  }, 1)
  return null
}

/** Por cima do canvas: a foto (altura = altura da tela, centrada), o slider e a troca de aparelho. */
export function RefOverlay() {
  const device = useShowroom((s) => s.device)
  const [op, setOp] = useState(Number(Q.get('op') ?? 0.5))
  const has = !!REFS[device]
  return (
    <>
      {has && <img src={`/ref/${device}.jpg`} alt="" className="pointer-events-none fixed left-1/2 top-0 z-40 h-full -translate-x-1/2" style={{ opacity: op, mixBlendMode: 'normal' }} />}
      <div className="glass fixed bottom-3 left-3 z-50 flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-white">
        <b>?ref</b>
        {DEVICES.map((d) => (
          <button key={d.id} className={`rounded px-1.5 py-0.5 ${d.id === device ? 'bg-brand-light' : 'bg-white/10'} ${REFS[d.id] ? '' : 'opacity-40'}`} onClick={() => useShowroom.getState().setDevice(d.id)}>{d.short}</button>
        ))}
        <input type="range" min={0} max={1} step={0.05} value={op} onChange={(e) => setOp(Number(e.target.value))} aria-label="Opacidade da foto" />
        <span>{Math.round(op * 100)}%{has ? '' : ' · sem foto oficial deste aparelho'}</span>
      </div>
    </>
  )
}
