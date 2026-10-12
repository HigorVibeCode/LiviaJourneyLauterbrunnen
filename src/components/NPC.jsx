import { useMemo, useRef } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { Billboard, RoundedBox } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useProgressStore } from '../store/progressStore'
import { ITEMS } from '../store/progressStore'
import { resolveNpcPosition } from '../config/npcs'
import { NPC_DIALOGUES } from '../config/story'
import { PAL } from '../config/palette'
import { guideInput } from '../lib/guideInput'
import { playerPosition } from '../store/playerStore'
import StaticBatch from './world/StaticBatch'
import * as THREE from 'three'

const HANDOFF_DUR = 0.7

// Proporções de bichinho (estilo Animal Crossing): cabeção redondo,
// corpinho de pera, bracinhos e perninhas curtas.
const HEAD_Y = 0.82 // pescoço (pivô do headRef)
const HEAD_R = 0.4 // raio da cabeça
const HEAD_C = 0.4 // centro da cabeça, local ao pescoço
const SHOULDER_Y = 0.7
const SHOULDER_X = 0.33
const HIP_Y = 0.2

/** ponto na frente da cabeça (coordenadas locais ao pescoço) */
function onHead(x, y, lift = 0) {
  const z = Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - y * y))
  return [x, HEAD_C + y, z + lift]
}

/** Olhos por espécie: posição (x, y, z local) e raio */
const EYES = {
  guard: { x: 0.14, y: 0.03, z: 0.43, r: 0.07 },
  carpenter: { x: 0.15, y: 0.06, z: 0.365, r: 0.058 },
  guide: { x: 0.14, y: 0.05, z: 0.39, r: 0.06 },
}

/** Presente na mão — visual por item */
function GiftProp({ itemId }) {
  if (itemId === 'fungo_brilho') {
    // cogumelo brilhante fofinho
    return (
      <group position={[0.02, -0.34, 0.1]} rotation={[0.3, 0.2, -0.2]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.05, 0.065, 0.14, 12]} />
          <ToonMat color="#fff4dc" />
        </mesh>
        <mesh position={[0, 0.1, 0]} scale={[1, 0.7, 1]}>
          <sphereGeometry args={[0.13, 14, 10]} />
          <ToonMat color="#7ef0b0" emissive="#3ee08a" emissiveIntensity={0.9} />
        </mesh>
        {[
          [0.06, 0.16, 0.06],
          [-0.07, 0.15, 0.04],
          [0.0, 0.18, -0.07],
        ].map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <ToonMat color="#ffffff" emissive="#d8ffe8" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
    )
  }
  if (itemId === 'ferramenta') {
    // martelinho de brinquedo
    return (
      <group position={[0.02, -0.3, 0.1]} rotation={[0.5, 0.3, -0.4]}>
        <mesh>
          <cylinderGeometry args={[0.035, 0.04, 0.36, 10]} />
          <ToonMat color={PAL.wood} />
        </mesh>
        <RoundedBox args={[0.24, 0.12, 0.12]} radius={0.04} smoothness={2} position={[0, 0.2, 0]}>
          <ToonMat color="#9fc3ff" />
        </RoundedBox>
        <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 12]} />
          <ToonMat color="#ff6b6b" />
        </mesh>
      </group>
    )
  }
  // cristal
  return (
    <group position={[0.03, -0.3, 0.1]} rotation={[0.2, 0.5, -0.2]}>
      <mesh rotation={[0.3, 0.4, 0.15]} scale={[1, 1.35, 1]}>
        <octahedronGeometry args={[0.17, 0]} />
        <ToonMat color="#6fd8ff" emissive="#22b8f0" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[0.02, 0.03, 0.03]} scale={[0.5, 0.75, 0.5]} rotation={[0.1, 0.8, 0]}>
        <octahedronGeometry args={[0.1, 0]} />
        <ToonMat color="#ffffff" emissive="#c8f4ff" emissiveIntensity={0.7} />
      </mesh>
    </group>
  )
}

