/**
 * Verifica oclusão da câmera perto de árvores e chalés.
 * Uso: node scripts/camera-occlusion-test.mjs http://localhost:5173/?debug=1
 */
import puppeteer from 'puppeteer'

const URL = process.argv[2] ?? 'http://localhost:5173/?debug=1'

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--window-size=1280,760',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 760 })

const errors = []
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForSelector('canvas', { timeout: 60000 })
await page.waitForFunction('!!window.livia?.camDebug', { timeout: 180000, polling: 1000 })
await new Promise((r) => setTimeout(r, 5000))

async function sampleCam(label, x, y, z, waitMs = 900) {
  await page.evaluate(({ x, y, z }) => window.livia.teleport(x, y, z), { x, y, z })
  await new Promise((r) => setTimeout(r, waitMs))
  // anda um pouco para forçar o braço da câmera contra obstáculos
  await page.keyboard.down('KeyW')
  await new Promise((r) => setTimeout(r, 700))
  await page.keyboard.up('KeyW')
  await new Promise((r) => setTimeout(r, 400))
  const dbg = await page.evaluate(() => window.livia.camDebug())
  const cam = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    // posição via store + heurística: distância câmera↔look no debug
    return { canvas: c ? `${c.width}x${c.height}` : null }
  })
  console.log(
    `${label}: ideal=${dbg.ideal.toFixed(2)} wanted=${dbg.wanted.toFixed(2)} occluded=${dbg.occluded}`,
    cam.canvas ?? '',
  )
  await page.screenshot({ path: `camera-${label}.png` })
  return dbg
}

const openField = await sampleCam('open', 0, 1, 90, 700)
// pinheiro deliberadamente entre Livia e a câmera (mesmo seed do scatter meadow)
const trees = await sampleCam('trees', -42.78, 1, 46.29, 1100)
// vilarejo / chalés
const village = await sampleCam('village', -8, 1, -95, 900)

const openOk = !openField.occluded || openField.wanted > openField.ideal * 0.85
const treesPulled = trees.occluded || trees.wanted < trees.ideal - 0.3
// no vilarejo pode ou não ocluir conforme ângulo; só exige que não quebre
const villageOk = Number.isFinite(village.wanted) && village.wanted >= 2.0

console.log('\nchecagens:')
console.log('  campo aberto (sem oclusão forçada):', openOk ? 'ok' : 'FALHOU')
console.log('  árvores puxam câmera:', treesPulled ? 'ok' : 'FALHOU (raycast não viu copas?)')
console.log('  vilarejo distância válida:', villageOk ? 'ok' : 'FALHOU')
console.log(`\nerros: ${errors.length}`)
errors.slice(0, 20).forEach((e) => console.log('  •', String(e).slice(0, 300)))

await browser.close()

const failed = !openOk || !treesPulled || !villageOk || errors.length > 0
process.exit(failed ? 1 : 0)
