const { app, BrowserWindow, screen, ipcMain } = require('electron')

app.commandLine.appendSwitch('ignore-certificate-errors')
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')

const WIN_WIDTH = 400
const WIN_HEIGHT = 400
const IS_DEV = process.env.NEXT_DEV === '1'
const OUT_DIR = path.join(__dirname, '..', 'out')
const FILE_SERVER_PORT = 47473

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
}

function startFileServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = req.url.split('?')[0]
      let filePath = path.join(OUT_DIR, pathname === '/' ? 'index.html' : pathname)

      if (!path.extname(filePath)) {
        if (fs.existsSync(filePath + '.html')) filePath += '.html'
        else if (fs.existsSync(path.join(filePath, 'index.html')))
          filePath = path.join(filePath, 'index.html')
      }

      if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return }

      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
      fs.createReadStream(filePath).pipe(res)
    })

    server.listen(FILE_SERVER_PORT, 'localhost', () => resolve(server.address().port))
  })
}

async function createWindow(port) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    x: width - WIN_WIDTH - 16,
    y: height - WIN_HEIGHT - 16,
    alwaysOnTop: true,
    resizable: false,
    frame: false,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const url = IS_DEV ? 'http://localhost:3000' : `http://localhost:${port}`
  win.loadURL(url)

  // YouTube embed iframe에 CSS 주입 → OSD 요소 완전 제거
  win.webContents.on('frame-created', (_event, details) => {
    details.frame.on('dom-ready', () => {
      try {
        if (details.frame.url.includes('youtube.com/embed')) {
          details.frame.insertCSS(
            '.ytp-chrome-top,.ytp-pause-overlay,.ytp-gradient-top,.ytp-gradient-bottom,.ytp-bezel{display:none!important}'
          )
        }
      } catch (_) {}
    })
  })
}

app.whenReady().then(async () => {
  const port = IS_DEV ? null : await startFileServer()
  createWindow(port)
})

app.on('window-all-closed', () => app.quit())

function getChromiumBookmarksPath() {
  const home = os.homedir()
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Bookmarks')
  } else if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks')
  } else {
    const chrome = path.join(home, '.config', 'google-chrome', 'Default', 'Bookmarks')
    const chromium = path.join(home, '.config', 'chromium', 'Default', 'Bookmarks')
    return fs.existsSync(chrome) ? chrome : chromium
  }
}

function extractYouTubeVideoId(url) {
  const patterns = [/[?&]v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/, /embed\/([a-zA-Z0-9_-]{11})/]
  for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
  return null
}

function findFolder(node, name) {
  if (node.type === 'folder') {
    if (node.name?.toLowerCase() === name.toLowerCase()) return node
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = findFolder(child, name)
        if (found) return found
      }
    }
  }
  return null
}

function extractYouTubeBookmarks(node, folderPath) {
  const results = []
  if (node.type === 'url' && node.url) {
    const videoId = extractYouTubeVideoId(node.url)
    if (videoId) results.push({ videoId, title: node.name || '', folder: folderPath })
  } else if (node.type === 'folder' && Array.isArray(node.children)) {
    const next = folderPath ? `${folderPath} / ${node.name}` : node.name
    for (const child of node.children) results.push(...extractYouTubeBookmarks(child, next))
  }
  return results
}

ipcMain.handle('get-bookmarks', async () => {
  try {
    const bookmarksPath = getChromiumBookmarksPath()
    const data = JSON.parse(fs.readFileSync(bookmarksPath, 'utf-8'))
    for (const key of ['bookmark_bar', 'other', 'synced']) {
      const root = data.roots?.[key]
      if (!root) continue
      const folder = findFolder(root, 'utube')
      if (folder) return { ok: true, bookmarks: extractYouTubeBookmarks(folder, '') }
    }
    return { ok: false, error: '"utube" 폴더를 찾을 수 없습니다' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})