/** Olhinhos de bolinha com brilho branco + bochechas rosadas */
function Eyes({ p, e }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * e.x, HEAD_C + e.y, e.z]}>
          <mesh scale={[0.85, 1.15, 0.45]}>
            <sphereGeometry args={[e.r, 14, 10]} />
            <ToonMat color={p.eye} />
          </mesh>
          <mesh position={[e.r * 0.3, e.r * 0.45, e.r * 0.32]}>
            <sphereGeometry args={[e.r * 0.36, 8, 6]} />
            <ToonMat color="#ffffff" />
          </mesh>
          <mesh position={[-e.r * 0.25, -e.r * 0.4, e.r * 0.36]}>
            <sphereGeometry args={[e.r * 0.16, 6, 5]} />
            <ToonMat color="#ffffff" />
          </mesh>
        </group>
      ))}
    </>
  )
}

function Cheeks({ p, x = 0.25, y = -0.07, lift = -0.02 }) {
  return [-1, 1].map((s) => (
    <mesh key={s} position={onHead(s * x, y, lift)} scale={[1, 0.65, 0.35]}>
      <sphereGeometry args={[0.07, 12, 8]} />
      <ToonMat color={p.cheek} />
    </mesh>
  ))
}

/** Cabeça por espécie (estática, local ao pescoço) */
function Head({ p, role }) {
  const e = EYES[role]
  if (role === 'guard') {
    // coruja: disco facial em coração, biquinho, tufos e touca de dormir
    return (
      <group>
        <mesh position={[0, HEAD_C, 0]}>
          <sphereGeometry args={[HEAD_R, 20, 16]} />
          <ToonMat color={p.fur} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={`d${s}`} position={onHead(s * 0.13, 0.02, -0.07)} scale={[1, 1.08, 0.5]}>
            <sphereGeometry args={[0.18, 16, 12]} />
            <ToonMat color={p.face} />
          </mesh>
        ))}
        <mesh position={onHead(0, -0.07, 0.02)} rotation={[-0.35, 0, 0]} scale={[1, 1.2, 1]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <ToonMat color={p.nose} />
        </mesh>
        <mesh position={onHead(0, -0.12, 0.01)} scale={[0.8, 1, 0.8]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <ToonMat color={p.nose} />
        </mesh>
        <Eyes p={p} e={e} />
        <Cheeks p={p} x={0.27} y={-0.1} lift={-0.03} />
        {/* tufos de orelha */}
        {[-1, 1].map((s) => (
          <mesh key={`t${s}`} position={[s * 0.27, HEAD_C + 0.3, 0.05]} rotation={[0, 0, s * -0.55]}>
            <coneGeometry args={[0.09, 0.2, 12]} />
            <ToonMat color={p.furShade} />
          </mesh>
        ))}
        {/* touca de dormir caída para o lado */}
        <group position={[0, HEAD_C + 0.25, -0.02]} rotation={[-0.15, 0, 0.12]}>
          <mesh position={[0, 0.02, 0]} scale={[1, 0.7, 1]}>
            <sphereGeometry args={[0.36, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <ToonMat color={p.hat} />
          </mesh>
          <mesh position={[-0.1, 0.24, -0.02]} rotation={[0, 0, 1.0]}>
            <coneGeometry args={[0.22, 0.5, 16]} />
            <ToonMat color={p.hat} />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.06, 10, 24]} />
            <ToonMat color={p.hatTrim} />
          </mesh>
          <mesh position={[-0.33, 0.36, -0.02]}>
            <sphereGeometry args={[0.09, 12, 10]} />
            <ToonMat color={p.trim} />
          </mesh>
          {/* estrelinhas */}
          {[
            [0.2, 0.17, 0.2],
            [-0.08, 0.2, 0.26],
          ].map((q, i) => (
            <mesh key={i} position={q} rotation={[0.3, 0, 0.4]}>
              <octahedronGeometry args={[0.045, 0]} />
              <ToonMat color={p.trim} />
            </mesh>
          ))}
        </group>
      </group>
    )
  }

  if (role === 'carpenter') {
    // castor: focinho creme, dentões, nariz rosado e capacete amarelo
    return (
      <group>
        <mesh position={[0, HEAD_C, 0]} scale={[1.05, 0.96, 1]}>
          <sphereGeometry args={[HEAD_R, 20, 16]} />
          <ToonMat color={p.fur} />
        </mesh>
        <mesh position={onHead(0, -0.11, -0.1)} scale={[1.35, 0.9, 1]}>
          <sphereGeometry args={[0.16, 16, 12]} />
          <ToonMat color={p.face} />
        </mesh>
        <mesh position={onHead(0, -0.03, 0.03)} scale={[1.3, 0.85, 0.9]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <ToonMat color={p.nose} />
        </mesh>
        {[-1, 1].map((s) => (
          <RoundedBox
            key={`dt${s}`}
            args={[0.055, 0.08, 0.04]}
            radius={0.015}
            smoothness={2}
            position={onHead(s * 0.03, -0.24, 0.03)}
            rotation={[-0.3, 0, 0]}
          >
            <ToonMat color="#ffffff" />
          </RoundedBox>
        ))}
        <Eyes p={p} e={e} />
        <Cheeks p={p} x={0.27} y={-0.08} />
        {/* orelhinhas redondas */}
        {[-1, 1].map((s) => (
          <group key={`o${s}`} position={[s * 0.31, HEAD_C + 0.22, 0]}>
            <mesh scale={[1, 1, 0.6]}>
              <sphereGeometry args={[0.09, 12, 10]} />
              <ToonMat color={p.furShade} />
            </mesh>
            <mesh position={[0, 0, 0.03]} scale={[0.6, 0.6, 0.4]}>
              <sphereGeometry args={[0.09, 10, 8]} />
              <ToonMat color={p.cheek} />
            </mesh>
          </group>
        ))}
        {/* capacete de obra */}
        <group position={[0, HEAD_C + 0.13, -0.02]} rotation={[-0.12, 0, 0]}>
          <mesh scale={[1.03, 0.85, 1.03]}>
            <sphereGeometry args={[0.37, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <ToonMat color={p.hat} />
          </mesh>
          <mesh position={[0, 0.0, 0.05]} scale={[1, 1, 1.12]}>
            <cylinderGeometry args={[0.43, 0.43, 0.05, 24]} />
            <ToonMat color={p.hat} />
          </mesh>
          <mesh position={[0, 0.27, 0]} scale={[0.35, 1, 1.05]}>
            <sphereGeometry args={[0.1, 12, 8]} />
            <ToonMat color={p.hatTrim} />
          </mesh>
          <mesh position={[0, 0.13, 0.33]} rotation={[0.45, 0, 0]} scale={[1, 1, 0.4]}>
            <sphereGeometry args={[0.07, 12, 8]} />
            <ToonMat color={p.hatTrim} />
          </mesh>
        </group>
      </group>
    )
  }

  // pinguim: máscara branca em coração, bico laranja, protetor de orelha
  return (
    <group>
      <mesh position={[0, HEAD_C, 0]}>
        <sphereGeometry args={[HEAD_R, 20, 16]} />
        <ToonMat color={p.fur} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`m${s}`} position={onHead(s * 0.12, 0.0, -0.1)} scale={[1, 1.1, 0.55]}>
          <sphereGeometry args={[0.2, 16, 12]} />
          <ToonMat color={p.face} />
        </mesh>
      ))}
      <mesh position={onHead(0, -0.12, -0.02)} scale={[1.6, 0.9, 0.6]}>
        <sphereGeometry args={[0.13, 16, 10]} />
        <ToonMat color={p.face} />
      </mesh>
      <mesh position={onHead(0, -0.06, 0.06)} rotation={[Math.PI / 2 - 0.15, 0, 0]} scale={[1.3, 1, 0.7]}>
        <coneGeometry args={[0.065, 0.16, 12]} />
        <ToonMat color={p.nose} />
      </mesh>
      <Eyes p={p} e={e} />
      <Cheeks p={p} x={0.25} y={-0.1} lift={-0.0} />
      {/* protetor de orelha */}
      <mesh position={[0, HEAD_C + 0.0, -0.02]}>
        <torusGeometry args={[0.41, 0.035, 8, 24, Math.PI]} />
        <ToonMat color={p.hat} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`e${s}`} position={[s * 0.4, HEAD_C + 0.0, -0.02]} scale={[0.6, 1, 1]}>
          <sphereGeometry args={[0.13, 14, 10]} />
          <ToonMat color={p.hat} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`f${s}`} position={[s * 0.45, HEAD_C + 0.0, -0.02]} scale={[0.3, 0.85, 0.85]}>
          <sphereGeometry args={[0.13, 12, 8]} />
          <ToonMat color={p.hatTrim} />
        </mesh>
      ))}
    </group>
  )
}

