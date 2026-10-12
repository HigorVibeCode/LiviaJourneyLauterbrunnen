import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { makeToonMaterial } from '../materials/toonMaterial'
import StaticBatch from './world/StaticBatch'
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

const PONY_SCALE = 0.68

/**
 * Pônei fofinho (crina colorida, sela pastel) — nasce no centro da trilha ao abrir gate_pasture,
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
      coat: makeToonMaterial({ color: '#f3b97f' }),
      coatShade: makeToonMaterial({ color: '#e6a368' }),
      muzzle: makeToonMaterial({ color: '#fff0dc' }),
      nostril: makeToonMaterial({ color: '#e88a8a' }),
      mane: makeToonMaterial({ color: '#ff8fb8' }),
      mane2: makeToonMaterial({ color: '#c39bff' }),
      mane3: makeToonMaterial({ color: '#8fd0ff' }),
      hoof: makeToonMaterial({ color: '#fff0c8' }),
      saddle: makeToonMaterial({ color: '#8fd0ff' }),
      saddleTrim: makeToonMaterial({ color: '#ffffff' }),
      blanket: makeToonMaterial({ color: '#ff9fc4' }),
      eye: makeToonMaterial({ color: '#4a3a5e' }),
      white: makeToonMaterial({ color: '#ffffff' }),
      cheek: makeToonMaterial({ color: '#ffb0c4' }),
      gold: makeToonMaterial({ color: '#ffd23f' }),
    }),
    [],
  )
  const shadowGeo = useMemo(() => new THREE.CircleGeometry(1, 20), [])
  const manes = [mats.mane, mats.mane2, mats.mane3]

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

    // jogo carregado do save já depois da cavalgada: cavalo espera no fim do pasto
    if (
      !horseRide.finished &&
      !horseRide.mounted &&
      useProgressStore.getState().unlockedGates.includes('gate_night')
    ) {
      horseRide.finished = true
      horseRide.waitZ = GATES.gate_night.z + 6
      horseRide.waitX = pathXAt(horseRide.waitZ)
      greetDone.current = true
    }

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
      {/* sombra macia */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[0.55, 0.9, 1]} geometry={shadowGeo}>
        <meshBasicMaterial color="#3b5a3a" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      <group ref={body} frustumCulled={false}>
        {/* pônei de brinquedo: modelado grande e encolhido para o assento
            ficar na altura do quadril da Livia montada (~0.95) */}
        <group scale={PONY_SCALE}>
        {/* ── tronco gordinho + manta + sela pastel (assento ~y 1.40–1.48) ── */}
        <StaticBatch>
          <mesh position={[0, 0.98, -0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[0.95, 1, 1]} material={mats.coat}>
            <capsuleGeometry args={[0.4, 0.62, 8, 16]} />
          </mesh>
          {/* peito */}
          <mesh position={[0, 1.0, 0.42]} scale={[0.9, 0.95, 0.85]} material={mats.coat}>
            <sphereGeometry args={[0.4, 16, 12]} />
          </mesh>
          {/* barriga clarinha */}
          <mesh position={[0, 0.78, 0.0]} scale={[0.75, 0.5, 1.35]} material={mats.muzzle}>
            <sphereGeometry args={[0.36, 14, 10]} />
          </mesh>
          {/* manta */}
          <mesh position={[0, 0.99, -0.06]} rotation={[Math.PI / 2, 0, 0]} scale={[0.96, 1, 1]} material={mats.blanket}>
            <cylinderGeometry args={[0.415, 0.415, 0.56, 20, 1, true, Math.PI / 2 + 0.25, Math.PI - 0.5]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh
              key={`bt${s}`}
              position={[0, 0.99, -0.06 + s * 0.28]}
              rotation={[0, 0, 0.25]}
              scale={[0.96, 1, 1]}
              material={mats.saddleTrim}
            >
              <torusGeometry args={[0.415, 0.03, 6, 20, Math.PI - 0.5]} />
            </mesh>
          ))}
          {/* sela */}
          <RoundedBox args={[0.46, 0.12, 0.5]} radius={0.05} smoothness={2} position={[0, 1.4, -0.06]} material={mats.saddle} />
          <RoundedBox args={[0.42, 0.18, 0.12]} radius={0.05} smoothness={2} position={[0, 1.47, -0.3]} material={mats.saddle} />
          <mesh position={[0, 1.5, 0.19]} material={mats.saddleTrim}>
            <sphereGeometry args={[0.07, 12, 10]} />
          </mesh>
          {/* estribos */}
          {[-1, 1].map((s) => (
            <group key={`st${s}`}>
              <mesh position={[s * 0.38, 1.13, -0.04]} rotation={[0, 0, s * 0.12]} material={mats.saddle}>
                <capsuleGeometry args={[0.025, 0.3, 4, 8]} />
              </mesh>
              <mesh position={[s * 0.4, 0.9, -0.04]} rotation={[0, Math.PI / 2, 0]} material={mats.gold}>
                <torusGeometry args={[0.07, 0.022, 6, 12]} />
              </mesh>
            </group>
          ))}
        </StaticBatch>

        {/* ── pescoço + cabeção ── */}
        <group ref={neck} position={[0, 1.2, 0.58]}>
          <StaticBatch>
            <mesh position={[0, 0.16, 0.06]} rotation={[0.5, 0, 0]} material={mats.coat}>
              <capsuleGeometry args={[0.25, 0.2, 8, 14]} />
            </mesh>
          </StaticBatch>
          {/* crina colorida */}
          <group ref={mane} position={[0, 0.3, -0.12]}>
            <StaticBatch>
              {[
                [0.22, -0.06, 0.15],
                [0.08, -0.1, 0.16],
                [-0.06, -0.13, 0.15],
                [-0.2, -0.13, 0.13],
                [0.34, 0.0, 0.13],
              ].map(([y, z, r], i) => (
                <mesh key={i} position={[i % 2 ? 0.04 : -0.04, y, z]} material={manes[i % 3]}>
                  <sphereGeometry args={[r, 12, 10]} />
                </mesh>
              ))}
            </StaticBatch>
          </group>
          <group ref={head} position={[0, 0.42, 0.2]}>
            <StaticBatch>
              <mesh position={[0, 0.06, 0.06]} material={mats.coat}>
                <sphereGeometry args={[0.32, 18, 14]} />
              </mesh>
              {/* focinho */}
              <mesh position={[0, -0.09, 0.32]} scale={[0.95, 0.82, 1.15]} material={mats.muzzle}>
                <sphereGeometry args={[0.22, 16, 12]} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={`n${s}`} position={[s * 0.08, -0.04, 0.565]} scale={[1, 0.7, 0.5]} material={mats.nostril}>
                  <sphereGeometry args={[0.035, 8, 6]} />
                </mesh>
              ))}
              {/* olhos grandes com brilho */}
              {[-1, 1].map((s) => (
                <group key={`e${s}`} position={[s * 0.17, 0.12, 0.3]} rotation={[0, s * 0.45, 0]}>
                  <mesh scale={[0.85, 1.15, 0.5]} material={mats.eye}>
                    <sphereGeometry args={[0.065, 12, 10]} />
                  </mesh>
                  <mesh position={[0.02, 0.03, 0.025]} material={mats.white}>
                    <sphereGeometry args={[0.024, 8, 6]} />
                  </mesh>
                </group>
              ))}
              {[-1, 1].map((s) => (
                <mesh key={`c${s}`} position={[s * 0.24, -0.04, 0.22]} scale={[0.5, 0.7, 1]} rotation={[0, s * 0.8, 0]} material={mats.cheek}>
                  <sphereGeometry args={[0.06, 8, 6]} />
                </mesh>
              ))}
              {/* orelhas */}
              {[-1, 1].map((s) => (
                <mesh
                  key={s}
                  position={[s * 0.16, 0.36, -0.02]}
                  rotation={[-0.1, 0, s * -0.3]}
                  scale={[1, 1, 0.7]}
                  material={mats.coatShade}
                >
                  <coneGeometry args={[0.08, 0.2, 12]} />
                </mesh>
              ))}
              {/* topete */}
              {[
                [0, 0.36, 0.12, 0.1, 0],
                [-0.09, 0.33, 0.16, 0.08, 1],
                [0.09, 0.33, 0.16, 0.08, 2],
              ].map(([x, y, z, r, m], i) => (
                <mesh key={`f${i}`} position={[x, y, z]} material={manes[m]}>
                  <sphereGeometry args={[r, 10, 8]} />
                </mesh>
              ))}
            </StaticBatch>
            <group ref={jaw} position={[0, -0.2, 0.32]}>
              <mesh position={[0, 0, 0.04]} scale={[1, 0.55, 0.9]} material={mats.muzzle}>
                <sphereGeometry args={[0.12, 12, 8]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* cauda fofa colorida */}
        <group ref={tail} position={[0, 1.16, -0.68]}>
          <StaticBatch>
            {[
              [-0.02, -0.06, -0.12, 0.15, 0],
              [0.0, -0.24, -0.24, 0.16, 1],
              [-0.02, -0.44, -0.3, 0.14, 2],
              [0.0, -0.6, -0.32, 0.11, 0],
            ].map(([x, y, z, r, m], i) => (
              <mesh key={i} position={[x, y, z]} material={manes[m]}>
                <sphereGeometry args={[r, 12, 10]} />
              </mesh>
            ))}
          </StaticBatch>
        </group>

        {/* perninhas gordinhas */}
        {[
          [legFL, shinFL, 0.22, 0.42],
          [legFR, shinFR, -0.22, 0.42],
          [legBL, shinBL, 0.22, -0.45],
          [legBR, shinBR, -0.22, -0.45],
        ].map(([legRef, shinRef, x, z], i) => (
          <group key={i} ref={legRef} position={[x, 0.74, z]}>
            <mesh position={[0, -0.14, 0]} material={mats.coat}>
              <capsuleGeometry args={[0.13, 0.16, 6, 12]} />
            </mesh>
            <group ref={shinRef} position={[0, -0.32, 0]}>
              <mesh position={[0, -0.12, 0]} material={mats.coat}>
                <capsuleGeometry args={[0.11, 0.12, 6, 12]} />
              </mesh>
              <mesh position={[0, -0.33, 0.02]} material={mats.hoof}>
                <cylinderGeometry args={[0.12, 0.135, 0.12, 14]} />
              </mesh>
            </group>
          </group>
        ))}
        </group>
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
