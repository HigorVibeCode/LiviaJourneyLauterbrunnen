import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import ToonMat from '../../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { CAMERA_OCCLUDER_COLLISION, CAMERA_OCCLUDER_SOLVER } from '../../physics/groups'
import { PHASES } from '../../config/world'
import { PAL } from '../../config/palette'
import StaticBatch from './StaticBatch'

const HALF_W = 6.5
const HALF_D = 5
const WALL_H = 6
const WALL_T = 0.4
const DOOR_W = 2.8
const DOOR_H = 3.6

// telhado fofo: grande, com beiral generoso
const ROOF_RUN = HALF_W + 1.5
const ROOF_RISE = 4.6
const ROOF_ANGLE = Math.atan2(ROOF_RISE, ROOF_RUN)
const ROOF_TAN = ROOF_RISE / ROOF_RUN
const ROOF_LEN = Math.hypot(ROOF_RUN, ROOF_RISE) + 0.5
const ROOF_T = 0.75
const ROOF_DEPTH = HALF_D * 2 + 2.8
const EAVE_Y = WALL_H - 0.35
const RIDGE_Y = EAVE_Y + ROOF_RISE
/** altura da face de cima do telhado num x qualquer */
const roofTopAt = (x) => RIDGE_Y - Math.abs(x) * ROOF_TAN + ROOF_T / Math.cos(ROOF_ANGLE)

const FRONT_Z = HALF_D + WALL_T // face externa da parede da frente
const WIN_X = 3.95
const WIN_Y = 3.3

/** Empena (triângulo sob o telhado) — prisma extrudado, compartilhado */
const GABLE_GEO = (() => {
  const w = HALF_W + WALL_T
  const edge = RIDGE_Y - w * ROOF_TAN - WALL_H
  const s = new THREE.Shape()
  s.moveTo(-w, -0.05)
  s.lineTo(w, -0.05)
  s.lineTo(w, edge)
  s.lineTo(0, RIDGE_Y - WALL_H - 0.05)
  s.lineTo(-w, edge)
  s.closePath()
  const depth = HALF_D * 2 + WALL_T * 2
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false })
  g.translate(0, WALL_H, -depth / 2)
  return g
})()

/**
 * Casinha fofa (estilo Animal Crossing), habitável.
 * Porta de 3.6 de altura — Livia (1.7) entra andando.
 * Paredes = colliders separados num único RigidBody, com vão na porta.
 * kind: chalet | barn | cabin | church ; home = casa da Livia.
 */
