/**
 * Screenshot headless provando que o mesh Emma é o personagem jogável.
 * Uso: node scripts/emma-screenshot.mjs http://127.0.0.1:4173/?debug=1
 */
import puppeteer from 'puppeteer'

const URL = process.argv[2] ?? 'http://127.0.0.1:4173/?debug=1'

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

// poll (mais estável que waitForFunction com Rapier/WASM lento)
let ready = false
for (let i = 0; i < 90; i++) {
  ready = await page.evaluate(() => !!(window.livia && window.__emmaPlayer))
  if (ready) break
  await new Promise((r) => setTimeout(r, 2000))
}

await new Promise((r) => setTimeout(r, 1500))
await page.evaluate(() => window.livia?.teleport?.(0, 1.5, 10))
await new Promise((r) => setTimeout(r, 1200))

await page.keyboard.down('KeyW')
await new Promise((r) => setTimeout(r, 1600))
await page.keyboard.up('KeyW')
await new Promise((r) => setTimeout(r, 600))

const info = await page.evaluate(() => ({
  hasLivia: !!window.livia,
  emma: window.__emmaPlayer ?? null,
}))

await page.screenshot({ path: 'livia-emma-player.png' })
console.log('info:', JSON.stringify(info, null, 2))
console.log('screenshot: livia-emma-player.png')
if (errors.length) {
  console.log('erros:')
  errors.slice(0, 20).forEach((e) => console.log('  •', String(e).slice(0, 300)))
}

const ok =
  info.emma?.model === 'emma.glb' &&
  (info.emma.skinnedMaterials?.length ?? 0) >= 5 &&
  (info.emma.bones?.length ?? 0) >= 10

await browser.close()
process.exit(ok ? 0 : 1)
