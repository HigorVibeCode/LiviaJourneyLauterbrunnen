import { useRef, useMemo } from 'react'
import ToonMat from '../../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { CAMERA_OCCLUDER_COLLISION, CAMERA_OCCLUDER_SOLVER } from '../../physics/groups'

const HALF_W = 6.5
const HALF_D = 5
const WALL_H = 6
const WALL_T = 0.4
const DOOR_W = 2.8
const DOOR_H = 3.6

/**
 * Chalé suíço habitável (~3x a escala antiga).
 * Porta de 3.6 de altura — Livia (1.7) entra andando.
 * Paredes = colliders separados num único RigidBody, com vão na porta.
 */
export default function Chalet({
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
  body = '#8B5A2B',
  roof = '#5c2e1a',
  home = false,
  kind = 'chalet',
}) {
  const sideW = (HALF_W * 2 - DOOR_W) / 2
  const sideX = DOOR_W / 2 + sideW / 2
  const snowy = kind === 'cabin'

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <RigidBody type="fixed" colliders={false} friction={1.2}>
        {/* fundo */}
        <CuboidCollider position={[0, WALL_H / 2, -HALF_D]} args={[HALF_W, WALL_H / 2, WALL_T]} />
        {/* laterais */}
        <CuboidCollider position={[-HALF_W, WALL_H / 2, 0]} args={[WALL_T, WALL_H / 2, HALF_D]} />
        <CuboidCollider position={[HALF_W, WALL_H / 2, 0]} args={[WALL_T, WALL_H / 2, HALF_D]} />
        {/* frente com vão da porta */}
        <CuboidCollider position={[-sideX, WALL_H / 2, HALF_D]} args={[sideW / 2, WALL_H / 2, WALL_T]} />
        <CuboidCollider position={[sideX, WALL_H / 2, HALF_D]} args={[sideW / 2, WALL_H / 2, WALL_T]} />
        {/* verga acima da porta */}
        <CuboidCollider
          position={[0, DOOR_H + (WALL_H - DOOR_H) / 2, HALF_D]}
          args={[DOOR_W / 2, (WALL_H - DOOR_H) / 2, WALL_T]}
        />
      </RigidBody>

      {/* Telhado: só oclusão da câmera (beirais sem collider físico) */}
      <RigidBody
        type="fixed"
        colliders={false}
        collisionGroups={CAMERA_OCCLUDER_COLLISION}
        solverGroups={CAMERA_OCCLUDER_SOLVER}
      >
        <CuboidCollider position={[0, WALL_H + 2.35, 0]} args={[HALF_W + 2.2, 2.5, HALF_D + 1.4]} />
      </RigidBody>

      {/* Base de pedra — assinatura do chalé alpino da referência */}
      {(kind === 'chalet' || kind === 'cabin' || kind === 'barn') && (
        <mesh position={[0, 0.55, 0]} receiveShadow castShadow>
          <boxGeometry args={[HALF_W * 2 + 0.35, 1.15, HALF_D * 2 + 0.35]} />
          <ToonMat color="#8a8680"/>
        </mesh>
      )}

      {/* ── Paredes (visual em painéis, evitando polígonos enormes) ── */}
      <Wall position={[0, WALL_H / 2, -HALF_D]} size={[HALF_W * 2, WALL_H, WALL_T * 2]} color={body} panels={4} />
      <Wall
        position={[-HALF_W, WALL_H / 2, 0]}
        size={[WALL_T * 2, WALL_H, HALF_D * 2]}
        color={shade(body, -14)}
        panels={3}
        axis="z"
      />
      <Wall
        position={[HALF_W, WALL_H / 2, 0]}
        size={[WALL_T * 2, WALL_H, HALF_D * 2]}
        color={shade(body, -8)}
        panels={3}
        axis="z"
      />
      <Wall position={[-sideX, WALL_H / 2, HALF_D]} size={[sideW, WALL_H, WALL_T * 2]} color={body} panels={2} />
      <Wall position={[sideX, WALL_H / 2, HALF_D]} size={[sideW, WALL_H, WALL_T * 2]} color={body} panels={2} />
      <mesh
        position={[0, DOOR_H + (WALL_H - DOOR_H) / 2, HALF_D]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[DOOR_W, WALL_H - DOOR_H, WALL_T * 2]} />
        <ToonMat color={shade(body, -18)}/>
      </mesh>

      {/* Moldura da porta */}
      <mesh position={[-DOOR_W / 2 - 0.15, DOOR_H / 2, HALF_D + 0.3]} castShadow>
        <boxGeometry args={[0.3, DOOR_H, 0.3]} />
        <ToonMat color="#3a2210"/>
      </mesh>
      <mesh position={[DOOR_W / 2 + 0.15, DOOR_H / 2, HALF_D + 0.3]} castShadow>
        <boxGeometry args={[0.3, DOOR_H, 0.3]} />
        <ToonMat color="#3a2210"/>
      </mesh>
      {/* porta aberta encostada */}
      <mesh position={[-DOOR_W / 2 - 0.5, DOOR_H / 2, HALF_D + 0.9]} rotation={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.16, DOOR_H - 0.1, DOOR_W * 0.9]} />
        <ToonMat color="#4a2c14"/>
      </mesh>

      {/* Janelas */}
      {[-3.6, 3.6].map((x) => (
        <group key={x} position={[x, 3.6, HALF_D + 0.42]}>
          <mesh castShadow>
            <boxGeometry args={[1.7, 1.5, 0.14]} />
            <ToonMat color="#5c3a1e"/>
          </mesh>
          <mesh position={[0, 0, 0.08]}>
            <boxGeometry args={[1.4, 1.2, 0.06]} />
            <ToonMat
              color="#bcd8ea"emissive="#ffd9a0"
              emissiveIntensity={0.25}/>
          </mesh>
          {/* floreira */}
          <mesh position={[0, -0.95, 0.25]} castShadow>
            <boxGeometry args={[1.8, 0.3, 0.5]} />
            <ToonMat color="#6a3f22"/>
          </mesh>
          <mesh position={[-0.45, -0.68, 0.3]}>
            <sphereGeometry args={[0.22, 5, 5]} />
            <ToonMat color="#d94a6a"/>
          </mesh>
          <mesh position={[0.45, -0.68, 0.3]}>
            <sphereGeometry args={[0.22, 5, 5]} />
            <ToonMat color="#e8c84a"/>
          </mesh>
        </group>
      ))}
      {/* janela lateral */}
      <mesh position={[HALF_W + 0.4, 3.4, -1.5]} castShadow>
        <boxGeometry args={[0.14, 1.4, 1.6]} />
        <ToonMat color="#bcd8ea"emissive="#ffd9a0" emissiveIntensity={0.2} />
      </mesh>

      {/* ── Telhado em duas águas, com ripas ── */}
      <Roof color={roof} snowy={snowy} />

      {/* Sacada corrida com balaústres — a assinatura do chalé suíço */}
      {(kind === 'chalet' || kind === 'cabin') && <Balcony />}
      {kind === 'chalet' && <Shutters />}
      {kind === 'church' && <Steeple />}
      {kind === 'barn' && <BarnDoors />}

      {/* Chaminé */}
      <mesh position={[HALF_W - 2, WALL_H + 3.2, -2]} castShadow>
        <boxGeometry args={[1.1, 2.6, 1.1]} />
        <ToonMat color="#7a7168"/>
      </mesh>
      {home && <Smoke position={[HALF_W - 2, WALL_H + 4.8, -2]} />}

      {/* ── Interior ── */}
      <Interior home={home} />
    </group>
  )
}

