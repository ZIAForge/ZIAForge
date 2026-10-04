#!/usr/bin/env node
// Dependency-free, loopback-only public website preview, including byte-range video seeking.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const root = path.resolve(__dirname, '../..')
const args = process.argv.slice(2)
const portIndex = args.indexOf('--port')
const port = portIndex < 0 ? 4173 : Number(args[portIndex + 1])
if (!Number.isInteger(port) || port < 1024 || port > 65535 || args.some((arg, i) => i !== portIndex && i !== portIndex + 1)) throw new Error('Usage: node scripts/website/serve.cjs [--port 4173]')
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.vtt': 'text/vtt; charset=utf-8' }
const publicRoots = ['website', 'docs', 'src', 'shared', 'electron', 'scripts', 'conductor', 'public', 'build', '.github']
const rootFiles = new Set(['README.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'package.json', 'package-lock.json', 'AGENTS.md'])
const server = http.createServer((request, response) => {
  const fail = (status, message) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end(message) }
  if (!['GET', 'HEAD'].includes(request.method)) return fail(405, 'Method not allowed')
  let urlPath
  try { urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname) } catch { return fail(400, 'Invalid path') }
  if (urlPath.includes('\\')) return fail(404, 'Not found')
  if (urlPath === '/') { response.writeHead(302, { Location: '/website/index.html' }); return response.end() }
  const relative = urlPath.replace(/^\/+/, '')
  const parts = relative.split('/')
  if (parts.some(part => part === '..' || part === '.' || (part.startsWith('.') && part !== '.github')) || (!publicRoots.includes(parts[0]) && !rootFiles.has(relative))) return fail(404, 'Not found')
  const file = path.resolve(root, relative)
  if (!file.startsWith(root + path.sep)) return fail(404, 'Not found')
  let stat
  try { stat = fs.lstatSync(file); if (!stat.isFile() || fs.realpathSync(file) !== file) return fail(404, 'Not found') } catch { return fail(404, 'Not found') }
  const headers = { 'Content-Type': types[path.extname(file)] || 'text/plain; charset=utf-8', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }
  let start = 0, end = stat.size - 1, status = 200
  if (request.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range)
    if (!match || (!match[1] && !match[2])) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return response.end() }
    if (!match[1]) start = Math.max(0, stat.size - Number(match[2]))
    else start = Number(match[1])
    if (match[2] && match[1]) end = Math.min(end, Number(match[2]))
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return response.end() }
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
  }
  headers['Content-Length'] = stat.size === 0 ? 0 : end - start + 1
  response.writeHead(status, headers)
  if (request.method === 'HEAD' || stat.size === 0) return response.end()
  const stream = fs.createReadStream(file, { start, end }); stream.on('error', () => response.destroy()); stream.pipe(response)
})
server.listen(port, '127.0.0.1', () => process.stdout.write(`ZIAForge Studio preview: http://127.0.0.1:${port}/website/index.html\n`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
