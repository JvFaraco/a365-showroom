import * as THREE from 'three'
import { DEVICE_BY_ID, type DeviceId, type Vec3 } from '../../data/devices'

// Registro das partes montadas no showroom, para calcular o enquadramento da câmera
// a partir do bounding box real de cada parte (e não de coordenadas fixas).

type Entry = { group: THREE.Object3D; id?: string; explode?: Vec3; internal: boolean }
const entries: Partial<Record<DeviceId, Entry[]>> = {}
/** Grupo-raiz de cada aparelho do showroom (em repouso, coincide com o mundo). */
export const deviceRoots: Partial<Record<DeviceId, THREE.Object3D>> = {}

export function registerPart(device: DeviceId, e: Entry) {
  ;(entries[device] ??= []).push(e)
  cache.clear()
  return () => {
    const list = entries[device]
    if (list) list.splice(list.indexOf(e), 1)
    cache.clear()
  }
}

const cache = new Map<string, THREE.Box3>()
const M4 = new THREE.Matrix4(), INV = new THREE.Matrix4(), B = new THREE.Box3()

/** Caixa de uma parte em coordenadas do aparelho, na posição de repouso (não explodida). */
function restBox(device: DeviceId, e: Entry, key: string): THREE.Box3 {
  const hit = cache.get(key)
  if (hit) return hit
  const root = deviceRoots[device]
  const box = new THREE.Box3()
  if (root) {
    root.updateWorldMatrix(true, true)
    INV.copy(root.matrixWorld).invert()
    e.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || m.userData.fx || !m.geometry) return
      const inst = m as unknown as THREE.InstancedMesh
      if (inst.isInstancedMesh) { if (!inst.boundingBox) inst.computeBoundingBox(); B.copy(inst.boundingBox!) }
      else { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); B.copy(m.geometry.boundingBox!) }
      box.union(B.applyMatrix4(M4.multiplyMatrices(INV, m.matrixWorld)))
    })
    // desfaz o deslocamento atual da vista explodida
    if (!box.isEmpty()) box.translate(e.group.position.clone().negate())
  }
  if (!box.isEmpty()) cache.set(key, box)
  return box
}

const OUT = new THREE.Box3()
/** Caixa de uma parte com a vista explodida em k (0..1). */
export function partBox(device: DeviceId, partId: string, k = 0, out = OUT): THREE.Box3 | null {
  const list = entries[device]
  const i = list ? list.findIndex((e) => e.id === partId) : -1
  if (!list || i < 0) return null
  const e = list[i]
  out.copy(restBox(device, e, `${device}:${i}`))
  if (out.isEmpty()) return null
  if (e.explode && k) out.translate(new THREE.Vector3(...e.explode).multiplyScalar(k))
  return out
}

/** Caixa do aparelho inteiro com a vista explodida em k. */
export function deviceBox(device: DeviceId, k = 0, out = new THREE.Box3()): THREE.Box3 {
  out.makeEmpty()
  const list = entries[device] ?? []
  const T = new THREE.Box3(), V = new THREE.Vector3()
  list.forEach((e, i) => {
    T.copy(restBox(device, e, `${device}:${i}`))
    if (T.isEmpty()) return
    if (e.explode && k) T.translate(V.set(...e.explode).multiplyScalar(k))
    out.union(T)
  })
  return out
}

const C = new THREE.Vector3()
/** Centro de uma parte (para pinos, linha-guia e alvo da câmera). Cai no alvo dos dados se ainda não houver malha. */
export function partCenter(device: DeviceId, partId: string, k = 0, out = C): THREE.Vector3 {
  const b = partBox(device, partId, k)
  if (b) return b.getCenter(out)
  const p = DEVICE_BY_ID[device].parts.find((x) => x.id === partId)
  const e = p?.explode ?? [0, 0, 0]
  return p ? out.set(p.camera.target[0] + e[0] * k, p.camera.target[1] + e[1] * k, p.camera.target[2] + e[2] * k) : out.set(0, 0, 0)
}

/** Calcula e guarda todas as caixas (chamado uma vez, no aquecimento, com tudo em repouso). */
export function warmBounds() {
  for (const d of Object.keys(entries) as DeviceId[]) deviceBox(d, 0)
}
