import * as THREE from 'three'
import { makeToonMaterial } from '../../materials/toonMaterial'
import { useMemo } from 'react'
import ToonMat from '../../materials/ToonMat'
import { useShallow } from 'zustand/react/shallow'
import { useProgressStore } from '../../store/progressStore'

/**
 * Equipamentos visíveis da Livia — montados DENTRO do rig, então seguem
 * a animação de andar/correr:
 *
 *  capa de chuva  → poncho amarelo + capuz (veste ao coletar, fica)
 *  casaco de pele → sobrepõe a capa: casaco marrom com gola de pele
 *  binóculo       → pendurado no pescoço (fica)
 *  chave / ferramenta → na mão direita, somem quando o portão consome
 *  cristal        → na mão esquerda, brilhando, até abrir o último portão
 *
 * IMPORTANTE: tudo fica sempre montado e só alterna `visible`. Montar
 * malhas na hora da coleta criava geometria + shader no meio do frame —
 * era a "travadinha" ao pegar um item.
 *
 * Âncoras do Spine (LiviaRig):
 *  torso ~y 0.27 · ombros ArmL/R (±0.225, 0.45) · pescoço ~y 0.54 · Head y 0.6
 */
export function useOutfit() {
  return useProgressStore(
    useShallow((s) => {
      const has = (id) => s.inventory.includes(id)
      return {
        raincoat: has('capa_chuva'),
        furcoat: has('casaco'),
        binoculars: has('binoculo'),
        key: has('chave_portao'),
        tool: has('ferramenta'),
        crystal: has('cristal'),
        lantern: s.hasLantern,
      }
    }),
  )
}

/** Tufts da gola — âncora no pescoço (y≈0.50–0.54), espalhados no anel */
const COLLAR_TUFTS = [
  [0, 0.52, 0.1, 0.038],
  [0.09, 0.51, 0.07, 0.034],
  [-0.09, 0.51, 0.07, 0.034],
  [0.13, 0.5, 0.02, 0.032],
  [-0.13, 0.5, 0.02, 0.032],
  [0.12, 0.49, -0.05, 0.03],
  [-0.12, 0.49, -0.05, 0.03],
  [0.06, 0.515, -0.08, 0.032],
  [-0.06, 0.515, -0.08, 0.032],
  [0, 0.5, -0.1, 0.036],
  [0.08, 0.48, 0.09, 0.028],
  [-0.08, 0.48, 0.09, 0.028],
]

