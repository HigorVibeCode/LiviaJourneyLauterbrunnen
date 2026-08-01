/**
 * Testa a comemoração de coleta: teleporta a Livia para cima da chave
 * (o sensor dispara de verdade) e fotografa a explosão + pulinho.
 * Uso: node scripts/pickup-test.mjs http://localhost:4180/?debug=1
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
})

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForSelector('canvas')
await page.waitForFunction('!!window.livia', { timeout: 180000, polling: 1000 })
await new Promise((r) => setTimeout(r, 6000))

const pos = await page.evaluate(() => window.livia.itemPos('chave_portao'))
console.log('chave em', pos)

// para perto primeiro, para a cena carregar
await page.evaluate(([x, , z]) => window.livia.teleport(x + 4, 3, z + 4), pos)
await new Promise((r) => setTimeout(r, 2600))
await page.screenshot({ path: 'pickup-1-perto.png' })
console.log('ok perto do item')

// pisa em cima: o sensor coleta e a comemoração dispara
await page.evaluate(([x, , z]) => window.livia.teleport(x, 2.2, z), pos)
await new Promise((r) => setTimeout(r, 350))
await page.screenshot({ path: 'pickup-2-comemorando.png' })
console.log('ok comemorando')

await new Promise((r) => setTimeout(r, 2200))
await page.screenshot({ path: 'pickup-3-depois.png' })
console.log('ok depois')

console.log(`\nerros: ${errors.length}`)
errors.slice(0, 20).forEach((e) => console.log('  •', e.slice(0, 300)))

await browser.close()
