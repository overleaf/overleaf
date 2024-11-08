/* eslint-disable no-console */
const fs = require('node:fs')
const Path = require('node:path')
const { merge } = require('./merge')

const CWD = process.cwd()
const ENTRY_POINT_DIR = process.argv[1]
  ? Path.dirname(process.argv[1])
  : undefined
const NODE_ENV = (process.env.NODE_ENV || 'development').toLowerCase()
const SHARELATEX_CONFIG = process.env.SHARELATEX_CONFIG
const OVERLEAF_CONFIG = process.env.OVERLEAF_CONFIG || SHARELATEX_CONFIG
if (SHARELATEX_CONFIG && SHARELATEX_CONFIG !== OVERLEAF_CONFIG) {
  throw new Error(
    'found mismatching SHARELATEX_CONFIG, rename to OVERLEAF_CONFIG'
  )
}

let settings
let settingsExist = false
const defaultsPath =
  pathIfExists(Path.join(CWD, 'config/settings.defaults.cjs')) ||
  pathIfExists(Path.join(CWD, 'config/settings.defaults.js')) ||
  pathIfExists(Path.join(ENTRY_POINT_DIR, 'config/settings.defaults.cjs')) ||
  pathIfExists(Path.join(ENTRY_POINT_DIR, 'config/settings.defaults.js'))
if (defaultsPath) {
  console.log(`Using default settings from ${defaultsPath}`)
  settings = require(defaultsPath)
  settingsExist = true
} else {
  settings = {}
}

const overridesPath =
  pathIfExists(OVERLEAF_CONFIG) ||
  pathIfExists(Path.join(CWD, `config/settings.${NODE_ENV}.cjs`)) ||
  pathIfExists(Path.join(CWD, `config/settings.${NODE_ENV}.js`))
if (overridesPath) {
  console.log(`Using settings from ${overridesPath}`)
  settings = merge(require(overridesPath), settings)
  settingsExist = true
}

if (!settingsExist) {
  console.warn("No settings or defaults found. I'm flying blind.")
}

module.exports = settings

function pathIfExists(path) {
  if (path && fs.existsSync(path)) {
    return path
  }
  return null
}
