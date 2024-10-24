import fs from 'fs'
import Path from 'path'
import { fileURLToPath } from 'node:url'
import { loadLocale } from './utils.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const GLOBALS = ['__appName__']
const LOCALES = Path.join(__dirname, '../../locales')
const baseLocale = loadLocale('en')
const baseLocaleKeys = Object.keys(baseLocale)

const IGNORE_ORPHANED_TRANSLATIONS = process.argv.includes(
  '--ignore-orphaned-translations'
)

const IGNORE_NESTING_FOR = {
  over_x_templates_easy_getting_started: ['__templates__'],
  all_packages_and_templates: ['__templatesLink__'],
}

function fetchKeys(str) {
  const matches = str.matchAll(/__.*?__/g)
  if (matches.length === 0) {
    return []
  }
  return Array.from(matches).map(match => match[0])
}

function difference(key, base, target) {
  const nesting = IGNORE_NESTING_FOR[key] || []
  const keysInBaseButNotInTarget = base.filter(
    key => !target.includes(key) && !nesting.includes(key)
  )
  const keysInTargetButNotInBase = target.filter(
    key => !base.includes(key) && !GLOBALS.includes(key)
  )
  return {
    keysInBaseButNotInTarget,
    keysInTargetButNotInBase,
  }
}

let violations = 0
for (const localeName of fs.readdirSync(LOCALES)) {
  if (localeName === 'README.md') continue
  const locale = loadLocale(localeName.replace('.json', ''))

  for (const key of Object.keys(locale)) {
    if (!baseLocaleKeys.includes(key)) {
      if (IGNORE_ORPHANED_TRANSLATIONS) continue
      violations += 1
      console.warn(`[${localeName}] Orphaned key "${key}" not found in en.json`)
      continue
    }

    const keysInTranslation = fetchKeys(locale[key])
    const keysInBase = fetchKeys(baseLocale[key])
    const { keysInBaseButNotInTarget, keysInTargetButNotInBase } = difference(
      key,
      keysInBase,
      keysInTranslation
    )
    if (keysInBaseButNotInTarget.length) {
      violations += keysInBaseButNotInTarget.length
      console.warn(
        `[${localeName}] Missing variables in key "${key}":`,
        keysInBaseButNotInTarget
      )
    }
    if (keysInTargetButNotInBase.length) {
      violations += keysInTargetButNotInBase.length
      console.warn(
        `[${localeName}] Extra variables in key   "${key}":`,
        keysInTargetButNotInBase
      )
    }
  }
}

if (violations) {
  console.warn('Variables are not in sync between translations.')
  process.exit(1)
} else {
  console.log('Variables are in sync.')
  process.exit(0)
}
