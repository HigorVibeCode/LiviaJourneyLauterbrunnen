/**
 * Mini-modelos low-poly por tema — segredos escondidos no cenário.
 * Cada um usa primitivos Three.js (sem assets novos).
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

/** Sino de vaca a balançar num poste */
function SecretCowBell() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 1.1, 5]} />
        <meshStandardMaterial color="#5a4030" flatShading />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.14, 6, 5]} />
        <meshStandardMaterial color="#d4a830" emissive="#b89420" emissiveIntensity={0.35} flatShading metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.78, 0.12]}>
        <boxGeometry args={[0.04, 0.18, 0.04]} />
        <meshStandardMaterial color="#8a7020" flatShading />
      </mesh>
    </group>
  )
}

/** Ratinho escondido no fardo de feno */
function SecretHayMouse() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 1.1, 8]} />
        <meshStandardMaterial color="#c8a848" flatShading roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.95, 0.35]} rotation={[0.3, 0, 0]}>
        <capsuleGeometry args={[0.08, 0.14, 3, 5]} />
        <meshStandardMaterial color="#9a8a78" flatShading />
      </mesh>
      <mesh position={[0.1, 1.05, 0.42]}>
        <coneGeometry args={[0.04, 0.12, 4]} />
        <meshStandardMaterial color="#b8a898" flatShading />
      </mesh>
      <mesh position={[-0.1, 1.05, 0.42]}>
        <coneGeometry args={[0.04, 0.12, 4]} />
        <meshStandardMaterial color="#b8a898" flatShading />
      </mesh>
      <mesh position={[0, 1.02, 0.48]}>
        <sphereGeometry args={[0.05, 5, 4]} />
        <meshStandardMaterial color="#2a2018" flatShading />
      </mesh>
    </group>
  )
}

/** Frasco com vaga-lumes brilhantes */
function SecretFireflyJar() {
  return (
    <group>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.7, 6]} />
        <meshStandardMaterial color="#88a8c0" flatShading transparent opacity={0.75} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 6]} />
        <meshStandardMaterial color="#5a4030" flatShading />
      </mesh>
      {[
        [0.06, 0.42, 0.05],
        [-0.08, 0.38, -0.04],
        [0.02, 0.52, -0.06],
        [-0.04, 0.48, 0.08],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.035, 4, 4]} />
          <meshStandardMaterial color="#c8ff80" emissive="#90ff40" emissiveIntensity={1.4} flatShading />
        </mesh>
      ))}
      <pointLight position={[0, 0.45, 0]} color="#a0ff60" intensity={0.8} distance={4} decay={2} />
    </group>
  )
}

/** Sapo à beira da água */
function SecretFrog() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]} scale={[1.2, 0.7, 1]}>
        <sphereGeometry args={[0.22, 6, 5]} />
        <meshStandardMaterial color="#4a8a48" flatShading />
      </mesh>
      <mesh position={[0.12, 0.22, 0.18]}>
        <sphereGeometry args={[0.1, 5, 4]} />
        <meshStandardMaterial color="#3a7a38" flatShading />
      </mesh>
      <mesh position={[-0.12, 0.22, 0.18]}>
        <sphereGeometry args={[0.1, 5, 4]} />
        <meshStandardMaterial color="#3a7a38" flatShading />
      </mesh>
      <mesh position={[0.08, 0.28, 0.24]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#1a2018" flatShading />
      </mesh>
      <mesh position={[-0.08, 0.28, 0.24]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#1a2018" flatShading />
      </mesh>
      <mesh position={[0.2, 0.05, -0.1]} rotation={[0, 0, -0.5]}>
        <capsuleGeometry args={[0.04, 0.12, 2, 4]} />
        <meshStandardMaterial color="#3a6a38" flatShading />
      </mesh>
      <mesh position={[-0.2, 0.05, -0.1]} rotation={[0, 0, 0.5]}>
        <capsuleGeometry args={[0.04, 0.12, 2, 4]} />
        <meshStandardMaterial color="#3a6a38" flatShading />
      </mesh>
    </group>
  )
}

/** Detalhe num boneco de neve (nariz + cachecol) */
function SecretSnowmanDetail() {
  return (
    <group>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.32, 7, 6]} />
        <meshStandardMaterial color="#f0f4f8" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.24, 7, 6]} />
        <meshStandardMaterial color="#f0f4f8" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.88, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.22, 5]} />
        <meshStandardMaterial color="#e87030" flatShading />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.05, 4, 10]} />
        <meshStandardMaterial color="#c83838" flatShading />
      </mesh>
      <mesh position={[0.1, 0.82, 0.18]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#2a2018" flatShading />
      </mesh>
      <mesh position={[-0.1, 0.82, 0.18]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#2a2018" flatShading />
      </mesh>
    </group>
  )
}

/** Coroa de flores no chão */
function SecretFlowerCrown() {
  const petals = [
    [0.28, 0.08, 0],
    [-0.28, 0.08, 0],
    [0, 0.08, 0.28],
    [0, 0.08, -0.28],
    [0.2, 0.08, 0.2],
    [-0.2, 0.08, 0.2],
    [0.2, 0.08, -0.2],
    [-0.2, 0.08, -0.2],
  ]
  const colors = ['#f0d24a', '#e8829a', '#faf7ee', '#8fd0f0', '#efd85a']
  return (
    <group>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.32, 12]} />
        <meshStandardMaterial color="#3a6a38" flatShading />
      </mesh>
      {petals.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.1, 5, 4]} />
          <meshStandardMaterial color={colors[i % colors.length]} flatShading emissive={colors[i % colors.length]} emissiveIntensity={0.15} />
        </mesh>
      ))}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.08, 5, 4]} />
        <meshStandardMaterial color="#efd85a" flatShading emissive="#d0b030" emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

/** Bandeirinha no marco do mirante */
function SecretSummitFlag() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 1.1, 5]} />
        <meshStandardMaterial color="#6a5038" flatShading />
      </mesh>
      <mesh position={[0.22, 0.95, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.38, 0.22, 0.04]} />
        <meshStandardMaterial color="#e83838" flatShading emissive="#c02020" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.22, 0.95, 0.03]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.12, 0.12, 0.02]} />
        <meshStandardMaterial color="#f0e8d0" flatShading />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.12, 6]} />
        <meshStandardMaterial color="#8a8a94" flatShading />
      </mesh>
    </group>
  )
}
