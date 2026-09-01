/**
 * 간단한 스모크 테스트: Next.js + Electron 시작 → 스크린샷 저장
 */
import { _electron as electron } from 'playwright-core'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawn } from 'node:child_process'

const APP_DIR = path.resolve(import.meta.dirname, '../../..')
const SHOT_DIR = '/tmp/shots'
const ELECTRON_BIN = path.join(APP_DIR, 'node_modules/electron/dist/electron')

fs.mkdirSync(SHOT_DIR, { recursive: true })

console.log('1. Next.js 시작...')
const nextProc = spawn('bun', ['run', 'dev'], {
  cwd: APP_DIR,
  env: { ...process.env },
  stdio: 'pipe',
})

// localhost:3000 대기
await new Promise((resolve, reject) => {
  const deadline = Date.now() + 30_000
  const check = async () => {
    try {
      const res = await fetch('http://localhost:3000')
      if (res.ok) return resolve()
    } catch {}
    if (Date.now() > deadline) return reject(new Error('Next.js 30초 초과'))
    setTimeout(check, 600)
  }
  check()
})
console.log('   Next.js 준비 완료')

console.log('2. Electron 실행...')
const app = await electron.launch({
  executablePath: ELECTRON_BIN,
  args: ['--no-sandbox', APP_DIR],
  env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
  timeout: 30_000,
})

console.log('   창 대기 중...')
await new Promise(r => setTimeout(r, 7_000))

const windows = app.windows()
console.log(`   창 ${windows.length}개:`, windows.map(w => w.url()))

const page = windows.find(w => !w.url().startsWith('devtools://'))
          ?? await app.firstWindow()

// 외부 폰트 요청 차단 (없으면 screenshot이 무한 대기)
await page.route('**/(fonts.googleapis.com|fonts.gstatic.com)/**', r => r.abort())

const shot1 = path.join(SHOT_DIR, '01-initial.png')
await page.screenshot({ path: shot1, timeout: 20_000 })
console.log('3. 스크린샷:', shot1)

console.log('4. 종료')
await app.close()
nextProc.kill()
process.exit(0)
