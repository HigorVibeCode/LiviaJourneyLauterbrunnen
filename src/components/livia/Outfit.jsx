import { useShallow } from 'zustand/react/shallow'
import { useProgressStore } from '../../store/progressStore'
import ToonMat from '../../materials/ToonMat'

/**
 * Roupas e acessórios da Livia chibi. Coordenadas no espaço do rig
 * (o rig inteiro é escalado ~0.62 em LiviaRig).
 *  — capa de chuva: casaquinho amarelo + chapéu de chuva
 *  — casaco de pele: casaco rosa fofinho com gola branca + gorro de pompom
 *  — binóculo pendurado no peito; chave/ferramenta/cristal na mão direita;
 *    lampião na mão esquerda
 */
export function useOutfit(remote = false) {
  return useProgressStore(
    useShallow((s) => {
      // avatar de amigo (multijogador) não veste o inventário da jogadora local
      const has = (id) => !remote && s.inventory.includes(id)
      return {
        raincoat: has('capa_chuva'),
        furcoat: has('casaco'),
        binoculars: has('binoculo'),
        key: has('chave_portao'),
        tool: has('ferramenta'),
        crystal: has('cristal'),
        lantern: !remote && s.hasLantern,
      }
    }),
  )
}

const RAIN = '#ffd23f'
const RAIN_DARK = '#f2b81f'
const FUR = '#ff9ec4'
const FUR_TRIM = '#ffffff'

/** Casaco por cima do vestido (o casaco de pele ganha da capa) */
export function TorsoOutfit({ outfit }) {
  if (outfit.furcoat) {
    return (
      <group>
        <mesh position={[0, 0.3, 0]} scale={[1.08, 1, 1.08]}>
          <capsuleGeometry args={[0.31, 0.22, 6, 16]} />
          <ToonMat color={FUR} />
        </mesh>
        {/* gola e barra de pelúcia */}
        <mesh position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.075, 8, 18]} />
          <ToonMat color={FUR_TRIM} />
        </mesh>
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.33, 0.07, 8, 20]} />
          <ToonMat color={FUR_TRIM} />
        </mesh>
        {[0.42, 0.28, 0.14].map((y) => (
          <mesh key={y} position={[0, y, 0.335]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <ToonMat color="#ffffff" />
          </mesh>
        ))}
      </group>
    )
  }
  if (outfit.raincoat) {
    return (
      <group>
        <mesh position={[0, 0.28, 0]} scale={[1.07, 1.02, 1.07]}>
          <capsuleGeometry args={[0.31, 0.24, 6, 16]} />
          <ToonMat color={RAIN} />
        </mesh>
        <mesh position={[0, 0.0, 0]}>
          <cylinderGeometry args={[0.36, 0.42, 0.14, 18]} />
          <ToonMat color={RAIN_DARK} />
        </mesh>
        {[0.42, 0.28, 0.14].map((y) => (
          <mesh key={y} position={[0, y, 0.335]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <ToonMat color="#6aa8ff" />
          </mesh>
        ))}
      </group>
    )
  }
  return null
}

/** Chapéu (gorro ou chapéu de chuva) + binóculo */
export function HeadOutfit({ outfit }) {
  return (
    <group>
      {outfit.furcoat ? (
        <group position={[0, 0.86, -0.02]}>
          <mesh scale={[1, 0.62, 1]}>
            <sphereGeometry args={[0.5, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <ToonMat color={FUR} />
          </mesh>
          <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.48, 0.07, 8, 24]} />
            <ToonMat color={FUR_TRIM} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <sphereGeometry args={[0.13, 14, 10]} />
            <ToonMat color={FUR_TRIM} />
          </mesh>
        </group>
      ) : (
        outfit.raincoat && (
          <group position={[0, 0.9, -0.02]}>
            <mesh scale={[1, 0.55, 1]}>
              <sphereGeometry args={[0.46, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <ToonMat color={RAIN} />
            </mesh>
            {/* aba larga, mais comprida atrás */}
            <mesh position={[0, 0.01, -0.04]} scale={[1, 1, 1.12]}>
              <cylinderGeometry args={[0.66, 0.7, 0.05, 24]} />
              <ToonMat color={RAIN_DARK} />
            </mesh>
          </group>
        )
      )}
    </group>
  )
}

/** Binóculo pendurado no peito (vai no Spine) */
export function ChestOutfit({ outfit }) {
  if (!outfit.binoculars) return null
  return (
    <group position={[0, 0.4, 0.33]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.065, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.06, 0.13, 12]} />
          <ToonMat color="#5a6fd8" />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.02, 10]} />
        <ToonMat color="#bfe8ff" emissive="#9fd8ff" emissiveIntensity={0.4} />
      </mesh>
    </group>
  )
}

/** Mão direita: cristal > ferramenta > chave (o mais recente da jornada) */
export function RightHandItem({ outfit }) {
  if (outfit.crystal) {
    return (
      <mesh position={[0, -0.32, 0.06]} rotation={[0.2, 0.4, 0]}>
        <octahedronGeometry args={[0.13, 0]} />
        <ToonMat color="#8fe6ff" emissive="#5fd0ff" emissiveIntensity={0.9} />
      </mesh>
    )
  }
  if (outfit.tool) {
    return (
      <group position={[0, -0.3, 0.06]} rotation={[0.4, 0, 0]}>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
          <ToonMat color="#d9a26a" />
        </mesh>
        <mesh position={[0, -0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.055, 0.14, 4, 10]} />
          <ToonMat color="#8fa2c0" />
        </mesh>
      </group>
    )
  }
  if (outfit.key) {
    return (
      <group position={[0, -0.3, 0.07]} rotation={[0, 0, 0.3]}>
        <mesh>
          <torusGeometry args={[0.07, 0.025, 8, 16]} />
          <ToonMat color="#ffd23f" emissive="#e8a800" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, -0.13, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.16, 8]} />
          <ToonMat color="#ffd23f" emissive="#e8a800" emissiveIntensity={0.35} />
        </mesh>
      </group>
    )
  }
  return null
}

/** Mão esquerda: lampião aceso */
export function LeftHandItem({ outfit }) {
  if (!outfit.lantern) return null
  return (
    <group position={[0, -0.36, 0.05]}>
      <mesh position={[0, 0.06, 0]}>
        <torusGeometry args={[0.05, 0.012, 6, 12, Math.PI]} />
        <ToonMat color="#7f93ad" />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <sphereGeometry args={[0.085, 12, 10]} />
        <ToonMat color="#fff0a8" emissive="#ffc84a" emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.03, 10]} />
        <ToonMat color="#7f93ad" />
      </mesh>
    </group>
  )
}
