// Ensure variable placeholders (`__name__`) in non-en locale values match
// those in the corresponding en.json key.
//
// Apply this rule to all non-en locale JSON files.

const fs = require('node:fs')
const Path = require('node:path')

// Placeholders always available in translations (injected by the i18n layer
// or globally defined as defaults).
const GLOBALS = new Set(['__appName__'])

// Keys whose translations are allowed to omit specific base placeholders.
const IGNORE_NESTING_FOR = {
  over_x_templates_easy_getting_started: ['__templates__'],
  all_packages_and_templates: ['__templatesLink__'],
}

function extractPlaceholders(str) {
  return Array.from(str.matchAll(/__.*?__/g), m => m[0])
}

const enCache = new Map()
function loadEn(localesDir) {
  if (enCache.has(localesDir)) return enCache.get(localesDir)
  const path = Path.join(localesDir, 'en.json')
  const data = JSON.parse(fs.readFileSync(path, 'utf8'))
  enCache.set(localesDir, data)
  return data
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure variable placeholders in non-en locale values match the en.json base.',
    },
    schema: [],
    messages: {
      missing:
        'Translation for key "{{key}}" is missing placeholder(s) {{placeholders}} present in en.json.',
      extra:
        'Translation for key "{{key}}" has placeholder(s) {{placeholders}} not present in en.json.',
    },
  },
  create(context) {
    const filename = context.filename
    const localesDir = Path.dirname(filename)
    if (Path.basename(filename) === 'en.json') return {}

    let base
    try {
      base = loadEn(localesDir)
    } catch {
      return {}
    }

    return {
      Member(node) {
        if (node.value.type !== 'String') return
        const key = node.name.value
        if (!(key in base)) return // orphan key — covered by no-orphan-locale-keys

        const basePlaceholders = extractPlaceholders(base[key])
        const targetPlaceholders = extractPlaceholders(node.value.value)
        const ignored = IGNORE_NESTING_FOR[key] || []

        const missing = basePlaceholders.filter(
          p => !targetPlaceholders.includes(p) && !ignored.includes(p)
        )
        const extra = targetPlaceholders.filter(
          p => !basePlaceholders.includes(p) && !GLOBALS.has(p)
        )

        if (missing.length > 0) {
          context.report({
            node: node.value,
            messageId: 'missing',
            data: { key, placeholders: missing.join(', ') },
          })
        }
        if (extra.length > 0) {
          context.report({
            node: node.value,
            messageId: 'extra',
            data: { key, placeholders: extra.join(', ') },
          })
        }
      },
    }
  },
}
