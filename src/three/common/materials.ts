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
  // logo dos aparelhos: na peça real é branco sobre branco (só o sulco faz sombra). Mesmas flags do logoGroove
  logoLight: std({ color: '#d2d2ce', roughness: 0.75 }),
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
  // filete do controle: azul saturado, com brilho leve (abaixo do limiar do bloom). Mesmas flags de antes.
  blueGlow: new THREE.MeshPhysicalMaterial({ color: '#2a5bff', roughness: 0.3, clearcoat: 0.6, emissive: '#2a5bff', emissiveIntensity: 0.5 }),
  pcb: std({ color: '#ffffff', roughness: 0.5, ...(typeof document !== 'undefined' ? { map: pcbTexture() } : {}) }),
  pcbDark: std({ color: '#0f5a2c', roughness: 0.5 }),
  chip: std({ color: '#1b1c20', roughness: 0.4 }),
  // componentes pequenos de placa (capacitores): bege
  smdTan: std({ color: '#b08a60', roughness: 0.55 }),
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
  // cristal dos LEDs (fotossensor, sirene e cápsula do módulo): plástico translúcido, levemente azulado, com reflexo
  crystal: new THREE.MeshPhysicalMaterial({ color: '#eaf2ff', roughness: 0.18, transparent: true, opacity: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 }),
}

/** Material de efeito (não participa do esmaecer/raio-X das partes). */
export const fxBasic = (color: string, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })

// As cores da marca precisam sair exatas, e o tone mapping filmico do showroom lava o amarelo (puxa para o branco).
// Por isso a peça devolve a cor já "desfeita": o shader aplica a inversa da curva ACES à cor iluminada, e o tone
// mapping do fim do quadro traz de volta o azul e o amarelo da arte.
const BRAND_GLSL = /* glsl */ `
vec3 brandColor(vec3 c) {
  c /= max(1.0, max(c.r, max(c.g, c.b)));
  vec3 y = clamp(mat3(0.64304, 0.05927, 0.00596, 0.31119, 0.93144, 0.06393, 0.04578, 0.00929, 0.93012) * c, 0.0, 0.985);
  vec3 A = 1.0 - 0.983729 * y, B = 0.0245786 - 0.4329510 * y, C = -(0.000090537 + 0.238081 * y);
  vec3 v = (-B + sqrt(B * B - 4.0 * A * C)) / (2.0 * A);
  vec3 o = mat3(1.76474, -0.14703, -0.03634, -0.67578, 1.16025, -0.16244, -0.08896, -0.01322, 1.19877) * v * 0.6;
  // fica abaixo do limiar do bloom: a chapa não é fonte de luz e o brilho em volta lavaria a cor de novo
  return o * min(1.0, 1.12 / max(1e-4, dot(o, vec3(0.2126, 0.7152, 0.0722))));
}`
/** Para materiais com `userData.brand`: aplica a correção de cor da marca no fim do shader (antes do tone mapping). */
export function brandPatch(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', BRAND_GLSL + '\nvoid main() {')
    .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb = brandColor(gl_FragColor.rgb);')
}