function Wall({ position, size, color, panels = 3, axis = 'x' }) {
  const [w, h, d] = size
  const items = []
  for (let i = 0; i < panels; i++) {
    const t = (i + 0.5) / panels - 0.5
    const off = axis === 'x' ? [t * w, 0, 0] : [0, 0, t * d]
    const pw = axis === 'x' ? w / panels + 0.02 : w
    const pd = axis === 'x' ? d : d / panels + 0.02
    items.push(
      <mesh
        key={i}
        position={[position[0] + off[0], position[1], position[2] + off[2]]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[pw, h, pd]} />
        <ToonMat color={i % 2 ? shade(color, -10) : color}/>
      </mesh>,
    )
  }
  return <group>{items}</group>
}

function Roof({ color, snowy = false }) {
  const slope = 0.52
  const len = 8.4
  return (
    <group position={[0, WALL_H, 0]}>
      {[-1, 1].map((side) => (
        <group key={side}>
          {[0, 1, 2, 3].map((i) => {
            const zSeg = -HALF_D + (i + 0.5) * ((HALF_D * 2) / 4)
            return (
              <group key={i}>
                <mesh
                  position={[side * (HALF_W * 0.52), 1.65, zSeg]}
                  rotation={[0, 0, -side * slope]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[len, 0.35, (HALF_D * 2) / 4 + 0.1]} />
                  <ToonMat
                    color={i % 2 ? shade(color, -12) : color}/>
                </mesh>
                {snowy && (
                  <mesh
                    position={[side * (HALF_W * 0.52), 1.9, zSeg]}
                    rotation={[0, 0, -side * slope]}
                    castShadow
                  >
                    <boxGeometry args={[len * 0.96, 0.28, (HALF_D * 2) / 4 + 0.05]} />
                    <ToonMat color="#f2f8fc"/>
                  </mesh>
                )}
              </group>
            )
          })}
        </group>
      ))}
      {/* cumeeira */}
      <mesh position={[0, 3.55, 0]} castShadow>
        <boxGeometry args={[0.7, 0.35, HALF_D * 2 + 1.4]} />
        <ToonMat color={shade(color, -25)}/>
      </mesh>
      {/* beirais */}
      <mesh position={[0, 0.1, HALF_D + 0.9]} castShadow>
        <boxGeometry args={[HALF_W * 2 + 3, 0.25, 0.6]} />
        <ToonMat color={shade(color, -20)}/>
      </mesh>
      <mesh position={[0, 0.1, -HALF_D - 0.9]} castShadow>
        <boxGeometry args={[HALF_W * 2 + 3, 0.25, 0.6]} />
        <ToonMat color={shade(color, -20)}/>
      </mesh>
    </group>
  )
}

