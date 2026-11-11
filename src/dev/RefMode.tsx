import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { DeviceId, Vec3 } from '../data/devices'
import { useShowroom } from '../store/showroomStore'

/**
 * Modo de comparação, só em desenvolvimento: `npm run dev` e abrir com `?ref=1`.
 * Põe a foto de referência do aparelho por cima do canvas (com slider de opacidade) e trava a
 * câmera no ângulo da foto. As fotos ficam em `ref/<id>.jpg`, na raiz do projeto, fora do git e
 * fora do build. Parâmetros opcionais: `&op=0.5` (opacidade), `&r=modulo-topo` (qual foto) e
 * `&cam=px,py,pz,tx,ty,tz,fov,roll` (para afinar o ângulo sem recompilar).
 */
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
export const REF_ON = import.meta.env.DEV && Q.has('ref')

type Ref = { id: string; label: string; device: DeviceId; file: string; position: Vec3; target: Vec3; fov: number; roll: number }
/** Uma entrada por foto. Um aparelho pode ter mais de uma (o módulo tem a oficial e a vista de cima). */
export const REFS: Ref[] = [
  { id: 'modulo', label: 'Módulo', device: 'modulo', file: 'modulo.jpg', position: [-5.14, 3.28, 1.03], target: [-0.02, -0.02, -0.2], fov: 31, roll: -0.7 },
  { id: 'modulo-topo', label: 'Módulo (de cima)', device: 'modulo', file: 'modulo-topo-led-azul.jpg', position: [1.6, 6.6, 3.4], target: [0.1, 0, -0.1], fov: 24, roll: -1.9 },
  { id: 'fotossensor', label: 'Fotossensor', device: 'fotossensor', file: 'fotossensor.jpg', position: [0, 0, 5.6], target: [0, 0, 0], fov: 25, roll: 0 },
  { id: 'sirene', label: 'Sirene', device: 'sirene', file: 'sirene.jpg', position: [-1.1, 2.9, 3.9], target: [0, -0.05, 0], fov: 33, roll: 0 },
  { id: 'controle', label: 'Controle', device: 'controle', file: 'controle.jpg', position: [-0.9, 0.25, 5.6], target: [0, -0.22, 0], fov: 37, roll: 0.1 },
  { id: 'placa', label: 'Placa', device: 'placa', file: 'placa.jpg', position: [0, 0, 6.35], target: [0, 0, 0], fov: 18, roll: 0 },
  { id: 'app', label: 'App', device: 'app', file: 'app.jpg', position: [0, 0.02, 4.95], target: [0, 0.02, 0], fov: 25, roll: 0 },
]

function parseCam(r: Ref): Ref {
  const o = Q.get('cam')?.split(',').map(Number)
  if (o && o.length >= 7 && o.every((n) => !Number.isNaN(n))) return { ...r, position: [o[0], o[1], o[2]], target: [o[3], o[4], o[5]], fov: o[6], roll: o[7] ?? 0 }
  return r
}
/** Foto ativa (fora do React para a câmera ler em useFrame). */
const active: { ref: Ref } = { ref: parseCam(REFS.find((r) => r.id === (Q.get('r') ?? Q.get('d'))) ?? REFS[0]) }

const F = new THREE.Vector3(), R = new THREE.Vector3(), U = new THREE.Vector3(), T = new THREE.Vector3()

/** Dentro do Canvas: trava a câmera no ângulo da foto (posição, alvo, fov e rolagem). */
export function RefCamera() {
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  useEffect(() => {
    const s = useShowroom.getState()
    s.setDevice(active.ref.device)
    s.set({ listOpen: false })
  }, [])
  useFrame(({ camera }) => {
    const r = active.ref
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

/** Por cima do canvas: a foto (altura = altura da tela, centrada), o slider e a troca de foto. */
export function RefOverlay() {
  const [id, setId] = useState(active.ref.id)
  const [op, setOp] = useState(Number(Q.get('op') ?? 0.5))
  const pick = (r: Ref) => { active.ref = r; setId(r.id); useShowroom.getState().setDevice(r.device) }
  return (
    <>
      <img src={`/ref/${active.ref.file}`} alt="" className="pointer-events-none fixed left-1/2 top-0 z-40 h-full -translate-x-1/2" style={{ opacity: op }} />
      <div className="glass fixed bottom-3 left-3 z-50 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs text-white">
        <b>?ref</b>
        {REFS.map((r) => (
          <button key={r.id} className={`rounded px-1.5 py-0.5 ${r.id === id ? 'bg-brand-light' : 'bg-white/10'}`} onClick={() => pick(r)}>{r.label}</button>
        ))}
        <input type="range" min={0} max={1} step={0.05} value={op} onChange={(e) => setOp(Number(e.target.value))} aria-label="Opacidade da foto" />
        <span>{Math.round(op * 100)}% · sensor magnético: sem foto oficial</span>
      </div>
    </>
  )
}
