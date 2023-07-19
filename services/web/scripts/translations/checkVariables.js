// Usage: node checkVariables.js <locale>

const fs = require('fs')
const Path = require('path')

const GLOBALS = ['__appName__']
const LOCALES = Path.join(__dirname, '../../locales')
const baseLocalePath = Path.join(LOCALES, 'en.json')

if (process.argv.length < 3) {
  console.error('Usage: node checkVariables.js <locale>')
  process.exit(1)
}

const localeName = process.argv[2]
const localePath = Path.join(LOCALES, `${localeName}.json`)

const baseLocale = JSON.parse(fs.readFileSync(baseLocalePath, 'utf-8'))
const locale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))

function fetchKeys(str) {
  const matches = str.matchAll(/__.*?__/g)
  if (matches.length === 0) {
    return []
  }
  return Array.from(matches).map(match => match[0])
}

function difference(base, target) {
  const keysInBaseButNotInTarget = base.filter(key => !target.includes(key))
  const keysInTargetButNotInBase = target.filter(
    key => !base.includes(key) && !GLOBALS.includes(key)
  )
  return {
    keysInBaseButNotInTarget,
    keysInTargetButNotInBase,
  }
}

for (const key of Object.keys(locale)) {
  if (Object.prototype.hasOwnProperty.call(baseLocale, key)) {
    const keysInTranslation = fetchKeys(locale[key])
    const keysInBase = fetchKeys(baseLocale[key])
    const { keysInBaseButNotInTarget, keysInTargetButNotInBase } = difference(
      keysInBase,
      keysInTranslation
    )
    if (keysInBaseButNotInTarget.length) {
      console.warn(
        `Warning: Missing variables in key ${key}:`,
        keysInBaseButNotInTarget
      )
    }
    if (keysInTargetButNotInBase.length) {
      console.warn(
        `Warning: Extra variables in key ${key}:`,
        keysInTargetButNotInBase
      )
    }
  }
}
