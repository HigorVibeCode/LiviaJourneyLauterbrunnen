import ToonMat from '../../materials/ToonMat'
import { RoundedBox } from '@react-three/drei'
import { PAL } from '../../config/palette'
import { heartGeometry, starGeometry } from '../world/cuteShapes'

/**
 * Mini-modelos fofos por tema — segredos escondidos no cenário.
 * Só primitivos Three.js (sem assets novos), formas gordinhas e cores claras.
 */
export default function SecretModel({ kind }) {
  switch (kind) {
    case 'bell':
      return <SecretCowBell />
    case 'hay':
      return <SecretHayMouse />
    case 'firefly':
      return <SecretFireflyJar />
    case 'splash':
      return <SecretFrog />
    case 'snow':
      return <SecretSnowmanDetail />
    case 'flower':
      return <SecretFlowerCrown />
    case 'flag':
      return <SecretSummitFlag />
    default:
      return <SecretFlowerCrown />
  }
}

// olhinhos: ameixa escura (nunca preto puro)
const EYE = '#5b4a6b'

/** Sino de vaca dourado com laço rosa, num postinho */
function SecretCowBell() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 1.1, 10]} />
        <ToonMat color={PAL.wood} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <ToonMat color={PAL.wood} />
      </mesh>
      <group position={[0, 0.88, 0.1]}>
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.13, 12, 8]} />
          <ToonMat color="#ffd45a" emissive="#ffb830" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.12, 0.2, 0.24, 14]} />
          <ToonMat color="#ffd45a" emissive="#ffb830" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <ToonMat color="#f0b43a" />
        </mesh>
        {/* lacinho */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.1, 0.22, 0.02]} scale={[1, 0.7, 0.5]}>
            <sphereGeometry args={[0.08, 8, 6]} />
            <ToonMat color="#ff8fb8" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Ratinho cinza-rosado espiando de cima do fardo de feno */
function SecretHayMouse() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 1.1, 16]} />
        <ToonMat color="#ffe28a" />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.56, 0.04, 6, 18]} />
          <ToonMat color="#f2c45a" />
        </mesh>
      ))}
      <group position={[0, 1.1, 0.12]}>
        <mesh scale={[1, 0.85, 1.1]}>
          <sphereGeometry args={[0.18, 12, 10]} />
          <ToonMat color="#d8d0e0" />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.13, 0.15, -0.02]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.09, 10, 8]} />
              <ToonMat color="#d8d0e0" />
            </mesh>
            <mesh position={[s * 0.13, 0.15, 0.02]} scale={[1, 1, 0.3]}>
              <sphereGeometry args={[0.06, 10, 8]} />
              <ToonMat color="#ffb7d0" />
            </mesh>
            <mesh position={[s * 0.065, 0.04, 0.16]}>
              <sphereGeometry args={[0.03, 8, 6]} />
              <ToonMat color={EYE} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, -0.02, 0.2]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <ToonMat color="#ff8fb8" />
        </mesh>
      </group>
    </group>
  )
}

/** Potinho de vidro com vaga-lumes brilhantes */
function SecretFireflyJar() {
  return (
    <group>
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.24, 0.27, 0.66, 14]} />
        <ToonMat color="#cdefff" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <RoundedBox args={[0.5, 0.12, 0.5]} radius={0.05} smoothness={2} bevelSegments={1} position={[0, 0.74, 0]}>
        <ToonMat color="#ff8fb8" />
      </RoundedBox>
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <ToonMat color="#ffd45a" />
      </mesh>
      {[
        [0.07, 0.42, 0.06],
        [-0.09, 0.32, -0.04],
        [0.03, 0.55, -0.07],
        [-0.05, 0.5, 0.09],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <ToonMat color="#f4ff9a" emissive="#c8ff50" emissiveIntensity={1.4} />
        </mesh>
      ))}
      <pooledLight position={[0, 0.45, 0]} color="#d8ff70" intensity={0.8} distance={4} decay={2} />
    </group>
  )
}

