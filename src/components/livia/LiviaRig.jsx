import { useEffect, useMemo, useRef } from 'react'
import ToonMat from '../../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { guideHand } from '../../lib/guideInput'
import { horseRide } from '../../lib/horseRide'
import { createLiviaClips } from './clips'
import { useOutfit, TorsoOutfit, HeadOutfit, ChestOutfit, RightHandItem, LeftHandItem } from './Outfit'

// paleta da Livia chibi (fofa, sem tons escuros)
const SKIN = '#ffd9bf'
const SKIN_SHADE = '#f7c6a6'
const CHEEK = '#ff9eb0'
const HAIR = '#8a5236'
const HAIR_LIGHT = '#a8673f'
const DRESS = '#5fb0ff'
const DRESS_LIGHT = '#8ccaff'
const COLLAR = '#ffffff'
const BUTTON = '#ffd23f'
const LEGGING = '#ffffff'
const BOOT = '#ff6f7d'
const BOOT_SOLE = '#e85566'
const BAG = '#ffb45a'
const BAG_STRAP = '#e8923a'
const RIBBON = '#ff6f9a'
const EYE = '#3b2a2a'
const RIG_SCALE = 0.62

/**
 * Livia chibi (estilo Animal Crossing): cabeção redondo, olhos grandes,
 * corpinho de vestido, botinhas. Mesmos ossos de antes (Hips, Spine, Legs,
 * Knees, Arms, Fores, Head, HairBack) — os clips de clips.js continuam valendo.
 * O rig é desenhado em "unidades de rig" e escalado por RIG_SCALE.
 */
