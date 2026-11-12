import * as THREE from 'three'
import { microNormalTexture, pcbTexture, roughnessNoiseTexture } from './textures'

// Materiais base. Cada <ClickablePart> clona os seus, então estes podem ser compartilhados.
const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
const micro = typeof document !== 'undefined' ? microNormalTexture() : null
const rough = typeof document !== 'undefined' ? roughnessNoiseTexture() : null
// variação sutil de rugosidade (o brilho do plástico nunca é perfeitamente uniforme)
const R = rough ? { roughnessMap: rough } : {}
const N = (s: number) => (micro ? { normalMap: micro, normalScale: new THREE.Vector2(s, s) } : {})

export const M = {
  // plástico branco injetado: branco levemente quente (nunca #FFF), acetinado, verniz baixo, micro-textura e ruído de rugosidade
  white: new THREE.MeshPhysicalMaterial({ color: '#F2F0EB', roughness: 0.42, clearcoat: 0.2, clearcoatRoughness: 0.45, ...N(0.05), ...R }),
  whiteRelief: new THREE.MeshPhysicalMaterial({ color: '#e4e2dd', roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.5, ...N(0.05), ...R }),
  // sulcos: linha de partição (escura) e logo em sulco fino (branco em sombra)
  groove: std({ color: '#23262d', roughness: 0.9 }),
  partition: std({ color: '#7d828c', roughness: 0.9 }),
  logoGroove: std({ color: '#b3b8c2', roughness: 0.75 }),
  logoGrooveDark: std({ color: '#5d626c', roughness: 0.6 }),
  // plástico cinza (base e suportes): fosco, com micro-textura
  grey: std({ color: '#8b8f97', roughness: 0.7, ...N(0.09) }),
  greyDark: std({ color: '#5a6170', roughness: 0.68 }),
  // preto soft-touch (#1A1C20, nunca #000) e botões um pouco mais brilhantes
  black: std({ color: '#1A1C20', roughness: 0.8, ...N(0.08) }),
  // botões de borracha fosca
  blackBtn: std({ color: '#24262b', roughness: 0.82, ...N(0.07) }),
  blackGloss: new THREE.MeshPhysicalMaterial({ color: '#0e0f13', roughness: 0.22, clearcoat: 0.6 }),
  hole: std({ color: '#07080b', roughness: 0.95 }),
  lens: new THREE.MeshPhysicalMaterial({ color: '#05060a', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 }),
  chrome: std({ color: '#f3f5f8', roughness: 0.15, metalness: 1 }),
  blue: new THREE.MeshPhysicalMaterial({ color: '#1E398D', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  // filete do controle: azul da marca com um pouco de brilho
  blueGlow: new THREE.MeshPhysicalMaterial({ color: '#1E398D', roughness: 0.3, clearcoat: 0.6, emissive: '#2a52d6', emissiveIntensity: 0.22 }),
  pcb: std({ color: '#ffffff', roughness: 0.5, ...(typeof document !== 'undefined' ? { map: pcbTexture() } : {}) }),
  pcbDark: std({ color: '#0f5a2c', roughness: 0.5 }),
  chip: std({ color: '#1b1c20', roughness: 0.4 }),
  // metais (molas, parafusos, conectores): metalness 1, roughness média
  metal: std({ color: '#cfd3d9', roughness: 0.38, metalness: 1 }),
  gold: std({ color: '#d9b25c', roughness: 0.36, metalness: 1 }),
  orange: std({ color: '#f07a1c', roughness: 0.5 }),
  red: std({ color: '#d42a2a', roughness: 0.5 }),
  yellow: std({ color: '#F9E000', roughness: 0.45 }),
  brown: std({ color: '#7a5a48', roughness: 0.6 }),
  wireBlue: std({ color: '#2f55c8', roughness: 0.55 }),
  cell: std({ color: '#3d4350', roughness: 0.45, metalness: 0.3 }),
  frosted: new THREE.MeshPhysicalMaterial({ color: '#f4f6fa', roughness: 0.35, transparent: true, opacity: 0.72, clearcoat: 0.6 }),
  crystal: new THREE.MeshPhysicalMaterial({ color: '#f3f6fb', roughness: 0.25, transparent: true, opacity: 0.55, clearcoat: 1, clearcoatRoughness: 0.1 }),
}

/** Material de efeito (não participa do esmaecer/raio-X das partes). */
export const fxBasic = (color: string, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