export default function Chalet({
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
  body = PAL.walls[0],
  roof = PAL.roofs[0],
  home = false,
  kind = 'chalet',
}) {
  const sideW = (HALF_W * 2 - DOOR_W) / 2
  const sideX = DOOR_W / 2 + sideW / 2
  const z = position[2] ?? 0
  // cabanas do vale noturno: janelas acesas, amarelinhas
  const night = z <= PHASES.night.zTo + 2 && z >= PHASES.night.zFrom - 2
  const cabin = kind === 'cabin'
  const snowy = cabin && !night
  const seed = Math.abs(Math.round(position[0] * 7 + z * 3))
  const trim = kind === 'church' ? mix(roof, '#ffffff', 0.72) : '#ffffff'
  const wallCol = body
  // a cabana tem toras mais grossas: decoração um pouco mais para fora
  const fz = cabin ? HALF_D + 0.56 : FRONT_Z
  const sx = cabin ? HALF_W + 0.56 : HALF_W + WALL_T

  return (
    <StaticBatch position={position} rotation={[0, rotation, 0]} scale={scale}>
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

      {/* ── Paredes ── */}
      {cabin ? (
        <LogWalls color={wallCol} sideX={sideX} sideW={sideW} />
      ) : (
        <PlainWalls color={wallCol} sideX={sideX} sideW={sideW} trim={trim} />
      )}

      {/* empena com a cor da parede (ou madeira na cabana) */}
      <mesh geometry={GABLE_GEO}>
        <ToonMat color={cabin ? tint(wallCol, 0.93) : wallCol} />
      </mesh>

      {/* ── Porta grande e simpática ── */}
      <Doorway z={fz} kind={kind} trim={cabin ? tint(wallCol, 0.78) : trim} lit={night} roof={roof} />

      {/* ── Janelas ── */}
      {kind !== 'barn' &&
        [-1, 1].map((s) => (
          <Window
            key={s}
            position={[s * WIN_X, WIN_Y, fz]}
            lit={night}
            frame={cabin ? tint(wallCol, 0.78) : trim}
            shutter={kind === 'church' ? null : mix(roof, '#ffffff', 0.25)}
            tall={kind === 'church'}
            seed={seed + s}
          />
        ))}
      {/* janelinhas redondas nas laterais */}
      {[-1, 1].map((s) => (
        <group key={`side${s}`} position={[s * sx, WIN_Y + 0.3, -0.6]} rotation={[0, s * Math.PI / 2, 0]}>
          <RoundWindow r={0.85} lit={night} frame={cabin ? tint(wallCol, 0.78) : trim} />
        </group>
      ))}
      {/* janela redonda da empena (sótão) */}
      {kind !== 'church' && (
        <group position={[0, WALL_H + 1.55, FRONT_Z]}>
          {kind === 'barn' ? (
            <LoftDoor />
          ) : (
            <RoundWindow r={0.8} lit={night} frame={cabin ? tint(wallCol, 0.78) : trim} />
          )}
        </group>
      )}

      {/* ── Telhado grande e arredondado ── */}
      <Roof color={roof} snowy={snowy} />

      {kind === 'church' && <Steeple roof={roof} lit={night} />}
      {kind === 'barn' && <BarnExtras />}
      {home && <Mailbox />}

      {/* Chaminé */}
      {kind !== 'church' && (
        <group position={[3.6, 0, -2]}>
          <RB args={[1.3, 2.9, 1.3]} r={0.25} position={[0, roofTopAt(3.6) + 0.55, 0]} color={cabin ? '#c9d2dc' : '#f4a48c'} />
          <RB args={[1.6, 0.45, 1.6]} r={0.18} position={[0, roofTopAt(3.6) + 2.1, 0]} color={cabin ? '#b6c1cc' : '#e88f78'} />
          {snowy && (
            <mesh position={[0, roofTopAt(3.6) + 2.38, 0]} scale={[1, 0.45, 1]}>
              <sphereGeometry args={[0.85, 12, 8]} />
              <ToonMat color={PAL.snow} />
            </mesh>
          )}
        </group>
      )}
      {home && <Smoke position={[3.6, roofTopAt(3.6) + 2.6, -2]} />}

      {/* ── Interior (simples e barato) ── */}
      <Interior home={home} seed={seed} />
    </StaticBatch>
  )
}

/** Caixa arredondada barata (drei RoundedBox com poucos segmentos) */
function RB({ args, r = 0.15, color, emissive, emissiveIntensity, ...p }) {
  const radius = Math.max(0.01, Math.min(r, Math.min(...args) / 2 - 0.01))
  return (
    <RoundedBox args={args} radius={radius} smoothness={2} bevelSegments={2} creaseAngle={0.6} {...p}>
      <ToonMat color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
    </RoundedBox>
  )
}

/** Paredes lisas em tom pastel, rodapé de pedra clara e cantoneiras brancas */
function PlainWalls({ color, sideX, sideW, trim }) {
  const side = tint(color, 0.95)
  const plinth = '#e4dccf'
  const pieces = [
    { p: [0, WALL_H / 2, -HALF_D], s: [HALF_W * 2, WALL_H, WALL_T * 2], c: side },
    { p: [-HALF_W, WALL_H / 2, 0], s: [WALL_T * 2, WALL_H, HALF_D * 2], c: side },
    { p: [HALF_W, WALL_H / 2, 0], s: [WALL_T * 2, WALL_H, HALF_D * 2], c: side },
    { p: [-sideX, WALL_H / 2, HALF_D], s: [sideW, WALL_H, WALL_T * 2], c: color },
    { p: [sideX, WALL_H / 2, HALF_D], s: [sideW, WALL_H, WALL_T * 2], c: color },
  ]
  return (
    <group>
      {pieces.map((w, i) => (
        <RB key={i} args={w.s} r={0.3} position={w.p} color={w.c} />
      ))}
      {/* verga acima da porta */}
      <RB
        args={[DOOR_W + 0.4, WALL_H - DOOR_H, WALL_T * 2]}
        r={0.2}
        position={[0, DOOR_H + (WALL_H - DOOR_H) / 2, HALF_D]}
        color={color}
      />
      {/* rodapé de pedra clarinha (sem cobrir o vão da porta) */}
      {pieces.map((w, i) => (
        <RB
          key={`pl${i}`}
          args={[w.s[0] + 0.3, 0.8, w.s[2] + 0.3]}
          r={0.25}
          position={[w.p[0], 0.4, w.p[2]]}
          color={plinth}
        />
      ))}
      {/* cantoneiras roliças */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`c${sx}${sz}`} position={[sx * HALF_W, WALL_H / 2, sz * HALF_D]}>
          <cylinderGeometry args={[0.55, 0.6, WALL_H + 0.1, 12]} />
          <ToonMat color={trim} />
        </mesh>
      ))}
      {/* friso sob o beiral */}
      <RB args={[HALF_W * 2 + 0.6, 0.45, 0.3]} r={0.12} position={[0, WALL_H - 0.2, FRONT_Z + 0.1]} color={trim} />
    </group>
  )
}

