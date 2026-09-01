const { app, BrowserWindow, screen } = require('electron')

app.commandLine.appendSwitch('ignore-certificate-errors')
const http = require('http')
const fs = require('fs')
const path = require('path')

const WIN_WIDTH = 400
const WIN_HEIGHT = 330
const IS_DEV = process.env.NEXT_DEV === '1'
const OUT_DIR = path.join(__dirname, '..', 'out')

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

    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
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
    title: 'YouTube Viewer',
    webPreferences: {
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const url = IS_DEV ? 'http://localhost:3000' : `http://127.0.0.1:${port}`
  win.loadURL(url)
}

app.whenReady().then(async () => {
  const port = IS_DEV ? null : await startFileServer()
  createWindow(port)
})

app.on('window-all-closed', () => app.quit())