export default function LiviaRig({ stateRef, remote = false }) {
  const root = useRef(null)
  const mixerRef = useRef(null)
  const actionsRef = useRef({})
  const currentRef = useRef('idle')
  const hairOpenRef = useRef(null)
  const hairFrontRef = useRef(null)
  const outfit = useOutfit(remote)
  const bonesRef = useRef(null)
  // chapéus ficam por cima do cabelo (não escondem mais nada)
  const hoodOn = false

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
    // só a Livia local segura o feixe da guia (antes um amigo "roubava" a mão)
    if (!remote) guideHand.bone = foreR || armR
    bonesRef.current = null

    return () => {
      mixer.stopAllAction()
      clips.forEach((clip) => mixer.uncacheClip(clip))
      mixerRef.current = null
      actionsRef.current = {}
      if (guideHand.bone === foreR || guideHand.bone === armR) guideHand.bone = null
    }
  }, [clips, remote])

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

    // ossos buscados uma vez (eram 10 getObjectByName por frame por avatar)
    if (!bonesRef.current && root.current) {
      const get = (n) => root.current.getObjectByName(n)
      bonesRef.current = {
        armR: get('ArmR'),
        armL: get('ArmL'),
        foreR: get('ForeR'),
        foreL: get('ForeL'),
        hips: get('Hips'),
        spine: get('Spine'),
        legR: get('LegR'),
        legL: get('LegL'),
        kneeR: get('KneeR'),
        kneeL: get('KneeL'),
      }
    }
    const { armR, armL, foreR, foreL, hips, spine, legR, legL, kneeR, kneeL } = bonesRef.current ?? {}

    // montada: horseRide.mounted é a fonte da verdade (animState pode atrasar 1 frame)
    const riding = !!(s.riding || (!remote && horseRide.mounted))
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
      // (rig escalado: 0.89 aqui = mesma altura de sela de antes)
      if (hips) hips.position.set(0, 0.89, 0.1)
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
      if (hips) hips.position.set(0, 0.82, 0)
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

    // Trava altura do quadril — clips/blend não podem mexer em Y (parecia “pulo”)
    if (hips) hips.position.y = 0.82

    if (s.guiding) {
      if (armR) armR.rotation.set(-2.15, 0.12, 0.42)
      if (foreR) foreR.rotation.set(-0.35, 0.1, 0)
    }
  })

  return (
    <group ref={root} scale={RIG_SCALE}>
      <group name="Hips" position={[0, 0.82, 0]}>
        {[1, -1].map((side) => (
          <group key={side} name={side > 0 ? 'LegR' : 'LegL'} position={[side * 0.15, 0, 0]}>
            <mesh position={[0, -0.17, 0]}>
              <capsuleGeometry args={[0.12, 0.2, 6, 12]} />
              <ToonMat color={LEGGING} />
            </mesh>
            <group name={side > 0 ? 'KneeR' : 'KneeL'} position={[0, -0.36, 0]}>
              <mesh position={[0, -0.12, 0]}>
                <capsuleGeometry args={[0.11, 0.14, 6, 12]} />
                <ToonMat color={LEGGING} />
              </mesh>
              {/* botinha redonda */}
              <mesh position={[0, -0.37, 0.05]} scale={[1, 0.78, 1.3]}>
                <sphereGeometry args={[0.16, 16, 12]} />
                <ToonMat color={BOOT} />
              </mesh>
              <mesh position={[0, -0.44, 0.05]} scale={[1.05, 0.3, 1.35]}>
                <sphereGeometry args={[0.16, 14, 8]} />
                <ToonMat color={BOOT_SOLE} />
              </mesh>
            </group>
          </group>
        ))}

        <group name="Spine" position={[0, 0.02, 0]}>
          {/* vestidinho em sino */}
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.27, 0.42, 0.34, 22]} />
            <ToonMat color={DRESS} />
          </mesh>
          <mesh position={[0, -0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.035, 8, 26]} />
            <ToonMat color={DRESS_LIGHT} />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <capsuleGeometry args={[0.27, 0.2, 8, 18]} />
            <ToonMat color={DRESS} />
          </mesh>
          {/* gola branca + botões */}
          <mesh position={[0, 0.56, 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.15, 1]}>
            <torusGeometry args={[0.16, 0.06, 8, 18]} />
            <ToonMat color={COLLAR} />
          </mesh>
          {[0.42, 0.3].map((y) => (
            <mesh key={y} position={[0, y, 0.27]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <ToonMat color={BUTTON} />
            </mesh>
          ))}
          {/* mochilinha */}
          <mesh position={[0, 0.36, -0.3]} scale={[1, 1.05, 0.7]}>
            <sphereGeometry args={[0.22, 16, 12]} />
            <ToonMat color={BAG} />
          </mesh>
          <mesh position={[0, 0.3, -0.42]} scale={[1, 0.8, 0.5]}>
            <sphereGeometry args={[0.13, 14, 10]} />
            <ToonMat color={BAG_STRAP} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.17, 0.4, 0.1]} rotation={[0.2, 0, side * 0.1]}>
              <capsuleGeometry args={[0.025, 0.36, 4, 8]} />
              <ToonMat color={BAG_STRAP} />
            </mesh>
          ))}

          <TorsoOutfit outfit={outfit} />
          <ChestOutfit outfit={outfit} />

          {[1, -1].map((side) => (
            <group
              key={side}
              name={side > 0 ? 'ArmR' : 'ArmL'}
              position={[side * 0.31, 0.5, 0]}
              rotation={[0.05, 0, side * 0.32]}
            >
              <mesh position={[0, -0.09, 0]}>
                <capsuleGeometry args={[0.085, 0.12, 6, 12]} />
                <ToonMat color={outfit.furcoat ? '#ff9ec4' : outfit.raincoat ? '#ffd23f' : DRESS} />
              </mesh>
              <group name={side > 0 ? 'ForeR' : 'ForeL'} position={[0, -0.2, 0]}>
                <mesh position={[0, -0.06, 0]}>
                  <capsuleGeometry args={[0.075, 0.08, 6, 12]} />
                  <ToonMat color={SKIN} />
                </mesh>
                {/* mãozinha redonda */}
                <mesh position={[0, -0.19, 0.01]}>
                  <sphereGeometry args={[0.1, 14, 10]} />
                  <ToonMat color={SKIN} />
                </mesh>
                {side > 0 ? <RightHandItem outfit={outfit} /> : <LeftHandItem outfit={outfit} />}
              </group>
            </group>
          ))}

          <group name="Head" position={[0, 0.62, 0]}>
            {/* cabeção */}
            <mesh position={[0, 0.46, 0]} scale={[1.05, 0.96, 1]}>
              <sphereGeometry args={[0.5, 28, 22]} />
              <ToonMat color={SKIN} />
            </mesh>
            {/* orelhinhas */}
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.51, 0.42, 0]} scale={[0.5, 0.8, 0.6]}>
                <sphereGeometry args={[0.1, 10, 8]} />
                <ToonMat color={SKIN_SHADE} />
              </mesh>
            ))}
            {/* olhos grandes e brilhantes */}
            {[-1, 1].map((side) => (
              <group key={`e${side}`} position={[side * 0.17, 0.45, 0.44]} rotation={[0, side * 0.32, 0]}>
                <mesh scale={[0.78, 1, 0.42]}>
                  <sphereGeometry args={[0.095, 16, 12]} />
                  <ToonMat color={EYE} />
                </mesh>
                <mesh position={[0.025 * side, 0.035, 0.035]}>
                  <sphereGeometry args={[0.03, 10, 8]} />
                  <ToonMat color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
                </mesh>
                <mesh position={[-0.02 * side, -0.035, 0.035]}>
                  <sphereGeometry args={[0.014, 8, 6]} />
                  <ToonMat color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
                </mesh>
              </group>
            ))}
            {/* bochechas rosadas */}
            {[-1, 1].map((side) => (
              <mesh key={`c${side}`} position={[side * 0.3, 0.32, 0.38]} rotation={[0, side * 0.6, 0]} scale={[1.2, 0.7, 0.3]}>
                <sphereGeometry args={[0.07, 12, 8]} />
                <ToonMat color={CHEEK} transparent opacity={0.85} />
              </mesh>
            ))}
            {/* narizinho + sorriso */}
            <mesh position={[0, 0.36, 0.49]} scale={[1, 0.8, 0.7]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <ToonMat color={SKIN_SHADE} />
            </mesh>
            <mesh position={[0, 0.27, 0.465]} rotation={[0.25, 0, Math.PI]}>
              <torusGeometry args={[0.055, 0.016, 6, 14, Math.PI]} />
              <ToonMat color="#d0505e" />
            </mesh>

            {/* cabelo: capacete arredondado cobrindo topo e nuca */}
            <mesh position={[0, 0.5, -0.03]} scale={[1.1, 1.02, 1.08]}>
              <sphereGeometry args={[0.5, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <ToonMat color={HAIR} />
            </mesh>
            <mesh position={[0, 0.42, -0.1]} scale={[1.08, 1, 1]}>
              <sphereGeometry args={[0.49, 22, 16, Math.PI * 0.85, Math.PI * 1.3, Math.PI * 0.25, Math.PI * 0.6]} />
              <ToonMat color={HAIR} />
            </mesh>
            {/* franja em gomos */}
            <group ref={hairFrontRef}>
              {[-0.26, -0.09, 0.09, 0.26].map((x, i) => (
                <mesh key={x} position={[x, 0.74 - Math.abs(x) * 0.35, 0.37 - Math.abs(x) * 0.25]} rotation={[0.55, 0, x * 0.9]} scale={[1, 0.72, 0.55]}>
                  <sphereGeometry args={[0.15 - (i % 2) * 0.015, 14, 10]} />
                  <ToonMat color={i % 2 ? HAIR_LIGHT : HAIR} />
                </mesh>
              ))}
            </group>
            {/* maria-chiquinha com lacinhos */}
            <group ref={hairOpenRef}>
              {[-1, 1].map((side) => (
                <group key={`p${side}`} position={[side * 0.5, 0.36, -0.12]}>
                  <mesh position={[side * 0.08, -0.12, 0]} scale={[0.85, 1.15, 0.85]}>
                    <sphereGeometry args={[0.17, 16, 12]} />
                    <ToonMat color={HAIR} />
                  </mesh>
                  <mesh position={[0, 0.06, 0]}>
                    <sphereGeometry args={[0.07, 10, 8]} />
                    <ToonMat color={RIBBON} />
                  </mesh>
                </group>
              ))}
              {/* florzinha no cabelo */}
              <group position={[0.3, 0.8, 0.22]} rotation={[0.4, 0.3, 0]}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <mesh key={k} position={[Math.cos((k / 5) * Math.PI * 2) * 0.06, Math.sin((k / 5) * Math.PI * 2) * 0.06, 0]}>
                    <sphereGeometry args={[0.045, 8, 6]} />
                    <ToonMat color="#ffffff" />
                  </mesh>
                ))}
                <mesh position={[0, 0, 0.02]}>
                  <sphereGeometry args={[0.04, 8, 6]} />
                  <ToonMat color={BUTTON} />
                </mesh>
              </group>
            </group>
            {/* coque de trás (balança com o passo) */}
            <group name="HairBack" position={[0, 0.5, -0.42]}>
              <mesh position={[0, -0.05, -0.06]}>
                <sphereGeometry args={[0.17, 16, 12]} />
                <ToonMat color={HAIR_LIGHT} />
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
