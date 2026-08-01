import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(jsx|js)$/.test(name)) out.push(p)
  }
  return out
}

function depthToImport(file) {
  const rel = path.relative(path.dirname(file), path.join(root, 'materials'))
  const norm = rel.split(path.sep).join('/')
  if (!norm || norm === '.') return './materials/toonMaterial'
  return `${norm}/toonMaterial`.replace(/\/+/g, '/')
}

function depthToToonMat(file) {
  const rel = path.relative(path.dirname(file), path.join(root, 'materials'))
  const norm = rel.split(path.sep).join('/')
  if (!norm || norm === '.') return './materials/ToonMat'
  return `${norm}/ToonMat`.replace(/\/+/g, '/')
}

const skip = new Set([
  path.join(root, 'materials', 'toonMaterial.js'),
  path.join(root, 'materials', 'ToonMat.jsx'),
])

for (const file of walk(root)) {
  if (skip.has(file)) continue
  let src = fs.readFileSync(file, 'utf8')
  if (!/MeshStandardMaterial|meshStandardMaterial|flatShading/.test(src)) continue

  let changed = false

  // useMemo / factories: MeshStandardMaterial -> makeToonMaterial
  if (/new THREE\.MeshStandardMaterial/.test(src)) {
    src = src.replace(/new THREE\.MeshStandardMaterial\(\{([^}]*)\}\)/g, (m, body) => {
      changed = true
      const cleaned = body
        .replace(/\s*flatShading:\s*true,?\s*/g, '')
        .replace(/\s*roughness:\s*[^,}]+,?\s*/g, '')
        .replace(/\s*metalness:\s*[^,}]+,?\s*/g, '')
        .replace(/new THREE\.Color\(([^)]+)\)/g, '$1')
      return `makeToonMaterial({${cleaned}})`
    })
  }

  // JSX meshStandardMaterial -> ToonMat (strip flat/rough/metal)
  if (/<meshStandardMaterial/.test(src)) {
    src = src.replace(/<meshStandardMaterial([^>]*)\/>/g, (m, attrs) => {
      changed = true
      const cleaned = attrs
        .replace(/\s*flatShading(=\{[^}]+\})?\s*/g, '')
        .replace(/\s*roughness=\{[^}]+\}\s*/g, '')
        .replace(/\s*metalness=\{[^}]+\}\s*/g, '')
      return `<ToonMat${cleaned}/>`
    })
    src = src.replace(/<meshStandardMaterial([^>]*)>\s*<\/meshStandardMaterial>/g, (m, attrs) => {
      changed = true
      const cleaned = attrs
        .replace(/\s*flatShading(=\{[^}]+\})?\s*/g, '')
        .replace(/\s*roughness=\{[^}]+\}\s*/g, '')
        .replace(/\s*metalness=\{[^}]+\}\s*/g, '')
      return `<ToonMat${cleaned}/>`
    })
  }

  if (!changed) continue

  const toonImport = depthToImport(file)
  const toonMatImport = depthToToonMat(file)

  if (!src.includes('makeToonMaterial') && /makeToonMaterial\(/.test(src)) {
    if (src.includes("from 'three'") || src.includes('from "three"')) {
      src = src.replace(
        /import \* as THREE from 'three'/,
        `import * as THREE from 'three'\nimport { makeToonMaterial } from '${toonImport}'`,
      )
    } else {
      src = `import { makeToonMaterial } from '${toonImport}'\n${src}`
    }
  } else if (/makeToonMaterial\(/.test(src) && !src.includes(`from '${toonImport}'`)) {
    src = src.replace(
      /import \* as THREE from 'three'/,
      `import * as THREE from 'three'\nimport { makeToonMaterial } from '${toonImport}'`,
    )
  }

  if (/<ToonMat/.test(src) && !src.includes(`from '${toonMatImport}'`)) {
    const importLine = `import ToonMat from '${toonMatImport}'\n`
    const reactMatch = src.match(/^import .+ from 'react'\n/m)
    if (reactMatch) {
      src = src.replace(reactMatch[0], reactMatch[0] + importLine)
    } else {
      src = importLine + src
    }
  }

  fs.writeFileSync(file, src)
  console.log('updated', path.relative(root, file))
}