/** Cabana de toras roliças (cores de madeira clara, nunca escuras) */
function LogWalls({ color, sideX, sideW }) {
  const logs = []
  const n = 6
  const r = 0.52
  const dark = tint(color, 0.88)
  for (let i = 0; i < n; i++) {
    const y = 0.5 + i * 1.0
    const c = i % 2 ? dark : color
    // fundo
    logs.push({ p: [0, y, -HALF_D], len: HALF_W * 2 + 1.3, ax: 'x', c })
    // laterais (desencontradas meia tora)
    logs.push({ p: [-HALF_W, y + 0.02, 0], len: HALF_D * 2 + 1.3, ax: 'z', c: i % 2 ? color : dark })
    logs.push({ p: [HALF_W, y + 0.02, 0], len: HALF_D * 2 + 1.3, ax: 'z', c: i % 2 ? color : dark })
    // frente: abaixo da verga, partida no vão da porta
    if (y - r < DOOR_H) {
      const len = sideW + 0.65
      logs.push({ p: [-(sideX + 0.32), y, HALF_D], len, ax: 'x', c })
      logs.push({ p: [sideX + 0.32, y, HALF_D], len, ax: 'x', c })
    } else {
      logs.push({ p: [0, y, HALF_D], len: HALF_W * 2 + 1.3, ax: 'x', c })
    }
  }
  return (
    <group>
      {logs.map((l, i) => (
        <mesh key={i} position={l.p} rotation={l.ax === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r, r, l.len, 10]} />
          <ToonMat color={l.c} />
        </mesh>
      ))}
      {/* preenchimento atrás das toras (sem frestas) */}
      <RB args={[sideW, WALL_H, 0.5]} position={[-sideX, WALL_H / 2, HALF_D]} color={dark} />
      <RB args={[sideW, WALL_H, 0.5]} position={[sideX, WALL_H / 2, HALF_D]} color={dark} />
      <RB args={[DOOR_W + 0.4, WALL_H - DOOR_H - 0.3, 0.5]} position={[0, (WALL_H + DOOR_H + 0.3) / 2, HALF_D]} color={dark} />
      <RB args={[HALF_W * 2, WALL_H, 0.5]} position={[0, WALL_H / 2, -HALF_D]} color={dark} />
      <RB args={[0.5, WALL_H, HALF_D * 2]} position={[-HALF_W, WALL_H / 2, 0]} color={dark} />
      <RB args={[0.5, WALL_H, HALF_D * 2]} position={[HALF_W, WALL_H / 2, 0]} color={dark} />
    </group>
  )
}

