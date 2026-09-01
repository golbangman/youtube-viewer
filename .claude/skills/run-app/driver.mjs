/**
 * YouTube Viewer — Electron driver
 * xvfb 헤드리스 환경에서 Electron 앱을 실행하고 Playwright로 조작한다.
 *
 * 사용법:
 *   xvfb-run -a node .claude/skills/run-app/driver.mjs
 *
 * 명령어 목록: help
 */
import { _electron as electron } from 'playwright-core'
import * as readline from 'node:readline'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawn } from 'node:child_process'

const APP_DIR = path.resolve(import.meta.dirname, '../../..')
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots'
const ELECTRON_BIN = path.join(APP_DIR, 'node_modules/electron/dist/electron')

fs.mkdirSync(SHOT_DIR, { recursive: true })

let app = null
let page = null
let nextProc = null

const COMMANDS = {
  async launch() {
    if (app) return console.log('이미 실행 중')

    // Next.js 개발 서버 시작
    console.log('Next.js 개발 서버 시작 중...')
    nextProc = spawn('bun', ['run', 'dev'], {
      cwd: APP_DIR,
      env: { ...process.env, PORT: '3000' },
      stdio: 'pipe',
    })

    // localhost:3000 준비 대기
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 30_000
      const check = async () => {
        try {
          const res = await fetch('http://localhost:3000')
          if (res.ok) return resolve()
        } catch {}
        if (Date.now() > deadline) return reject(new Error('Next.js 30초 초과'))
        setTimeout(check, 500)
      }
      check()
    })
    console.log('Next.js 준비 완료. Electron 시작 중...')

    app = await electron.launch({
      executablePath: ELECTRON_BIN,
      args: ['--no-sandbox', APP_DIR],
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
      timeout: 30_000,
    })

    // 창이 로드될 때까지 대기
    await new Promise(r => setTimeout(r, 6_000))

    page = app.windows().find(w => !w.url().startsWith('devtools://'))
        ?? await app.firstWindow()

    console.log(`실행 완료. 창 ${app.windows().length}개:`)
    for (const w of app.windows()) console.log(' ', w.url())
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch 먼저 실행하세요')
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png')
    await page.screenshot({ path: f })
    console.log('screenshot:', f)
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch 먼저 실행하세요')
    const r = await page.evaluate(s => {
      const el = document.querySelector(s)
      if (!el) return 'NOT_FOUND'
      el.click(); return 'OK'
    }, sel)
    console.log('click', sel, '->', r)
  },

  async type(text) {
    if (!page) return console.log('ERROR: launch 먼저 실행하세요')
    await page.keyboard.type(text, { delay: 30 })
  },

  async press(key) {
    if (!page) return console.log('ERROR: launch 먼저 실행하세요')
    await page.keyboard.press(key)
  },

  async focus(sel) {
    if (!page) return console.log('ERROR: launch 먼저 실행하세요')
    const r = await page.evaluate(s => {
      const el = document.querySelector(s)
      if (!el) return 'NOT_FOUND'
      el.focus(); return 'OK'
    }, sel)
    console.log('focus', sel, '->', r)
  },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch 먼저 실행하세요')
    try {
      await page.waitForSelector(sel, { timeout: 10_000 })
      console.log('found:', sel)
    } catch {
      console.log('TIMEOUT:', sel)
    }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch 먼저 실행하세요')
    try { console.log(JSON.stringify(await page.evaluate(expr))) }
    catch (e) { console.log('ERROR:', e.message) }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch 먼저 실행하세요')
    console.log(await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null
    ))
  },

  async windows() {
    if (!app) return console.log('ERROR: launch 먼저 실행하세요')
    for (const w of app.windows()) console.log(' ', w.url())
  },

  async 'load-video'(url) {
    if (!page) return console.log('ERROR: launch 먼저 실행하세요')
    await COMMANDS.focus('input[type="text"]')
    await page.evaluate((u) => {
      const el = document.querySelector('input[type="text"]')
      if (!el) return
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      nativeInputValueSetter?.call(el, u)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, url)
    await page.keyboard.press('Enter')
    console.log('URL 입력 완료:', url)
  },

  async quit() {
    if (app) await app.close().catch(() => {})
    if (nextProc) nextProc.kill()
    app = null; page = null; nextProc = null
  },

  help() {
    console.log('명령어:', Object.keys(COMMANDS).join(', '))
  },
}

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') })
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' })

rl.on('line', async line => {
  const [cmd, ...rest] = line.trim().split(/\s+/)
  if (!cmd) return rl.prompt()
  const fn = COMMANDS[cmd]
  if (!fn) { console.log('알 수 없음:', cmd, '— help로 목록 확인'); return rl.prompt() }
  try { await fn(rest.join(' ')) } catch (e) { console.log('ERROR:', e.message) }
  if (cmd === 'quit') { rl.close(); process.exit(0) }
  rl.prompt()
})

rl.on('close', async () => { await COMMANDS.quit(); process.exit(0) })

console.log('YouTube Viewer 드라이버 — "help"로 명령어, "launch"로 시작')
rl.prompt()