/** Corpinho (roupa) + detalhes por espécie — estático */
function Torso({ p, role }) {
  return (
    <group>
      {/* corpinho de pera */}
      <mesh position={[0, 0.5, 0]} scale={[1, 1.08, 0.92]}>
        <sphereGeometry args={[0.32, 18, 14]} />
        <ToonMat color={role === 'guide' ? p.fur : p.coat} />
      </mesh>

      {role === 'guard' && (
        <>
          {/* barriga de penas + botões da capa de vigia */}
          <mesh position={[0, 0.45, 0.2]} scale={[0.85, 0.95, 0.6]}>
            <sphereGeometry args={[0.24, 16, 12]} />
            <ToonMat color={p.face} />
          </mesh>
          <mesh position={[0, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.055, 10, 20]} />
            <ToonMat color={p.coatShade} />
          </mesh>
          {[0.62, 0.48].map((y) => (
            <mesh key={y} position={[0, y, 0.305]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <ToonMat color={p.trim} />
            </mesh>
          ))}
        </>
      )}

      {role === 'carpenter' && (
        <>
          {/* peitilho do macacão + bolso */}
          <RoundedBox args={[0.34, 0.24, 0.1]} radius={0.04} smoothness={2} position={[0, 0.66, 0.24]} rotation={[-0.25, 0, 0]}>
            <ToonMat color={p.coatShade} />
          </RoundedBox>
          <RoundedBox args={[0.14, 0.1, 0.04]} radius={0.02} smoothness={2} position={[0, 0.66, 0.3]} rotation={[-0.25, 0, 0]}>
            <ToonMat color={p.coat} />
          </RoundedBox>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.13, 0.76, 0.24]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <ToonMat color={p.trim} />
            </mesh>
          ))}
          {/* cinto de ferramentas */}
          <mesh position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.92, 1]}>
            <torusGeometry args={[0.31, 0.045, 8, 24]} />
            <ToonMat color={PAL.wood} />
          </mesh>
          <RoundedBox args={[0.12, 0.12, 0.08]} radius={0.03} smoothness={2} position={[-0.22, 0.32, 0.2]} rotation={[0, -0.6, 0]}>
            <ToonMat color={PAL.woodDark} />
          </RoundedBox>
          <RoundedBox args={[0.1, 0.1, 0.07]} radius={0.03} smoothness={2} position={[0.25, 0.32, 0.17]} rotation={[0, 0.7, 0]}>
            <ToonMat color={PAL.woodDark} />
          </RoundedBox>
          {/* lápis e chave no cinto */}
          <mesh position={[-0.22, 0.42, 0.22]} rotation={[0, 0, 0.2]}>
            <cylinderGeometry args={[0.018, 0.018, 0.16, 8]} />
            <ToonMat color="#ffb02e" />
          </mesh>
          <mesh position={[0.25, 0.43, 0.19]} rotation={[0, 0, -0.15]}>
            <cylinderGeometry args={[0.02, 0.02, 0.16, 8]} />
            <ToonMat color="#b9c4cf" />
          </mesh>
          <mesh position={[0, 0.38, 0.305]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <ToonMat color={p.trim} />
          </mesh>
        </>
      )}

      {role === 'guide' && (
        <>
          {/* barrigona branca */}
          <mesh position={[0, 0.48, 0.1]} scale={[0.74, 0.92, 0.85]}>
            <sphereGeometry args={[0.32, 16, 12]} />
            <ToonMat color={p.coat} />
          </mesh>
          {/* cachecol listrado */}
          <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.08, 10, 22]} />
            <ToonMat color={p.trim} />
          </mesh>
          <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.02, 1.02, 0.4]}>
            <torusGeometry args={[0.2, 0.083, 10, 22]} />
            <ToonMat color="#ffffff" />
          </mesh>
          <RoundedBox args={[0.14, 0.26, 0.06]} radius={0.03} smoothness={2} position={[0.12, 0.66, 0.24]} rotation={[0.25, 0, 0.2]}>
            <ToonMat color={p.trim} />
          </RoundedBox>
          {/* mochilinha de explorador */}
          <RoundedBox args={[0.34, 0.36, 0.18]} radius={0.07} smoothness={2} position={[0, 0.52, -0.3]}>
            <ToonMat color="#ffb43a" />
          </RoundedBox>
          <RoundedBox args={[0.24, 0.12, 0.08]} radius={0.04} smoothness={2} position={[0, 0.46, -0.4]}>
            <ToonMat color="#ffcf6e" />
          </RoundedBox>
          <mesh position={[0, 0.74, -0.32]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.06, 0.24, 6, 10]} />
            <ToonMat color="#7ad0ff" />
          </mesh>
        </>
      )}
    </group>
  )
}