/** Batentes, bandeira semicircular de vidro, porta aberta com maçaneta e capacho */
function Doorway({ z, kind, trim, lit, roof }) {
  const doorColor = kind === 'barn' ? '#ff7a6b' : kind === 'church' ? mix(roof, '#ffffff', 0.15) : PAL.door
  const glass = lit ? PAL.windowNight : PAL.window
  const glow = lit ? '#ffc04a' : '#000000'
  const open = 1.95
  return (
    <group>
      {/* batentes */}
      {[-1, 1].map((s) => (
        <RB key={s} args={[0.4, DOOR_H + 0.1, 0.5]} r={0.15} position={[s * (DOOR_W / 2 + 0.2), DOOR_H / 2, z + 0.05]} color={trim} />
      ))}
      {/* bandeira em arco sobre a porta */}
      {kind !== 'barn' && (
        <group position={[0, DOOR_H, z + 0.08]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.25, 1.25, 0.16, 16, 1, false, Math.PI / 2, Math.PI]} />
            <ToonMat color={glass} emissive={glow} emissiveIntensity={lit ? 0.9 : 0} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <torusGeometry args={[1.35, 0.18, 8, 16, Math.PI]} />
            <ToonMat color={trim} />
          </mesh>
        </group>
      )}
      {kind === 'barn' && (
        <RB args={[DOOR_W + 0.8, 0.4, 0.5]} r={0.15} position={[0, DOOR_H + 0.2, z + 0.05]} color={trim} />
      )}
      {/* folha da porta, aberta para fora (dobradiça à esquerda) */}
      {kind !== 'barn' && (
        <group position={[-DOOR_W / 2, 0, z + 0.12]} rotation={[0, -open, 0]}>
          <RB args={[DOOR_W - 0.15, DOOR_H - 0.12, 0.26]} r={0.12} position={[DOOR_W / 2 - 0.07, DOOR_H / 2, 0]} color={doorColor} />
          {/* almofadas da porta */}
          {[-1, 1].map((f) => (
            <RB
              key={f}
              args={[DOOR_W - 0.9, 0.9, 0.34]}
              r={0.12}
              position={[DOOR_W / 2 - 0.07, f > 0 ? 2.55 : 1.0, 0]}
              color={tint(doorColor, 0.9)}
            />
          ))}
          {/* maçaneta redonda dourada (dos dois lados) */}
          {[-1, 1].map((f) => (
            <mesh key={`k${f}`} position={[DOOR_W - 0.5, 1.75, f * 0.24]}>
              <sphereGeometry args={[0.16, 10, 8]} />
              <ToonMat color="#ffd45a" />
            </mesh>
          ))}
        </group>
      )}
      {/* capacho fofo */}
      <RB args={[2.2, 0.08, 1.1]} r={0.04} position={[0, 0.05, z + 1.1]} color={kind === 'church' ? '#c9b6ff' : '#ff9fbf'} />
    </group>
  )
}

/** Janela quadradinha com moldura branca, cruz, venezianas e floreira */
function Window({ position, lit, frame, shutter, tall = false, seed = 0 }) {
  const h = tall ? 2.6 : 1.9
  const w = tall ? 1.5 : 1.9
  const glass = lit ? PAL.windowNight : PAL.window
  return (
    <group position={position}>
      <RB args={[w + 0.3, h + 0.3, 0.3]} r={0.14} position={[0, 0, 0.1]} color={frame} />
      <RB
        args={[w - 0.2, h - 0.2, 0.32]}
        r={0.1}
        position={[0, 0, 0.13]}
        color={glass}
        emissive={lit ? '#ffc04a' : '#000000'}
        emissiveIntensity={lit ? 0.9 : 0}
      />
      {/* cruz */}
      <RB args={[0.16, h - 0.2, 0.4]} r={0.06} position={[0, 0, 0.15]} color={frame} />
      <RB args={[w - 0.2, 0.16, 0.4]} r={0.06} position={[0, tall ? 0.3 : 0, 0.15]} color={frame} />
      {/* brilhinho no vidro */}
      {!lit && (
        <RB args={[0.14, 0.42, 0.36]} r={0.06} position={[-w / 4 - 0.05, h / 4, 0.17]} rotation={[0, 0, -0.5]} color="#ffffff" />
      )}
      {shutter &&
        [-1, 1].map((s) => (
          <RB key={s} args={[0.62, h + 0.1, 0.2]} r={0.1} position={[s * (w / 2 + 0.55), 0, 0.1]} color={shutter} />
        ))}
      <FlowerBox position={[0, -h / 2 - 0.42, 0.35]} width={w + 0.5} seed={seed} />
    </group>
  )
}