/** Poncho / casaco sobre o torso (dentro do grupo Spine) */
export function TorsoOutfit({ outfit }) {
  const showFur = outfit.furcoat
  const showRain = outfit.raincoat && !showFur
  const binocularZ = showFur ? 0.24 : showRain ? 0.26 : 0.17

  const mats = useMemo(
    () => ({
      rain: makeToonMaterial({
        color: '#e0c83e',}),
      rainDark: makeToonMaterial({
        color: '#b8a028',}),
      rainMid: makeToonMaterial({
        color: '#d4bc36',}),
      rainShine: makeToonMaterial({
        color: '#f0e06a',}),
      rainTrim: makeToonMaterial({
        color: '#8a7420',}),
      furBody: makeToonMaterial({
        color: '#8b5530',}),
      furDark: makeToonMaterial({
        color: '#6a3e22',}),
      furLight: makeToonMaterial({
        color: '#c4a882',}),
      furCream: makeToonMaterial({
        color: '#efe6d8',}),
      button: makeToonMaterial({
        color: '#3a2c1e',}),
      belt: makeToonMaterial({
        color: '#4a3220',}),
    }),
    [],
  )

  return (
    <group>
      {/* ── casaco de pele: mesma silhueta do torso ── */}
      <group visible={showFur}>
        <mesh castShadow position={[0, 0.27, 0]} scale={[1.05, 1.01, 1.06]} material={mats.furBody}>
          <capsuleGeometry args={[0.165, 0.28, 4, 10]} />
        </mesh>
        <mesh castShadow position={[0, 0.29, -0.01]} scale={[1.03, 0.9, 1.04]} material={mats.furDark}>
          <capsuleGeometry args={[0.158, 0.2, 3, 9]} />
        </mesh>
        <mesh castShadow position={[0, 0.1, 0]} material={mats.belt}>
          <cylinderGeometry args={[0.182, 0.186, 0.04, 8]} />
        </mesh>
        <mesh castShadow position={[0, 0.02, 0]} material={mats.furDark}>
          <cylinderGeometry args={[0.185, 0.195, 0.07, 8]} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.2, 0.43, 0]}>
            <mesh castShadow material={mats.furBody}>
              <sphereGeometry args={[0.065, 6, 5]} />
            </mesh>
            <mesh position={[side * 0.025, -0.08, 0.01]} material={mats.furCream}>
              <sphereGeometry args={[0.032, 5, 4]} />
            </mesh>
          </group>
        ))}
        <mesh castShadow position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.furCream}>
          <torusGeometry args={[0.08, 0.032, 5, 10]} />
        </mesh>
        {COLLAR_TUFTS.map(([x, y, z, r], i) => (
          <mesh key={i} castShadow position={[x, y, z]} material={i % 3 === 0 ? mats.furLight : mats.furCream}>
            <sphereGeometry args={[r * 0.75, 4, 3]} />
          </mesh>
        ))}
        {[0.34, 0.25, 0.17].map((y) => (
          <mesh key={y} position={[0, y, 0.165]} material={mats.button}>
            <sphereGeometry args={[0.012, 5, 4]} />
          </mesh>
        ))}
      </group>

      {/* ── capa de chuva: cola no torso (quase a mesma cápsula) ── */}
      <group visible={showRain}>
        <mesh castShadow position={[0, 0.27, 0]} scale={[1.02, 1.0, 1.03]} material={mats.rain}>
          <capsuleGeometry args={[0.165, 0.28, 4, 10]} />
        </mesh>
        <mesh castShadow position={[0, 0.29, -0.01]} scale={[1.01, 0.9, 1.02]} material={mats.rainDark}>
          <capsuleGeometry args={[0.158, 0.2, 3, 9]} />
        </mesh>
        <mesh castShadow position={[0, 0.28, 0.135]} scale={[0.7, 0.9, 0.22]} material={mats.rainShine}>
          <capsuleGeometry args={[0.07, 0.14, 3, 6]} />
        </mesh>
        {/* costas / sob a mochila — capa amarela visível de trás */}
        <mesh castShadow position={[0, 0.26, -0.1]} scale={[0.95, 0.85, 0.35]} material={mats.rainMid}>
          <capsuleGeometry args={[0.12, 0.16, 3, 6]} />
        </mesh>
        <mesh castShadow position={[0, 0.08, 0]} material={mats.rainDark}>
          <cylinderGeometry args={[0.178, 0.188, 0.06, 10]} />
        </mesh>
        {/* ombros da capa — colados aos deltóides do rig */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            castShadow
            position={[side * 0.2, 0.44, 0]}
            scale={[0.9, 0.85, 0.9]}
            material={mats.rain}
          >
            <sphereGeometry args={[0.062, 6, 5]} />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.5, 0]} material={mats.rainDark}>
          <cylinderGeometry args={[0.06, 0.09, 0.055, 8]} />
        </mesh>
        {[0.34, 0.25, 0.17].map((y) => (
          <mesh key={y} position={[0, y, 0.165]} material={mats.rainTrim}>
            <sphereGeometry args={[0.01, 5, 4]} />
          </mesh>
        ))}
      </group>

      {/* binóculo pendurado no peito */}
      <group visible={outfit.binoculars} position={[0, 0.3, binocularZ]}>
        <mesh position={[0, 0.12, -0.02]} rotation={[0.3, 0, 0]}>
          <torusGeometry args={[0.09, 0.008, 4, 10]} />
          <ToonMat color="#3a3228"/>
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} castShadow position={[s * 0.035, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.034, 0.09, 8]} />
            <ToonMat color="#4a5560"/>
          </mesh>
        ))}
      </group>

      {/* lampião na cintura */}
      <group visible={outfit.lantern} position={[-0.14, 0.08, 0.2]} rotation={[0, 0.4, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.025, 0.03, 0.14, 5]} />
          <ToonMat color="#5a4030"/>
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.06, 0.08, 0.06]} />
          <ToonMat
            color="#ffd080"
            emissive="#ffb040"
            emissiveIntensity={1.4}/>
        </mesh>
      </group>
    </group>
  )
}

/**
 * Capuz: irmão do cabelo no Head.
 * Calota do cabelo: [0, 0.2, -0.02] · olhos: y 0.168 / z 0.138
 * Capuz fica mais atrás (z negativo), abertura facial clara — não cobre olhos.
 */
