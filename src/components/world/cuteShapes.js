import * as THREE from 'three'

/**
 * Formas fofas compartilhadas (coração e estrela gordinhos, com bisel)
 * + helpers de cor que preservam o matiz.
 */

let heart = null
/** Coração extrudado, ~1 de largura, centrado na origem, virado para +Z */
export function heartGeometry() {
  if (heart) return heart
  const s = new THREE.Shape()
  s.moveTo(5, 5)
  s.bezierCurveTo(5, 5, 4, 0, 0, 0)
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7)
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19)
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7)
  s.bezierCurveTo(16, 7, 16, 0, 10, 0)
  s.bezierCurveTo(7, 0, 5, 5, 5, 5)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 3,
    bevelEnabled: true,
    bevelThickness: 2.2,
    bevelSize: 1.8,
    bevelSegments: 3,
    curveSegments: 8,
  })
  g.rotateZ(Math.PI)
  g.center()
  g.scale(1 / 24, 1 / 24, 1 / 24)
  g.computeVertexNormals()
  heart = g
  return g
}

let star = null
/** Estrela de 5 pontas gordinha, ~1 de diâmetro, virada para +Z */
export function starGeometry() {
  if (star) return star
  const s = new THREE.Shape()
  const outer = 10
  const inner = 5.2
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 2,
    bevelEnabled: true,
    bevelThickness: 2,
    bevelSize: 1.6,
    bevelSegments: 3,
    curveSegments: 4,
  })
  g.center()
  g.scale(1 / 22, 1 / 22, 1 / 22)
  g.computeVertexNormals()
  star = g
  return g
}

/** Escurece mantendo o matiz (sombra = tom mais escuro da mesma cor) */
export function tint(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (sh) => Math.min(255, Math.round(((n >> sh) & 255) * k))
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

/** Mistura duas cores (t=0 → a, t=1 → b) */
export function mix(a, b, t) {
  const na = parseInt(a.slice(1), 16)
  const nb = parseInt(b.slice(1), 16)
  const ch = (sh) => Math.round(((na >> sh) & 255) * (1 - t) + ((nb >> sh) & 255) * t)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

const tmp = new THREE.Color()
/** Versão pastel de uma cor qualquer (mesmo matiz, clara e saturada) */
export function pastelOf(hex, s = 0.62, l = 0.74) {
  const hsl = {}
  tmp.set(hex).getHSL(hsl, THREE.SRGBColorSpace)
  tmp.setHSL(hsl.h, s, l, THREE.SRGBColorSpace)
  return `#${tmp.getHexString()}`
}
