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
    fs.rmSync(cachePath, { recursive: true, force: true, maxRetries: 5 })
    fs.mkdirSync(cachePath)
    fs.writeFileSync(statePath, newState)
  }
}
