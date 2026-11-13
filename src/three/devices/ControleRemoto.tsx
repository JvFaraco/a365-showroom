import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { ClickablePart } from '../parts/ClickablePart'
import { M, fxBasic } from '../common/materials'
import { LogoGroove } from '../common/Logo'
import { Led } from '../common/Led'
import { iconTexture, type IconId } from '../common/textures'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { boxesGeometry, latheZ, ringSectorGeometry, smoothLatheZ, stadiumGeometry, wire, type Block } from '../common/shapes'
import { DeviceCtx, bump, seg, useActionPhase, type DeviceProps } from '../common/util'
import type { ActionId } from '../../data/devices'
import { actionTau, actionTime, useShowroom, type ArmState } from '../../store/showroomStore'
import { RadioPulse } from '../fx/RadioPulse'
import { HoldRing } from '../fx/HoldRing'
import { MiniModulo } from '../fx/MiniModulo'
import { beep } from '../../ui/audio'

const D2R = Math.PI / 180
const BUTTONS: { id: string; icon: IconId; angle: number; action: ActionId; arm?: ArmState }[] = [
  { id: 'btn-panico', icon: 'panico', angle: 90, action: 'panico' },
  { id: 'btn-desarmar', icon: 'desarmar', angle: 180, action: 'btn-desarmar', arm: 'disarmed' },
  { id: 'btn-armar', icon: 'armar', angle: 0, action: 'btn-armar', arm: 'armed' },
  { id: 'btn-parcial', icon: 'parcial', angle: 270, action: 'btn-parcial', arm: 'partial' },
]
const CMD: ActionId[] = ['btn-desarmar', 'btn-armar', 'btn-parcial']
const MINI: [number, number, number] = [2.5, 0.75, 0]
const cmdTime = () => { for (const c of CMD) { const t = actionTime(c); if (t >= 0) return t } return -1 }

// Medidas externas: 44 de largura × 51 de altura (com o olhal da argola) × 13 mm de espessura. 1 unidade = 25,9 mm.
// As bordas da frente e de trás são arredondadas (um seixo, não uma moeda); a frente e as costas são quase planas.
const THICK = 1.45 // a espessura modelada (0,34) vira ~13 mm no meio
// ombro arredondado do corpo: quanto a borda recua (no raio) e sobe (na espessura) até a face plana
const SH = { r: 0.15, z: 0.11, z0: 0.06, face: 0.17 }
/** Perfil do ombro, da borda (raio R) até a face plana: quarto de elipse. Pontos [raio, z ≥ 0]. */
const shoulder = (n = 14): [number, number][] => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * (Math.PI / 2); return [R - SH.r * (1 - Math.cos(a)), SH.z0 + SH.z * Math.sin(a)] as [number, number] })
const KY = 0 // o teclado (~32 mm de diâmetro) fica no centro do corpo
// corpo redondo (raio 22 mm) que vira gota embaixo: o olhal da argola é um círculo de ~6 mm de raio com o centro
// quase na borda do corpo, ligado a ele por concordâncias largas. Altura total ≈ 1,15× a largura
const R = 0.853, TAIL_Y = -0.861, TAIL_R = 0.24, FILLET = 0.15
const HOLE_Y = -0.95 // furo da argola: oval deitado (~6,5 × 4 mm), perto da ponta
// tampa da bateria, atrás: disco com um lado reto (onde ela engancha) e a presilha de abrir no lado oposto; fica
// girada 45° em relação ao olhal
const COVER_ROT = -Math.PI / 4, CHORD = 0.382

/**
 * Contorno do corpo: um círculo com uma aba curta embaixo (o olhal da argola), ligada por duas concordâncias
 * côncavas. É um bloco só. `grow` engorda o contorno (usado no filete azul).
 */