/** Floreira com flores grandes e coloridas */
function FlowerBox({ position, width, seed = 0 }) {
  const n = 3
  return (
    <group position={position}>
      <RB args={[width, 0.5, 0.65]} r={0.16} color={PAL.wood} />
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x * width, 0.3, 0]} scale={[1.3, 0.7, 0.9]}>
          <sphereGeometry args={[0.3, 8, 6]} />
          <ToonMat color={PAL.leafLight} />
        </mesh>
      ))}
      {Array.from({ length: n }, (_, i) => {
        const x = ((i + 0.5) / n - 0.5) * (width - 0.5)
        const c = PAL.flowers[(seed + i * 2) % PAL.flowers.length]
        const petal = c === '#ffffff' ? '#fff0f6' : c
        return (
          <group key={i} position={[x, 0.62 + (i % 2) * 0.12, 0.12]} rotation={[0, 0, i * 0.5]}>
            {Array.from({ length: 5 }, (_, k) => {
              const a = (k / 5) * Math.PI * 2
              return (
                <mesh key={k} position={[Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0]} scale={[1, 1, 0.6]}>
                  <sphereGeometry args={[0.16, 8, 6]} />
                  <ToonMat color={petal} />
                </mesh>
              )
            })}
            <mesh position={[0, 0, 0.08]}>
              <sphereGeometry args={[0.12, 8, 6]} />
              <ToonMat color={c === PAL.flowers[1] ? '#ff9a3a' : PAL.flowerCenter} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Janela redonda (escotilha) com moldura em anel */
function RoundWindow({ r = 0.8, lit, frame }) {
  return (
    <group>
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, 0.22, 16]} />
        <ToonMat
          color={lit ? PAL.windowNight : PAL.window}
          emissive={lit ? '#ffc04a' : '#000000'}
          emissiveIntensity={lit ? 0.9 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 0.2]}>
        <torusGeometry args={[r + 0.06, 0.16, 8, 18]} />
        <ToonMat color={frame} />
      </mesh>
      <RB args={[0.14, r * 1.8, 0.3]} r={0.06} position={[0, 0, 0.16]} color={frame} />
      <RB args={[r * 1.8, 0.14, 0.3]} r={0.06} position={[0, 0, 0.16]} color={frame} />
    </group>
  )
}

function Roof({ color, snowy = false }) {
  const stripe = tint(color, 0.88)
  const ridge = tint(color, 0.82)
  const midY = (EAVE_Y + RIDGE_Y) / 2
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <RB
            args={[ROOF_LEN, ROOF_T, ROOF_DEPTH]}
            r={0.32}
            position={[
              (s * ROOF_RUN) / 2 + s * Math.sin(ROOF_ANGLE) * (ROOF_T / 2),
              midY + Math.cos(ROOF_ANGLE) * (ROOF_T / 2),
              0,
            ]}
            rotation={[0, 0, -s * ROOF_ANGLE]}
            color={color}
          />
          {/* fileiras de telhas roliças */}
          {!snowy &&
            [0.36, 0.7].map((f) => {
              const x = s * f * ROOF_RUN
              return (
                <mesh key={f} position={[x, roofTopAt(x) - 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.2, 0.2, ROOF_DEPTH - 0.3, 8]} />
                  <ToonMat color={stripe} />
                </mesh>
              )
            })}
          {snowy && (
            <>
              <RB
                args={[ROOF_LEN - 0.3, 0.5, ROOF_DEPTH + 0.1]}
                r={0.24}
                position={[
                  (s * ROOF_RUN) / 2 + s * Math.sin(ROOF_ANGLE) * (ROOF_T + 0.2),
                  midY + Math.cos(ROOF_ANGLE) * (ROOF_T + 0.2),
                  0,
                ]}
                rotation={[0, 0, -s * ROOF_ANGLE]}
                color={PAL.snow}
              />
              {/* neve escorrendo no beiral */}
              {Array.from({ length: 7 }, (_, i) => (
                <mesh
                  key={i}
                  position={[s * (ROOF_RUN + 0.05), EAVE_Y + 0.55, -ROOF_DEPTH / 2 + 0.9 + i * ((ROOF_DEPTH - 1.8) / 6)]}
                  scale={[0.8, 0.6 + (i % 3) * 0.12, 1]}
                >
                  <sphereGeometry args={[0.55, 10, 8]} />
                  <ToonMat color={i % 2 ? PAL.snowShade : PAL.snow} />
                </mesh>
              ))}
            </>
          )}
        </group>
      ))}
      {/* cumeeira roliça */}
      <mesh position={[0, RIDGE_Y + ROOF_T + (snowy ? 0.35 : 0.05), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.48, ROOF_DEPTH - 0.6, 4, 12]} />
        <ToonMat color={snowy ? PAL.snow : ridge} />
      </mesh>
    </group>
  )
}

