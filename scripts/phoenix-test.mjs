/**
 * Confere a fênix sobrevoando o mirante (orientação, escala e asas).
 * Uso: node scripts/phoenix-test.mjs http://localhost:4180/?debug=1
 */
import puppeteer from 'puppeteer'

const URL = process.argv[2] ?? 'http://localhost:4180/?debug=1'

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 720 })

const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
  if (m.text().includes('[phoenix]')) console.log(m.text())
})

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForSelector('canvas')
await page.waitForFunction('!!window.livia', { timeout: 180000, polling: 1000 })
await new Promise((r) => setTimeout(r, 6000))

// mirante, perto do baú — câmera olha para −Z (Alpes)
await page.evaluate(() => window.livia.teleport(0, 21, -375))
await new Promise((r) => setTimeout(r, 4000))

// elipse ~22s; fotos espaçadas cobrem o circuito
for (let i = 1; i <= 8; i++) {
  await page.screenshot({ path: `phoenix-${i}.png` })
  console.log(`ok foto ${i}`)
  await new Promise((r) => setTimeout(r, 2800))
}

console.log(`\nerros: ${errors.length}`)
errors.slice(0, 20).forEach((e) => console.log('  •', e.slice(0, 300)))

await browser.close()
