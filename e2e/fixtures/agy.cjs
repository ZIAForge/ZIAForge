// A deterministic CLI with raw terminal input: LF inserts a newline, CR submits.
// It runs as a real child process under node-pty and never contacts a provider.
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

// Production catalog discovery checks the CLI version before invoking models.
// This metadata-only branch must also work with ordinary pipes, without a PTY.
if (process.argv.length === 3 && process.argv[2] === '--version') {
  process.stdout.write('1.2.2\n')
  process.exit(0)
}

if (process.argv.includes('models')) {
  const record = entry => fs.appendFileSync(process.env.ZIAFORGE_E2E_TRANSCRIPT, JSON.stringify({ pid: process.pid, role: 'model-discovery', ...entry }) + '\n')
  record({ event: 'model-discovery-start' })
  process.on('exit', code => record({ event: 'model-discovery-exit', code }))
  process.on('SIGTERM', () => { record({ event: 'model-discovery-signal', signal: 'SIGTERM' }); process.exit(0) })
  process.stdout.write('Fetching available models...\n')
  if (process.env.ZIAFORGE_E2E_CATALOG_HOLD === '1') setInterval(() => {}, 1000)
  else setTimeout(() => {
    process.stdout.write('gemini-3.8-flash-high\tGemini 3.8 Flash (High)\n')
    process.stdout.write('gemini-3.8-flash-medium   Gemini 3.8 Flash (Medium)\n')
  }, 2500) // Regression: the old 2000 ms timeout cannot succeed.
} else {
  if (!process.stdin.isTTY) throw new Error('Expected a real PTY')
  const modelIndex = process.argv.indexOf('--model')
  const model = modelIndex < 0 ? 'auto' : process.argv[modelIndex + 1]
  process.stdin.setRawMode(true)
  process.stdin.setEncoding('utf8')
  process.stdin.resume()
  let input = ''
  let question = false
  let responseTimer
  let server
  const record = entry => fs.appendFileSync(process.env.ZIAFORGE_E2E_TRANSCRIPT, JSON.stringify({ model, pid: process.pid, ...entry }) + '\n')
  const ready = () => process.stdout.write('\r\n> ? for shortcuts')
  record({ event: 'start' })

  if (process.env.ZIAFORGE_E2E_STARTUP_REPLAY === '1') {
    // Replay sanitized bytes captured from agy 1.2.1, including authentication
    // spinner frames, cursor movement and late model/account footer updates.
    const chunks = require('./agy-startup.json')
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
    void (async () => {
      await pause(500)
      for (const [index, chunk] of chunks.entries()) {
        process.stdout.write(chunk)
        if (index === 1) record({ event: 'authenticating' })
        await pause(index < 31 ? 80 : 250)
      }
      record({ event: 'ready' })
      await pause(1500)
      // A legitimate split redraw briefly has no footer. It is not a turn.
      process.stdout.write('\x1b[H\x1b[JAntigravity CLI 1.2.1\r\nGemini 3.8 Flash (High)\r\n')
      record({ event: 'idle-redraw' })
      await pause(1500)
      process.stdout.write('────────────────────────────\r\n>\r\n────────────────────────────\r\n? for shortcuts\r\nGemini 3.8 Flash · high')
      process.stdout.write('\x1b[?2026$p\x1b[=1;1u\x1b[?u')
      record({ event: 'idle-stable' })
    })()
  } else {
    // Delay readiness to allow the renderer to enqueue a second message.
    setTimeout(() => {
      process.stdout.write('Welcome to Antigravity CLI\r\nGemini 3.8 Flash · high\r\nType your message')
      ready()
    }, 1500)
  }

  process.stdin.on('data', data => {
    for (const char of data) {
      if (char === '\u0004') process.exit(0)
      if (char === '\u0003') {
        clearTimeout(responseTimer)
        input = ''
        question = false
        record({ event: 'interrupt' })
        process.stdout.write('\r\nGeneration cancelled')
        ready()
        continue
      }
      if (char !== '\r') {
        input += char
        continue
      }
      const message = input
      input = ''
      record({ message })
      process.stdout.write('\r\x1b[2K> ' + message + '\r\n')
      process.stdout.write('⣾ Generating... (esc to cancel)\r\n')
      if (question === 'task' && message === '1') {
        question = false
        process.stdout.write('● [12:00:00] Write index.html running\r\n')
        responseTimer = setTimeout(() => {
          const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Mock авторизация</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<body class="bg-dark text-light"><main class="container py-5"><h1>Авторизация</h1><form class="card p-4">
<label>Email<input class="form-control" type="email" value="demo@example.test"></label>
<label>Пароль<input class="form-control" type="password" value="demo-password"></label>
<button class="btn btn-primary mt-3" type="submit">Войти</button><p id="result"></p></form></main>
<script>document.querySelector('form').onsubmit = e => { e.preventDefault(); document.querySelector('#result').textContent = 'Демо: вход выполнен'; }</script></body></html>`
          fs.writeFileSync(path.join(process.cwd(), 'index.html'), html)
          server = http.createServer((_request, response) => {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            response.end(html)
          })
          server.listen(0, '127.0.0.1', () => {
            const url = `http://127.0.0.1:${server.address().port}`
            record({ event: 'preview', url })
            process.stdout.write(`Mock авторизация готова. Bootstrap CDN подключён. Preview: ${url}\r\n`)
            ready()
          })
        }, 1200)
      } else if (question) {
        question = false
        process.stdout.write('\r\nConfirmed choice: ' + message + '\r\n')
        ready()
      } else if (message === 'ask-options') {
        question = true
        process.stdout.write('\r\nChoose an action:\r\n1) Continue\r\n[2] Cancel\r\n(3) Explain\r\n')
      } else if (message === 'ask-yes-no') {
        question = true
        process.stdout.write('\r\nProceed? (y/N)\r\n')
      } else if (message.startsWith('Удали страничку index')) {
        question = 'task'
        process.stdout.write('\r\nChoose an action:\r\n1) Создать mock авторизацию и запустить сервер\r\n2) Отмена\r\n')
      } else if (message === 'long-generation') {
        process.stdout.write('\r\nWorking on a long response...\r\n')
        responseTimer = setTimeout(() => {
          process.stdout.write('\r\nLong response completed\r\n')
          ready()
        }, 30_000)
      } else {
        const reply = message
        responseTimer = setTimeout(() => {
          process.stdout.write('\r\nE2E response: ' + reply + '\r\n')
          ready()
        }, 600)
      }
    }
  })
}
