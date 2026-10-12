import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const inv = new THREE.Matrix4()
const rel = new THREE.Matrix4()
const nrm = new THREE.Matrix3()

/**
 * Junta todos os meshes estáticos da sub-árvore em poucos meshes
 * (1 por "tipo" de material), com a cor de cada peça em vertex colors.
 *
 * Um chalé tinha ~90 meshes = 90 draw calls; depois do batch são 2–4.
 * Partes animadas ficam de fora marcando `userData.noBatch` no grupo.
 */
export default function StaticBatch({ children, noNearFade = false, ...props }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return undefined
    root.updateMatrixWorld(true)
    inv.copy(root.matrixWorld).invert()

    const buckets = new Map()
    const hidden = []

    const visit = (obj) => {
      if (obj.userData.noBatch) return
      if (obj.isMesh && !obj.isInstancedMesh && !obj.isSkinnedMesh && obj.visible) {
        const mat = obj.material
        if (mat && !Array.isArray(mat) && !mat.map && obj.geometry?.attributes?.position) {
          const key = materialKey(mat) + (obj.castShadow ? 'c' : '') + (obj.receiveShadow ? 'r' : '')
          let b = buckets.get(key)
          if (!b) {
            b = { mat, geos: [], cast: obj.castShadow, receive: obj.receiveShadow }
            buckets.set(key, b)
          }
          b.geos.push(bakeGeometry(obj, mat))
          hidden.push(obj)
        }
      }
      for (const c of obj.children) visit(c)
    }
    for (const c of root.children) visit(c)

    const merged = []
    const mergedMats = new Set()
    for (const [key, b] of buckets) {
      if (b.geos.length < 2) {
        b.geos.forEach((g) => g.dispose())
        // só um mesh nesse bucket: não vale a pena, deixa o original
        continue
      }
      const geo = mergeGeometries(b.geos, false)
      b.geos.forEach((g) => g.dispose())
      if (!geo) continue
      geo.computeBoundingSphere()
      const mat = b.mat.clone()
      mat.color?.set('#ffffff')
      mat.vertexColors = true
      // casas/portões/bichos: somem em pontilhado se a câmera encostar
      if (!noNearFade) mat.defines = { ...(mat.defines ?? {}), NEAR_FADE: '' }
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = b.cast
      mesh.receiveShadow = b.receive
      mesh.matrixAutoUpdate = false
      merged.push(mesh)
      mergedMats.add(key)
    }

    // esconde só o que entrou de fato num mesh mesclado
    for (const obj of hidden) {
      const key =
        materialKey(obj.material) + (obj.castShadow ? 'c' : '') + (obj.receiveShadow ? 'r' : '')
      if (mergedMats.has(key)) obj.visible = false
    }
    merged.forEach((m) => root.add(m))

    return () => {
      merged.forEach((m) => {
        root.remove(m)
        m.geometry.dispose()
        m.material.dispose()
      })
      hidden.forEach((o) => {
        o.visible = true
      })
    }
  }, [])

  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  )
}

function materialKey(m) {
  return [
    m.type,
    m.transparent ? `t${m.opacity.toFixed(2)}` : '',
    m.side,
    m.emissive ? m.emissive.getHexString() + (m.emissiveIntensity ?? 0).toFixed(2) : '',
    m.flatShading ? 'f' : '',
    m.depthWrite ? '' : 'nd',
    m.fog === false ? 'nf' : '',
    m.toneMapped === false ? 'nt' : '',
  ].join('|')
}

function bakeGeometry(obj, mat) {
  rel.multiplyMatrices(inv, obj.matrixWorld)
  let g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone()
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
  }
  if (!g.attributes.normal) g.computeVertexNormals()
  g.applyMatrix4(rel)
  // determinante negativo (escala espelhada) inverte o winding
  if (rel.determinant() < 0) {
    const pos = g.attributes.position.array
    const nor = g.attributes.normal.array
    for (let i = 0; i < pos.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const a = pos[i + 3 + k]
        pos[i + 3 + k] = pos[i + 6 + k]
        pos[i + 6 + k] = a
        const b = nor[i + 3 + k]
        nor[i + 3 + k] = nor[i + 6 + k]
        nor[i + 6 + k] = b
      }
    }
  }
  void nrm
  const c = mat.color ?? new THREE.Color('#ffffff')
  const n = g.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}
