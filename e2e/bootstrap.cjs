// This entry point isolates app storage before the production main module loads.
const { app } = require('electron')
const path = require('node:path')

const userData = process.env.ZIAFORGE_E2E_USER_DATA
if (process.env.ZIAFORGE_E2E !== '1' || !userData || !path.isAbsolute(userData)) {
  throw new Error('E2E requires an absolute, isolated ZIAFORGE_E2E_USER_DATA path')
}
app.setPath('userData', userData)
app.setPath('logs', path.join(userData, 'logs'))
import('../dist-electron/main.js').catch(error => {
  console.error(error)
  app.exit(1)
})
