/**
 * Tour visual: teleporta a Livia por cada etapa e salva screenshots.
 * Uso: node scripts/tour.mjs http://localhost:5174/
 */
import puppeteer from 'puppeteer'

const URL = process.argv[2] ?? 'http://localhost:5174/'

/**
 * Uma parada por marco das 4 fases.
 * `grant` dá itens antes da foto (para ver a roupa da Livia mudando).
 */
const STOPS = [
  { name: '1-pradaria', at: [-18, 3, 78] },
  { name: '2-casa-livia', at: [-24, 3, 72] },
  { name: '3-capa-e-chave', at: [0, 3, 60], grant: ['chave_portao', 'capa_chuva'] },
  { name: '4-portao-agua', at: [0, 3, 26] },
  { name: '5-vilarejo-chuva', at: [6, 3, -10] },
  { name: '6-riacho-peixes', at: [10, 3, -2] },
  { name: '7-ponte-rio', at: [0, 3, -36] },
  { name: '8-staubbach', at: [-40, 3, -88] },
  { name: '9-casaco-martelo', at: [0, 3, -100], grant: ['ferramenta', 'casaco'] },
  { name: '10-portao-neve', at: [0, 3, -114] },
  { name: '11-passo-nevado', at: [-14, 3, -160] },
  { name: '12-boneco-neve', at: [20, 3, -200], grant: ['cristal', 'binoculo'] },
  { name: '13-cachoeira-congelada', at: [40, 3, -196] },
  { name: '14-portao-mirante', at: [0, 3, -244] },
  { name: '15-escadaria', at: [0, 8, -290] },
  { name: '16-mirante', at: [0, 21, -375] },
  { name: '17-tesouro-celebracao', at: [0, 21, -385], wait: 6500 },
]

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

for (const stop of STOPS) {
  if (stop.grant) {
    await page.evaluate((ids) => ids.forEach((id) => window.livia.grant(id)), stop.grant)
  }
  await page.evaluate(([x, y, z]) => window.livia.teleport(x, y, z), stop.at)
  await new Promise((r) => setTimeout(r, stop.wait ?? 2600))
  await page.screenshot({ path: `tour-${stop.name}.png` })
  console.log(`ok ${stop.name}`)
}

console.log(`\nerros: ${errors.length}`)
errors.slice(0, 20).forEach((e) => console.log('  •', e.slice(0, 300)))

await browser.close()
