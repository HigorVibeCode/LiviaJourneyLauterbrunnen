import { useLayoutEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getToonGradientMap } from '../../materials/toonMaterial'

const tmpMatrix = new THREE.Matrix4()
const tmpQuat = new THREE.Quaternion()
const tmpEuler = new THREE.Euler()
const tmpPos = new THREE.Vector3()
const tmpScale = new THREE.Vector3()
const tmpColor = new THREE.Color()

/**
 * InstancedMesh estático: as matrizes são escritas uma única vez.
 * É o que permite milhares de detalhes com custo de CPU ~zero por frame.
 */
export default function Instanced({
  geometry,
  material,
  items,
  castShadow = true,
  receiveShadow = true,
}) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh || !items.length) return

    // Se qualquer item tem cor, pinta TODOS (evita instanceColor parcial / preto)
    let useColor = false
    for (let i = 0; i < items.length; i++) {
      if (items[i].color) {
        useColor = true
        break
      }
    }
    const fallback = material?.color ?? tmpColor.set('#ffffff')

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      tmpEuler.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0)
      tmpQuat.setFromEuler(tmpEuler)
      tmpPos.set(it.x, it.y, it.z)
      const s = it.s ?? 1
      tmpScale.set(it.sx ?? s, it.sy ?? s, it.sz ?? s)
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMatrix)
      if (useColor) {
        if (it.color) tmpColor.set(it.color)
        else if (fallback.isColor) tmpColor.copy(fallback)
        else tmpColor.set('#ffffff')
        mesh.setColorAt(i, tmpColor)
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    if (useColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, material])

  if (!items.length) return null

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}

/**
 * Material com vento no vertex shader — a animação roda na GPU,
 * então 1500 tufos de grama balançam sem custo de CPU.
 */
export function useWindMaterial({ color, strength = 0.16, speed = 1.4 }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uStrength: { value: strength } }), [strength])

  const material = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({
      color,
      gradientMap: getToonGradientMap(),
    })

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime
      shader.uniforms.uStrength = uniforms.uStrength
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uTime;\nuniform float uStrength;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
             float wOff = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.27;
           #else
             float wOff = 0.0;
           #endif
           float sway = sin(uTime * ${speed.toFixed(2)} + wOff) * 0.6
                      + sin(uTime * ${(speed * 2.3).toFixed(2)} + wOff * 1.7) * 0.4;
           float h = max(transformed.y, 0.0);
           transformed.x += sway * uStrength * h;
           transformed.z += sway * uStrength * 0.6 * h;`,
        )
    }

    return mat
  }, [color, uniforms, speed])

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
  })

  return material
}
