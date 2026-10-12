import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeRng } from '../config/world'
import { skyState } from '../lib/skyState'
import Instanced from './world/Instanced'

/**
 * Alpes de fundo no estilo fofo: montanhas arredondadas (perfil em sino)
 * azul-lavanda com chapéu de neve, e nuvens de algodão bem brancas.
 * Sem curvatura de mundo e sem neblina — ficam sempre lá no horizonte.
 */
function bellGeometry(radius, height, segs = 22) {
  const pts = []
  const n = 14
  for (let i = 0; i <= n; i++) {
    const t = i / n
    // sino: base larga, topo arredondado
    const r = radius * Math.sqrt(1 - t) * (1 - 0.15 * Math.sin(t * Math.PI))
    pts.push(new THREE.Vector2(Math.max(0.001, r), t * height))
  }
  const g = new THREE.LatheGeometry(pts, segs)
  g.computeVertexNormals()
  return g
}

function makeFarMaterial(color) {
  const m = new THREE.MeshLambertMaterial({ color, fog: false })
  m.defines = { NO_CURVE: '' }
  return m
}

export default function AlpsBackdrop() {
  const geos = useMemo(
    () => ({
      body: bellGeometry(1, 1),
      // chapéu de neve: mesmo sino, só o topo, um pouco maior
      cap: (() => {
        const pts = []
        const n = 8
        for (let i = 0; i <= n; i++) {
          const t = 0.62 + (i / n) * 0.38
          const r = 1.03 * Math.sqrt(1 - t) * (1 - 0.15 * Math.sin(t * Math.PI))
          pts.push(new THREE.Vector2(Math.max(0.001, r), t * 1.01))
        }
        const g = new THREE.LatheGeometry(pts, 22)
        g.computeVertexNormals()
        return g
      })(),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      near: makeFarMaterial('#9ec4ee'),
      mid: makeFarMaterial('#b4d0f2'),
      far: makeFarMaterial('#c8dcf6'),
      snow: makeFarMaterial('#ffffff'),
    }),
    [],
  )

  const peaks = useMemo(() => {
    const rng = makeRng(555)
    const rows = [
      // à frente do mirante: cordilheira grande
      { z: -1260, n: 9, spread: 110, h: [120, 190], mat: 'far' },
      { z: -1180, n: 7, spread: 95, h: [90, 150], mat: 'mid' },
      // laterais ao longo do vale
      ...Array.from({ length: 12 }, (_, i) => ({ z: 140 - i * 105, n: 2, flank: true, h: [80, 140], mat: i % 2 ? 'mid' : 'near' })),
      // atrás da casa
      { z: 260, n: 7, spread: 90, h: [80, 140], mat: 'mid' },
    ]
    const list = { near: [], mid: [], far: [], snow: [] }
    rows.forEach((row) => {
      for (let i = 0; i < row.n; i++) {
        const h = row.h[0] + rng() * (row.h[1] - row.h[0])
        const r = h * (0.62 + rng() * 0.2)
        let x
        // bem longe da trilha: sem 'paredes' no céu
        if (row.flank) x = (i === 0 ? -1 : 1) * (260 + rng() * 70)
        else x = (i - (row.n - 1) / 2) * row.spread + (rng() - 0.5) * 30
        const z = row.z + (rng() - 0.5) * 40
        const y = -h * 0.12
        list[row.mat].push({ x, y, z, sx: r, sy: h, sz: r, ry: rng() * Math.PI })
        list.snow.push({ x, y, z, sx: r, sy: h, sz: r, ry: rng() * Math.PI })
      }
    })
    return list
  }, [])

  // à noite as montanhas escurecem junto com o céu
  useFrame(() => {
    Object.values(mats).forEach((m) => {
      if (!m.userData.base) m.userData.base = m.color.clone()
      m.color.copy(m.userData.base).multiply(skyState.farTint)
    })
  })

  return (
    <group userData={{ noCull: true }}>
      {['near', 'mid', 'far'].map((k) => (
        <Instanced key={k} geometry={geos.body} material={mats[k]} items={peaks[k]} castShadow={false} receiveShadow={false} />
      ))}
      <Instanced geometry={geos.cap} material={mats.snow} items={peaks.snow} castShadow={false} receiveShadow={false} />
      <Clouds />
    </group>
  )
}

/** Nuvens de algodão: grupos de bolinhas com fundo achatado, derivando devagar */
function Clouds() {
  const ref = useRef(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 14, 10), [])
  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#e8f2ff', emissiveIntensity: 0.55, fog: false })
    m.defines = { NO_CURVE: '' }
    return m
  }, [])

  const items = useMemo(() => {
    const rng = makeRng(1212)
    const out = []
    for (let c = 0; c < 34; c++) {
      const side = rng() < 0.5 ? -1 : 1
      const cx = side * (40 + rng() * 140)
      const cy = 46 + rng() * 34
      const cz = 180 - rng() * 1400
      const s = 6 + rng() * 6
      const puffs = [
        [0, 0, 0, 1.25],
        [-1.4, -0.3, 0.3, 0.95],
        [1.4, -0.35, -0.2, 1],
        [0.6, 0.55, 0.2, 0.85],
        [-0.7, 0.45, -0.3, 0.75],
      ]
      puffs.forEach(([dx, dy, dz, k]) => {
        out.push({ x: cx + dx * s, y: cy + dy * s, z: cz + dz * s, s: s * k, sy: s * k * 0.78 })
      })
    }
    return out
  }, [])

  useFrame((state) => {
    if (!ref.current) return
    ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.01) * 30
    material.emissive.set('#e8f2ff').multiply(skyState.farTint)
    material.color.set('#ffffff').multiply(skyState.farTint)
  })

  return (
    <group ref={ref}>
      <Instanced geometry={geometry} material={material} items={items} castShadow={false} receiveShadow={false} />
    </group>
  )
}
