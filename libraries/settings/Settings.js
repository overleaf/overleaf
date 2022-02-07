/* eslint-disable no-console */
const fs = require('fs')
const Path = require('path')
const { merge } = require('./merge')

const CWD = process.cwd()
const NODE_ENV = (process.env.NODE_ENV || 'development').toLowerCase()
const SHARELATEX_CONFIG = process.env.SHARELATEX_CONFIG

let settings
let settingsExist = false
const defaultsPath = pathIfExists(Path.join(CWD, 'config/settings.defaults.js'))
if (defaultsPath) {
  console.log(`Using default settings from ${defaultsPath}`)
  settings = require(defaultsPath)
  settingsExist = true
} else {
  settings = {}
}

const overridesPath =
  pathIfExists(SHARELATEX_CONFIG) ||
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
