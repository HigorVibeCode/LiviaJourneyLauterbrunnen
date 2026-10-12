import * as THREE from 'three'
import {
  PHASES,
  RIVER,
  RIVER_CX,
  STAIRS,
  STAIRS_Z_TOP,
  SUMMIT_Y,
  TREASURE_POS,
  makeRng,
  pathXAt,
} from '../../config/world'
import { PAL } from '../../config/palette'

/**
 * Geometria do terreno no estilo fofo:
 *  — chão de grama contínuo (vertex colors, manchinhas), em pedaços para culling
 *  — trilha de terra clarinha com bordas onduladas
 *  — falésias em degraus (paredes de terra listradas + topo gramado)
 *
 * Tudo é plano onde se anda (a física é plana); a graça vem da cor.
 */

export const Z_FRONT = 121
export const Z_BACK = -1116
/** face interna da falésia (lateral a partir do centro da trilha) */
export const CLIFF_FACE = 44
const GRID = 2

const tmp = new THREE.Color()
const tmp2 = new THREE.Color()

/** chão base (sem escada): mirante é um platô alto */
export function baseYAt(z) {
  return z < STAIRS_Z_TOP ? SUMMIT_Y : 0
}

/** cores de grama por bioma (claro, escuro) */
const BIOME_GRASS = {
  meadow: ['#93d96c', '#7fcb5e'],
  pasture: ['#a6dc68', '#93cf5a'],
  night: ['#5aa898', '#4e9888'],
  water: ['#86d877', '#73c866'],
  snow: ['#f2f8ff', '#dfeefb'],
  flower: ['#9ede78', '#8cd36a'],
  alpine: ['#b6e28e', '#a2d67e'],
}
const BIOME_TOP = {
  meadow: '#86d064',
  pasture: '#9bd560',
  night: '#3f8578',
  water: '#7bd06c',
  snow: '#f6fbff',
  flower: '#94d870',
  alpine: '#f6fbff',
}
const PATH_COL = {
  night: '#b8b4d6',
  snow: '#bfcfe4',
}

function biomeAt(z) {
  for (const id of ['meadow', 'pasture', 'night', 'water', 'snow', 'flower', 'summit']) {
    const p = PHASES[id]
    if (z >= p.zFrom - 2 && z <= p.zTo + 2) return p.biome
  }
  return z > 0 ? 'meadow' : 'alpine'
}

/** cor de grama suavizada entre biomas (mistura 12 m) */
function grassColor(z, which, out) {
  const a = BIOME_GRASS[biomeAt(z)][which]
  const b = BIOME_GRASS[biomeAt(z + 6)][which]
  const c = BIOME_GRASS[biomeAt(z - 6)][which]
  out.set(a)
  tmp2.set(b)
  out.lerp(tmp2, 0.25)
  tmp2.set(c)
  out.lerp(tmp2, 0.25)
  return out
}

function noise2(x, z) {
  return (
    Math.sin(x * 0.11 + z * 0.07) * 0.5 +
    Math.sin(x * 0.23 - z * 0.19 + 1.7) * 0.3 +
    Math.sin(x * 0.53 + z * 0.41 + 4.1) * 0.2
  )
}

function inRiverGap(x, z) {
  return z >= RIVER.zFrom && z <= RIVER.zTo && Math.abs(x - RIVER_CX) < RIVER.gapHalfX
}

