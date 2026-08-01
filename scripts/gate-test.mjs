/**
 * Testa a cerimônia de abertura do portão:
 * antes (chave na mão) → destranque → meio da animação → aberto.
 * Uso: node scripts/gate-test.mjs http://localhost:4180/?debug=1
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

// chave + capa no inventário, Livia diante do portão da fase 1
await page.evaluate(() => {
  window.livia.grant('chave_portao')
  window.livia.grant('capa_chuva')
  window.livia.teleport(0, 3, 21)
})
await new Promise((r) => setTimeout(r, 2600))
await page.screenshot({ path: 'gate-1-antes.png' })
console.log('ok antes (chave na mão)')

await page.evaluate(() => window.livia.unlock('gate_water'))
await new Promise((r) => setTimeout(r, 1100))
await page.screenshot({ path: 'gate-2-abrindo.png' })
console.log('ok meio da animação')

await new Promise((r) => setTimeout(r, 2600))
await page.screenshot({ path: 'gate-3-aberto.png' })
console.log('ok aberto (chave consumida)')

// atravessa para confirmar que o colisor liberou
await page.evaluate(() => window.livia.teleport(0, 3, 8))
await new Promise((r) => setTimeout(r, 1800))
await page.screenshot({ path: 'gate-4-atravessou.png' })
console.log('ok atravessou')

console.log(`\nerros: ${errors.length}`)
errors.slice(0, 20).forEach((e) => console.log('  •', e.slice(0, 300)))

await browser.close()
