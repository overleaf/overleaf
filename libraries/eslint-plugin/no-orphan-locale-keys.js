// Detect translation keys in non-en locale files that don't exist in
// en.json (orphans).

const fs = require('node:fs')
const Path = require('node:path')

const enCache = new Map()
function loadEnKeys(localesDir) {
  if (enCache.has(localesDir)) return enCache.get(localesDir)
  const path = Path.join(localesDir, 'en.json')
  const data = JSON.parse(fs.readFileSync(path, 'utf8'))
  const keys = new Set(Object.keys(data))
  enCache.set(localesDir, keys)
  return keys
}

module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Detect translation keys in non-en locale files that are not present in en.json.',
    },
    schema: [],
    messages: {
      orphan:
        'Translation key "{{key}}" is not present in en.json (orphan key).',
    },
  },
  create(context) {
    const filename = context.filename
    const localesDir = Path.dirname(filename)
    if (Path.basename(filename) === 'en.json') return {}

    let enKeys
    try {
      enKeys = loadEnKeys(localesDir)
    } catch {
      return {}
    }

    return {
      'Document > Object'(node) {
        const orphans = node.members.filter(m => !enKeys.has(m.name.value))
        if (orphans.length === 0) return

        const text = context.sourceCode.text
        const parsed = JSON.parse(text)
        for (const member of orphans) {
          delete parsed[member.name.value]
        }
        const sortedRemaining = Object.keys(parsed).sort()
        const cleaned = JSON.stringify(parsed, sortedRemaining, 2) + '\n'

        for (const member of orphans) {
          context.report({
            node: member,
            messageId: 'orphan',
            data: { key: member.name.value },
            fix(fixer) {
              return fixer.replaceTextRange([0, text.length], cleaned)
            },
          })
        }
      },
    }
  },
}
