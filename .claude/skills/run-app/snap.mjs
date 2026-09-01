/**
 * 정적 빌드 Electron 스모크 스크린샷
 */
import { _electron as electron } from 'playwright-core'
import * as fs from 'node:fs'
import * as path from 'node:path'

const APP_DIR = path.resolve(import.meta.dirname, '../../..')
const SHOT_DIR = '/tmp/shots'
const ELECTRON_BIN = path.join(APP_DIR, 'node_modules/electron/dist/electron')

fs.mkdirSync(SHOT_DIR, { recursive: true })

console.log('Electron 실행 중 (정적 빌드)...')
const app = await electron.launch({
  executablePath: ELECTRON_BIN,
  args: ['--no-sandbox', APP_DIR],
  env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' },
  timeout: 30_000,
})

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await new Promise(r => setTimeout(r, 3_000))

console.log('URL:', page.url())

const client = await page.context().newCDPSession(page)
const { data } = await client.send('Page.captureScreenshot', { format: 'png' })
const shot = path.join(SHOT_DIR, '02-static.png')
fs.writeFileSync(shot, Buffer.from(data, 'base64'))
console.log('스크린샷:', shot)

await app.close()
process.exit(0)