/** Mão / ponta da asa por espécie (estático, dentro do braço) */
function Arm({ p, role, side }) {
  const sleeve = role === 'guide' ? p.fur : p.coat
  const hand = role === 'guide' ? p.furShade : p.fur
  return (
    <group>
      <mesh position={[0, -0.1, 0]} scale={role === 'guide' ? [0.75, 1, 1.15] : [1, 1, 1]}>
        <capsuleGeometry args={[0.085, 0.12, 6, 12]} />
        <ToonMat color={sleeve} />
      </mesh>
      <mesh position={[0, -0.21, 0.01]} scale={role === 'guide' ? [0.7, 1.1, 1] : [1, 1, 1]}>
        <sphereGeometry args={[0.085, 12, 10]} />
        <ToonMat color={hand} />
      </mesh>
      {role === 'guard' && (
        // pontinha de pena
        <mesh position={[side * 0.02, -0.27, -0.02]} rotation={[0, 0, side * 0.3]}>
          <coneGeometry args={[0.06, 0.12, 10]} />
          <ToonMat color={p.furShade} />
        </mesh>
      )}
    </group>
  )
}

/** Lanterninha da coruja (na asa esquerda) */
function OwlLantern() {
  return (
    <group position={[0, -0.3, 0.08]} rotation={[0, 0, 0.3]}>
      <mesh position={[0, 0.06, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.05, 0.012, 6, 14, Math.PI]} />
        <ToonMat color="#ff9a3c" />
      </mesh>
      <mesh position={[0, 0.0, 0]}>
        <cylinderGeometry args={[0.06, 0.075, 0.04, 12]} />
        <ToonMat color="#ff9a3c" />
      </mesh>
      <mesh position={[0, -0.09, 0]}>
        <sphereGeometry args={[0.075, 12, 10]} />
        <ToonMat color="#fff3a8" emissive="#ffd23f" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, -0.17, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.04, 12]} />
        <ToonMat color="#ff9a3c" />
      </mesh>
    </group>
  )
}

