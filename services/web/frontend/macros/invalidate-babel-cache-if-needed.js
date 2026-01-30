const fs = require('fs')
const Path = require('path')
const Settings = require('@overleaf/settings')

module.exports = function invalidateBabelCacheIfNeeded() {
  const cacheDir = Path.join(__dirname, '../../node_modules/.cache')
  const cachePath = Path.join(cacheDir, 'babel-loader')
  const statePath = Path.join(cacheDir, 'last-overleafModuleImports.json')
  let lastState = ''
  try {
    lastState = fs.readFileSync(statePath, { encoding: 'utf-8' })
  } catch (e) {}

  const newState = JSON.stringify(Settings.overleafModuleImports)
  if (lastState !== newState) {
    // eslint-disable-next-line no-console
    console.warn(
      'Detected change in overleafModuleImports, purging babel cache!'
    )
    // Gracefully handle cache mount in Server Pro build, only purge nested folder and keep .cache/ folder.
    fs.mkdirSync(cacheDir, { recursive: true })
    fs.rmSync(cachePath, {
      recursive: true,
      force: true,
      maxRetries: 5,
    })
    fs.writeFileSync(statePath, newState)
  }
}
