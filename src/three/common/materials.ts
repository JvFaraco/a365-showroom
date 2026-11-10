import * as THREE from 'three'

// Materiais base. Cada <ClickablePart> clona os seus, então estes podem ser compartilhados.
const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)

export const M = {
  white: new THREE.MeshPhysicalMaterial({ color: '#eef0f3', roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
  whiteRelief: std({ color: '#d9dce2', roughness: 0.5 }),
  grey: std({ color: '#8a8f98', roughness: 0.6 }),
  greyDark: std({ color: '#4b4f57', roughness: 0.6 }),
  black: std({ color: '#17181c', roughness: 0.55 }),
  blackGloss: std({ color: '#0b0c0f', roughness: 0.25 }),
  hole: std({ color: '#06070a', roughness: 0.9 }),
  lens: new THREE.MeshPhysicalMaterial({ color: '#050608', roughness: 0.05, clearcoat: 1 }),
  blue: std({ color: '#1E398D', roughness: 0.4 }),
  blueGlow: std({ color: '#2a7df5', roughness: 0.3, emissive: '#1b63e0', emissiveIntensity: 0.6 }),
  pcb: std({ color: '#1e7d43', roughness: 0.5 }),
  chip: std({ color: '#1b1c20', roughness: 0.4 }),
  metal: std({ color: '#c9ccd2', roughness: 0.25, metalness: 0.9 }),
  gold: std({ color: '#d9b25c', roughness: 0.3, metalness: 0.9 }),
  orange: std({ color: '#f07a1c', roughness: 0.5 }),
  red: std({ color: '#d42a2a', roughness: 0.5 }),
  yellow: std({ color: '#F9E000', roughness: 0.45 }),
  frosted: new THREE.MeshPhysicalMaterial({ color: '#f4f6fa', roughness: 0.35, transparent: true, opacity: 0.72, clearcoat: 0.6 }),
}

/** Material de efeito (não participa do esmaecer/raio-X das partes). */
export const fxBasic = (color: string, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
