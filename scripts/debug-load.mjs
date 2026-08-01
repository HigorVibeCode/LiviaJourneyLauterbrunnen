import puppeteer from 'puppeteer'

const URL = process.argv[2] ?? 'http://localhost:5174/'
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1024, height: 640 })

const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`))

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
await new Promise((r) => setTimeout(r, 45000))

const state = await page.evaluate(() => ({
  hasLivia: typeof window.livia,
  canvas: !!document.querySelector('canvas'),
  objective: document.querySelector('.hud-objective p')?.textContent ?? null,
}))

console.log(state)
console.log('--- logs ---')
logs.slice(0, 40).forEach((l) => console.log(l.slice(0, 600)))

await page.screenshot({ path: 'debug-load.png' })
await browser.close()