/** Sacada de madeira com balaústres e vasos — cara de Lauterbrunnen */
function Balcony() {
  const y = 4.5
  const out = HALF_D + 1.5
  return (
    <group>
      <mesh position={[0, y, out - 0.75]} castShadow receiveShadow>
        <boxGeometry args={[HALF_W * 2 + 1, 0.22, 3]} />
        <ToonMat color="#6b4a2c"/>
      </mesh>
      {/* mão-corrente */}
      <mesh position={[0, y + 1.1, out + 0.6]} castShadow>
        <boxGeometry args={[HALF_W * 2 + 1, 0.18, 0.18]} />
        <ToonMat color="#54381f"/>
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (HALF_W + 0.4), y + 1.1, out - 0.75]} castShadow>
          <boxGeometry args={[0.18, 0.18, 3]} />
          <ToonMat color="#54381f"/>
        </mesh>
      ))}
      {/* balaústres */}
      {Array.from({ length: 13 }, (_, i) => (
        <mesh key={i} position={[-HALF_W - 0.4 + i * ((HALF_W * 2 + 0.8) / 12), y + 0.6, out + 0.6]}>
          <boxGeometry args={[0.12, 1.1, 0.12]} />
          <ToonMat color="#5c3f22"/>
        </mesh>
      ))}
      {/* mãos francesas */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (HALF_W - 1), y - 0.8, out - 0.2]} rotation={[0.7, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 2.4, 0.2]} />
          <ToonMat color="#54381f"/>
        </mesh>
      ))}
      {/* gerânios na sacada */}
      {[-4, -1.3, 1.3, 4].map((x) => (
        <group key={x} position={[x, y + 0.35, out + 0.45]}>
          <mesh castShadow>
            <boxGeometry args={[1.5, 0.36, 0.5]} />
            <ToonMat color="#6a3f22"/>
          </mesh>
          {[-0.4, 0, 0.4].map((dx) => (
            <mesh key={dx} position={[dx, 0.32, 0]}>
              <sphereGeometry args={[0.2, 5, 4]} />
              <ToonMat color={dx === 0 ? '#e8c84a' : '#d94a6a'}/>
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Persianas verdes ao lado das janelas */
function Shutters() {
  return (
    <group>
      {[-3.6, 3.6].map((x) =>
        [-1, 1].map((s) => (
          <mesh key={`${x}${s}`} position={[x + s * 1.15, 3.6, HALF_D + 0.5]} castShadow>
            <boxGeometry args={[0.55, 1.6, 0.12]} />
            <ToonMat color="#3f6b4a"/>
          </mesh>
        )),
      )}
    </group>
  )
}

/** Campanário da igreja do vilarejo */
function Steeple() {
  return (
    <group position={[0, 0, -HALF_D + 1]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0, 7, 0]} args={[1.7, 7, 1.7]} />
      </RigidBody>
      <mesh position={[0, 7, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 14, 3.4]} />
        <ToonMat color="#e8e2d4"/>
      </mesh>
      {/* relógio */}
      <mesh position={[0, 12.2, 1.78]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.14, 14]} />
        <ToonMat color="#f4efe2"/>
      </mesh>
      <mesh position={[0, 12.2, 1.86]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.78, 0.78, 0.06, 14]} />
        <ToonMat color="#2f3338"/>
      </mesh>
      {/* arcos do sino */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.2, 10, 1.75]}>
          <boxGeometry args={[0.8, 1.8, 0.2]} />
          <ToonMat color="#4a4a48"/>
        </mesh>
      ))}
      {/* agulha */}
      <mesh position={[0, 15.6, 0]} castShadow>
        <coneGeometry args={[2.5, 5.6, 4]} />
        <ToonMat color="#4a5560"/>
      </mesh>
      <mesh position={[0, 18.9, 0]}>
        <sphereGeometry args={[0.28, 6, 5]} />
        <ToonMat color="#d8b64a"/>
      </mesh>
      <mesh position={[0, 19.5, 0]}>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
        <ToonMat color="#d8b64a"/>
      </mesh>
      <mesh position={[0, 19.7, 0]}>
        <boxGeometry args={[0.6, 0.1, 0.1]} />
        <ToonMat color="#d8b64a"/>
      </mesh>
    </group>
  )
}