/** Campanário branquinho com agulha pastel e sino dourado */
function Steeple({ roof, lit }) {
  const white = '#fffaf2'
  const belfryY = 10.2
  return (
    <group position={[0, 0, -HALF_D + 1]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0, 7, 0]} args={[1.7, 7, 1.7]} />
      </RigidBody>
      <RB args={[3.4, belfryY, 3.4]} r={0.35} position={[0, belfryY / 2, 0]} color={white} />
      {/* janela redonda (rosácea) */}
      <group position={[0, 8.6, 1.72]}>
        <RoundWindow r={0.75} lit={lit} frame={mix(roof, '#ffffff', 0.5)} />
      </group>
      {/* faixa pastel */}
      <RB args={[3.7, 0.4, 3.7]} r={0.15} position={[0, belfryY, 0]} color={mix(roof, '#ffffff', 0.45)} />
      {/* colunas do campanário */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * 1.35, belfryY + 1.4, sz * 1.35]}>
          <cylinderGeometry args={[0.32, 0.32, 2.6, 10]} />
          <ToonMat color={white} />
        </mesh>
      ))}
      {/* sino dourado */}
      <group position={[0, belfryY + 1.55, 0]}>
        <mesh>
          <cylinderGeometry args={[0.45, 0.85, 1.1, 14]} />
          <ToonMat color="#ffd45a" />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.46, 12, 8]} />
          <ToonMat color="#ffd45a" />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <sphereGeometry args={[0.2, 10, 8]} />
          <ToonMat color="#f0b43a" />
        </mesh>
      </group>
      <RB args={[3.9, 0.5, 3.9]} r={0.2} position={[0, belfryY + 2.85, 0]} color={mix(roof, '#ffffff', 0.45)} />
      {/* agulha */}
      <mesh position={[0, belfryY + 5.6, 0]}>
        <coneGeometry args={[2.3, 5.2, 12]} />
        <ToonMat color={roof} />
      </mesh>
      <mesh position={[0, belfryY + 8.35, 0]}>
        <sphereGeometry args={[0.36, 12, 8]} />
        <ToonMat color="#ffd45a" />
      </mesh>
      {/* estrelinha dourada no topo */}
      <mesh position={[0, belfryY + 9.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.22, 5]} />
        <ToonMat color="#ffd45a" />
      </mesh>
    </group>
  )
}

/** Celeiro: portas de correr vermelhas com X branco, porta do feno e fardos */
function BarnExtras() {
  const z = FRONT_Z
  const red = '#ff7a6b'
  return (
    <group>
      {/* trilho */}
      <RB args={[HALF_W * 2 - 0.4, 0.3, 0.3]} r={0.1} position={[0, DOOR_H + 0.55, z + 0.2]} color="#ffffff" />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (DOOR_W / 2 + 1.35), DOOR_H / 2 + 0.05, z + 0.25]}>
          <RB args={[2.5, DOOR_H + 0.1, 0.24]} r={0.1} color={red} />
          {/* moldura e X brancos */}
          <RB args={[2.5, 0.22, 0.32]} r={0.08} position={[0, DOOR_H / 2 - 0.1, 0]} color="#ffffff" />
          <RB args={[2.5, 0.22, 0.32]} r={0.08} position={[0, -DOOR_H / 2 + 0.15, 0]} color="#ffffff" />
          {[-1, 1].map((f) => (
            <RB key={f} args={[0.22, 3.8, 0.3]} r={0.08} rotation={[0, 0, f * 0.58]} color="#ffffff" />
          ))}
        </group>
      ))}
      {/* fardos de feno ao lado */}
      {[
        [HALF_W + 1.8, 0.7, HALF_D - 0.5, 0],
        [HALF_W + 1.8, 0.7, HALF_D - 2.3, 0.1],
        [HALF_W + 1.8, 1.95, HALF_D - 1.4, -0.1],
      ].map(([x, y, zz, ry], i) => (
        <mesh key={i} position={[x, y, zz]} rotation={[Math.PI / 2, ry, 0]}>
          <cylinderGeometry args={[0.7, 0.7, 1.7, 12]} />
          <ToonMat color={i % 2 ? '#f6d873' : '#ffe28a'} />
        </mesh>
      ))}
    </group>
  )
}