/** Peça pendurada nas costas que balança (capeRef) */
function BackFlap({ p, role }) {
  if (role === 'guard') {
    // rabinho de penas em leque
    return (
      <group position={[0, -0.05, 0]}>
        {[-1, 0, 1].map((i) => (
          <mesh key={i} position={[i * 0.09, -0.1, -0.02]} rotation={[0, 0, i * 0.4]} scale={[1, 1, 0.45]}>
            <capsuleGeometry args={[0.08, 0.1, 6, 10]} />
            <ToonMat color={i === 0 ? p.furShade : p.fur} />
          </mesh>
        ))}
      </group>
    )
  }
  if (role === 'carpenter') {
    // rabo de castor (remo achatado)
    return (
      <group position={[0, -0.12, -0.12]} rotation={[0.9, 0, 0]}>
        <mesh scale={[1, 1.5, 0.3]}>
          <sphereGeometry args={[0.15, 16, 12]} />
          <ToonMat color={p.furShade} />
        </mesh>
        <mesh position={[0, 0, 0.035]} scale={[0.7, 1.25, 0.2]}>
          <sphereGeometry args={[0.15, 12, 8]} />
          <ToonMat color="#d99062" />
        </mesh>
      </group>
    )
  }
  // pontas do cachecol voando nas costas
  return (
    <group>
      <RoundedBox args={[0.13, 0.3, 0.05]} radius={0.025} smoothness={2} position={[-0.06, -0.14, 0]} rotation={[0, 0, 0.15]}>
        <ToonMat color={p.trim} />
      </RoundedBox>
      <mesh position={[-0.08, -0.31, 0]} rotation={[0, 0, 0.15]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <ToonMat color="#ffffff" />
      </mesh>
    </group>
  )
}

/** Marcador "!" — balãozinho amarelo que sempre olha para a câmera */
function TalkBubble() {
  return (
    <Billboard>
      <mesh scale={[1.15, 0.95, 0.45]}>
        <sphereGeometry args={[0.24, 20, 14]} />
        <ToonMat color="#ffd84a" emissive="#ffb800" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[-0.1, -0.22, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.07, 0.14, 12]} />
        <ToonMat color="#ffd84a" emissive="#ffb800" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, 0.05, 0.1]}>
        <capsuleGeometry args={[0.035, 0.11, 6, 10]} />
        <ToonMat color="#ff7a1a" emissive="#ff6a00" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, -0.1, 0.1]}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <ToonMat color="#ff7a1a" emissive="#ff6a00" emissiveIntensity={0.25} />
      </mesh>
    </Billboard>
  )
}