/** Portões largos de celeiro */
function BarnDoors() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.6, DOOR_H / 2, HALF_D + 0.45]} castShadow>
          <boxGeometry args={[2.9, DOOR_H, 0.18]} />
          <ToonMat color="#8a3f2c"/>
        </mesh>
      ))}
      <mesh position={[0, DOOR_H + 0.25, HALF_D + 0.5]}>
        <boxGeometry args={[6.4, 0.22, 0.18]} />
        <ToonMat color="#e8dcc4"/>
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.6, DOOR_H / 2, HALF_D + 0.56]} rotation={[0, 0, s * 0.9]}>
          <boxGeometry args={[4.4, 0.18, 0.1]} />
          <ToonMat color="#e8dcc4"/>
        </mesh>
      ))}
    </group>
  )
}

/** Mobília simples para a casa fazer sentido por dentro */
function Interior({ home }) {
  return (
    <group>
      {/* piso de madeira — rente ao terreno, sem degrau na porta */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[HALF_W * 2 - 0.8, 0.06, HALF_D * 2 - 0.8]} />
        <ToonMat color="#6b4a2c"/>
      </mesh>
      {/* tapete */}
      <mesh position={[0.5, 0.075, 0.5]} receiveShadow>
        <boxGeometry args={[4, 0.03, 3]} />
        <ToonMat color="#8a3a44"/>
      </mesh>
      {/* mesa + bancos */}
      <mesh position={[-2.5, 1.05, -1.5]} castShadow>
        <boxGeometry args={[2.6, 0.18, 1.6]} />
        <ToonMat color="#7a5230"/>
      </mesh>
      {[[-3.5, -2.1], [-1.5, -2.1], [-3.5, -0.9], [-1.5, -0.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.55, z]} castShadow>
          <boxGeometry args={[0.16, 1, 0.16]} />
          <ToonMat color="#5c3a1e"/>
        </mesh>
      ))}
      {/* cama */}
      <mesh position={[3.4, 0.55, -2.6]} castShadow>
        <boxGeometry args={[2.4, 0.8, 3.4]} />
        <ToonMat color="#6b4a2c"/>
      </mesh>
      <mesh position={[3.4, 1.05, -2.2]} castShadow>
        <boxGeometry args={[2.3, 0.3, 2.4]} />
        <ToonMat color="#c9d6e2"/>
      </mesh>
      <mesh position={[3.4, 1.15, -3.8]} castShadow>
        <boxGeometry args={[1.6, 0.35, 0.7]} />
        <ToonMat color="#f0f0e6"/>
      </mesh>
      {/* lareira */}
      <mesh position={[5.1, 1.2, -2]} castShadow>
        <boxGeometry args={[1.6, 2.4, 2.2]} />
        <ToonMat color="#7a7168"/>
      </mesh>
      <mesh position={[4.4, 0.7, -2]}>
        <boxGeometry args={[0.3, 0.9, 1.3]} />
        <ToonMat color="#ff8830" emissive="#ff7020" emissiveIntensity={1.6} />
      </mesh>
      {home && <pointLight position={[3.4, 2.4, -1]} intensity={9} distance={16} decay={2} color="#ffb060" />}
    </group>
  )
}

function Smoke({ position }) {
  const ref = useRef(null)
  const puffs = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ phase: i * 0.8, s: 0.4 + i * 0.15 })),
    [],
  )

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.children.forEach((child, i) => {
      const p = puffs[i]
      const cycle = (t * 0.45 + p.phase) % 4
      child.position.y = cycle * 2.2
      child.position.x = Math.sin(cycle * 1.4 + p.phase) * 0.7
      child.scale.setScalar(p.s * (1 + cycle * 0.4))
      child.material.opacity = Math.max(0, 0.4 - cycle * 0.1)
    })
  })

  return (
    <group ref={ref} position={position}>
      {puffs.map((p, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.5, 5, 5]} />
          <ToonMat color="#e6e6e6" transparent opacity={0.35} depthWrite={false}/>
        </mesh>
      ))}
    </group>
  )
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount))
  const b = Math.max(0, Math.min(255, (n & 255) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
