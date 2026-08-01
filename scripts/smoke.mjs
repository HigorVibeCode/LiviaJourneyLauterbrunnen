/**
 * Smoke test do jogo em navegador headless.
 * Abre a página, espera a cena montar, anda um pouco e reporta
 * erros de console, exceções e um screenshot.
 */
import puppeteer from 'puppeteer'

const URL = process.argv[2] ?? 'http://localhost:5174/'

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
const warnings = []

page.on('console', (msg) => {
  const text = msg.text()
  if (msg.type() === 'error') errors.push(text)
  else if (msg.type() === 'warning') warnings.push(text)
})
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('requestfailed', (req) => {
  if (!req.url().includes('livia.glb')) {
    errors.push(`requestfailed: ${req.url()}`)
  }
})

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForSelector('canvas', { timeout: 60000 })
await page.waitForFunction('!!window.livia', { timeout: 180000, polling: 1000 }).catch(() => {})
await new Promise((r) => setTimeout(r, 6000))

// anda para frente e corre
await page.keyboard.down('KeyW')
await page.keyboard.down('ShiftLeft')
await new Promise((r) => setTimeout(r, 4000))
await page.keyboard.up('ShiftLeft')
await page.keyboard.up('KeyW')
await page.keyboard.press('Space')
await new Promise((r) => setTimeout(r, 2500))

const stats = await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  return {
    canvas: canvas ? `${canvas.width}x${canvas.height}` : null,
    objective: document.querySelector('.hud-objective p')?.textContent ?? null,
    compass: document.querySelector('.hud-compass strong')?.textContent ?? null,
  }
})

await page.screenshot({ path: 'smoke-1-meadow.png' })

console.log('canvas:', stats.canvas)
console.log('objetivo:', stats.objective)
console.log('bússola:', stats.compass)
console.log(`\nerros: ${errors.length}`)
errors.slice(0, 25).forEach((e) => console.log('  •', e.slice(0, 400)))
console.log(`avisos: ${warnings.length}`)
warnings.slice(0, 12).forEach((w) => console.log('  -', w.slice(0, 260)))

await browser.close()
process.exit(errors.length ? 1 : 0)