function teardrop(grow = 0) {
  const R0 = R + grow, r = TAIL_R + grow, f = FILLET - grow
  // centro da concordância: tangente por fora ao círculo do corpo e ao da aba
  const cy = ((R0 + f) ** 2 - (r + f) ** 2 + TAIL_Y * TAIL_Y) / (2 * TAIL_Y)
  const cx = Math.sqrt((R0 + f) ** 2 - cy * cy)
  const a0 = Math.atan2(cy, cx) // onde o corpo encontra a concordância (lado direito)
  const a1 = Math.atan2(cy - TAIL_Y, cx) // onde a aba encontra a concordância (lado direito)
  const s = new THREE.Shape()
  s.absarc(0, 0, R0, a0, Math.PI - a0, false)
  s.absarc(-cx, cy, f, -a0, -a1, true)
  s.absarc(0, TAIL_Y, r, Math.PI - a1, Math.PI * 2 + a1, false)
  s.absarc(cx, cy, f, Math.PI + a1, Math.PI + a0, true)
  s.closePath()
  return s
}
const ringHole = () => { const h = new THREE.Path(); h.absellipse(0, HOLE_Y, 0.125, 0.08, 0, Math.PI * 2, true, 0); return h }

type Geo = ReturnType<typeof build>
let cache: Geo | null = null
function build() {
  const bevel = { bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 3, curveSegments: 48 }
  // O corpo é feito de duas placas finas no contorno inteiro (com a aba da argola), uma de cada lado da emenda, e
  // de dois ombros arredondados (sólidos de revolução, só no círculo): é por isso que a aba fica fina e o corpo, gordinho.
  // Metade da frente: maciça. Metade de trás: aro grosso com a cavidade da bateria (fechada pela tampa).
  // casca da frente oca: a placa fina da emenda é só um aro (por dentro fica o vão da placa e do teclado)
  const fs = teardrop(); fs.holes.push(ringHole())
  const frontHole = new THREE.Path(); frontHole.absarc(0, 0, R - SH.r - 0.01, 0, Math.PI * 2, true); fs.holes.push(frontHole)
  const front = new THREE.ExtrudeGeometry(fs, { depth: 0.05, ...bevel })
  const bs = teardrop(); bs.holes.push(ringHole())
  const cav = new THREE.Path(); cav.absarc(0, 0, 0.61, 0, Math.PI * 2, true); bs.holes.push(cav)
  const back = new THREE.ExtrudeGeometry(bs, { depth: 0.05, ...bevel }); back.translate(0, 0, -0.06)
  // ombro da frente: da borda até a face plana, que é aberta em anel onde entra o teclado (como na peça real: o miolo
  // fica preso por quatro raios em X). Por dentro, a parede do ombro tem a face de dentro (a casca tem ~1,5 mm)
  const frontDome = latheZ([[R, 0.03], ...shoulder(), [0.64, SH.face]], 96)
  const innerShoulder = shoulder().map(([r, z]) => [r - 0.035, Math.max(0.05, z - 0.03)] as [number, number])
  const frontDomeIn = latheZ([[0.64, SH.face - 0.03], ...innerShoulder.reverse(), [R - 0.035, 0.05]], 96)
  // raios em X que seguram o miolo: ficam nas frestas entre as quatro teclas (a 45°)
  const spokes = mergeGeometries([45, 135, 225, 315].map((d) => {
    const b = new THREE.BoxGeometry(0.4, 0.045, 0.03)
    b.translate(0.455, 0, SH.face - 0.012); b.rotateZ(d * D2R)
    return b
  }))
  // por dentro: parede circular em volta do teclado e os pinos de apoio da placa
  const innerWall = new THREE.CylinderGeometry(0.665, 0.665, 0.09, 64, 1, true); innerWall.rotateX(Math.PI / 2); innerWall.translate(0, 0, 0.1)
  const posts = mergeGeometries(Array.from({ length: 8 }, (_, i) => {
    const a = ((i + 0.5) / 8) * Math.PI * 2, c = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10)
    c.rotateX(Math.PI / 2); c.translate(Math.cos(a) * 0.76, Math.sin(a) * 0.76, 0.1)
    return c
  }))
  // miolo: o disco central fixo também tem a face de baixo
  const hubBack = new THREE.CircleGeometry(0.27, 48); hubBack.rotateY(Math.PI); hubBack.translate(0, KY, SH.face - 0.025)
  // teclado de borracha: lâmina atrás da face, com um pino embaixo de cada tecla (aperta o domo dourado da placa)
  const keypadSheet = new THREE.RingGeometry(0.28, 0.645, 64); keypadSheet.translate(0, KY, SH.face - 0.024)
  const keypadBack = new THREE.RingGeometry(0.28, 0.645, 64); keypadBack.rotateY(Math.PI); keypadBack.translate(0, KY, SH.face - 0.034)
  const plungers = mergeGeometries([0, 90, 180, 270].map((d) => {
    const c = new THREE.CylinderGeometry(0.045, 0.05, 0.06, 16); c.rotateX(Math.PI / 2)
    c.translate(Math.cos(d * D2R) * 0.47, KY + Math.sin(d * D2R) * 0.47, SH.face - 0.06)
    return c
  }))
  // ombro de trás: o mesmo perfil espelhado; por dentro, a parede da cavidade da bateria
  const backDome = latheZ([[0.61, -0.05], [0.61, -SH.face], ...shoulder().reverse().map(([r, z]) => [r, -z] as [number, number]), [R, -0.03]], 96)
  // filete azul: anel fino (~1,5 mm) no meio da espessura, quase rente às cascas
  const fl = teardrop(0.03)
  // é um anel de verdade (não um disco): na vista explodida aparece fino, só o contorno
  fl.holes.push(new THREE.Path(teardrop(-0.05).getPoints(120).reverse()))
  const fillet = new THREE.ExtrudeGeometry(fl, { depth: 0.03, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 64 }); fillet.translate(0, 0, -0.015)
  // tampa: disco com um lado reto (embaixo, no referencial da tampa); a presilha fica na borda oposta
  const cs = new THREE.Shape(), ca = Math.asin(CHORD / 0.87 / 0.7)
  cs.absarc(0, 0, 0.7, -ca, Math.PI + ca, false); cs.closePath()
  // fora do lado reto da tampa a casca de trás é fechada: a cavidade (e a placa) não aparecem por fora
  const fs2 = new THREE.Shape(), fa = Math.asin((CHORD - 0.007) / 0.62)
  fs2.absarc(0, 0, 0.62, Math.PI + fa, Math.PI * 2 - fa, false); fs2.closePath()
  const coverSill = new THREE.ExtrudeGeometry(fs2, { depth: 0.109, bevelEnabled: false, curveSegments: 24 }); coverSill.translate(0, 0, -0.184)
  const cover = new THREE.ExtrudeGeometry(cs, { depth: 0.014, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 48 }); cover.translate(0, 0, -0.022)
  // componentes pequenos na frente da placa (sob o teclado), em volta do CI do centro, como na placa real: capacitores
  // (bege), resistores e CIs pequenos (pretos), o cristal (metal) e dois pontos de teste (dourados). Sem texto
  const ZS = -0.046, t = (x: number, y: number, w = 0.04, h = 0.022): Block => [x, y, ZS, w, h, 0.008]
  const side = (v: number): Block[] => [t(-0.08, v), t(0, v), t(0.08, v), t(v, -0.08, 0.022, 0.04), t(v, 0, 0.022, 0.04), t(v, 0.08, 0.022, 0.04)]
  const smdTan = boxesGeometry([...side(0.17), t(-0.3, -0.2), t(-0.21, -0.31, 0.022, 0.04), t(0.3, -0.17), t(0.22, 0.3, 0.022, 0.04), t(-0.24, 0.27)])
  const smdBlack = boxesGeometry([...side(-0.17), [-0.3, -0.3, ZS, 0.07, 0.07, 0.01], [0.3, -0.28, ZS, 0.06, 0.09, 0.01], t(-0.32, 0.2, 0.022, 0.04)])
  const smdMetal = boxesGeometry([[0, 0.29, -0.042, 0.1, 0.06, 0.016]])
  const smdGold = boxesGeometry([[0.13, 0.29, -0.048, 0.035, 0.035, 0.004], [0.2, 0.29, -0.048, 0.035, 0.035, 0.004]])
  return {
    front, back, frontDome, frontDomeIn, spokes, innerWall, posts, hubBack, keypadSheet, keypadBack, plungers, backDome, fillet, cover, coverSill, smdTan, smdBlack, smdMetal, smdGold,
    sector: ringSectorGeometry(0.3, 0.62, -38 * D2R, 38 * D2R, 0.018, 0.022),
    // disco central fixo: baixo, sem contorno de tecla
    center: smoothLatheZ([[0.27, 0.168], [0.266, 0.182], [0.245, 0.19], [0.001, 0.192]], 96, 24),
    coin: smoothLatheZ([[0.001, -0.14], [0.39, -0.14], [0.415, -0.135], [0.42, -0.12], [0.42, -0.09], [0.41, -0.08], [0.001, -0.08]], 64, 32),
    slit: stadiumGeometry(0.27, 0.075, 0.01, 0.003), // fenda do LED: ~7 × 2 mm
    aerial: wire([[0.5, 0.42, -0.045], [0.63, 0.2, -0.04], [0.66, -0.1, -0.04], [0.56, -0.36, -0.04]], 0.012),
    rib: wire([[-0.42, 0.25, 0], [-0.45, -0.1, 0], [-0.36, -0.34, 0], [0, -0.39, 0], [0.36, -0.34, 0], [0.45, -0.1, 0], [0.42, 0.25, 0]], 0.014),
  }
}
const G = () => (cache ??= build())