/**
 * NPC bichinho (estilo Animal Crossing) — diálogo no HUD + entrega de item
 * ao pressionar E perto.
 */
export default function NPC({ def }) {
  const pos = resolveNpcPosition(def)
  const hasItem = useProgressStore(
    (s) => s.inventory.includes(def.itemId) || s.collectedEver.includes(def.itemId),
  )
  const collectItem = useProgressStore((s) => s.collectItem)
  const setNearNpc = useProgressStore((s) => s.setNearNpc)
  const markNpcSpoke = useProgressStore((s) => s.markNpcSpoke)
  const npcSpoke = useProgressStore((s) => s.npcSpoke[def.id])
  const wasNear = useRef(false)
  const groupRef = useRef(null)
  const markerRef = useRef(null)
  const ringRef = useRef(null)
  const bodyRef = useRef(null)
  const headRef = useRef(null)
  const leftArmRef = useRef(null)
  const rightArmRef = useRef(null)
  const leftLegRef = useRef(null)
  const rightLegRef = useRef(null)
  const capeRef = useRef(null)
  const bobRef = useRef(Math.random() * 10)
  const handoffT = useRef(0)
  const handoffActive = useRef(false)
  const blinkT = useRef(2 + Math.random() * 3)
  const lidsRef = useRef(null)

  const shadowGeo = useMemo(() => new THREE.CircleGeometry(0.55, 20), [])

  useFrame((state, dt) => {
    if (!groupRef.current) return

    const dx = playerPosition.x - pos.x
    const dz = playerPosition.z - pos.z
    const dist = Math.hypot(dx, dz)
    const isNear = dist < 3.4
    const t = bobRef.current

    if (isNear && !wasNear.current) {
      wasNear.current = true
      if (!hasItem) setNearNpc(def.id)
    } else if (!isNear && wasNear.current) {
      wasNear.current = false
      if (useProgressStore.getState().nearNpcId === def.id) setNearNpc(null)
    } else if (isNear && hasItem && useProgressStore.getState().nearNpcId === def.id) {
      setNearNpc(null)
    }

    bobRef.current += dt
    const breath = Math.sin(t * 1.8) * 0.035
    const sway = Math.sin(t * 1.35) * 0.1
    const armSway = Math.sin(t * 1.5 + 0.4) * 0.16
    groupRef.current.position.y = pos.y + breath

    if (isNear && dist > 0.05) {
      const want = Math.atan2(dx, dz)
      const cur = groupRef.current.rotation.y
      let dYaw = want - cur
      while (dYaw > Math.PI) dYaw -= Math.PI * 2
      while (dYaw < -Math.PI) dYaw += Math.PI * 2
      groupRef.current.rotation.y = cur + dYaw * Math.min(1, dt * 4)
    }

    // marcador flutuante
    if (markerRef.current) {
      const show = isNear && !hasItem
      markerRef.current.visible = show
      if (show) {
        markerRef.current.position.y = 2.35 + Math.sin(t * 3.2) * 0.1
        markerRef.current.rotation.y = t * 1.8
      }
    }
    if (ringRef.current) {
      ringRef.current.visible = isNear && !hasItem
      if (ringRef.current.visible) {
        ringRef.current.rotation.z = t * 1.2
        const s = 0.9 + Math.sin(t * 2.5) * 0.08
        ringRef.current.scale.set(s, s, s)
      }
    }

    // piscar — pálpebras só descem no instante do blink
    blinkT.current -= dt
    if (lidsRef.current) {
      if (blinkT.current < 0.1 && blinkT.current > 0) {
        lidsRef.current.scale.y = 1
        lidsRef.current.position.y = 1.25
      } else {
        lidsRef.current.scale.y = 0.05
        lidsRef.current.position.y = 1.285
        if (blinkT.current <= 0) blinkT.current = 2.2 + Math.random() * 3.5
      }
    }

    if (headRef.current) {
      headRef.current.rotation.z = sway * 0.2
      headRef.current.rotation.x = Math.sin(t * 0.9) * 0.04 + (isNear ? -0.06 : 0)
    }
    if (capeRef.current) {
      capeRef.current.rotation.x = 0.12 + Math.sin(t * 1.7) * 0.04
    }

    if (handoffActive.current) {
      handoffT.current += dt
      const ht = Math.min(1, handoffT.current / HANDOFF_DUR)
      const ease = 1 - (1 - ht) ** 2
      if (bodyRef.current) bodyRef.current.rotation.z = sway * 0.06
      if (leftArmRef.current) leftArmRef.current.rotation.x = armSway * 0.3
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -0.2 + ease * 1.55
        rightArmRef.current.rotation.z = -0.2 + ease * 0.15
      }
      if (ht >= 1) {
        collectItem(def.itemId)
        handoffActive.current = false
        handoffT.current = 0
        setNearNpc(null)
      }
      return
    }

    if (bodyRef.current) {
      bodyRef.current.rotation.z = sway * 0.12
      bodyRef.current.scale.y = 1 + Math.sin(t * 1.8) * 0.012
    }
    if (leftArmRef.current) leftArmRef.current.rotation.x = armSway
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = -armSway * 0.65 + (hasItem ? 0.12 : 0.4)
      rightArmRef.current.rotation.z = -0.28
    }
    if (leftLegRef.current) leftLegRef.current.rotation.x = -armSway * 0.22
    if (rightLegRef.current) rightLegRef.current.rotation.x = armSway * 0.22

    if (hasItem || !isNear) return

    if (guideInput.tapPending) {
      guideInput.tapPending = false
      guideInput.tapStale = true
      // um único E: fala a linha de entrega e já passa o item (antes o 1º E
      // só mostrava "Leve este…" e nada era entregue)
      if (!npcSpoke) markNpcSpoke(def.id)
      handoffActive.current = true
      handoffT.current = 0
    }
  })

  const p = def
  const role = p.role
  const e = EYES[role]
  const lidColor = role === 'guard' ? p.face : role === 'guide' ? p.face : p.fur

  return (
    <group ref={groupRef} position={[pos.x, pos.y, pos.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.38, 0.95, 0.38]} position={[0, 0.95, 0]} />
      </RigidBody>

      {/* sombra macia no chão */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={shadowGeo}>
        <meshBasicMaterial color="#3b5a3a" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      <group ref={bodyRef}>
        {/* perninhas + pezinhos */}
        {[
          [leftLegRef, -1],
          [rightLegRef, 1],
        ].map(([ref, s]) => (
          <group key={s} ref={ref} position={[s * 0.13, HIP_Y, 0]}>
            <StaticBatch>
              <mesh position={[0, -0.04, 0]}>
                <capsuleGeometry args={[0.075, 0.08, 6, 12]} />
                <ToonMat color={role === 'carpenter' ? p.coat : p.feet} />
              </mesh>
              <mesh position={[0, -0.15, 0.05]} scale={[1, 0.55, 1.35]}>
                <sphereGeometry args={[0.1, 14, 10]} />
                <ToonMat color={p.feet} />
              </mesh>
            </StaticBatch>
          </group>
        ))}

        <StaticBatch>
          <Torso p={p} role={role} />
        </StaticBatch>

        {/* peça das costas que balança */}
        <group
          ref={capeRef}
          position={role === 'guide' ? [0.17, 0.8, -0.2] : [0, 0.34, -0.26]}
        >
          <StaticBatch>
            <BackFlap p={p} role={role} />
          </StaticBatch>
        </group>

        {/* bracinhos */}
        <group ref={leftArmRef} position={[-SHOULDER_X, SHOULDER_Y, 0]} rotation={[0, 0, -0.32]}>
          <StaticBatch>
            <Arm p={p} role={role} side={-1} />
          </StaticBatch>
          {role === 'guard' && (
            <StaticBatch>
              <OwlLantern />
            </StaticBatch>
          )}
        </group>

        <group ref={rightArmRef} position={[SHOULDER_X, SHOULDER_Y, 0]} rotation={[0.35, 0, -0.28]}>
          {/* abre o bracinho para fora do corpo (a animação gira para dentro) */}
          <group rotation={[0, 0, 0.6]}>
            <StaticBatch>
              <Arm p={p} role={role} side={1} />
            </StaticBatch>
            {!hasItem && <GiftProp itemId={def.itemId} />}
          </group>
        </group>

        {/* cabeção */}
        <group ref={headRef} position={[0, HEAD_Y, 0]}>
          <StaticBatch>
            <Head p={p} role={role} />
          </StaticBatch>
          {/* pálpebras (piscar): o useFrame anima y entre 1.25 e 1.285 */}
          <group position={[0, HEAD_C + e.y + e.r * 1.25 - 1.285, e.z + 0.012]}>
            <group ref={lidsRef} position={[0, 1.285, 0]} scale={[1, 0.05, 1]}>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * e.x, 0, 0]} scale={[1.25, 2.0, 0.6]}>
                  <sphereGeometry args={[e.r, 12, 8]} />
                  <ToonMat color={lidColor} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>

      {/* marcador de interação: balãozinho "!" */}
      <group ref={markerRef} visible={false} position={[0, 2.35, 0]}>
        <TalkBubble />
      </group>
      <mesh ref={ringRef} visible={false} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.05, 8, 32]} />
        <ToonMat color="#ffd84a" emissive="#ffb800" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

export function npcInteractHint(npc) {
  const dlg = NPC_DIALOGUES[npc.id]
  return dlg
    ? `Fale com ${npc.name} (E) — ${ITEMS[npc.itemId]?.short ?? 'presente'}`
    : `Fale com ${npc.name} (E)`
}

export function npcDialogueLine(npc, spoke) {
  const dlg = NPC_DIALOGUES[npc.id]
  if (!dlg) return null
  return spoke ? dlg.give : dlg.greet
}
