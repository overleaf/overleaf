const fs = require('fs')
const Path = require('path')
const Settings = require('@overleaf/settings')

module.exports = function invalidateBabelCacheIfNeeded() {
  const cachePath = Path.join(__dirname, '../../node_modules/.cache')
  const statePath = Path.join(cachePath, 'last-overleafModuleImports.json')
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
    // Gracefully handle cache mount in Server Pro build, only purge nested folders and keep .cache/ folder.
    fs.mkdirSync(cachePath, { recursive: true })
    for (const name of fs.readdirSync(cachePath)) {
      fs.rmSync(Path.join(cachePath, name), {
        recursive: true,
        force: true,
        maxRetries: 5,
      })
    }
    fs.writeFileSync(statePath, newState)
  }
}
