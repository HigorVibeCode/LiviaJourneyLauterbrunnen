import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { guideHand } from '../../lib/guideInput'
import { horseRide } from '../../lib/horseRide'
import { createLiviaClips } from './clips'
import { useOutfit, TorsoOutfit, HeadOutfit, RightHandItem, LeftHandItem } from './Outfit'

const SKIN = '#e8b896'
const SKIN_DARK = '#d09474'
const SKIN_LIGHT = '#f0c4a8'
const CHEEK = '#e89890'
const LIP = '#c45a68'
const HAIR = '#3a281c'
const HAIR_DARK = '#241610'
const HAIR_LIGHT = '#4a3428'
const TUNIC = '#4a8ec8'
const TUNIC_DARK = '#2868a8'
const SHIRT = '#f2ebe0'
const SKIRT = '#5a2a48'
const PANTS = '#6a5a48'
const BOOT = '#5a3824'
const BOOT_DARK = '#3a2214'
const SASH = '#e8c04a'
const POUCH = '#6a7a3a'
const STRAP = '#3a2a1c'
const BLOOM = '#e8a0b8'
const EYE_WHITE = '#f7f4ee'
const EYE_IRIS = '#3a2818'

/**
 * Livia low-poly polida: rosto limpo, cabelo sem cobrir olhos,
 * touca sem atravessar o cabelo.
 */