/** Portinha do palheiro na empena do celeiro */
function LoftDoor() {
  return (
    <group>
      <RB args={[2.1, 2.1, 0.3]} r={0.15} position={[0, -0.2, 0.1]} color="#ffffff" />
      <RB args={[1.7, 1.7, 0.36]} r={0.1} position={[0, -0.2, 0.12]} color="#ff7a6b" />
      {[-1, 1].map((f) => (
        <RB key={f} args={[0.16, 2.2, 0.42]} r={0.06} position={[0, -0.2, 0.14]} rotation={[0, 0, f * 0.785]} color="#ffffff" />
      ))}
    </group>
  )
}

/** Caixa de correio da casa da Livia */
function Mailbox() {
  return (
    <group position={[DOOR_W / 2 + 3.4, 0, FRONT_Z + 3.2]} rotation={[0, -0.3, 0]}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 1.4, 10]} />
        <ToonMat color={PAL.wood} />
      </mesh>
      <RB args={[0.8, 0.6, 1.1]} r={0.14} position={[0, 1.6, 0]} color="#ff8fb8" />
      <mesh position={[0, 1.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 1.1, 14, 1, false, Math.PI / 2, Math.PI]} />
        <ToonMat color="#ff8fb8" />
      </mesh>
      {/* bandeirinha */}
      <RB args={[0.1, 0.6, 0.1]} r={0.04} position={[0.47, 1.95, -0.2]} color="#ffd45a" />
      <RB args={[0.1, 0.3, 0.42]} r={0.05} position={[0.47, 2.15, -0.02]} color="#ff6b6b" />
      {/* coraçãozinho na frente */}
      <mesh position={[0, 1.65, 0.56]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.22, 0.22, 0.06]} />
        <ToonMat color="#ffffff" />
      </mesh>
    </group>
  )
}

/** Mobília simples: tapete redondo, mesa e cama */
function Interior({ home, seed }) {
  const rug = PAL.flowers[seed % 2 === 0 ? 0 : 3]
  return (
    <group>
      {/* piso de madeira clara — rente ao terreno, sem degrau na porta */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[HALF_W * 2 - 0.8, 0.06, HALF_D * 2 - 0.8]} />
        <ToonMat color="#e8c391" />
      </mesh>
      <mesh position={[0.3, 0.08, 0.8]}>
        <cylinderGeometry args={[2.3, 2.3, 0.05, 20]} />
        <ToonMat color={rug} />
      </mesh>
      <mesh position={[0.3, 0.1, 0.8]}>
        <cylinderGeometry args={[1.5, 1.5, 0.05, 20]} />
        <ToonMat color={mix(rug, '#ffffff', 0.45)} />
      </mesh>
      {/* mesa redonda */}
      <mesh position={[-3, 1.05, -1.8]}>
        <cylinderGeometry args={[1, 1, 0.2, 16]} />
        <ToonMat color={PAL.wood} />
      </mesh>
      <mesh position={[-3, 0.5, -1.8]}>
        <cylinderGeometry args={[0.18, 0.4, 1, 10]} />
        <ToonMat color={PAL.woodDark} />
      </mesh>
      {/* cama */}
      <RB args={[2.4, 0.8, 3.4]} r={0.2} position={[3.6, 0.5, -2.6]} color={PAL.wood} />
      <RB args={[2.3, 0.35, 2.5]} r={0.15} position={[3.6, 1.0, -2.1]} color={home ? '#ffb7d0' : '#bfe0ff'} />
      <RB args={[1.6, 0.4, 0.8]} r={0.18} position={[3.6, 1.1, -3.75]} color="#ffffff" />
      {home && <pooledLight position={[3.4, 2.4, -1]} intensity={9} distance={16} decay={2} color="#ffb060" />}
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
      child.material.opacity = Math.max(0, 0.6 - cycle * 0.15)
    })
  })

  return (
    <group ref={ref} position={position} userData={{ noBatch: true }}>
      {puffs.map((p, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.55, 12, 8]} />
          <ToonMat color="#ffffff" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Escurece mantendo o matiz (sombra = tom da mesma cor) */
function tint(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * k)
  const g = Math.round(((n >> 8) & 255) * k)
  const b = Math.round((n & 255) * k)
  return `#${((Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b)).toString(16).padStart(6, '0')}`
}

/** Mistura duas cores (t=0 → a, t=1 → b) */
function mix(a, b, t) {
  const na = parseInt(a.slice(1), 16)
  const nb = parseInt(b.slice(1), 16)
  const ch = (s) => Math.round(((na >> s) & 255) * (1 - t) + ((nb >> s) & 255) * t)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}