/**
 * Controle remoto: corpo redondo e gordinho (bordas bem arredondadas), com uma aba fina para o furo da argola, preto/grafite brilhante
 * com filete azul, 4 botões em cunha (em X) em volta de um disco central fixo, que não é botão. Atrás, a tampa (um disco de um lado reto)
 * fecha a cavidade com a placa verde, o suporte e a bateria CR2032. Frente em +Z.
 */
export function ControleRemoto({ interactive = false, pressed }: DeviceProps & { pressed?: () => string | null }) {
  const g = G()
  // corpo preto/grafite brilhante, como na arte oficial
  const bodyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#1d1f24', roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.25 }), [])
  const coinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dfe2e8', roughness: 0.32, metalness: 0.6 }), [])
  const coverMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#22242a', roughness: 0.7 }), [])
  const icons = useMemo(() => BUTTONS.map((b) => new THREE.MeshBasicMaterial({ map: iconTexture(b.icon), transparent: true, toneMapped: false })), [])
  const btnRefs = useRef<(THREE.Group | null)[]>([])
  const root = useRef<THREE.Group>(null!)
  const cover = useRef<THREE.Group>(null!)
  const coin = useRef<THREE.Group>(null!)
  const range = useRef<THREE.Mesh>(null!)
  const rangeMat = useMemo(() => fxBasic('#5b8cff', 0), [])
  const cmdPhase = useActionPhase(CMD, [0, 1.5])
  const panicOn = useActionPhase('panico') >= 0
  const rangePhase = useActionPhase('alcance', [1.2])
  const coverPhase = useActionPhase('tampa-controle', [0.8, 1.6], true)
  const tx = () => {
    if (!interactive) return !!pressed?.()
    const t = cmdTime(), s = useShowroom.getState()
    return (t > 0.25 && t < 2.2) || (s.action?.id === 'panico' && s.holdMsg === 'ok')
  }

  // o comando chega ao módulo: o estado do alarme muda
  useEffect(() => {
    if (cmdPhase !== 1) return
    const s = useShowroom.getState()
    const b = BUTTONS.find((x) => x.action === s.action?.id)
    if (b?.arm) s.setArm(b.arm)
  }, [cmdPhase])
  useEffect(() => { if (cmdPhase === 0) beep('click') }, [cmdPhase])

  useFrame(() => {
    const s = useShowroom.getState()
    BUTTONS.forEach((b, i) => {
      const g = btnRefs.current[i]
      if (!g) return
      let down = 0
      if (interactive) {
        const t = actionTime(b.action)
        if (b.action === 'panico') down = s.holding && t >= 0 ? 1 : 0
        else if (t >= 0) down = bump(t, 0.05, 0.2, 0.45, 0.6)
      } else if (pressed?.() === b.id) down = 1
      g.position.z = -down * 0.022
    })
    if (!interactive) return
    // tampa: o controle vira de costas, a tampa inclina ~25° pela borda de cima e sai para trás;
    // por fim a bateria-moeda desliza para fora do suporte
    const tt = actionTau('tampa-controle')
    root.current.rotation.y = tt < 0 ? 0 : seg(tt, 0, 0.8) * Math.PI
    const off = tt < 0 ? 0 : seg(tt, 2.0, 2.7)
    cover.current.rotation.x = -(tt < 0 ? 0 : seg(tt, 1.5, 2.0)) * 0.44
    cover.current.position.set(0, -off * 0.25, -off * 0.7)
    const slide = tt < 0 ? 0 : seg(tt, 2.9, 3.6)
    coin.current.position.set(-slide * 0.75, -slide * 0.25, -slide * 0.04)
    const ta = actionTime('alcance')
    const k = ta < 0 ? 0 : seg(ta, 0.2, 2.6)
    range.current.scale.setScalar(0.2 + k * 5.2)
    rangeMat.opacity = ta < 0 ? 0 : 0.8 * (1 - seg(ta, 4.8, 5.8)) * seg(ta, 0.1, 0.5)
  })

  return (
    <DeviceCtx.Provider value={{ deviceId: 'controle', interactive }}>
      <group ref={root} position={[0, 0.1, 0]} scale={[1, 1, THICK]}>
        {/* casca da frente */}
        <ClickablePart id="corpo">
          <mesh geometry={g.front} material={bodyMat} castShadow />
          <mesh geometry={g.frontDome} material={bodyMat} castShadow />
          {/* por dentro: face interna do ombro, raios do miolo, parede em volta do teclado e pinos da placa */}
          <mesh geometry={g.frontDomeIn} material={bodyMat} />
          <mesh geometry={g.spokes} material={bodyMat} />
          <mesh geometry={g.innerWall} material={bodyMat} />
          <mesh geometry={g.posts} material={bodyMat} />
          <mesh geometry={g.hubBack} material={bodyMat} />
          {/* linha de partição em volta do teclado */}
          <mesh material={M.groove} position={[0, KY, 0.1705]}><ringGeometry args={[0.652, 0.666, 96]} /></mesh>
        </ClickablePart>
        {/* anel do filete azul: ~1,5 mm, no MEIO da espessura (a emenda entre as duas cascas), em volta de tudo */}
        <ClickablePart follow="corpo" explode={[0, 0, 0.2]}>
          <mesh geometry={g.fillet} material={M.blueGlow} />
        </ClickablePart>
        {/* casca de trás, com a argola */}
        <ClickablePart follow="corpo" explode={[0, 0, -0.6]}>
          <mesh geometry={g.back} material={bodyMat} castShadow />
          <mesh geometry={g.backDome} material={bodyMat} castShadow />
          <mesh geometry={g.coverSill} material={bodyMat} rotation={[0, 0, COVER_ROT]} />
        </ClickablePart>
        <ClickablePart id="argola">
          {/* furo da argola (oval deitado), no olhal fino que sai do corpo, com a borda chanfrada */}
          {[0.062, -0.072].map((z) => (
            <mesh key={z} material={M.blackGloss} position={[0, HOLE_Y, z]} scale={[1.12, 0.74, 0.4]}><torusGeometry args={[0.117, 0.022, 12, 64]} /></mesh>
          ))}
        </ClickablePart>
        <ClickablePart id="led">
          <mesh geometry={g.slit} material={M.blackGloss} position={[0, 0.685, 0.159]} rotation={[-0.12, 0, 0]} />
          <Led sample={(t, o) => { o.color = '#3d7bff'; o.on = tx() ? (t % 0.24 < 0.12 ? 1 : 0.1) : 0.05 }} position={[0, 0.687, 0.1735]} rotation={[-0.12, 0, 0]}>
            <boxGeometry args={[0.2, 0.04, 0.004]} />
          </Led>
        </ClickablePart>

        {/* teclado de borracha atrás da face: a lâmina e os pinos que apertam os domos da placa; sai junto com as teclas */}
        <ClickablePart follow="btn-panico">
          <mesh geometry={g.keypadSheet} material={M.blackBtn} />
          <mesh geometry={g.keypadBack} material={M.blackBtn} />
          <mesh geometry={g.plungers} material={M.blackBtn} />
        </ClickablePart>

        {/* 4 botões em cunha, em X: ✱ em cima, cadeado aberto à esquerda, fechado à direita, casa embaixo */}
        {BUTTONS.map((b, i) => (
          <ClickablePart key={b.id} id={b.id}>
            <group ref={(gr) => { btnRefs.current[i] = gr }}
              onPointerDown={b.action === 'panico' ? (e) => { if (panicOn) { e.stopPropagation(); useShowroom.getState().set({ holding: true, holdMsg: '' }) } } : undefined}
              onPointerUp={b.action === 'panico' ? () => panicOn && useShowroom.getState().set({ holding: false }) : undefined}
              onPointerLeave={b.action === 'panico' ? () => panicOn && useShowroom.getState().set({ holding: false }) : undefined}>
              <mesh geometry={g.sector} material={M.blackBtn} position={[0, KY, 0.172]} rotation={[0, 0, b.angle * D2R]} />
              <mesh material={icons[i]} position={[Math.cos(b.angle * D2R) * 0.46, KY + Math.sin(b.angle * D2R) * 0.46, 0.2135]}><planeGeometry args={[0.2, 0.2]} /></mesh>
            </group>
            {interactive && b.action === 'panico' && <HoldRing radius={0.18} position={[0, KY + 0.46, 0.24]} />}
          </ClickablePart>
        ))}
        {/* centro: disco escuro FIXO (não afunda, não tem contorno de tecla), com o logo em baixo-relevo bem discreto.
            TODO(usuário): confirmar o logo no disco (a arte de marketing mostra; o ícone do sistema mostra liso). */}
        <ClickablePart follow="corpo">
          <mesh geometry={g.center} material={bodyMat} position={[0, KY, 0]} />
          <LogoGroove r={0.12} position={[0, KY, 0.1925]} material={M.logoGrooveDark} />
        </ClickablePart>

        {/* tampa traseira: disco de um lado reto, com duas abas nesse lado, a presilha no lado oposto e o símbolo em relevo */}
        <ClickablePart id="tampa">
          <group rotation={[0, 0, COVER_ROT]}>
          <group position={[0, -CHORD, -0.165]}>
            <group ref={cover}>
              <group position={[0, CHORD, 0]} scale={[0.87, 0.87, 1]}>
                <mesh geometry={g.cover} material={coverMat} />
                {/* presilha da tampa, na borda oposta ao lado reto: lingueta retangular com a fenda onde se apoia para abrir */}
                <mesh material={coverMat} position={[0, 0.6, -0.031]}><boxGeometry args={[0.24, 0.11, 0.012]} /></mesh>
                <mesh material={M.hole} position={[0, 0.61, -0.0375]}><boxGeometry args={[0.16, 0.028, 0.004]} /></mesh>
                <mesh material={M.black} position={[0, 0.3, -0.031]} rotation={[Math.PI / 2, Math.PI / 6, 0]}><cylinderGeometry args={[0.07, 0.07, 0.006, 3]} /></mesh>
                <mesh material={M.black} position={[0, 0.17, -0.031]}><boxGeometry args={[0.2, 0.035, 0.006]} /></mesh>
                {[[-0.22, -0.45], [0.22, -0.45]].map(([x, y], i) => (
                  <mesh key={i} material={coverMat} position={[x, y, -0.006]}><boxGeometry args={[0.12, 0.06, 0.03]} /></mesh>
                ))}
                {/* por dentro: nervura em "U" e a etiqueta (lisa, sem texto) */}
                <mesh geometry={g.rib} material={coverMat} position={[0, 0, 0.004]} />
                <mesh material={M.white} position={[0, 0.02, 0.0005]}><planeGeometry args={[0.5, 0.34]} /></mesh>
              </group>
            </group>
          </group>
          </group>
        </ClickablePart>
        {/* por dentro: placa verde, suporte preto da bateria com a lâmina de contato dourada e o bloco do encaixe */}
        <ClickablePart internal>
          <mesh material={M.pcb} position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.69, 0.69, 0.02, 64]} /></mesh>
          {/* frente da placa, sob os botões: 4 pads dourados redondos, o CI preto quadrado no centro, a fileira de 5 pads
              perto da borda de baixo e a antena de fio amarelo. O resto é verde liso */}
          {BUTTONS.map((b) => (
            <group key={b.id} position={[Math.cos(b.angle * D2R) * 0.47, Math.sin(b.angle * D2R) * 0.47, -0.047]} rotation={[0, 0, Math.PI / 4]}>
              <mesh material={M.gold} position={[0, 0, 0.004]} scale={[1, 1, 0.3]}><sphereGeometry args={[0.062, 20, 12]} /></mesh>
            </group>
          ))}
          <mesh material={M.chip} position={[0, 0, -0.043]}><boxGeometry args={[0.2, 0.2, 0.014]} /></mesh>
          <mesh geometry={g.smdTan} material={M.smdTan} />
          <mesh geometry={g.smdBlack} material={M.chip} />
          <mesh geometry={g.smdMetal} material={M.metal} />
          <mesh geometry={g.smdGold} material={M.gold} />
          <mesh material={M.white} position={[0.3, 0.56, -0.045]}><boxGeometry args={[0.05, 0.03, 0.01]} /></mesh>
          {[0, 1, 2, 3, 4].map((i) => <mesh key={i} material={M.gold} position={[-0.14 + i * 0.07, -0.6, -0.048]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.004, 10]} /></mesh>)}
          <mesh geometry={g.aerial} material={M.yellow} />
          <mesh material={M.black} position={[0, -0.05, -0.1]}><torusGeometry args={[0.455, 0.035, 8, 48, Math.PI * 1.45]} /></mesh>
          <mesh material={M.gold} position={[0.12, 0.3, -0.148]}><boxGeometry args={[0.2, 0.26, 0.008]} /></mesh>
          <mesh material={M.gold} position={[0.12, 0.44, -0.12]}><boxGeometry args={[0.24, 0.05, 0.06]} /></mesh>
          <mesh material={M.black} position={[-0.3, 0.57, -0.1]}><boxGeometry args={[0.3, 0.16, 0.1]} /></mesh>
          <mesh material={M.white} position={[0.52, -0.3, -0.071]} rotation={[0, Math.PI, -0.5]}><planeGeometry args={[0.1, 0.4]} /></mesh>
        </ClickablePart>
        <ClickablePart id="bateria">
          <group ref={coin}>
            <group position={[0, -0.03, 0]} scale={[0.92, 0.92, 1]}>
              <mesh geometry={g.coin} material={coinMat} />
              {/* o "+" gravado na face */}
              <mesh material={M.metal} position={[-0.1, -0.2, -0.141]}><boxGeometry args={[0.13, 0.022, 0.002]} /></mesh>
              <mesh material={M.metal} position={[-0.1, -0.2, -0.141]}><boxGeometry args={[0.022, 0.13, 0.002]} /></mesh>
            </group>
          </group>
        </ClickablePart>
        {interactive && coverPhase === 0 && (
          <Html position={[0.45, 0.45, -0.2]} center style={{ pointerEvents: 'none' }}>
            <div className="fx-tag -translate-y-7 text-center text-xs font-semibold text-accent">entalhe<div className="text-xl leading-none">▼</div></div>
          </Html>
        )}
      </group>

      {interactive && (
        <>
          {(cmdPhase >= 0 || panicOn) && (
            <>
              <MiniModulo position={MINI} led={() => { const s = useShowroom.getState(); return s.action?.id === 'panico' && s.holdMsg === 'ok' ? 'sos' : null }} />
              <RadioPulse from={[0, 0.95, 0.15]} to={MINI} on={tx} />
            </>
          )}
          <mesh ref={range} material={rangeMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} userData={{ fx: true }} raycast={() => null}>
            <ringGeometry args={[0.97, 1, 96]} />
          </mesh>
          {rangePhase >= 0 && (
            <Html position={[0, -0.3, 5.4]} center style={{ pointerEvents: 'none' }}>
              <div className="fx-tag rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white">Alcance de até 30 m</div>
            </Html>
          )}
        </>
      )}
    </DeviceCtx.Provider>
  )
}
