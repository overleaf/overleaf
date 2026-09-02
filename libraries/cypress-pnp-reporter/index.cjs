'use strict'

/**
 * cypress-multi-reporters, loadable from inside Cypress.
 *
 * Cypress builds mocha reporters in its Electron process. That process resolves
 * modules through PackherdModuleLoader and does not inherit NODE_OPTIONS, so
 * Yarn PnP is not installed there and `require('cypress-multi-reporters')`
 * fails with "Cannot find module".
 *
 * Installing PnP for the rest of that process is not an option either: Cypress
 * asks packherd for its own bundled modules under ids like
 * `packages/server/lib/browsers/`, which PnP reads as paths inside this
 * workspace and then rejects ("it isn't declared in your dependencies"),
 * breaking the browser launch.
 *
 * So install PnP, pull the reporters in through it, and hand resolution back to
 * Cypress. Requires made by the modules that came in through PnP keep going
 * through PnP, so anything they load later still resolves.
 *
 * Point Cypress at this package rather than at cypress-multi-reporters:
 *
 *   reporter: require.resolve('@overleaf/cypress-pnp-reporter')
 */

const Module = require('node:module')
const path = require('node:path')

function loadReporters() {
  const MultiReporters = require('cypress-multi-reporters')

  // MultiReporters resolves the reporters named in reporterEnabled when a run
  // starts, long after PnP is gone. It reads mocha's own registry before
  // falling back to require(), so register mocha-junit-reporter there while it
  // can still be found.
  require('mocha').reporters[
    'mocha-junit-reporter'
  ] = require('mocha-junit-reporter')

  return MultiReporters
}

if (process.versions.pnp) {
  module.exports = loadReporters()
} else {
  const stockLoad = Module._load
  const stockResolveFilename = Module._resolveFilename
  const stockFindPath = Module._findPath

  require(path.join(__dirname, '..', '..', '.pnp.cjs')).setup()

  const pnpResolveFilename = Module._resolveFilename
  const cachedBefore = new Set(Object.keys(Module._cache))
  const loadedViaPnp = new Set()

  try {
    module.exports = loadReporters()
  } finally {
    for (const filename of Object.keys(Module._cache)) {
      if (!cachedBefore.has(filename)) loadedViaPnp.add(filename)
    }

    // Leave the patched fs in place: the reporters live in zip archives, so
    // anything they read lazily still has to go through it.
    Module._load = stockLoad
    Module._findPath = stockFindPath
    Module._resolveFilename = function (request, parent, ...args) {
      if (!parent || !loadedViaPnp.has(parent.filename)) {
        return stockResolveFilename.call(this, request, parent, ...args)
      }
      const filename = pnpResolveFilename.call(this, request, parent, ...args)
      loadedViaPnp.add(filename)
      return filename
    }
  }
}