export default function LiviaRig({ stateRef }) {
  const root = useRef(null)
  const mixerRef = useRef(null)
  const actionsRef = useRef({})
  const currentRef = useRef('idle')
  const hairOpenRef = useRef(null)
  const hairFrontRef = useRef(null)
  const outfit = useOutfit()
  const hoodOn = outfit.raincoat || outfit.furcoat

  const clips = useMemo(() => createLiviaClips(), [])

  useEffect(() => {
    if (!root.current) return
    const mixer = new THREE.AnimationMixer(root.current)
    const actions = {}
    clips.forEach((clip) => {
      const action = mixer.clipAction(clip)
      action.enabled = true
      if (clip.name === 'jump') {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
      }
      actions[clip.name] = action
    })
    actions.idle.play()
    mixerRef.current = mixer
    actionsRef.current = actions
    currentRef.current = 'idle'

    const armR = root.current.getObjectByName('ArmR')
    const foreR = root.current.getObjectByName('ForeR')
    guideHand.bone = foreR || armR

    return () => {
      mixer.stopAllAction()
      clips.forEach((clip) => mixer.uncacheClip(clip))
      mixerRef.current = null
      actionsRef.current = {}
      if (guideHand.bone === foreR || guideHand.bone === armR) guideHand.bone = null
    }
  }, [clips])

  useEffect(() => {
    // com touca: some franja/volume aberto; calota + occipital + HairBack ficam
    if (hairOpenRef.current) hairOpenRef.current.visible = !hoodOn
    if (hairFrontRef.current) hairFrontRef.current.visible = !hoodOn
  }, [hoodOn])

  // Depois da Livia (priority -1) — riding já está atualizado.
  // NÃO usar priority > 0 — isso desliga o auto-render do R3F.
  useFrame((_, delta) => {
    const mixer = mixerRef.current
    const actions = actionsRef.current
    const s = stateRef.current
    if (!mixer || !s) return
    if (s.paused) return

    const armR = root.current?.getObjectByName('ArmR')
    const armL = root.current?.getObjectByName('ArmL')
    const foreR = root.current?.getObjectByName('ForeR')
    const foreL = root.current?.getObjectByName('ForeL')
    const hips = root.current?.getObjectByName('Hips')
    const spine = root.current?.getObjectByName('Spine')
    const legR = root.current?.getObjectByName('LegR')
    const legL = root.current?.getObjectByName('LegL')
    const kneeR = root.current?.getObjectByName('KneeR')
    const kneeL = root.current?.getObjectByName('KneeL')

    // montada: horseRide.mounted é a fonte da verdade (animState pode atrasar 1 frame)
    const riding = !!(s.riding || horseRide.mounted)
    if (riding) {
      if (currentRef.current !== 'sit') {
        Object.values(actions).forEach((a) => {
          try {
            a?.stop?.()
          } catch {
            /* ignore */
          }
        })
        currentRef.current = 'sit'
      }
      // quadril encaixado na sela; pernas abraçam o dorso (não “de pé”)
      if (hips) hips.position.set(0, 0.55, 0.1)
      if (spine) spine.rotation.set(0.38, 0, 0)
      if (legR) legR.rotation.set(1.5, 0.32, 1.15)
      if (legL) legL.rotation.set(1.5, -0.32, -1.15)
      if (kneeR) kneeR.rotation.set(-1.8, 0, 0)
      if (kneeL) kneeL.rotation.set(-1.8, 0, 0)
      if (armR) armR.rotation.set(0.7, 0.1, 0.35)
      if (armL) armL.rotation.set(0.7, -0.1, -0.35)
      if (foreR) foreR.rotation.set(-0.8, 0, 0)
      if (foreL) foreL.rotation.set(-0.8, 0, 0)
      return
    }

    if (currentRef.current === 'sit') {
      // volta do assento: restaura quadril antes do idle/walk
      if (hips) hips.position.set(0, 0.84, 0)
      currentRef.current = 'idle'
      if (actions.idle) {
        actions.idle.reset().fadeIn(0.12).play()
      }
    }

    const target = s.guiding ? 'idle' : pickClip(s)
    if (target !== currentRef.current) {
      const from = actions[currentRef.current]
      const to = actions[target]
      if (to) {
        to.reset()
        to.setEffectiveWeight(1)
        to.fadeIn(target === 'jump' ? 0.07 : 0.14).play()
        if (from && from !== to) from.fadeOut(target === 'jump' ? 0.07 : 0.14)
        currentRef.current = target
      }
    }

    if (actions.walk) actions.walk.timeScale = THREE.MathUtils.clamp(s.speed / 6.2, 0.7, 1.65)
    if (actions.run) actions.run.timeScale = THREE.MathUtils.clamp(s.speed / 10.5, 0.85, 1.55)

    mixer.update(Math.min(delta, 0.05))

    if (s.guiding) {
      if (armR) armR.rotation.set(-2.15, 0.12, 0.42)
      if (foreR) foreR.rotation.set(-0.35, 0.1, 0)
    }
  })

  return (
    <group ref={root}>
      <group name="Hips" position={[0, 0.84, 0]}>
        {[1, -1].map((side) => (
          <group key={side} name={side > 0 ? 'LegR' : 'LegL'} position={[side * 0.11, 0, 0]}>
            <mesh castShadow position={[0, -0.16, 0]}>
              <cylinderGeometry args={[0.1, 0.086, 0.34, 8]} />
              <meshStandardMaterial color={PANTS} flatShading />
            </mesh>
            <group name={side > 0 ? 'KneeR' : 'KneeL'} position={[0, -0.34, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[0.072, 6, 5]} />
                <meshStandardMaterial color={PANTS} flatShading />
              </mesh>
              <mesh castShadow position={[0, -0.175, 0]}>
                <cylinderGeometry args={[0.072, 0.056, 0.34, 7]} />
                <meshStandardMaterial color={PANTS} flatShading />
              </mesh>
              {/* bota mais definida */}
              <mesh castShadow position={[0, -0.38, 0.06]}>
                <boxGeometry args={[0.155, 0.155, 0.3]} />
                <meshStandardMaterial color={BOOT} flatShading />
              </mesh>
              <mesh castShadow position={[0, -0.3, 0]}>
                <cylinderGeometry args={[0.088, 0.094, 0.12, 7]} />
                <meshStandardMaterial color={BOOT_DARK} flatShading />
              </mesh>
              <mesh castShadow position={[0, -0.44, 0.13]}>
                <boxGeometry args={[0.135, 0.07, 0.12]} />
                <meshStandardMaterial color={BOOT_DARK} flatShading />
              </mesh>
              <mesh castShadow position={[0, -0.475, 0.05]}>
                <boxGeometry args={[0.16, 0.038, 0.32]} />
                <meshStandardMaterial color="#1a100c" flatShading />
              </mesh>
              {/* cadarço vermelho — detalhe da referência */}
              <mesh position={[0, -0.36, 0.18]}>
                <boxGeometry args={[0.04, 0.02, 0.08]} />
                <meshStandardMaterial color="#c43838" flatShading />
              </mesh>
            </group>
          </group>
        ))}

        <mesh castShadow position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.175, 0.205, 0.18, 10]} />
          <meshStandardMaterial color={TUNIC_DARK} flatShading />
        </mesh>
        {/* saia oculta — visual da referência usa casaco + calças */}
        {false && !hoodOn && (
          <group position={[0, -0.02, 0]}>
            <mesh castShadow position={[0, -0.14, 0]}>
              <cylinderGeometry args={[0.2, 0.3, 0.36, 12, 1, true]} />
              <meshStandardMaterial color={SKIRT} flatShading side={THREE.DoubleSide} />
            </mesh>
            <mesh castShadow position={[0, -0.3, 0]}>
              <cylinderGeometry args={[0.3, 0.34, 0.08, 12, 1, true]} />
              <meshStandardMaterial color="#4a2038" flatShading side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}

        <group name="Spine" position={[0, 0.02, 0]}>
          {/* ombros / clavícula */}
          <mesh castShadow position={[0, 0.46, 0.01]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.055, 0.055, 0.42, 6]} />
            <meshStandardMaterial color={SHIRT} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.44, 0.02]}>
            <cylinderGeometry args={[0.095, 0.135, 0.1, 8]} />
            <meshStandardMaterial color={SHIRT} flatShading />
          </mesh>
          {/* túnica vermelha some sob capa/casaco (evita “casca” amarela + vermelho) */}
          <mesh castShadow position={[0, 0.27, 0]} visible={!hoodOn}>
            <capsuleGeometry args={[0.165, 0.28, 4, 10]} />
            <meshStandardMaterial color={TUNIC} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.29, -0.012]} scale={[1.03, 0.88, 1.05]} visible={!hoodOn}>
            <capsuleGeometry args={[0.158, 0.2, 3, 9]} />
            <meshStandardMaterial color={TUNIC_DARK} flatShading />
          </mesh>
          {!hoodOn &&
            [0.36, 0.28, 0.2].map((y) => (
              <mesh key={y} position={[0, y, 0.17]}>
                <sphereGeometry args={[0.017, 5, 4]} />
                <meshStandardMaterial color={SASH} flatShading metalness={0.45} roughness={0.4} />
              </mesh>
            ))}
          <mesh castShadow position={[0, 0.1, 0]} visible={!hoodOn}>
            <cylinderGeometry args={[0.185, 0.185, 0.052, 10]} />
            <meshStandardMaterial color={STRAP} flatShading roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, 0.1, 0.18]} visible={!hoodOn}>
            <boxGeometry args={[0.065, 0.05, 0.03]} />
            <meshStandardMaterial color={SASH} flatShading metalness={0.5} roughness={0.35} />
          </mesh>
          {!hoodOn &&
            [-1, 1].map((side) => (
              <mesh key={side} castShadow position={[side * 0.165, 0.07, 0.085]} rotation={[0.1, side * 0.3, 0]}>
                <boxGeometry args={[0.085, 0.095, 0.055]} />
                <meshStandardMaterial color={POUCH} flatShading />
              </mesh>
            ))}
          <mesh castShadow position={[0, 0.3, -0.22]}>
            <boxGeometry args={[0.25, 0.32, 0.14]} />
            <meshStandardMaterial color="#5c3a1e" flatShading />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} castShadow position={[side * 0.105, 0.42, -0.085]} rotation={[0.5, 0, side * 0.15]}>
              <boxGeometry args={[0.04, 0.24, 0.03]} />
              <meshStandardMaterial color={STRAP} flatShading />
            </mesh>
          ))}

          <TorsoOutfit outfit={outfit} />

          {[1, -1].map((side) => (
            <group
              key={side}
              name={side > 0 ? 'ArmR' : 'ArmL'}
              position={[side * 0.225, 0.45, 0]}
              rotation={[0.05, 0, side * 0.28]}
            >
              {/* ombro/manga acompanham capa/casaco — evita “colete solto” amarelo */}
              <mesh castShadow position={[0, 0.02, 0]}>
                <sphereGeometry args={[0.075, 6, 5]} />
                <meshStandardMaterial
                  color={outfit.furcoat ? '#8b5530' : outfit.raincoat ? '#e0c83e' : TUNIC}
                  flatShading
                />
              </mesh>
              <mesh castShadow position={[0, -0.115, 0]}>
                <cylinderGeometry args={[0.058, 0.05, 0.23, 7]} />
                <meshStandardMaterial
                  color={outfit.furcoat ? '#8b5530' : outfit.raincoat ? '#e0c83e' : TUNIC}
                  flatShading
                />
              </mesh>
              <group name={side > 0 ? 'ForeR' : 'ForeL'} position={[0, -0.25, 0]}>
                <mesh castShadow position={[0, -0.105, 0]}>
                  <cylinderGeometry args={[0.048, 0.04, 0.21, 6]} />
                  <meshStandardMaterial color={SKIN} flatShading />
                </mesh>
                <mesh castShadow position={[0, 0.02, 0]}>
                  <cylinderGeometry args={[0.05, 0.048, 0.048, 6]} />
                  <meshStandardMaterial color={SHIRT} flatShading />
                </mesh>
                {/* mão */}
                <mesh castShadow position={[0, -0.225, 0.01]}>
                  <sphereGeometry args={[0.052, 6, 5]} />
                  <meshStandardMaterial color={SKIN_DARK} flatShading />
                </mesh>
                <mesh castShadow position={[0, -0.255, 0.035]} scale={[0.85, 0.55, 1.1]}>
                  <boxGeometry args={[0.07, 0.04, 0.055]} />
                  <meshStandardMaterial color={SKIN} flatShading />
                </mesh>
                {side > 0 ? <RightHandItem outfit={outfit} /> : <LeftHandItem outfit={outfit} />}
              </group>
            </group>
          ))}

          {/* pescoço mais longo / limpo */}
          <mesh castShadow position={[0, 0.535, 0.01]}>
            <cylinderGeometry args={[0.048, 0.058, 0.11, 7]} />
            <meshStandardMaterial color={SKIN_DARK} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.58, 0.01]}>
            <sphereGeometry args={[0.055, 6, 5]} />
            <meshStandardMaterial color={SKIN} flatShading />
          </mesh>

          <group name="Head" position={[0, 0.6, 0]}>
            {/* crânio / rosto — limpo na frente */}
            <mesh castShadow position={[0, 0.155, 0.015]} scale={[0.92, 1.02, 0.95]}>
              <sphereGeometry args={[0.152, 14, 12]} />
              <meshStandardMaterial color={SKIN} flatShading />
            </mesh>
            {/* testa um pouco mais clara */}
            <mesh position={[0, 0.22, 0.08]} scale={[0.85, 0.45, 0.5]}>
              <sphereGeometry args={[0.08, 6, 5]} />
              <meshStandardMaterial color={SKIN_LIGHT} flatShading />
            </mesh>
            {/* orelhas */}
            {[-1, 1].map((side) => (
              <mesh key={side} castShadow position={[side * 0.145, 0.15, -0.01]} scale={[0.28, 0.48, 0.35]}>
                <sphereGeometry args={[0.055, 5, 4]} />
                <meshStandardMaterial color={SKIN} flatShading />
              </mesh>
            ))}

            {/* olhos bem na frente — sem mesh de cabelo à frente */}
            {[0.046, -0.046].map((x) => (
              <group key={x} position={[x, 0.168, 0.138]}>
                <mesh scale={[1.2, 1.0, 0.5]}>
                  <sphereGeometry args={[0.027, 8, 6]} />
                  <meshStandardMaterial color={EYE_WHITE} flatShading />
                </mesh>
                <mesh position={[0, -0.002, 0.016]}>
                  <sphereGeometry args={[0.0135, 7, 5]} />
                  <meshStandardMaterial color={EYE_IRIS} flatShading />
                </mesh>
                <mesh position={[0, -0.002, 0.024]}>
                  <sphereGeometry args={[0.006, 4, 3]} />
                  <meshStandardMaterial color="#0a0806" flatShading />
                </mesh>
                <mesh position={[0.005, 0.006, 0.027]}>
                  <sphereGeometry args={[0.0045, 4, 3]} />
                  <meshStandardMaterial color="#ffffff" flatShading />
                </mesh>
              </group>
            ))}
            {/* sobrancelhas arqueadas */}
            {[0.046, -0.046].map((x) => (
              <mesh
                key={`b${x}`}
                position={[x, 0.205, 0.132]}
                rotation={[0.1, 0, x > 0 ? -0.18 : 0.18]}
                scale={[1.15, 0.22, 0.35]}
              >
                <boxGeometry args={[0.05, 0.014, 0.014]} />
                <meshStandardMaterial color={HAIR_DARK} flatShading />
              </mesh>
            ))}
            {/* nariz */}
            <mesh position={[0, 0.145, 0.155]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.015, 0.038, 4]} />
              <meshStandardMaterial color={SKIN_DARK} flatShading />
            </mesh>
            {/* boca */}
            <mesh position={[0, 0.1, 0.148]} scale={[1.1, 0.55, 0.7]}>
              <sphereGeometry args={[0.022, 6, 4]} />
              <meshStandardMaterial color={LIP} flatShading />
            </mesh>
            <mesh position={[0, 0.108, 0.152]} scale={[0.7, 0.25, 0.4]}>
              <sphereGeometry args={[0.018, 5, 3]} />
              <meshStandardMaterial color="#d47880" flatShading />
            </mesh>
            {/* blush */}
            {[0.088, -0.088].map((x) => (
              <mesh key={x} position={[x, 0.132, 0.118]} scale={[1.1, 0.7, 0.5]}>
                <sphereGeometry args={[0.03, 5, 4]} />
                <meshStandardMaterial color={CHEEK} flatShading transparent opacity={0.55} />
              </mesh>
            ))}

            {/* calota + occipital (receive-only: muitas esferas no shadow map) */}
            <mesh position={[0, 0.2, -0.02]} scale={[1.08, 0.92, 1.12]}>
              <sphereGeometry args={[0.155, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
              <meshStandardMaterial color={HAIR} flatShading side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.1, -0.14]} scale={[1.15, 0.95, 1.05]}>
              <sphereGeometry args={[0.12, 7, 5]} />
              <meshStandardMaterial color={HAIR} flatShading />
            </mesh>
            <mesh position={[0, 0.05, -0.16]} scale={[0.95, 0.7, 0.75]}>
              <sphereGeometry args={[0.1, 6, 4]} />
              <meshStandardMaterial color={HAIR_DARK} flatShading />
            </mesh>

            {/* franja partida — sem cobrir o eixo dos olhos */}
            <group ref={hairFrontRef}>
              <mesh position={[0.078, 0.228, 0.09]} rotation={[0.15, 0.5, 0.28]} scale={[0.55, 0.38, 0.42]}>
                <sphereGeometry args={[0.08, 5, 4]} />
                <meshStandardMaterial color={HAIR} flatShading />
              </mesh>
              <mesh position={[-0.078, 0.228, 0.09]} rotation={[0.15, -0.5, -0.28]} scale={[0.55, 0.38, 0.42]}>
                <sphereGeometry args={[0.08, 5, 4]} />
                <meshStandardMaterial color={HAIR} flatShading />
              </mesh>
              <mesh position={[0.1, 0.19, 0.1]} rotation={[0.35, 0.3, 0.4]} scale={[0.35, 0.55, 0.3]}>
                <sphereGeometry args={[0.06, 4, 3]} />
                <meshStandardMaterial color={HAIR_DARK} flatShading />
              </mesh>
              <mesh position={[-0.1, 0.19, 0.1]} rotation={[0.35, -0.3, -0.4]} scale={[0.35, 0.55, 0.3]}>
                <sphereGeometry args={[0.06, 4, 3]} />
                <meshStandardMaterial color={HAIR_DARK} flatShading />
              </mesh>
              <mesh position={[0, 0.268, 0.055]} scale={[0.85, 0.32, 0.45]}>
                <sphereGeometry args={[0.072, 5, 3]} />
                <meshStandardMaterial color={HAIR_LIGHT} flatShading />
              </mesh>
            </group>

            {/* volume aberto (some com touca) */}
            <group ref={hairOpenRef}>
              <mesh position={[0, 0.29, -0.02]} scale={[1.05, 0.7, 1.0]}>
                <sphereGeometry args={[0.125, 6, 5]} />
                <meshStandardMaterial color={HAIR} flatShading />
              </mesh>
              <mesh position={[0, 0.26, 0.04]} scale={[0.95, 0.45, 0.55]}>
                <sphereGeometry args={[0.1, 5, 4]} />
                <meshStandardMaterial color={HAIR_LIGHT} flatShading />
              </mesh>
              {[0.145, -0.145].map((x) => (
                <mesh key={x} position={[x, 0.14, -0.02]} scale={[0.55, 1.15, 0.85]}>
                  <sphereGeometry args={[0.11, 5, 4]} />
                  <meshStandardMaterial color={HAIR} flatShading />
                </mesh>
              ))}
              {/* tranças laterais */}
              {[1, -1].map((side) => (
                <group key={`braid${side}`} position={[side * 0.15, 0.05, -0.04]}>
                  <mesh position={[0, -0.12, -0.02]} rotation={[0.15, 0, side * 0.08]}>
                    <capsuleGeometry args={[0.042, 0.38, 3, 5]} />
                    <meshStandardMaterial color={HAIR_DARK} flatShading />
                  </mesh>
                  <mesh position={[0, -0.38, -0.03]} rotation={[0.2, 0, side * 0.1]}>
                    <capsuleGeometry args={[0.038, 0.32, 3, 5]} />
                    <meshStandardMaterial color={HAIR} flatShading />
                  </mesh>
                </group>
              ))}
              {[0.13, -0.13].map((x) => (
                <mesh
                  key={`side${x}`}
                  position={[x, -0.02, 0.02]}
                  rotation={[0.15, 0, x > 0 ? 0.12 : -0.12]}
                  scale={[0.45, 1.35, 0.55]}
                >
                  <sphereGeometry args={[0.09, 4, 4]} />
                  <meshStandardMaterial color={HAIR_DARK} flatShading />
                </mesh>
              ))}
              <mesh position={[0.13, 0.3, 0.02]} rotation={[0, 0, 0.5]}>
                <boxGeometry args={[0.095, 0.04, 0.04]} />
                <meshStandardMaterial color={SASH} flatShading />
              </mesh>
              <mesh position={[0.13, 0.3, 0.02]} rotation={[0, 0, -0.5]}>
                <boxGeometry args={[0.095, 0.04, 0.04]} />
                <meshStandardMaterial color={SASH} flatShading />
              </mesh>
              <mesh position={[-0.12, 0.27, 0.055]}>
                <sphereGeometry args={[0.03, 4, 3]} />
                <meshStandardMaterial color={BLOOM} flatShading />
              </mesh>
            </group>

            {/* cabelo longo — 3 mechas (antes 6) */}
            <group
              name="HairBack"
              position={[0, hoodOn ? 0.1 : 0.14, hoodOn ? -0.13 : -0.11]}
              scale={hoodOn ? 0.88 : 1}
            >
              <mesh position={[0, -0.02, -0.02]} scale={[1.1, 0.75, 0.95]}>
                <sphereGeometry args={[0.11, 6, 5]} />
                <meshStandardMaterial color={HAIR} flatShading />
              </mesh>
              <mesh position={[0, -0.28, -0.03]} rotation={[0.28, 0, 0]}>
                <capsuleGeometry args={[0.105, 0.5, 2, 5]} />
                <meshStandardMaterial color={HAIR} flatShading />
              </mesh>
              <mesh position={[0.08, -0.34, 0]} rotation={[0.25, 0, 0.14]}>
                <capsuleGeometry args={[0.058, 0.4, 2, 4]} />
                <meshStandardMaterial color={HAIR_DARK} flatShading />
              </mesh>
              <mesh position={[-0.08, -0.34, 0]} rotation={[0.25, 0, -0.14]}>
                <capsuleGeometry args={[0.058, 0.4, 2, 4]} />
                <meshStandardMaterial color={HAIR_DARK} flatShading />
              </mesh>
            </group>

            <HeadOutfit outfit={outfit} />
          </group>
        </group>
      </group>
    </group>
  )
}

function pickClip(s) {
  if (s.jumping) return 'jump'
  if (!s.grounded) return 'fall'
  if (s.speed > 8.5) return 'run'
  if (s.speed > 0.35) return 'walk'
  return 'idle'
}