/** pedaços do chão: [{ geometry }] */
export function buildGroundChunks(chunkLen = 48) {
  const chunks = []
  const half = CLIFF_FACE + 4
  const cols = Math.ceil((half * 2) / GRID)
  for (let z0 = Z_FRONT; z0 > Z_BACK; z0 -= chunkLen) {
    const z1 = Math.max(Z_BACK, z0 - chunkLen)
    const rows = Math.max(1, Math.ceil((z0 - z1) / GRID))
    const pos = []
    const col = []
    const idx = []
    for (let r = 0; r <= rows; r++) {
      const z = z0 - ((z0 - z1) * r) / rows
      const px = pathXAt(z)
      const y = baseYAt(z)
      for (let c = 0; c <= cols; c++) {
        const lat = -half + (c * half * 2) / cols
        const x = px + lat
        pos.push(x, y, z)
        const n = noise2(x, z)
        grassColor(z, 0, tmp)
        grassColor(z, 1, tmp2)
        tmp.lerp(tmp2, THREE.MathUtils.clamp(0.5 + n * 0.9, 0, 1))
        // pé da falésia um pouco mais escuro (dá profundidade)
        const edge = THREE.MathUtils.smoothstep(Math.abs(lat), CLIFF_FACE - 6, CLIFF_FACE)
        tmp.multiplyScalar(1 - edge * 0.12)
        col.push(tmp.r, tmp.g, tmp.b)
      }
    }
    const w = cols + 1
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * w + c
        const b = a + 1
        const d = a + w
        const e = d + 1
        // buraco do desfiladeiro do rio
        const cx = (pos[a * 3] + pos[e * 3]) / 2
        const cz = (pos[a * 3 + 2] + pos[e * 3 + 2]) / 2
        if (inRiverGap(cx, cz)) continue
        // degrau do mirante: não liga linhas de alturas diferentes
        if (pos[a * 3 + 1] !== pos[d * 3 + 1]) continue
        idx.push(a, b, d, b, e, d)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    chunks.push({ key: `g${z0}`, geometry: g })
  }
  return chunks
}

/**
 * Trilha: fita com bordas onduladas (2 faixas: borda + miolo), um pouquinho
 * acima do chão. Some no desfiladeiro (a ponte cobre) e na escadaria.
 */