export function HeadOutfit({ outfit }) {
  const showFur = outfit.furcoat
  const showRain = outfit.raincoat && !showFur

  const mats = useMemo(
    () => ({
      rain: makeToonMaterial({
        color: '#e0c83e',side: THREE.DoubleSide,
      }),
      rainDark: makeToonMaterial({
        color: '#b8a028',side: THREE.DoubleSide,
      }),
      rainShine: makeToonMaterial({
        color: '#f0e06a',}),
      fur: makeToonMaterial({
        color: '#8b5530',side: THREE.DoubleSide,
      }),
      furDark: makeToonMaterial({
        color: '#6a3e22',side: THREE.DoubleSide,
      }),
      furCream: makeToonMaterial({
        color: '#efe6d8',}),
      furLight: makeToonMaterial({
        color: '#c4a882',}),
    }),
    [],
  )

  const hoodFurTufts = useMemo(
    () =>
      [
        [0, 0.26, -0.12],
        [0.1, 0.22, -0.08],
        [-0.1, 0.22, -0.08],
        [0.13, 0.16, -0.06],
        [-0.13, 0.16, -0.06],
        [0.08, 0.2, -0.14],
        [-0.08, 0.2, -0.14],
        [0, 0.18, -0.16],
        [0.11, 0.14, 0.0],
        [-0.11, 0.14, 0.0],
      ].map(([x, y, z], i) => (
        <mesh key={i} castShadow position={[x, y, z]} material={i % 2 ? mats.furLight : mats.furCream}>
          <sphereGeometry args={[0.032 + (i % 3) * 0.006, 4, 3]} />
        </mesh>
      )),
    [mats],
  )

  return (
    <group>
      {/* capuz do casaco — senta na calota, abertura facial clara */}
      <group visible={showFur}>
        <mesh castShadow position={[0, 0.175, -0.06]} scale={[1.08, 1.0, 1.1]} material={mats.fur}>
          <sphereGeometry args={[0.165, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        </mesh>
        <mesh castShadow position={[0, 0.1, -0.14]} scale={[1.0, 0.8, 0.85]} material={mats.furDark}>
          <sphereGeometry args={[0.1, 7, 5]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            castShadow
            position={[side * 0.13, 0.12, -0.04]}
            rotation={[0.15, side * 0.3, side * 0.1]}
            scale={[0.38, 0.75, 0.6]}
            material={mats.furDark}
          >
            <sphereGeometry args={[0.08, 6, 5]} />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.13, 0.02]} rotation={[0.95, 0, 0]} material={mats.furCream}>
          <torusGeometry args={[0.125, 0.024, 5, 12]} />
        </mesh>
        {hoodFurTufts}
      </group>

      {/* capuz da capa — senta na calota, abertura do rosto livre */}
      <group visible={showRain}>
        <mesh castShadow position={[0, 0.17, -0.055]} scale={[1.04, 0.96, 1.05]} material={mats.rain}>
          <sphereGeometry args={[0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        </mesh>
        <mesh castShadow position={[0, 0.1, -0.125]} scale={[0.92, 0.7, 0.78]} material={mats.rainDark}>
          <sphereGeometry args={[0.09, 7, 5]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            castShadow
            position={[side * 0.12, 0.11, -0.04]}
            rotation={[0.1, side * 0.25, side * 0.06]}
            scale={[0.34, 0.65, 0.5]}
            material={mats.rainDark}
          >
            <sphereGeometry args={[0.075, 6, 5]} />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.13, 0.02]} rotation={[0.95, 0, 0]} material={mats.rainShine}>
          <torusGeometry args={[0.115, 0.012, 5, 12]} />
        </mesh>
      </group>
    </group>
  )
}

/** Item na mão direita: chave (fase 1) ou martelo (fase 2).
 *  Offsets relativos ao grupo ForeR do rig procedural. */
export function RightHandItem({ outfit }) {
  return (
    <group>
      <group visible={outfit.key} position={[0, -0.28, 0.06]} rotation={[0.9, 0, 0.2]}>
        <mesh castShadow>
          <torusGeometry args={[0.05, 0.018, 5, 8]} />
          <ToonMat color="#f0cf4c"/>
        </mesh>
        <mesh castShadow position={[0.085, 0, 0]}>
          <boxGeometry args={[0.1, 0.024, 0.024]} />
          <ToonMat color="#f0cf4c"/>
        </mesh>
        <mesh castShadow position={[0.125, -0.028, 0]}>
          <boxGeometry args={[0.026, 0.04, 0.024]} />
          <ToonMat color="#f0cf4c"/>
        </mesh>
      </group>

      <group visible={!outfit.key && outfit.tool} position={[0, -0.28, 0.05]} rotation={[1.15, 0, 0.15]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.016, 0.02, 0.22, 5]} />
          <ToonMat color="#5c3a1e"/>
        </mesh>
        <mesh castShadow position={[0, 0.11, 0]}>
          <boxGeometry args={[0.05, 0.055, 0.13]} />
          <ToonMat color="#9fb0c2"/>
        </mesh>
      </group>
    </group>
  )
}

/** Cristal na mão esquerda, brilhando (ForeL). */
export function LeftHandItem({ outfit }) {
  return (
    <group visible={outfit.crystal} position={[0, -0.28, 0.06]}>
      <mesh castShadow>
        <octahedronGeometry args={[0.075, 0]} />
        <ToonMat
          color="#6ec8e8"emissive="#6ec8e8"
          emissiveIntensity={1.4}
          transparent
          opacity={0.95}
        />
      </mesh>
    </group>
  )
}
