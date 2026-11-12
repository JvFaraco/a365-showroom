import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { ActionId, DeviceId, Vec3 } from '../data/devices'
import { useShowroom, type Scene, type View } from '../store/showroomStore'

/**
 * Modo de comparação, só em desenvolvimento: `npm run dev` e abrir com `?ref=1`.
 * Põe a foto de referência do aparelho por cima do canvas (com slider de opacidade) e trava a
 * câmera no ângulo da foto. As fotos ficam em `ref/<id>.jpg`, na raiz do projeto, fora do git e
 * fora do build. Parâmetros opcionais: `&op=0.5` (opacidade), `&r=modulo-topo` (qual foto) e
 * `&cam=px,py,pz,tx,ty,tz,fov,roll` (para afinar o ângulo sem recompilar).
 */
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
export const REF_ON = import.meta.env.DEV && Q.has('ref')

type Ref = {
  id: string; label: string; device: DeviceId; file: string; position: Vec3; target: Vec3; fov: number; roll: number
  view?: View // estado do modelo que corresponde à foto (ex.: explodido, para as fotos das placas)
  action?: ActionId // micro-animação que deixa o aparelho como na foto (ex.: tampa das pilhas aberta)
  scene?: Scene // foto do kit inteiro: usa a cena de abertura
  note?: string // o que a foto mostra / limite da comparação
}
/** Uma entrada por foto. Um aparelho pode ter mais de uma (o módulo tem a oficial e a vista de cima). */
export const REFS: Ref[] = [
  { id: 'modulo', label: 'Módulo', device: 'modulo', file: 'modulo.jpg', position: [-5.14, 3.28, 1.03], target: [-0.02, -0.02, -0.2], fov: 31, roll: -0.7 },
  { id: 'modulo-topo', label: 'Módulo (de cima)', device: 'modulo', file: 'modulo-topo-led-azul.jpg', position: [1.6, 6.6, 3.4], target: [0.1, 0, -0.1], fov: 24, roll: -1.9 },
  { id: 'fotossensor', label: 'Fotossensor', device: 'fotossensor', file: 'fotossensor.jpg', position: [0, 0, 5.6], target: [0, 0, 0], fov: 25, roll: 0 },
  { id: 'sirene', label: 'Sirene', device: 'sirene', file: 'sirene.jpg', position: [-1.1, 2.9, 3.9], target: [0, -0.05, 0], fov: 33, roll: 0 },
  { id: 'controle', label: 'Controle', device: 'controle', file: 'controle.jpg', position: [-0.9, 0.25, 5.6], target: [0, -0.22, 0], fov: 37, roll: 0.1 },
  { id: 'placa', label: 'Placa', device: 'placa', file: 'placa.jpg', position: [0, 0, 6.35], target: [0, 0, 0], fov: 18, roll: 0 },
  // fotos reais (rodada "fidelidade"): aparelho na mão, celular a ~25 cm, lente grande-angular
  { id: 'fotossensor-frente', label: 'Foto: frente', device: 'fotossensor', file: 'fotossensor-frente.jpg', position: [0.03, 0.4, 2.72], target: [0, -0.14, 0], fov: 62, roll: 0 },
  { id: 'fotossensor-perfil', label: 'Perfil', device: 'fotossensor', file: 'fotossensor-frente.jpg', position: [5.6, 0, 0], target: [0, -0.15, 0], fov: 25, roll: 0, note: 'não há foto de perfil: serve para conferir que a janela PIR fica atrás da linha do corpo (use opacidade 0)' },
  { id: 'fotossensor-icone', label: 'Ícone', device: 'fotossensor', file: 'icones/device-photo-sensor.png', position: [0, 0.5, 5.4], target: [0, -0.15, 0], fov: 25, roll: 0 },
  { id: 'fotossensor-tras', label: 'Foto: trás', device: 'fotossensor', file: 'fotossensor-tras.jpg', position: [0.1, 0.4, -2.7], target: [0.1, -0.17, 0], fov: 62, roll: 0 },
  { id: 'fotossensor-aberto', label: 'Foto: pilhas', device: 'fotossensor', file: 'fotossensor-aberto.jpg', position: [0, 0.65, -2.25], target: [0, -0.3, 0], fov: 62, roll: 0, action: 'tampa-foto' },
  { id: 'pilhas', label: 'Foto: tampa ao lado', device: 'fotossensor', file: 'pilhas.jpg', position: [-0.42, 0.75, -2.5], target: [-0.42, -0.1, 0], fov: 62, roll: 0, action: 'tampa-foto' },
  // colagens de quadros de vídeo: não há um ângulo único; a câmera fica no ângulo dos quadros principais
  { id: 'controle-tampa', label: 'Controle: tampa', device: 'controle', file: 'controle-tampa.jpg', position: [0.3, 0.4, -5.4], target: [0, -0.1, 0], fov: 37, roll: 0, note: 'colagem de 8 quadros (abrindo a tampa da bateria)' },
  { id: 'modulo-fundo-montagem', label: 'Módulo: fundo', device: 'modulo', file: 'modulo-fundo-montagem.jpg', position: [0.2, -5.2, -1.2], target: [0, -0.3, -0.2], fov: 31, roll: 0, note: 'colagem de 8 quadros (montagem; bolsão do fundo nos quadros de baixo)' },
  // placas soltas: comparar com a vista explodida
  { id: 'placa-a', label: 'Placa: magnético', device: 'magnetico', file: 'placa-a.jpg', position: [0, 0, 6], target: [0, 0, 0], fov: 30, roll: Math.PI / 2, view: 'exploded', note: 'placa do sensor magnético, deitada na foto' },
  { id: 'placa-b', label: 'Placa: controle', device: 'controle', file: 'placa-b.jpg', position: [0, 0, 5.6], target: [0, 0, 0], fov: 37, roll: 0, view: 'exploded', note: 'placa redonda do controle com a antena de fio' },
  { id: 'placa-c', label: 'Placa: sirene', device: 'sirene', file: 'placa-c.jpg', position: [0, 0.4, -5.2], target: [0, 0, 0], fov: 33, roll: 0, view: 'exploded', note: 'placa da sirene com o elemento sonoro' },
  { id: 'kit', label: 'Kit', device: 'modulo', file: 'kit.jpg', position: [0, 1.2, 8.4], target: [0, 0.85, 0], fov: 35, roll: 0, scene: 'intro', note: 'foto oficial do kit (cena de abertura)' },
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

/** Deixa o modelo no estado que a foto mostra (aparelho, vista e, se houver, a micro-animação). */
function apply(r: Ref) {
  const s = useShowroom.getState()
  if (r.scene && r.scene !== 'showroom') { s.setScene(r.scene); return }
  s.setDevice(r.device)
  if (r.view) s.setView(r.view)
  if (r.action) s.startAction(r.action)
}

/** Dentro do Canvas: trava a câmera no ângulo da foto (posição, alvo, fov e rolagem). */
export function RefCamera() {
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  useEffect(() => {
    apply(active.ref)
    useShowroom.getState().set({ listOpen: false })
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
  const pick = (r: Ref) => { active.ref = r; setId(r.id); apply(r) }
  return (
    <>
      <img src={`/ref/${active.ref.file}`} alt="" className="pointer-events-none fixed left-1/2 top-0 z-40 h-full -translate-x-1/2" style={{ opacity: op }} />
      <div className="glass fixed bottom-3 left-3 z-50 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs text-white">
        <b>?ref</b>
        {REFS.map((r) => (
          <button key={r.id} className={`rounded px-1.5 py-0.5 ${r.id === id ? 'bg-brand-light' : 'bg-white/10'}`} onClick={() => pick(r)}>{r.label}</button>
        ))}
        <input type="range" min={0} max={1} step={0.05} value={op} onChange={(e) => setOp(Number(e.target.value))} aria-label="Opacidade da foto" />
        <span>{Math.round(op * 100)}%{active.ref.note ? ` · ${active.ref.note}` : ''} · sensor magnético: sem foto externa</span>
      </div>
    </>
  )
}