export function buildPath() {
  const pos = []
  const col = []
  const idx = []
  const step = 0.9
  const rng = makeRng(4242)
  let prev = null
  const zEnd = TREASURE_POS.z + 3
  for (let z = Z_FRONT - 4; z > zEnd; z -= step) {
    const skip =
      (z >= RIVER.zFrom - 1 && z <= RIVER.zTo + 1) ||
      (z <= STAIRS.zStart + 1 && z >= STAIRS_Z_TOP - 1)
    if (skip) {
      prev = null
      continue
    }
    const px = z <= STAIRS_Z_TOP ? 0 : pathXAt(z)
    const y = baseYAt(z) + 0.035
    const wob = Math.sin(z * 0.37) * 0.35 + Math.sin(z * 1.13 + 2) * 0.18 + (rng() - 0.5) * 0.12
    const inner = 2.1 + wob
    const outer = inner + 0.45
    const biome = biomeAt(z)
    const base = PATH_COL[biome] ?? PAL.path
    const start = pos.length / 3
    const lats = [-outer, -inner, inner, outer]
    lats.forEach((lat, i) => {
      pos.push(px + lat, y + (i === 0 || i === 3 ? -0.01 : 0), z)
      tmp.set(base)
      if (i === 0 || i === 3) tmp.multiplyScalar(0.9)
      else tmp.multiplyScalar(1 + (rng() - 0.5) * 0.04)
      col.push(tmp.r, tmp.g, tmp.b)
    })
    if (prev !== null) {
      for (let k = 0; k < 3; k++) {
        const a = prev + k
        const b = prev + k + 1
        const c = start + k
        const d = start + k + 1
        idx.push(a, b, c, b, d, c)
      }
    }
    prev = start
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return chunkGeometryByZ(g, 60)
}

/** perfil da falésia em degraus: [lateral, altura, tipo] a partir da face */
const PROFILE = [
  [0, 0, 'face'],
  [0.5, 7, 'face'],
  [0.5, 7, 'top'],
  [7.5, 7, 'top'],
  [7.5, 7, 'face'],
  [8.2, 16, 'face'],
  [8.2, 16, 'top'],
  [17, 16, 'top'],
  [17, 16, 'face'],
  [18, 28, 'face'],
  [18, 28, 'top'],
  [46, 30, 'top'],
]

function faceColor(y, h0, biome, out) {
  // listras horizontais de terra (estilo ilha do Animal Crossing)
  const band = Math.floor((y - h0) / 2.2) % 2 === 0
  if (biome === 'snow' || biome === 'alpine') out.set(band ? '#cfd8e6' : '#bccadb')
  else if (biome === 'night') out.set(band ? '#8a86b8' : '#7a76a8')
  else out.set(band ? PAL.cliffSide : PAL.cliffBand)
  return out
}

/**
 * Falésias dos dois lados, seguindo a trilha. Também gera os colliders
 * (caixas finas alinhadas com a face visual — física e visual batem).
 */
export function buildCliffs(step = 4) {
  const pos = []
  const col = []
  const idx = []
  const colliders = []
  const zs = []
  for (let z = Z_FRONT; z > Z_BACK; z -= step) zs.push(z)
  zs.push(Z_BACK)

  for (const side of [-1, 1]) {
    let prevRow = null
    let prevFace = null
    for (const z of zs) {
      const px = pathXAt(z)
      const h0 = baseYAt(z)
      const biome = biomeAt(z)
      const rowStart = pos.length / 3
      PROFILE.forEach(([lat, h, kind]) => {
        // degraus sobem com a altura extra perto do lado "de fora"
        const x = px + side * (CLIFF_FACE + lat)
        // a falésia no mirante começa da altura do platô
        const y = h0 + h * (h0 > 0 ? 0.55 : 1)
        pos.push(x, y, z)
        if (kind === 'top') tmp.set(BIOME_TOP[biome] ?? PAL.grass)
        else faceColor(y, h0, biome, tmp)
        col.push(tmp.r, tmp.g, tmp.b)
      })
      if (prevRow !== null) {
        for (let k = 0; k < PROFILE.length - 1; k++) {
          const a = prevRow + k
          const b = prevRow + k + 1
          const c = rowStart + k
          const d = rowStart + k + 1
          if (side > 0) idx.push(a, b, c, b, d, c)
          else idx.push(a, c, b, b, c, d)
        }
      }
      prevRow = rowStart

      // collider da face (6 de espessura, para fora)
      const face = { x: px + side * CLIFF_FACE, z, y: h0 }
      if (prevFace) {
        const dx = face.x - prevFace.x
        const dz = face.z - prevFace.z
        const len = Math.hypot(dx, dz)
        const yaw = Math.atan2(dx, dz)
        // normal para fora do corredor
        const nx = side * Math.cos(yaw)
        const nz = -side * Math.sin(yaw)
        colliders.push({
          x: (face.x + prevFace.x) / 2 + nx * 3,
          y: Math.min(face.y, prevFace.y) + 20,
          z: (face.z + prevFace.z) / 2 + nz * 3,
          ry: yaw,
          halfX: 3,
          halfY: 30,
          halfZ: len / 2 + 0.25,
        })
      }
      prevFace = face
    }
  }

  // degrau do mirante: parede de terra onde o platô sobe (fora da escadaria)
  const wallZ = STAIRS_Z_TOP
  for (const side of [-1, 1]) {
    const x0 = side * (STAIRS.halfWidth + 1.4)
    const x1 = side * (CLIFF_FACE + 2)
    pushQuadWall(pos, col, idx, [x0, 0, wallZ], [x1, 0, wallZ], SUMMIT_Y, side > 0, 'meadow')
  }
  // laterais da escadaria (morro da rampa)
  const zA = STAIRS.zStart + STAIRS.stepDepth * 0.7
  const zB = STAIRS_Z_TOP
  for (const side of [-1, 1]) {
    const x = side * (STAIRS.halfWidth + 1.4)
    const n = 18
    for (let i = 0; i < n; i++) {
      const za = zA + ((zB - zA) * i) / n
      const zb = zA + ((zB - zA) * (i + 1)) / n
      const ha = ((STAIRS.zStart - za) / (STAIRS.zStart - zB)) * SUMMIT_Y
      const hb = ((STAIRS.zStart - zb) / (STAIRS.zStart - zB)) * SUMMIT_Y
      pushSlopedWall(pos, col, idx, [x, za], [x, zb], Math.max(0.5, ha + 0.6), Math.max(0.5, hb + 0.6), side < 0)
    }
  }
  // fundos do mapa: atrás da casa e depois do mirante
  pushQuadWall(pos, col, idx, [-CLIFF_FACE - 2, 0, Z_FRONT], [CLIFF_FACE + 2, 0, Z_FRONT], 9, true, 'meadow')
  pushQuadWall(
    pos,
    col,
    idx,
    [-CLIFF_FACE - 2, SUMMIT_Y, Z_BACK + 1],
    [CLIFF_FACE + 2, SUMMIT_Y, Z_BACK + 1],
    9,
    false,
    'alpine',
  )

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return { chunks: chunkGeometryByZ(g, 80), colliders }
}

function pushQuadWall(pos, col, idx, p0, p1, height, flip, biome) {
  const s = pos.length / 3
  const corners = [
    [p0[0], p0[1], p0[2]],
    [p1[0], p1[1], p1[2]],
    [p0[0], p0[1] + height, p0[2]],
    [p1[0], p1[1] + height, p1[2]],
  ]
  corners.forEach(([x, y, z], i) => {
    pos.push(x, y, z)
    if (i >= 2) tmp.set(BIOME_TOP[biome] ?? PAL.grass)
    else faceColor(y, p0[1], biome, tmp)
    col.push(tmp.r, tmp.g, tmp.b)
  })
  if (flip) idx.push(s, s + 2, s + 1, s + 1, s + 2, s + 3)
  else idx.push(s, s + 1, s + 2, s + 1, s + 3, s + 2)
}

function pushSlopedWall(pos, col, idx, a, b, ha, hb, flip) {
  const s = pos.length / 3
  const pts = [
    [a[0], 0, a[1]],
    [b[0], 0, b[1]],
    [a[0], ha, a[1]],
    [b[0], hb, b[1]],
  ]
  pts.forEach(([x, y, z], i) => {
    pos.push(x, y, z)
    faceColor(i < 2 ? 0 : y, 0, 'meadow', tmp)
    if (i >= 2) tmp.set('#a6dc84')
    col.push(tmp.r, tmp.g, tmp.b)
  })
  if (flip) idx.push(s, s + 2, s + 1, s + 1, s + 2, s + 3)
  else idx.push(s, s + 1, s + 2, s + 1, s + 3, s + 2)
}

/** parte uma geometria indexada em pedaços por Z (bounding spheres pequenas → culling) */
function chunkGeometryByZ(geo, chunkLen) {
  const posA = geo.attributes.position.array
  const colA = geo.attributes.color.array
  const index = geo.index.array
  const buckets = new Map()
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i]
    const zc = (posA[a * 3 + 2] + posA[index[i + 1] * 3 + 2] + posA[index[i + 2] * 3 + 2]) / 3
    const key = Math.floor(zc / chunkLen)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(index[i], index[i + 1], index[i + 2])
  }
  const out = []
  for (const [key, tri] of buckets) {
    const map = new Map()
    const p = []
    const c = []
    const id = []
    for (const v of tri) {
      let n = map.get(v)
      if (n === undefined) {
        n = p.length / 3
        map.set(v, n)
        p.push(posA[v * 3], posA[v * 3 + 1], posA[v * 3 + 2])
        c.push(colA[v * 3], colA[v * 3 + 1], colA[v * 3 + 2])
      }
      id.push(n)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3))
    g.setIndex(id)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    out.push({ key: `c${key}`, geometry: g })
  }
  geo.dispose()
  return out
}
