/*
 * Production server: the whole app on one port (Railway gives a service one).
 *   /api/*        the Jev decision server's handler (the TypeSafe key stays here)
 *   /game         the multiplayer socket, forwarded to the uWebSockets.js game
 *                 server running in this process on an internal port
 *   /game/*       its HTTP routes (the leaderboard)
 *   everything else  the built app from dist/, with index.html for client routes
 * Run after `npm run build`: node server/prod.ts (Node 24, for uWS).
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { connect } from 'node:net'
import { extname, join, normalize } from 'node:path'
import { createHandler } from './http.ts'
import { jevDecider } from './jevDecider.ts'
import { jevUsage } from './jevUsage.ts'

const port = Number(process.env.PORT) || 8080
const GAME_PORT = Number(process.env.GAME_PORT) || 8790
process.env.GAME_PORT = String(GAME_PORT)
await import('./game/index.ts')

const DIST = new URL('../dist/', import.meta.url).pathname
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain', '.wasm': 'application/wasm',
}

if (!process.env.TYPESAFE_API_KEY?.trim()) console.warn('[prod] TYPESAFE_API_KEY is not set: every decision will use the rules fallback')
const api = createHandler({ decider: jevDecider, usage: jevUsage.snapshot })

/** A file from dist, with range requests (Safari needs them to play video) and long caching for hashed assets. */
function serveFile(file: string, req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  const size = statSync(file).size
  const headers: Record<string, string | number> = {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end) { res.writeHead(416, { 'content-range': `bytes */${size}` }).end(); return }
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 })
    createReadStream(file, { start, end }).pipe(res)
    return
  }
  res.writeHead(200, { ...headers, 'content-length': size })
  if (req.method === 'HEAD') { res.end(); return }
  createReadStream(file).pipe(res)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname.startsWith('/api/')) return void api(req, res)
  if (url.pathname.startsWith('/game/')) {
    // the leaderboard and other game routes: forward to the game server
    const up = request({ host: '127.0.0.1', port: GAME_PORT, path: req.url, method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers)
      r.pipe(res)
    })
    up.on('error', () => res.writeHead(502).end('game server unavailable'))
    req.pipe(up)
    return
  }
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  const file = join(DIST, path)
  if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) return serveFile(file, req, res)
  // a missing file is a 404; client routes (/how, /play, ...) load the app shell
  if (extname(path)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return }
  serveFile(join(DIST, 'index.html'), req, res)
})

// WebSocket upgrades on /game go straight through to the game server as raw TCP
server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/game')) return socket.destroy()
  const up = connect(GAME_PORT, '127.0.0.1', () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`]
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`)
    up.write(lines.join('\r\n') + '\r\n\r\n')
    if (head.length) up.write(head)
    socket.pipe(up).pipe(socket)
  })
  const close = () => { socket.destroy(); up.destroy() }
  up.on('error', close)
  socket.on('error', close)
})

server.listen(port, () => console.log(`[prod] app, /api and /game on http://localhost:${port}`))
