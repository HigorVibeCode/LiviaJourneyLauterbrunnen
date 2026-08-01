import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeToonMaterial } from '../materials/toonMaterial'
import {
  horseRide,
  HORSE_MOUNT_DIST,
  horseShouldDismount,
  HORSE_RIDE_RUN,
  HORSE_GREET_DUR,
} from '../lib/horseRide'
import { HORSE_WAIT, GATES, groundHeightAt, pathXAt } from '../config/world'
import { playerPosition } from '../store/playerStore'
import { useProgressStore } from '../store/progressStore'
import { guideInput } from '../lib/guideInput'
import { sfxGallopHoof, sfxNeigh } from '../audio/sfx'

/**
 * Cavalo low-poly — nasce no centro da trilha ao abrir gate_pasture,
 * relincha/empina em cumprimento, depois espera para montar.
 */
export default function Horse() {
  const root = useRef(null)
  const body = useRef(null)
  const neck = useRef(null)
  const head = useRef(null)
  const jaw = useRef(null)
  const mane = useRef(null)
  const tail = useRef(null)
  const legFL = useRef(null)
  const legFR = useRef(null)
  const legBL = useRef(null)
  const legBR = useRef(null)
  const shinFL = useRef(null)
  const shinFR = useRef(null)
  const shinBL = useRef(null)
  const shinBR = useRef(null)
  const hoofBeat = useRef(0)
  const hoofCd = useRef(0)
  const gaitPhase = useRef(0)
  const greetT = useRef(0)
  const greetDone = useRef(false)
  const greetStart = useRef(-1)
  const neighAt = useRef(-1)

  const mats = useMemo(
    () => ({
      coat: makeToonMaterial({ color: '#a87848' }),
      coatDark: makeToonMaterial({ color: '#7a5428' }),
      coatDeep: makeToonMaterial({ color: '#6a401c' }),
      coatLight: makeToonMaterial({ color: '#b88858' }),
      mane: makeToonMaterial({ color: '#3a2410' }),
      muzzle: makeToonMaterial({ color: '#4a3020' }),
      hoof: makeToonMaterial({ color: '#2a2018' }),
      saddle: makeToonMaterial({ color: '#5a3418' }),
      leather: makeToonMaterial({ color: '#4a2810' }),
      blanket: makeToonMaterial({ color: '#7a4230' }),
      eye: makeToonMaterial({ color: '#1a1008' }),
      white: makeToonMaterial({ color: '#f0e4d0' }),
      metal: makeToonMaterial({ color: '#d0b070' }),
    }),
    [],
  )

  // Depois da Livia (priority -1): vê tapPending no mesmo frame do E.
  // NÃO usar priority > 0 — isso desliga o auto-render do R3F.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const unlocked = useProgressStore.getState().unlockedGates.includes('gate_pasture')
    horseRide.ready = unlocked

    if (!unlocked) {
      horseRide.mounted = false
      horseRide.nearMount = false
      horseRide.finished = false
      horseRide.greeting = false
      horseRide.greetDone = false
      horseRide.waitX = HORSE_WAIT.x
      horseRide.waitZ = HORSE_WAIT.z
      horseRide.x = HORSE_WAIT.x
      horseRide.z = HORSE_WAIT.z
      horseRide.bobY = 0
      horseRide.speed = 0
      greetT.current = 0
      greetDone.current = false
      greetStart.current = -1
      neighAt.current = -1
      if (root.current) root.current.visible = false
      return
    }
    if (root.current) root.current.visible = true

    // cumprimento: empina + relincha (tempo de relógio — independente do FPS)
    if (!greetDone.current && !horseRide.mounted && !horseRide.finished) {
      if (greetStart.current < 0) {
        greetStart.current = state.clock.elapsedTime
        neighAt.current = state.clock.elapsedTime
        sfxNeigh()
      }
      greetT.current = Math.min(
        HORSE_GREET_DUR,
        state.clock.elapsedTime - greetStart.current,
      )
      if (greetT.current >= HORSE_GREET_DUR) greetDone.current = true
      // segundo relincho no pico do empinar
      if (
        greetT.current > 0.85 &&
        neighAt.current > 0 &&
        state.clock.elapsedTime - neighAt.current > 0.9
      ) {
        sfxNeigh()
        neighAt.current = -2
      }
    }
    // debug mountHorse() / HMR: respeita greetDone já setado no estado compartilhado
    if (horseRide.greetDone || horseRide.mounted) greetDone.current = true
    horseRide.greeting = !greetDone.current && !horseRide.mounted && !horseRide.finished
    horseRide.greetDone = greetDone.current

    const px = playerPosition.x
    const pz = playerPosition.z
    const dist = Math.hypot(px - horseRide.x, pz - horseRide.z)
    horseRide.nearMount =
      !horseRide.mounted && !horseRide.finished && greetDone.current && dist < HORSE_MOUNT_DIST

    // backup: se a Livia não montou no hold, o tap ainda chega aqui
    if (horseRide.nearMount && guideInput.tapPending && !horseRide.mounted) {
      guideInput.tapPending = false
      guideInput.holding = false
      guideInput.holdTime = 0
      horseRide.mounted = true
      const toast = 'Livia montou o cavalo! Atravessa o pasto cavalgando.'
      useProgressStore.setState({ toast })
      setTimeout(() => {
        if (useProgressStore.getState().toast === toast) {
          useProgressStore.setState({ toast: null })
        }
      }, 3500)
    }

    if (horseRide.mounted && horseShouldDismount(pz)) {
      horseRide.mounted = false
      horseRide.finished = true
      horseRide.waitZ = GATES.gate_night.z + 6
      horseRide.waitX = pathXAt(horseRide.waitZ)
      horseRide.x = horseRide.waitX
      horseRide.z = horseRide.waitZ
      horseRide.y = groundHeightAt(horseRide.x, horseRide.z)
      horseRide.speed = 0
      horseRide.bobY = 0
      const { unlockedGates } = useProgressStore.getState()
      if (!unlockedGates.includes('gate_night')) {
        const toast = 'Fim da cavalgada! O Vale Noturno se abre à frente.'
        useProgressStore.setState({
          unlockedGates: [...unlockedGates, 'gate_night'],
          toast,
        })
        setTimeout(() => {
          if (useProgressStore.getState().toast === toast) {
            useProgressStore.setState({ toast: null })
          }
        }, 3500)
      }
    }

    if (!horseRide.mounted) {
      if (!horseRide.finished) {
        horseRide.waitX = HORSE_WAIT.x
        horseRide.waitZ = HORSE_WAIT.z
      }
      horseRide.x = horseRide.waitX
      horseRide.z = horseRide.waitZ
      horseRide.y = groundHeightAt(horseRide.x, horseRide.z)
      horseRide.speed = 0
      horseRide.bobY = 0
      horseRide.yaw = Math.PI
    }

    if (root.current) {
      root.current.position.set(horseRide.x, horseRide.y, horseRide.z)
      root.current.rotation.y = horseRide.yaw
    }

    const greeting = !greetDone.current && !horseRide.mounted && !horseRide.finished
    const greetU = greetT.current / HORSE_GREET_DUR
    // curva de empinar: sobe, segura, desce
    const rear =
      greeting
        ? greetU < 0.35
          ? easeOut(greetU / 0.35) * 0.72
          : greetU < 0.55
            ? 0.72
            : 0.72 * (1 - easeIn((greetU - 0.55) / 0.45))
        : 0

    const spd = horseRide.speed
    const moving = spd > 0.8
    const speedNorm = THREE.MathUtils.clamp(spd / HORSE_RIDE_RUN, 0, 1)
    const gaitRate = moving ? 3.4 + speedNorm * 5.2 : greeting ? 0 : 1.15
    gaitPhase.current += dt * gaitRate
    const g = gaitPhase.current

    const hindAmp = moving ? 0.72 + speedNorm * 0.28 : 0.04
    const foreAmp = moving ? 0.78 + speedNorm * 0.32 : 0.04
    let bl = Math.sin(g) * hindAmp
    let br = Math.sin(g + 0.55) * hindAmp
    let fl = Math.sin(g + Math.PI + 0.15) * foreAmp
    let fr = Math.sin(g + Math.PI + 0.7) * foreAmp

    // ao empinar: dianteiros recolhem, traseiros esticam
    if (greeting) {
      fl = -0.15 - rear * 0.85
      fr = -0.1 - rear * 0.9
      bl = 0.25 + rear * 0.35
      br = 0.2 + rear * 0.4
    }

    if (legFL.current) legFL.current.rotation.x = fl
    if (legFR.current) legFR.current.rotation.x = fr
    if (legBL.current) legBL.current.rotation.x = bl
    if (legBR.current) legBR.current.rotation.x = br

    const knee = (v) => Math.max(0, -v) * 0.85 + (moving ? 0.12 : greeting ? 0.35 : 0.06)
    if (shinFL.current) shinFL.current.rotation.x = greeting ? 0.9 + rear * 0.4 : knee(fl)
    if (shinFR.current) shinFR.current.rotation.x = greeting ? 0.85 + rear * 0.45 : knee(fr)
    if (shinBL.current) shinBL.current.rotation.x = greeting ? 0.05 : knee(bl)
    if (shinBR.current) shinBR.current.rotation.x = greeting ? 0.05 : knee(br)

    const bob = moving
      ? Math.abs(Math.sin(g * 2)) * (0.06 + speedNorm * 0.1)
      : greeting
        ? rear * 0.22
        : Math.sin(state.clock.elapsedTime * 1.1) * 0.012
    horseRide.bobY = bob

    if (body.current) {
      body.current.position.y = bob
      body.current.rotation.x = greeting
        ? -rear * 0.85
        : moving
          ? Math.sin(g * 2) * 0.06 * speedNorm
          : 0
      body.current.rotation.z = moving
        ? Math.sin(g) * 0.04 * speedNorm
        : Math.sin(state.clock.elapsedTime * 0.8) * 0.015
    }

    if (neck.current) {
      neck.current.rotation.x = greeting
        ? -0.55 - rear * 0.35
        : moving
          ? -0.18 - speedNorm * 0.12 + Math.sin(g * 2) * 0.1
          : -0.22 + Math.sin(state.clock.elapsedTime * 0.9) * 0.07
    }
    if (head.current) {
      head.current.rotation.x = greeting
        ? 0.25 + Math.sin(state.clock.elapsedTime * 14) * 0.08
        : moving
          ? 0.08 + Math.sin(g * 2 + 0.4) * 0.06
          : 0.05
    }
    if (jaw.current) {
      jaw.current.rotation.x = greeting ? 0.25 + Math.sin(state.clock.elapsedTime * 18) * 0.15 : 0.04
    }
    if (mane.current) {
      mane.current.rotation.z = Math.sin(g * 1.6 + 0.3) * (moving ? 0.18 + speedNorm * 0.12 : greeting ? 0.25 : 0.04)
      mane.current.rotation.x = Math.sin(g * 2) * (moving ? 0.1 : greeting ? 0.2 : 0.02)
    }
    if (tail.current) {
      tail.current.rotation.x = greeting
        ? 0.9 + rear * 0.4
        : 0.35 + Math.sin(g * 1.8) * (moving ? 0.35 + speedNorm * 0.2 : 0.08)
      tail.current.rotation.y = Math.sin(g * 1.3) * (moving ? 0.28 : greeting ? 0.35 : 0.1)
    }

    if (horseRide.mounted && moving) {
      hoofCd.current -= dt
      if (hoofCd.current <= 0) {
        const beat = hoofBeat.current % 4
        sfxGallopHoof(beat, speedNorm)
        hoofBeat.current = beat + 1
        const base = THREE.MathUtils.lerp(0.2, 0.085, speedNorm)
        const gaps = [base, base * 0.85, base, base * 1.55]
        hoofCd.current = gaps[beat]
      }
    } else {
      hoofCd.current = 0
      hoofBeat.current = 0
    }
  })

  return (
    <group ref={root} position={[HORSE_WAIT.x, 0, HORSE_WAIT.z]} frustumCulled={false}>
      <group ref={body} frustumCulled={false}>
        {/* ── tronco alongado (menos “dois blobs”) ── */}
        <mesh castShadow position={[0, 1.15, 0.05]} rotation={[0.05, 0, 0]} material={mats.coat}>
          <capsuleGeometry args={[0.34, 1.25, 6, 12]} />
        </mesh>
        <mesh castShadow position={[0, 1.32, 0.55]} scale={[1.15, 0.72, 0.88]} material={mats.coatLight}>
          <sphereGeometry args={[0.36, 8, 6]} />
        </mesh>
        <mesh castShadow position={[0, 1.08, 0.82]} scale={[1.05, 0.9, 0.85]} material={mats.coatDark}>
          <sphereGeometry args={[0.34, 8, 6]} />
        </mesh>
        <mesh castShadow position={[0, 1.28, -0.55]} scale={[1.12, 0.82, 0.95]} material={mats.coatDark}>
          <sphereGeometry args={[0.38, 8, 6]} />
        </mesh>
        <mesh castShadow position={[0, 1.18, -0.92]} scale={[0.8, 0.65, 0.7]} material={mats.coatDeep}>
          <sphereGeometry args={[0.26, 6, 5]} />
        </mesh>
        <mesh position={[0, 0.92, 0.05]} scale={[0.75, 0.48, 1.25]} material={mats.white}>
          <sphereGeometry args={[0.36, 7, 5]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh
            key={`sh${s}`}
            castShadow
            position={[s * 0.3, 1.22, 0.48]}
            scale={[0.5, 0.65, 0.7]}
            material={mats.coat}
          >
            <sphereGeometry args={[0.2, 6, 5]} />
          </mesh>
        ))}
        {/* coxas traseiras */}
        {[-1, 1].map((s) => (
          <mesh
            key={`hq${s}`}
            castShadow
            position={[s * 0.22, 1.05, -0.55]}
            scale={[0.55, 0.7, 0.65]}
            material={mats.coatDark}
          >
            <sphereGeometry args={[0.22, 6, 5]} />
          </mesh>
        ))}

        {/* ── pescoço arqueado + cabeça ── */}
        <group ref={neck} position={[0, 1.42, 0.85]}>
          <mesh castShadow position={[0, 0.22, 0.05]} rotation={[0.72, 0, 0]} material={mats.coat}>
            <capsuleGeometry args={[0.15, 0.48, 5, 8]} />
          </mesh>
          <mesh
            castShadow
            position={[0, 0.42, 0.22]}
            rotation={[0.95, 0, 0]}
            scale={[0.9, 1, 0.75]}
            material={mats.coatLight}
          >
            <capsuleGeometry args={[0.12, 0.32, 4, 7]} />
          </mesh>
          <mesh castShadow position={[0, 0.08, 0.12]} rotation={[0.5, 0, 0]} material={mats.coatDark}>
            <capsuleGeometry args={[0.14, 0.22, 3, 6]} />
          </mesh>
          <group ref={mane} position={[0, 0.32, -0.06]}>
            {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((y, i) => (
              <mesh
                key={i}
                castShadow
                position={[0, y * 0.55, -0.05 + i * 0.025]}
                rotation={[0.35 + i * 0.05, 0, i % 2 ? 0.1 : -0.1]}
                material={mats.mane}
              >
                <boxGeometry args={[0.07, 0.22 + i * 0.01, 0.14]} />
              </mesh>
            ))}
          </group>
          <group ref={head} position={[0, 0.58, 0.52]}>
            <mesh castShadow scale={[0.95, 0.9, 1]} material={mats.coatDeep}>
              <boxGeometry args={[0.26, 0.24, 0.36]} />
            </mesh>
            <mesh castShadow position={[0, 0.02, 0.08]} scale={[0.85, 0.7, 0.7]} material={mats.coat}>
              <sphereGeometry args={[0.14, 6, 5]} />
            </mesh>
            <mesh castShadow position={[0, -0.02, 0.3]} material={mats.muzzle}>
              <boxGeometry args={[0.18, 0.14, 0.28]} />
            </mesh>
            <mesh castShadow position={[0, 0.02, 0.42]} material={mats.white}>
              <boxGeometry args={[0.12, 0.06, 0.08]} />
            </mesh>
            <group ref={jaw} position={[0, -0.08, 0.32]}>
              <mesh position={[0, -0.02, 0.06]} material={mats.muzzle}>
                <boxGeometry args={[0.15, 0.07, 0.18]} />
              </mesh>
            </group>
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                castShadow
                position={[s * 0.09, 0.18, -0.08]}
                rotation={[0.25, 0, s * 0.35]}
                material={mats.coatDeep}
              >
                <coneGeometry args={[0.045, 0.16, 4]} />
              </mesh>
            ))}
            {[-1, 1].map((s) => (
              <mesh key={`e${s}`} position={[s * 0.12, 0.06, 0.12]} material={mats.eye}>
                <sphereGeometry args={[0.03, 5, 4]} />
              </mesh>
            ))}
            <mesh castShadow position={[0, 0.16, 0]} material={mats.mane}>
              <boxGeometry args={[0.12, 0.1, 0.18]} />
            </mesh>
            <mesh position={[0, 0.0, 0.08]} rotation={[Math.PI / 2, 0, 0]} material={mats.leather}>
              <torusGeometry args={[0.13, 0.012, 4, 12]} />
            </mesh>
            <mesh position={[0, -0.02, 0.22]} material={mats.metal}>
              <torusGeometry args={[0.06, 0.01, 4, 8]} />
            </mesh>
          </group>
        </group>

        {/* cauda */}
        <group ref={tail} position={[0, 1.28, -1.05]}>
          <mesh castShadow position={[0, -0.1, -0.12]} rotation={[0.6, 0, 0]} material={mats.mane}>
            <capsuleGeometry args={[0.055, 0.55, 3, 6]} />
          </mesh>
          <mesh castShadow position={[0, -0.38, -0.35]} rotation={[0.85, 0, 0]} material={mats.mane}>
            <capsuleGeometry args={[0.04, 0.35, 3, 5]} />
          </mesh>
        </group>

        {/* manta + sela (assento ~y 1.20–1.35 — Livia encaixa) */}
        <mesh castShadow position={[0, 1.28, -0.05]} material={mats.blanket}>
          <boxGeometry args={[0.68, 0.08, 0.78]} />
        </mesh>
        <mesh castShadow position={[0, 1.36, -0.08]} material={mats.saddle}>
          <boxGeometry args={[0.52, 0.14, 0.5]} />
        </mesh>
        <mesh castShadow position={[0, 1.44, 0.12]} material={mats.leather}>
          <boxGeometry args={[0.32, 0.14, 0.14]} />
        </mesh>
        {/* cantle alto — legível de trás */}
        <mesh castShadow position={[0, 1.5, -0.32]} material={mats.leather}>
          <boxGeometry args={[0.4, 0.22, 0.16]} />
        </mesh>
        <mesh position={[0, 1.28, -0.05]} material={mats.leather}>
          <boxGeometry args={[0.62, 0.05, 0.08]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.32, 1.12, -0.05]} material={mats.leather}>
              <boxGeometry args={[0.04, 0.42, 0.06]} />
            </mesh>
            <mesh position={[s * 0.34, 0.88, 0]} material={mats.metal}>
              <torusGeometry args={[0.075, 0.014, 4, 10]} />
            </mesh>
          </group>
        ))}

        {/* pernas mais grossas / articuladas */}
        {[
          [legFL, shinFL, 0.24, 0.52],
          [legFR, shinFR, -0.24, 0.52],
          [legBL, shinBL, 0.26, -0.55],
          [legBR, shinBR, -0.26, -0.55],
        ].map(([legRef, shinRef, x, z], i) => (
          <group key={i} ref={legRef} position={[x, 0.78, z]}>
            <mesh castShadow position={[0, -0.18, 0]} material={mats.coatDark}>
              <capsuleGeometry args={[0.1, 0.28, 4, 7]} />
            </mesh>
            <group ref={shinRef} position={[0, -0.38, 0]}>
              <mesh castShadow position={[0, -0.2, 0]} material={mats.coatDeep}>
                <capsuleGeometry args={[0.075, 0.28, 3, 6]} />
              </mesh>
              <mesh castShadow position={[0, -0.4, 0.04]} material={mats.hoof}>
                <boxGeometry args={[0.14, 0.1, 0.2]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t)
}
function easeIn(t) {
  return t * t
}