/** Sapinho fofo numa vitória-régia */
function SecretFrog() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.04, 16, 1, false, 0.5, Math.PI * 2 - 1]} />
        <ToonMat color={PAL.leafLight} />
      </mesh>
      <mesh position={[0, 0.17, 0]} scale={[1.25, 0.8, 1]}>
        <sphereGeometry args={[0.2, 14, 10]} />
        <ToonMat color="#7ad96a" />
      </mesh>
      <mesh position={[0, 0.13, 0.1]} scale={[1, 0.6, 0.7]}>
        <sphereGeometry args={[0.15, 12, 8]} />
        <ToonMat color="#d8f8b0" />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.1, 0.3, 0.07]}>
            <sphereGeometry args={[0.08, 12, 8]} />
            <ToonMat color="#7ad96a" />
          </mesh>
          <mesh position={[s * 0.1, 0.31, 0.13]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <ToonMat color="#ffffff" />
          </mesh>
          <mesh position={[s * 0.1, 0.31, 0.165]}>
            <sphereGeometry args={[0.022, 8, 6]} />
            <ToonMat color={EYE} />
          </mesh>
          {/* bochechas */}
          <mesh position={[s * 0.15, 0.19, 0.13]} scale={[1, 0.6, 0.4]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <ToonMat color="#ffa3c4" />
          </mesh>
          <mesh position={[s * 0.2, 0.06, -0.08]} rotation={[0, 0, -s * 0.5]}>
            <capsuleGeometry args={[0.05, 0.12, 3, 8]} />
            <ToonMat color="#66c85a" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Bonequinho de neve com cachecol rosa e narizinho de cenoura */
function SecretSnowmanDetail() {
  return (
    <group>
      <mesh position={[0, 0.33, 0]}>
        <sphereGeometry args={[0.33, 16, 12]} />
        <ToonMat color={PAL.snow} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.25, 16, 12]} />
        <ToonMat color={PAL.snow} />
      </mesh>
      <mesh position={[0, 0.79, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.055, 0.2, 10]} />
        <ToonMat color="#ff9a3a" />
      </mesh>
      <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.07, 8, 16]} />
        <ToonMat color="#ff8fb8" />
      </mesh>
      <mesh position={[0.14, 0.45, 0.2]} rotation={[0.2, 0, 0.2]}>
        <capsuleGeometry args={[0.055, 0.16, 3, 8]} />
        <ToonMat color="#ff8fb8" />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.09, 0.86, 0.21]}>
            <sphereGeometry args={[0.032, 8, 6]} />
            <ToonMat color={EYE} />
          </mesh>
          <mesh position={[s * 0.15, 0.76, 0.18]} scale={[1, 0.6, 0.4]}>
            <sphereGeometry args={[0.04, 8, 6]} />
            <ToonMat color="#ffb7d0" />
          </mesh>
        </group>
      ))}
      {/* gorrinho azul com pompom */}
      <mesh position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <ToonMat color="#6ec8ff" />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <ToonMat color="#ffffff" />
      </mesh>
    </group>
  )
}

/** Coroa de flores no chão */
function SecretFlowerCrown() {
  const colors = PAL.flowers
  return (
    <group>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.06, 8, 20]} />
        <ToonMat color={PAL.leaf} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return (
          <group key={i} position={[Math.cos(a) * 0.28, 0.1, Math.sin(a) * 0.28]}>
            <mesh>
              <sphereGeometry args={[0.1, 10, 8]} />
              <ToonMat color={colors[i % colors.length]} emissive={colors[i % colors.length]} emissiveIntensity={0.12} />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <sphereGeometry args={[0.04, 8, 6]} />
              <ToonMat color={PAL.flowerCenter} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Bandeirinha com coração no marco do mirante */
function SecretSummitFlag() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 1.1, 10]} />
        <ToonMat color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <ToonMat color="#ffd45a" />
      </mesh>
      <RoundedBox args={[0.42, 0.26, 0.05]} radius={0.02} smoothness={2} bevelSegments={1} position={[0.23, 0.92, 0]} rotation={[0, 0, -0.1]}>
        <ToonMat color="#ff8fb8" emissive="#ff6fa0" emissiveIntensity={0.15} />
      </RoundedBox>
      <mesh geometry={heartGeometry()} position={[0.23, 0.92, 0.04]} scale={0.14}>
        <ToonMat color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.08, 0]} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.22, 12, 8]} />
        <ToonMat color={PAL.rock} />
      </mesh>
      <mesh geometry={starGeometry()} position={[-0.12, 0.2, 0.15]} scale={0.12}>
        <ToonMat color="#ffd45a" />
      </mesh>
    </group>
  )
}
